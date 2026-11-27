const pool = require("../config/db");
const userModel = require("../models/userModel");
const { ok, fail } = require("../utils/response");
const { isPastSlot } = require("../utils/time");
const v = require("../utils/validators");

const SELECT_APPOINTMENTS = `
  SELECT a.id, a.appointment_date, a.appointment_time, a.reason, a.status,
         a.cancelled_at, a.created_at,
         a.doctor_id, du.name AS doctor_name, d.specialization, d.consultation_fee,
         a.patient_id, pu.name AS patient_name, pu.email AS patient_email,
         p.phone AS patient_phone, p.date_of_birth AS patient_dob,
         p.gender AS patient_gender, p.blood_group AS patient_blood_group
  FROM appointments a
  JOIN doctors d ON d.id = a.doctor_id
  JOIN users du ON du.id = d.user_id
  JOIN patients p ON p.id = a.patient_id
  JOIN users pu ON pu.id = p.user_id`;

// GET /getappointments?status=booked
//  patient -> only their own, doctor -> only those assigned to them
exports.getAppointments = async (req, res) => {
  const isPatient = req.user.role === "patient";
  const ownerId = isPatient
    ? await userModel.getPatientId(req.user.id)
    : await userModel.getDoctorId(req.user.id);
  if (!ownerId) return fail(res, 403, "Profile not found for this account.");

  let sql = `${SELECT_APPOINTMENTS} WHERE ${isPatient ? "a.patient_id" : "a.doctor_id"} = ?`;
  const params = [ownerId];

  if (req.query.status) {
    if (!["booked", "cancelled", "completed"].includes(req.query.status))
      return fail(res, 400, "Status must be booked, cancelled or completed.");
    sql += " AND a.status = ?";
    params.push(req.query.status);
  }
  sql += " ORDER BY a.appointment_date DESC, a.appointment_time DESC";

  const [rows] = await pool.query(sql, params);
  return ok(res, "Appointments fetched.", rows);
};

// GET /getappointments/:id  (only if it belongs to the logged-in user)
exports.getAppointmentById = async (req, res) => {
  if (!v.isPositiveInt(req.params.id)) return fail(res, 400, "Invalid appointment id.");
  const isPatient = req.user.role === "patient";
  const ownerId = isPatient
    ? await userModel.getPatientId(req.user.id)
    : await userModel.getDoctorId(req.user.id);

  const [rows] = await pool.query(
    `${SELECT_APPOINTMENTS} WHERE a.id = ? AND ${isPatient ? "a.patient_id" : "a.doctor_id"} = ?`,
    [req.params.id, ownerId]
  );
  if (!rows.length) return fail(res, 404, "Appointment not found.");
  return ok(res, "Appointment fetched.", rows[0]);
};

// POST /bookappointment  (patient)  body: { availability_id, reason? }
exports.bookAppointment = async (req, res) => {
  const { availability_id, reason } = req.body || {};
  if (!v.isPositiveInt(availability_id)) return fail(res, 400, "A valid availability_id is required.");
  const cleanReason = v.nullIfEmpty(reason);
  if (cleanReason && cleanReason.length > 255) return fail(res, 400, "Reason must be 255 characters or fewer.");

  const patientId = await userModel.getPatientId(req.user.id);
  if (!patientId) return fail(res, 403, "Patient profile not found.");

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // FOR UPDATE locks this slot row. A second patient clicking at the same moment
    // must wait here, then finds is_booked = TRUE and gets a 409.
    const [slots] = await conn.query(
      `SELECT id, doctor_id, available_date, start_time
       FROM appointment_availability WHERE id = ? AND is_booked = FALSE FOR UPDATE`,
      [availability_id]
    );
    if (!slots.length) {
      await conn.rollback();
      return fail(res, 409, "Sorry, this slot is no longer available.");
    }
    const slot = slots[0];
    if (isPastSlot(slot.available_date, slot.start_time)) {
      await conn.rollback();
      return fail(res, 400, "This slot is in the past.");
    }

    const [result] = await conn.query(
      `INSERT INTO appointments
       (patient_id, doctor_id, availability_id, appointment_date, appointment_time, reason)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [patientId, slot.doctor_id, slot.id, slot.available_date, slot.start_time, cleanReason]
    );
    await conn.query("UPDATE appointment_availability SET is_booked = TRUE WHERE id = ?", [slot.id]);
    await conn.commit();

    const [rows] = await pool.query(`${SELECT_APPOINTMENTS} WHERE a.id = ?`, [result.insertId]);
    return ok(res, "Appointment booked successfully.", rows[0], 201);
  } catch (err) {
    await conn.rollback().catch(() => {});
    // The UNIQUE index uq_no_double_booking is the last safety net.
    if (err.code === "ER_DUP_ENTRY") return fail(res, 409, "Sorry, this slot was just booked by someone else.");
    throw err;
  } finally {
    conn.release();
  }
};

// POST /cancelappointment  (patient)  body: { appointment_id }
exports.cancelAppointment = async (req, res) => {
  const { appointment_id } = req.body || {};
  if (!v.isPositiveInt(appointment_id)) return fail(res, 400, "A valid appointment_id is required.");

  const patientId = await userModel.getPatientId(req.user.id);
  if (!patientId) return fail(res, 403, "Patient profile not found.");

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // "patient_id = ?" means a patient can never cancel someone else's appointment.
    const [rows] = await conn.query(
      "SELECT id, availability_id FROM appointments WHERE id = ? AND patient_id = ? AND status = 'booked' FOR UPDATE",
      [appointment_id, patientId]
    );
    if (!rows.length) {
      await conn.rollback();
      return fail(res, 404, "Appointment not found or already cancelled.");
    }

    // active_slot = NULL frees the UNIQUE index so the slot can be booked again.
    await conn.query(
      "UPDATE appointments SET status = 'cancelled', active_slot = NULL, cancelled_at = NOW() WHERE id = ?",
      [rows[0].id]
    );
    await conn.query("UPDATE appointment_availability SET is_booked = FALSE WHERE id = ?", [rows[0].availability_id]);
    await conn.commit();
    return ok(res, "Appointment cancelled. The slot is available again.");
  } catch (err) {
    await conn.rollback().catch(() => {});
    throw err;
  } finally {
    conn.release();
  }
};

// POST /completeappointment  (doctor)  body: { appointment_id }
exports.completeAppointment = async (req, res) => {
  const { appointment_id } = req.body || {};
  if (!v.isPositiveInt(appointment_id)) return fail(res, 400, "A valid appointment_id is required.");

  const doctorId = await userModel.getDoctorId(req.user.id);
  if (!doctorId) return fail(res, 403, "Doctor profile not found.");

  // "doctor_id = ?" means a doctor can only complete their own appointments.
  const [result] = await pool.query(
    "UPDATE appointments SET status = 'completed' WHERE id = ? AND doctor_id = ? AND status = 'booked'",
    [appointment_id, doctorId]
  );
  if (result.affectedRows === 0) return fail(res, 404, "Appointment not found or not in booked status.");
  return ok(res, "Appointment marked as completed.");
};
