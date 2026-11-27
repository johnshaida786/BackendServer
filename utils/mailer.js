
const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

async function sendOtpEmail(email, otp, purpose) {
  const subject = "Hospital Appointment System - OTP Verification";

  const html = `
    <div style="font-family: Arial, sans-serif;">
      <h2>OTP Verification</h2>
      <p>Your verification code is:</p>
      <h1>${otp}</h1>
      <p>This OTP is valid for ${process.env.OTP_EXPIRY_MINUTES || 5} minutes.</p>
      <p>Purpose: ${purpose}</p>
      <p>Please do not share this OTP with anyone.</p>
    </div>
  `;

  const info = await transporter.sendMail({
    from: `"Hospital Appointment System" <${process.env.SMTP_FROM}>`,
    to: email,
    subject,
    html
  });

  console.log("OTP email sent successfully:", info.messageId);
}

module.exports = { sendOtpEmail };
