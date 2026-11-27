const { fail } = require("../utils/response");

const notFound = (req, res) => fail(res, 404, `Route not found: ${req.method} ${req.originalUrl}`);

// Central error handler: logs details on the server, sends a safe message to the client.
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  if (err.type === "entity.parse.failed") return fail(res, 400, "Invalid JSON in request body.");

  const dbDown = ["ECONNREFUSED", "ETIMEDOUT", "ENOTFOUND", "PROTOCOL_CONNECTION_LOST", "ER_ACCESS_DENIED_ERROR"];
  if (dbDown.includes(err.code)) {
    console.error("Database connection error:", err.code, err.message);
    return fail(res, 503, "Service temporarily unavailable. Please try again later.");
  }

  console.error("Server error:", err);
  return fail(res, 500, "Something went wrong on the server.");
};

module.exports = { notFound, errorHandler };
