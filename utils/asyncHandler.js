// Lets us write "async" controllers without try/catch everywhere.
// Any thrown error is passed to the central error handler.
module.exports = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
