const nodemailer = require("nodemailer");
const logger = require("./logger");
const {
  verificationEmail,
  passwordResetEmail,
} = require("./emailTemplates");

const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST,
  port: Number(process.env.MAIL_PORT) || 587,
  secure: process.env.MAIL_SECURE === "true", // true for 465, false for 587
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
});

// SMTP is optional in development: without MAIL_HOST, emails are written to
// the server log instead (so sign-up / reset codes can still be used locally).
const isMailConfigured = () => Boolean(process.env.MAIL_HOST && process.env.MAIL_USER);

const sendMail = async ({ to, subject, text, html, attachments }) => {
  if (!isMailConfigured()) {
    if (process.env.NODE_ENV === "production") {
      const error = new Error("Email is not configured on the server. Please contact support.");
      error.statusCode = 503;
      throw error;
    }
    logger.warn(`[mail:dev] SMTP not configured — not sent. To: ${to} | ${subject} | ${text}`);
    return;
  }
  try {
    await transporter.sendMail({
      from: `"${process.env.MAIL_FROM_NAME || "ShokherBoard"}" <${process.env.MAIL_FROM_ADDRESS}>`,
      to,
      subject,
      text,
      html,
      ...(attachments ? { attachments } : {}),
    });
  } catch (err) {
    logger.error(`SMTP error: ${err.message}`);
    const error = new Error("Failed to send email. Please try again later.");
    error.statusCode = 503;
    throw error;
  }
};

const sendVerificationOTP = async (to, otp) => {
  await sendMail({
    to,
    subject: "Verify your email address",
    text: `Your email verification code is: ${otp}  (expires in 10 minutes)`,
    html: verificationEmail(otp),
  });
};

const sendPasswordResetOTP = async (to, otp) => {
  await sendMail({
    to,
    subject: "Reset your password",
    text: `Your password reset code is: ${otp}  (expires in 10 minutes)`,
    html: passwordResetEmail(otp),
  });
};

module.exports = {
  sendVerificationOTP,
  sendPasswordResetOTP,
  sendMail,
};
