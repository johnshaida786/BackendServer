const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;
const PHONE_RE = /^[0-9+\-\s]{7,20}$/;

const isString = (v) => typeof v === "string";
const clean = (v) => (isString(v) ? v.trim() : "");
const nullIfEmpty = (v) => {
  const s = clean(v);
  return s === "" ? null : s;
};

const isEmail = (v) => isString(v) && v.length <= 150 && EMAIL_RE.test(v.trim());
const normalizeEmail = (v) => clean(v).toLowerCase();
const isStrongPassword = (v) =>
  isString(v) && v.length >= 8 && v.length <= 72 && /[A-Za-z]/.test(v) && /\d/.test(v);
const isOtp = (v) => isString(v) && /^\d{6}$/.test(v.trim());
const isPhone = (v) => isString(v) && PHONE_RE.test(v.trim());
const isPositiveInt = (v) => /^\d+$/.test(String(v)) && Number(v) > 0;

const isValidDate = (v) => {
  if (!isString(v) || !DATE_RE.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
};
const isValidTime = (v) => isString(v) && TIME_RE.test(v);
const normalizeTime = (v) => (v.length === 5 ? `${v}:00` : v);

module.exports = {
  clean, nullIfEmpty, isEmail, normalizeEmail, isStrongPassword, isOtp,
  isPhone, isPositiveInt, isValidDate, isValidTime, normalizeTime,
};
