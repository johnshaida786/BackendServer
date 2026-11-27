const pool = require("../config/db");
const userModel = require("../models/userModel");
const { ok, fail } = require("../utils/response");
const { nowLocal, isPastSlot, toMinutes, fromMinutes } = require("../utils/time");
const v = require("../utils/validators");

// Does this doctor already have a slot that overlaps [start, end) on that date?
async function hasOverlap(conn, doctorId, date, start, end, ignoreId = null) {
  let sql = `SELECT id FROM appointment_availability
             WHERE doctor_id = ? AND available_date = ? AND start_time < ? AND end_time > ?`;
  const params = [doctorId, date, end, start];
  if (ignoreId) {
    sql += " AND id <> ?";
    params.push(ignoreId);
  }
  const [rows] = await conn.query(`${sql} LIMIT 1`, params);
  return rows.length > 0;
}

// GET /getavailability/:doctorId
//  patient -> only future, unbooked slots of that doctor
//  doctor  -> all future slots, but only their own
exports.getAvailability = async (req, res) => {
  if (!v.isPositiveInt(req.params.doctorId)) return fail(res, 400, "Invalid doctor id.");
  const doctorId = Number(req.params.doctorId);
  const now = nowLocal();

  if (req.user.role === "doctor") {
    const myId = await userModel.getDoctorId(req.user.id);
    if (myId !== doctorId) return fail(res, 403, "You can only view your own availability.", "FORBIDDEN");
  } else {
    const [d] = await pool.query("SELECT id FROM doctors WHERE id = ?", [doctorId]);
    if (!d.length) return fail(res, 404, "Doctor not found.");
  }

  let sql = `SELECT id, doctor_id, available_date, start_time, end_time, is_booked
             FROM appointment_availability
             WHERE doctor_id = ? AND (available_date > ? OR (available_date = ? AND start_time > ?))`;
  if (req.user.role === "patient") sql += " AND is_booked = FALSE";
  sql += " ORDER BY available_date, start_time";

  const [rows] = await pool.query(sql, [doctorId, now.date, now.date, now.time]);
  return ok(res, "Availability fetched.", rows.map((r) => ({ ...r, is_booked: Boolean(r.is_booked) })));
};

// POST /addavailability  (doctor)
// body: { date, start_time, end_time, slot_minutes? }
// Without slot_minutes: one slot from start_time to end_time.
// With slot_minutes: the range is split into equal slots (e.g. 09:00-12:00, 30 -> 6 slots).
exports.addAvailability = async (req, res) => {
  const b = req.body || {};
  if (!v.isValidDate(b.date)) return fail(res, 400, "Date must be in YYYY-MM-DD format.");
  if (!v.isValidTime(b.start_time) || !v.isValidTime(b.end_time))
    return fail(res, 400, "Start and end time must be in HH:MM format.");

  const start = v.normalizeTime(b.start_time);
  const end = v.normalizeTime(b.end_time);
  if (toMinutes(start) >= toMinutes(end)) return fail(res, 400, "End time must be after start time.");
  if (isPastSlot(b.date, start)) return fail(res, 400, "You cannot add availability in the past.");

  let slots = [[start, end]];
  if (b.slot_minutes !== undefined && b.slot_minutes !== "") {
    const step = Number(b.slot_minutes);
    if (!Number.isInteger(step) || step < 10 || step > 240)
      return fail(res, 400, "Slot length must be a whole number between 10 and 240 minutes.");
    slots = [];
    for (let t = toMinutes(start); t + step <= toMinutes(end); t += step) {
      slots.push([fromMinutes(t), fromMinutes(t + step)]);
    }
    if (slots.length === 0) return fail(res, 400, "The time range is shorter than one slot.");
    if (slots.length > 48) return fail(res, 400, "You can create at most 48 slots at a time.");
  }

  const doctorId = await userModel.getDoctorId(req.user.id);
  if (!doctorId) return fail(res, 403, "Doctor profile not found.");

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    if (await hasOverlap(conn, doctorId, b.date, start, end)) {
      await conn.rollback();
      return fail(res, 409, "This time overlaps with a slot you already created.");
    }
    await conn.query(
      "INSERT INTO appointment_availability (doctor_id, available_date, start_time, end_time) VALUES ?",
      [slots.map(([s, e]) => [doctorId, b.date, s, e])]
    );
    await conn.commit();
    return ok(res, `${slots.length} slot(s) added.`, { created: slots.length }, 201);
  } catch (err) {
    await conn.rollback().catch(() => {});
    if (err.code === "ER_DUP_ENTRY") return fail(res, 409, "One of these slots already exists.");
    throw err;
  } finally {
    conn.release();
  }
};

// PUT /updateavailability/:id  (doctor) body: { start_time, end_time }
exports.updateAvailability = async (req, res) => {
  if (!v.isPositiveInt(req.params.id)) return fail(res, 400, "Invalid slot id.");
  const b = req.body || {};
  if (!v.isValidTime(b.start_time) || !v.isValidTime(b.end_time))
    return fail(res, 400, "Start and end time must be in HH:MM format.");
  const start = v.normalizeTime(b.start_time);
  const end = v.normalizeTime(b.end_time);
  if (toMinutes(start) >= toMinutes(end)) return fail(res, 400, "End time must be after start time.");

  const doctorId = await userModel.getDoctorId(req.user.id);
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.query(
      "SELECT id, available_date, is_booked FROM appointment_availability WHERE id = ? AND doctor_id = ? FOR UPDATE",
      [req.params.id, doctorId]
    );
    if (!rows.length) {
      await conn.rollback();
      return fail(res, 404, "Slot not found.");
    }
    if (rows[0].is_booked) {
      await conn.rollback();
      return fail(res, 409, "This slot is already booked and cannot be changed.");
    }
    if (isPastSlot(rows[0].available_date, start)) {
      await conn.rollback();
      return fail(res, 400, "You cannot move a slot into the past.");
    }
    if (await hasOverlap(conn, doctorId, rows[0].available_date, start, end, rows[0].id)) {
      await conn.rollback();
      return fail(res, 409, "This time overlaps with another slot.");
    }
    await conn.query("UPDATE appointment_availability SET start_time = ?, end_time = ? WHERE id = ?", [start, end, rows[0].id]);
    await conn.commit();
    return ok(res, "Slot updated.");
  } catch (err) {
    await conn.rollback().catch(() => {});
    if (err.code === "ER_DUP_ENTRY") return fail(res, 409, "A slot with this start time already exists.");
    throw err;
  } finally {
    conn.release();
  }
};

// DELETE /deleteavailability/:id  (doctor)
exports.deleteAvailability = async (req, res) => {
  if (!v.isPositiveInt(req.params.id)) return fail(res, 400, "Invalid slot id.");
  const doctorId = await userModel.getDoctorId(req.user.id);

  try {
    const [result] = await pool.query(
      "DELETE FROM appointment_availability WHERE id = ? AND doctor_id = ? AND is_booked = FALSE",
      [req.params.id, doctorId]
    );
    if (result.affectedRows === 0)
      return fail(res, 404, "Slot not found, or it is booked and cannot be removed.");
    return ok(res, "Slot removed.");
  } catch (err) {
    // The foreign key blocks deleting a slot that has (cancelled) appointment history.
    if (err.code === "ER_ROW_IS_REFERENCED_2" || err.code === "ER_ROW_IS_REFERENCED")
      return fail(res, 409, "This slot has appointment history and cannot be deleted.");
    throw err;
  }
};
