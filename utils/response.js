// Every API reply uses the same JSON shape:
//   success: { success: true,  message, data }
//   error:   { success: false, message, code? }
const ok = (res, message, data = null, status = 200) =>
  res.status(status).json({ success: true, message, data });

const fail = (res, status, message, code) => {
  const body = { success: false, message };
  if (code) body.code = code;
  return res.status(status).json(body);
};

module.exports = { ok, fail };
