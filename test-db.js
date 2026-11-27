const pool = require("./config/db");

(async () => {
  try {
    const [rows] = await pool.query("SELECT VERSION() AS version, NOW() AS now");
    console.log("Connected to TiDB:", rows[0]);
    const [tables] = await pool.query("SHOW TABLES");
    console.log("Tables:", tables);
  } catch (err) {
    console.error("Connection failed:", err.code, err.message);
  } finally {
    process.exit();
  }
})();
