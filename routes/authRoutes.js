const router = require("express").Router();
const asyncHandler = require("../utils/asyncHandler");
const { verifyToken } = require("../middleware/auth");
const auth = require("../controllers/authController");
const otp = require("../controllers/otpController");
const profile = require("../controllers/profileController");

router.post("/sendotp", asyncHandler(otp.sendOtp));
router.post("/verifyotp", asyncHandler(otp.verifyOtpCheck));
router.post("/registerpatient", asyncHandler(auth.registerPatient));
router.post("/registerdoctor", asyncHandler(auth.registerDoctor));
router.post("/login", asyncHandler(auth.login));
router.post("/loginotp", asyncHandler(auth.loginWithOtp));
router.post("/logout", auth.logout);
router.get("/session", verifyToken, asyncHandler(auth.session));
router.get("/profile", verifyToken, asyncHandler(profile.getProfile));
router.put("/profile", verifyToken, asyncHandler(profile.updateProfile));

module.exports = router;
