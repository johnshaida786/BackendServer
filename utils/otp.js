const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const otpModel = require("../models/otpModel");
const { sendOtpEmail } = require("./mailer");

const EXPIRY_MINUTES = Number(process.env.OTP_EXPIRY_MINUTES) || 5;
const MAX_ATTEMPTS = 5;
const MAX_REQUESTS_PER_HOUR = 5;

// Creates a 6-digit OTP, stores only its hash, and emails the plain code.
async function issueOtp(email, purpose) {
  const recent = await otpModel.countRecent(email, purpose);
  if (recent >= MAX_REQUESTS_PER_HOUR) {
    return { ok: false, status: 429, message: "Too many OTP requests. Please try again in an hour." };
  }

  const otp = String(crypto.randomInt(0, 1000000)).padStart(6, "0");
  const otpHash = await bcrypt.hash(otp, 10);

  await otpModel.invalidateOld(email, purpose);
  await otpModel.create(email, purpose, otpHash, EXPIRY_MINUTES);
  await sendOtpEmail(email, otp, purpose);
  return { ok: true };
}

// consume = true  -> a correct OTP is burned (can't be used again)
// consume = false -> only checks (used by /verifyotp)
async function verifyOtp(email, purpose, otp, { consume = true } = {}) {
  const row = await otpModel.getLatestValid(email, purpose);
  if (!row) return { ok: false, message: "OTP is invalid or has expired. Please request a new one." };

  if (row.attempts >= MAX_ATTEMPTS) {
    await otpModel.markUsed(row.id);
    return { ok: false, message: "Too many wrong attempts. Please request a new OTP." };
  }

  const match = await bcrypt.compare(otp, row.otp_hash);
  if (!match) {
    await otpModel.incrementAttempts(row.id);
    return { ok: false, message: "Incorrect OTP." };
  }

  if (consume) {
    const burned = await otpModel.markUsed(row.id);
    if (!burned) return { ok: false, message: "This OTP has already been used." };
  }
  return { ok: true };
}

module.exports = { issueOtp, verifyOtp };
