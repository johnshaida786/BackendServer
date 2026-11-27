const pool = require("../config/db");
const userModel = require("../models/userModel");
const { ok, fail } = require("../utils/response");

// GET /getpatients  (doctor only) - patients who have appointments with this doctor
exports.getPatients = async (req, res) => {
  const doctorId = await userModel.getDoctorId(req.user.id);
  if (!doctorId) return fail(res, 403, "Doctor profile not found.");

  const [rows] = await pool.query(
    `SELECT p.id, u.name, u.email, p.phone, p.date_of_birth, p.gender, p.blood_group, p.address,
            COUNT(a.id) AS total_appointments,
            SUM(CASE WHEN a.status = 'booked' THEN 1 ELSE 0 END) AS booked_count,
            SUM(CASE WHEN a.status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled_count,
            MAX(a.appointment_date) AS last_appointment
     FROM appointments a
     JOIN patients p ON p.id = a.patient_id
     JOIN users u ON u.id = p.user_id
     WHERE a.doctor_id = ?
     GROUP BY p.id, u.name, u.email, p.phone, p.date_of_birth, p.gender, p.blood_group, p.address
     ORDER BY u.name`,
    [doctorId]
  );

  return ok(res, "Patients fetched.", rows.map((r) => ({
    ...r,
    total_appointments: Number(r.total_appointments),
    booked_count: Number(r.booked_count),
    cancelled_count: Number(r.cancelled_count),
  })));
};
