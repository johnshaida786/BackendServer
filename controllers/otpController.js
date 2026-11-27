const userModel = require("../models/userModel");
const { issueOtp, verifyOtp } = require("../utils/otp");
const { ok, fail } = require("../utils/response");
const v = require("../utils/validators");

const PURPOSES = ["register", "login"];

// POST /sendotp   body: { email, purpose }
exports.sendOtp = async (req, res) => {
  const { email, purpose } = req.body || {};
  if (!v.isEmail(email)) return fail(res, 400, "Please enter a valid email address.");
  if (!PURPOSES.includes(purpose)) return fail(res, 400, "Purpose must be 'register' or 'login'.");

  const cleanEmail = v.normalizeEmail(email);
  const existing = await userModel.findByEmail(cleanEmail);

  if (purpose === "register" && existing) return fail(res, 409, "This email is already registered. Please log in.");

  // For login we do not reveal whether the email exists.
  if (purpose === "login" && !existing) return ok(res, "If this email is registered, an OTP has been sent.");

  let result;
  try {
    result = await issueOtp(cleanEmail, purpose);
  } catch (err) {
    console.error("OTP email error:", err.message);
    return fail(res, 502, "We could not send the OTP email. Please try again later.");
  }
  if (!result.ok) return fail(res, result.status, result.message);

  return ok(
    res,
    purpose === "login" ? "If this email is registered, an OTP has been sent." : "OTP sent to your email."
  );
};

// POST /verifyotp   body: { email, purpose, otp }  (checks only; the OTP stays usable)
exports.verifyOtpCheck = async (req, res) => {
  const { email, purpose, otp } = req.body || {};
  if (!v.isEmail(email) || !PURPOSES.includes(purpose) || !v.isOtp(otp))
    return fail(res, 400, "Email, purpose and a 6-digit OTP are required.");

  const result = await verifyOtp(v.normalizeEmail(email), purpose, otp.trim(), { consume: false });
  if (!result.ok) return fail(res, 400, result.message);
  return ok(res, "OTP is correct.");
};
