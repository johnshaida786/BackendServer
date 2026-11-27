const router = require("express").Router();
const asyncHandler = require("../utils/asyncHandler");
const { verifyToken, requireRole } = require("../middleware/auth");
const patients = require("../controllers/patientController");

router.get("/getpatients", verifyToken, requireRole("doctor"), asyncHandler(patients.getPatients));

module.exports = router;
