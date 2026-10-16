const crypto = require('crypto');

/**
 * Generate a 6-digit numeric OTP and its SHA-256 hash
 * - Plain OTP is sent to the user via email
 * - Hash is stored in DB (never store plain OTP)
 * @returns {{ otp: string, hash: string }}
 */
const generateOTP = () => {
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const hash = crypto.createHash('sha256').update(otp).digest('hex');
  return { otp, hash };
};

/**
 * Hash a plain OTP for DB lookup
 * @param {string} otp
 * @returns {string}
 */
const hashOTP = (otp) => {
  return crypto.createHash('sha256').update(String(otp)).digest('hex');
};

module.exports = { generateOTP, hashOTP };
