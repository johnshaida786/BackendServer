const pool = require("../config/db");
const { ok, fail } = require("../utils/response");
const v = require("../utils/validators");

// GET /profile
exports.getProfile = async (req, res) => {
  const { id, role } = req.user;
  let rows;
  if (role === "patient") {
    [rows] = await pool.query(
      `SELECT u.id, u.name, u.email, u.role, p.phone, p.date_of_birth, p.gender, p.blood_group, p.address
       FROM users u JOIN patients p ON p.user_id = u.id WHERE u.id = ?`,
      [id]
    );
  } else {
    [rows] = await pool.query(
      `SELECT u.id, u.name, u.email, u.role, d.id AS doctor_id, d.specialization, d.qualification,
              d.experience_years, d.phone, d.consultation_fee, d.bio
       FROM users u JOIN doctors d ON d.user_id = u.id WHERE u.id = ?`,
      [id]
    );
  }
  if (!rows.length) return fail(res, 404, "Profile not found.");
  return ok(res, "Profile fetched.", rows[0]);
};

// PUT /profile
exports.updateProfile = async (req, res) => {
  const { id, role } = req.user;
  const b = req.body || {};

  const name = v.clean(b.name);
  if (name.length < 2 || name.length > 100) return fail(res, 400, "Name must be 2 to 100 characters.");
  if (b.phone && !v.isPhone(b.phone)) return fail(res, 400, "Please enter a valid phone number.");

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query("UPDATE users SET name = ? WHERE id = ?", [name, id]);

    if (role === "patient") {
      if (b.date_of_birth && (!v.isValidDate(b.date_of_birth) || b.date_of_birth > new Date().toISOString().slice(0, 10)))
        throw Object.assign(new Error("Invalid date of birth."), { status: 400 });
      if (b.gender && !["male", "female", "other"].includes(b.gender))
        throw Object.assign(new Error("Invalid gender."), { status: 400 });
      await conn.query(
        "UPDATE patients SET phone = ?, date_of_birth = ?, gender = ?, blood_group = ?, address = ? WHERE user_id = ?",
        [v.nullIfEmpty(b.phone), v.nullIfEmpty(b.date_of_birth), v.nullIfEmpty(b.gender),
         v.nullIfEmpty(b.blood_group), v.nullIfEmpty(b.address), id]
      );
    } else {
      const specialization = v.clean(b.specialization);
      const years = Number(b.experience_years || 0);
      const fee = Number(b.consultation_fee || 0);
      if (!specialization) throw Object.assign(new Error("Specialization is required."), { status: 400 });
      if (!Number.isInteger(years) || years < 0 || years > 70)
        throw Object.assign(new Error("Experience must be a whole number between 0 and 70."), { status: 400 });
      if (Number.isNaN(fee) || fee < 0) throw Object.assign(new Error("Consultation fee is not valid."), { status: 400 });
      await conn.query(
        `UPDATE doctors SET specialization = ?, qualification = ?, experience_years = ?, phone = ?,
         consultation_fee = ?, bio = ? WHERE user_id = ?`,
        [specialization, v.nullIfEmpty(b.qualification), years, v.nullIfEmpty(b.phone), fee, v.nullIfEmpty(b.bio), id]
      );
    }
    await conn.commit();
    return ok(res, "Profile updated.");
  } catch (err) {
    await conn.rollback().catch(() => {});
    if (err.status === 400) return fail(res, 400, err.message);
    throw err;
  } finally {
    conn.release();
  }
};
