const router = require("express").Router();
const asyncHandler = require("../utils/asyncHandler");
const { verifyToken } = require("../middleware/auth");
const doctors = require("../controllers/doctorController");

router.get("/getdoctors", verifyToken, asyncHandler(doctors.getDoctors));
router.get("/getdoctors/:id", verifyToken, asyncHandler(doctors.getDoctorById));

module.exports = router;
