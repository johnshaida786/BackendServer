const jwt = require("jsonwebtoken");
const { fail } = require("../utils/response");

// 1) Reads the JWT from the "x-access-token" header and checks it.
const verifyToken = (req, res, next) => {
  const token = req.headers["x-access-token"];
  if (!token) return fail(res, 401, "Access token is missing.", "TOKEN_MISSING");

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: payload.id, role: payload.role, email: payload.email };
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return fail(res, 401, "Your session has expired. Please log in again.", "TOKEN_EXPIRED");
    }
    return fail(res, 401, "Invalid access token.", "TOKEN_INVALID");
  }
};

// 2) Allows only the listed roles, e.g. requireRole("doctor")
const requireRole = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return fail(res, 403, "You do not have permission to access this resource.", "FORBIDDEN");
  }
  next();
};

module.exports = { verifyToken, requireRole };
