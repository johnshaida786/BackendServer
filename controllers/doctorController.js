const pool = require("../config/db");
const { ok, fail } = require("../utils/response");
const { nowLocal } = require("../utils/time");
const v = require("../utils/validators");

// open_slots = future, not-yet-booked slots
const SELECT_DOCTORS = `
  SELECT d.id, u.name, d.specialization, d.qualification, d.experience_years,
         d.consultation_fee, d.bio,
         (SELECT COUNT(*) FROM appointment_availability a
           WHERE a.doctor_id = d.id AND a.is_booked = FALSE
             AND (a.available_date > ? OR (a.available_date = ? AND a.start_time > ?))) AS open_slots
  FROM doctors d JOIN users u ON u.id = d.user_id`;

// GET /getdoctors?search=cardio
exports.getDoctors = async (req, res) => {
  const now = nowLocal();
  const params = [now.date, now.date, now.time];
  let sql = SELECT_DOCTORS;

  const search = v.clean(req.query.search);
  if (search) {
    sql += " WHERE u.name LIKE ? OR d.specialization LIKE ?";
    params.push(`%${search}%`, `%${search}%`);
  }
  sql += " ORDER BY u.name";

  const [rows] = await pool.query(sql, params);
  return ok(res, "Doctors fetched.", rows.map((r) => ({ ...r, open_slots: Number(r.open_slots) })));
};

// GET /getdoctors/:id
exports.getDoctorById = async (req, res) => {
  if (!v.isPositiveInt(req.params.id)) return fail(res, 400, "Invalid doctor id.");
  const now = nowLocal();
  const [rows] = await pool.query(`${SELECT_DOCTORS} WHERE d.id = ?`, [now.date, now.date, now.time, req.params.id]);
  if (!rows.length) return fail(res, 404, "Doctor not found.");
  return ok(res, "Doctor fetched.", { ...rows[0], open_slots: Number(rows[0].open_slots) });
};
