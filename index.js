require("dotenv").config();
const express = require("express");
const cors = require("cors");

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 16) {
  console.error("JWT_SECRET is missing or too short. Set a long random value in backend/.env");
  process.exit(1);
}

const app = express();

// Allow only the React app to call this API from a browser.
const allowedOrigins = (process.env.CLIENT_URL || "http://localhost:5173").split(",").map((s) => s.trim());
app.use(
  cors({
    origin: allowedOrigins,
    allowedHeaders: ["Content-Type", "x-access-token"],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  })
);
app.use(express.json({ limit: "100kb" }));

// GET / -> server status
app.get("/", (req, res) =>
  res.json({ success: true, message: "Hospital Appointment API is running.", data: { time: new Date().toISOString() } })
);

app.use("/", require("./routes/authRoutes"));
app.use("/", require("./routes/doctorRoutes"));
app.use("/", require("./routes/patientRoutes"));
app.use("/", require("./routes/availabilityRoutes"));
app.use("/", require("./routes/appointmentRoutes"));

const { notFound, errorHandler } = require("./middleware/errorHandler");
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`API running on http://localhost:${PORT}`));
