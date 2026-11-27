const fs = require("fs");
const mysql = require("mysql2/promise");
require("dotenv").config();

// TiDB Cloud requires an encrypted (TLS) connection.
const ssl = { minVersion: "TLSv1.2", rejectUnauthorized: true };
if (process.env.DB_CA_PATH) {
  ssl.ca = fs.readFileSync(process.env.DB_CA_PATH);
}

// A pool keeps several ready connections so each request doesn't open a new one.
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 4000,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl,
  waitForConnections: true,
  connectionLimit: 10,
  // Return DATE/TIME columns as plain strings ("2026-12-01") instead of JS Date objects.
  // This avoids time-zone shifts when the data is sent to React.
  dateStrings: true,
});

module.exports = pool;
