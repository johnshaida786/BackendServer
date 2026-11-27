const pool = require("../config/db");

exports.findByEmail = async (email) => {
  const [rows] = await pool.query(
    "SELECT id, name, email, password_hash, role FROM users WHERE email = ?",
    [email]
  );
  return rows[0] || null;
};

exports.findById = async (id) => {
  const [rows] = await pool.query("SELECT id, name, email, role FROM users WHERE id = ?", [id]);
  return rows[0] || null;
};

exports.getPatientId = async (userId) => {
  const [rows] = await pool.query("SELECT id FROM patients WHERE user_id = ?", [userId]);
  return rows[0] ? rows[0].id : null;
};

exports.getDoctorId = async (userId) => {
  const [rows] = await pool.query("SELECT id FROM doctors WHERE user_id = ?", [userId]);
  return rows[0] ? rows[0].id : null;
};

// Runs fn(connection) inside one transaction: all queries succeed or none do.
async function withTransaction(fn) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback().catch(() => {});
    throw err;
  } finally {
    conn.release();
  }
}
exports.withTransaction = withTransaction;

exports.createPatientAccount = ({ name, email, passwordHash, phone, dateOfBirth, gender }) =>
  withTransaction(async (conn) => {
    const [user] = await conn.query(
      `INSERT INTO users (name, email, password_hash, role, is_email_verified)
       VALUES (?, ?, ?, 'patient', TRUE)`,
      [name, email, passwordHash]
    );
    await conn.query(
      "INSERT INTO patients (user_id, phone, date_of_birth, gender) VALUES (?, ?, ?, ?)",
      [user.insertId, phone, dateOfBirth, gender]
    );
    return user.insertId;
  });

exports.createDoctorAccount = (d) =>
  withTransaction(async (conn) => {
    const [user] = await conn.query(
      `INSERT INTO users (name, email, password_hash, role, is_email_verified)
       VALUES (?, ?, ?, 'doctor', TRUE)`,
      [d.name, d.email, d.passwordHash]
    );
    await conn.query(
      `INSERT INTO doctors (user_id, specialization, qualification, experience_years, phone, consultation_fee, bio)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [user.insertId, d.specialization, d.qualification, d.experienceYears, d.phone, d.consultationFee, d.bio]
    );
    return user.insertId;
  });
