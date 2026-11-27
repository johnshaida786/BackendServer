const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const userModel = require("../models/userModel");
const { verifyOtp } = require("../utils/otp");
const { ok, fail } = require("../utils/response");
const v = require("../utils/validators");

const signToken = (user) =>
  jwt.sign({ id: user.id, role: user.role, email: user.email }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "1d",
  });

const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email, role: u.role });

// Checks the fields shared by both registration forms. Returns an error message or null.
function validateCommon(b) {
  const name = v.clean(b.name);
  if (name.length < 2 || name.length > 100) return "Name must be 2 to 100 characters.";
  if (!v.isEmail(b.email)) return "Please enter a valid email address.";
  if (!v.isStrongPassword(b.password))
    return "Password must be 8-72 characters and include at least one letter and one number.";
  if (!v.isOtp(b.otp)) return "Please enter the 6-digit OTP sent to your email.";
  if (b.phone && !v.isPhone(b.phone)) return "Please enter a valid phone number.";
  return null;
}

// POST /registerpatient
exports.registerPatient = async (req, res) => {
  const b = req.body || {};
  const error = validateCommon(b);
  if (error) return fail(res, 400, error);
  if (b.date_of_birth) {
    if (!v.isValidDate(b.date_of_birth) || b.date_of_birth > new Date().toISOString().slice(0, 10))
      return fail(res, 400, "Date of birth must be a valid date that is not in the future.");
  }
  if (b.gender && !["male", "female", "other"].includes(b.gender))
    return fail(res, 400, "Gender must be male, female or other.");

  const email = v.normalizeEmail(b.email);
  if (await userModel.findByEmail(email)) return fail(res, 409, "This email is already registered.");

  const otpResult = await verifyOtp(email, "register", b.otp.trim());
  if (!otpResult.ok) return fail(res, 400, otpResult.message);

  try {
    const userId = await userModel.createPatientAccount({
      name: v.clean(b.name),
      email,
      passwordHash: await bcrypt.hash(b.password, 10),
      phone: v.nullIfEmpty(b.phone),
      dateOfBirth: v.nullIfEmpty(b.date_of_birth),
      gender: v.nullIfEmpty(b.gender),
    });
    return ok(res, "Patient registered successfully. You can now log in.", { id: userId }, 201);
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") return fail(res, 409, "This email is already registered.");
    throw err;
  }
};

// POST /registerdoctor
exports.registerDoctor = async (req, res) => {
  const b = req.body || {};
  const error = validateCommon(b);
  if (error) return fail(res, 400, error);

  const specialization = v.clean(b.specialization);
  if (!specialization || specialization.length > 100) return fail(res, 400, "Specialization is required.");
  const years = b.experience_years === undefined || b.experience_years === "" ? 0 : Number(b.experience_years);
  if (!Number.isInteger(years) || years < 0 || years > 70)
    return fail(res, 400, "Experience must be a whole number between 0 and 70.");
  const fee = b.consultation_fee === undefined || b.consultation_fee === "" ? 0 : Number(b.consultation_fee);
  if (Number.isNaN(fee) || fee < 0 || fee > 1000000) return fail(res, 400, "Consultation fee is not valid.");

  const email = v.normalizeEmail(b.email);
  if (await userModel.findByEmail(email)) return fail(res, 409, "This email is already registered.");

  const otpResult = await verifyOtp(email, "register", b.otp.trim());
  if (!otpResult.ok) return fail(res, 400, otpResult.message);

  try {
    const userId = await userModel.createDoctorAccount({
      name: v.clean(b.name),
      email,
      passwordHash: await bcrypt.hash(b.password, 10),
      specialization,
      qualification: v.nullIfEmpty(b.qualification),
      experienceYears: years,
      phone: v.nullIfEmpty(b.phone),
      consultationFee: fee,
      bio: v.nullIfEmpty(b.bio),
    });
    return ok(res, "Doctor registered successfully. You can now log in.", { id: userId }, 201);
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") return fail(res, 409, "This email is already registered.");
    throw err;
  }
};

// POST /login  (email + password)
exports.login = async (req, res) => {
  const { email, password } = req.body || {};
  if (!v.isEmail(email) || typeof password !== "string" || !password)
    return fail(res, 400, "Email and password are required.");

  const user = await userModel.findByEmail(v.normalizeEmail(email));
  // Same message for "no such user" and "wrong password" so attackers can't find valid emails.
  const valid = user && (await bcrypt.compare(password, user.password_hash));
  if (!valid) return fail(res, 401, "Invalid email or password.");

  return ok(res, "Login successful.", { token: signToken(user), user: publicUser(user) });
};

// POST /loginotp  (email + OTP)
exports.loginWithOtp = async (req, res) => {
  const { email, otp } = req.body || {};
  if (!v.isEmail(email) || !v.isOtp(otp)) return fail(res, 400, "A valid email and 6-digit OTP are required.");

  const cleanEmail = v.normalizeEmail(email);
  const user = await userModel.findByEmail(cleanEmail);
  const otpResult = user ? await verifyOtp(cleanEmail, "login", otp.trim()) : { ok: false };
  if (!user || !otpResult.ok) return fail(res, 401, "Invalid or expired OTP.");

  return ok(res, "Login successful.", { token: signToken(user), user: publicUser(user) });
};

// POST /logout
// JWTs are stateless, so the real "logout" is the browser deleting the token.
exports.logout = (req, res) => ok(res, "Logged out successfully.");

// GET /session  (needs a valid token)
exports.session = async (req, res) => {
  const user = await userModel.findById(req.user.id);
  if (!user) return fail(res, 401, "Account no longer exists.", "TOKEN_INVALID");
  return ok(res, "Session is active.", { user: publicUser(user) });
};
