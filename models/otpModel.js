const pool = require("../config/db");

// How many OTPs were requested in the last hour (rate limiting)
exports.countRecent = async (email, purpose) => {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS total FROM otp_verifications
     WHERE email = ? AND purpose = ? AND created_at > (NOW() - INTERVAL 1 HOUR)`,
    [email, purpose]
  );
  return Number(rows[0].total);
};

// Old unused OTPs stop working when a new one is requested
exports.invalidateOld = (email, purpose) =>
  pool.query(
    `UPDATE otp_verifications SET is_used = TRUE
     WHERE email = ? AND purpose = ? AND is_used = FALSE`,
    [email, purpose]
  );

exports.create = (email, purpose, otpHash, expiryMinutes) =>
  pool.query(
    `INSERT INTO otp_verifications (email, purpose, otp_hash, expires_at)
     VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL ? MINUTE))`,
    [email, purpose, otpHash, Number(expiryMinutes)]
  );

exports.getLatestValid = async (email, purpose) => {
  const [rows] = await pool.query(
    `SELECT id, otp_hash, attempts FROM otp_verifications
     WHERE email = ? AND purpose = ? AND is_used = FALSE AND expires_at > NOW()
     ORDER BY id DESC LIMIT 1`,
    [email, purpose]
  );
  return rows[0] || null;
};

exports.incrementAttempts = (id) =>
  pool.query("UPDATE otp_verifications SET attempts = attempts + 1 WHERE id = ?", [id]);

// Returns true only for the request that actually burned the OTP
exports.markUsed = async (id) => {
  const [result] = await pool.query(
    "UPDATE otp_verifications SET is_used = TRUE WHERE id = ? AND is_used = FALSE",
    [id]
  );
  return result.affectedRows === 1;
};

exports.cleanup = () =>
  pool.query("DELETE FROM otp_verifications WHERE expires_at < (NOW() - INTERVAL 1 DAY)");
