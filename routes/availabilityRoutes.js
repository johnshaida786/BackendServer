const router = require("express").Router();
const asyncHandler = require("../utils/asyncHandler");
const { verifyToken, requireRole } = require("../middleware/auth");
const a = require("../controllers/availabilityController");

router.get("/getavailability/:doctorId", verifyToken, asyncHandler(a.getAvailability));
router.post("/addavailability", verifyToken, requireRole("doctor"), asyncHandler(a.addAvailability));
router.put("/updateavailability/:id", verifyToken, requireRole("doctor"), asyncHandler(a.updateAvailability));
router.delete("/deleteavailability/:id", verifyToken, requireRole("doctor"), asyncHandler(a.deleteAvailability));

module.exports = router;
