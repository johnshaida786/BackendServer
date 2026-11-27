const router = require("express").Router();
const asyncHandler = require("../utils/asyncHandler");
const { verifyToken, requireRole } = require("../middleware/auth");
const appt = require("../controllers/appointmentController");

router.get("/getappointments", verifyToken, asyncHandler(appt.getAppointments));
router.get("/getappointments/:id", verifyToken, asyncHandler(appt.getAppointmentById));
router.post("/bookappointment", verifyToken, requireRole("patient"), asyncHandler(appt.bookAppointment));
router.post("/cancelappointment", verifyToken, requireRole("patient"), asyncHandler(appt.cancelAppointment));
router.post("/completeappointment", verifyToken, requireRole("doctor"), asyncHandler(appt.completeAppointment));

module.exports = router;
