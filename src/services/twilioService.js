const twilio = require("twilio");

let _client = null;

function getClient() {
  if (!_client) {
    _client = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );
  }
  return _client;
}

/**
 * Send OTP to a phone number via Twilio Verify.
 * Phone must include country code (e.g. +919361500493).
 */
async function sendOTP(phone) {
  const verification = await getClient().verify.v2
    .services(process.env.TWILIO_VERIFY_SID)
    .verifications.create({ to: phone, channel: "sms" });

  return { status: verification.status };
}

/**
 * Verify OTP code for a phone number.
 */
async function verifyOTP(phone, code) {
  const check = await getClient().verify.v2
    .services(process.env.TWILIO_VERIFY_SID)
    .verificationChecks.create({ to: phone, code });

  return { valid: check.status === "approved" };
}

module.exports = { sendOTP, verifyOTP };
