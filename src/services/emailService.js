const crypto = require("crypto");

// In-memory OTP store: { email: { code, expiresAt } }
const otpStore = new Map();

const OTP_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Generate a 6-digit OTP.
 */
function generateOTP() {
  return crypto.randomInt(100000, 999999).toString();
}

/**
 * Send an email via Brevo HTTP API (works on Render free tier where SMTP port 587 is blocked).
 * Uses the same SMTP_PASS (xsmtpsib-...) as the API key since Brevo accepts it.
 * If BREVO_API_KEY is set, it takes priority.
 */
async function sendEmail({ to, subject, html }) {
  const apiKey = process.env.BREVO_API_KEY || process.env.SMTP_PASS;

  if (!apiKey) {
    throw new Error(
      "Email service not configured. Set BREVO_API_KEY (or SMTP_PASS) environment variable."
    );
  }

  const senderName = process.env.SMTP_FROM_NAME || "DheenaArts";
  const senderEmail = process.env.SMTP_FROM_EMAIL || "noreply@dheenaarts.com";

  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": apiKey,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      sender: { name: senderName, email: senderEmail },
      to: [{ email: to }],
      subject,
      htmlContent: html,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error("Brevo API error:", response.status, errorBody);
    throw new Error(`Brevo API error (${response.status}): ${errorBody}`);
  }

  return response.json();
}

/**
 * Format an amount stored in paise into a rupee string (e.g. 220000 -> "2,200.00").
 */
function formatRupees(paise) {
  const rupees = Number(paise || 0) / 100;
  return rupees.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Send OTP to an email address.
 */
async function sendOTP(email) {
  const code = generateOTP();

  otpStore.set(email, {
    code,
    expiresAt: Date.now() + OTP_EXPIRY_MS,
  });

  await sendEmail({
    to: email,
    subject: "Your DheenaArts Verification Code",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #333; margin-bottom: 16px;">Verification Code</h2>
        <p style="color: #555; font-size: 15px;">Your verification code is:</p>
        <div style="background: #f5f5f5; padding: 16px; border-radius: 8px; text-align: center; margin: 16px 0;">
          <span style="font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #e94560;">${code}</span>
        </div>
        <p style="color: #888; font-size: 13px;">This code is valid for 5 minutes. Do not share it with anyone.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
        <p style="color: #aaa; font-size: 12px;">DheenaArts</p>
      </div>
    `,
  });

  return { status: "pending" };
}

/**
 * Verify OTP code for an email.
 */
async function verifyOTP(email, code, consume = true) {
  const entry = otpStore.get(email);

  if (!entry) {
    return { valid: false };
  }

  if (Date.now() > entry.expiresAt) {
    otpStore.delete(email);
    return { valid: false };
  }

  if (entry.code !== code) {
    return { valid: false };
  }

  if (consume) {
    otpStore.delete(email);
  }
  return { valid: true };
}

/**
 * Notify admin about a new order via email.
 */
async function notifyAdminNewOrder({ orderNumber, amount, transactionLast4, customerName }) {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) {
    console.warn(
      `[order-notify] ADMIN_EMAIL not set — skipping new-order email for #${orderNumber}`
    );
    return;
  }

  try {
    console.log(`[order-notify] Sending new-order email for #${orderNumber} to ${adminEmail}`);
    const amountStr = formatRupees(amount);
    await sendEmail({
      to: adminEmail,
      subject: `New Order #${orderNumber} - Rs.${amountStr}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #e94560;">New Art Order Received!</h2>
          <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
            <tr><td style="padding: 8px 0; color: #888; width: 140px;">Order</td><td style="padding: 8px 0; font-weight: 600;">#${orderNumber}</td></tr>
            <tr><td style="padding: 8px 0; color: #888;">Amount</td><td style="padding: 8px 0; font-weight: 600;">Rs.${amountStr}</td></tr>
            <tr><td style="padding: 8px 0; color: #888;">Txn Last 4 Digits</td><td style="padding: 8px 0; font-weight: 600; font-size: 18px; letter-spacing: 4px;">${transactionLast4}</td></tr>
            <tr><td style="padding: 8px 0; color: #888;">Customer</td><td style="padding: 8px 0; font-weight: 600;">${customerName}</td></tr>
          </table>
          <p style="color: #555; font-size: 13px;">Please verify the payment and update the order status in admin panel.</p>
        </div>
      `,
    });
  } catch (err) {
    console.error("Admin email notification failed:", err.message);
  }
}

/**
 * Notify admin about a new course enrollment via email.
 */
async function notifyAdminNewEnrollment({ courseTitle, amount, transactionLast4, customerName }) {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) {
    console.warn(
      `[enroll-notify] ADMIN_EMAIL not set — skipping new-enrollment email for "${courseTitle}"`
    );
    return;
  }

  try {
    const amountStr = formatRupees(amount);
    await sendEmail({
      to: adminEmail,
      subject: `New Enrollment - ${courseTitle} - Rs.${amountStr}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #e94560;">New Course Enrollment!</h2>
          <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
            <tr><td style="padding: 8px 0; color: #888; width: 140px;">Course</td><td style="padding: 8px 0; font-weight: 600;">${courseTitle}</td></tr>
            <tr><td style="padding: 8px 0; color: #888;">Amount</td><td style="padding: 8px 0; font-weight: 600;">Rs.${amountStr}</td></tr>
            <tr><td style="padding: 8px 0; color: #888;">Txn Last 4 Digits</td><td style="padding: 8px 0; font-weight: 600; font-size: 18px; letter-spacing: 4px;">${transactionLast4}</td></tr>
            <tr><td style="padding: 8px 0; color: #888;">Customer</td><td style="padding: 8px 0; font-weight: 600;">${customerName}</td></tr>
          </table>
          <p style="color: #555; font-size: 13px;">Please verify the payment and update the enrollment in admin panel.</p>
        </div>
      `,
    });
  } catch (err) {
    console.error("Admin email notification failed:", err.message);
  }
}

module.exports = { sendOTP, verifyOTP, notifyAdminNewOrder, notifyAdminNewEnrollment };
