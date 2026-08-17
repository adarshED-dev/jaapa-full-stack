// Outgoing email — Gmail SMTP via nodemailer, using an App Password rather
// than the account's real password (Google blocks plain-password SMTP
// login; an App Password is a revocable, mail-only credential).
//
// Setup: turn on 2-Step Verification on the sending Gmail account, then
// generate one at https://myaccount.google.com/apppasswords. Put the
// address in EMAIL_USER and the 16-character password in EMAIL_APP_PASSWORD
// in backend/.env.
//
// Same pattern as shiprocket.js: isConfigured() is false until those two
// env vars are set, and every send is best-effort — a missing/wrong
// credential disables email, it never breaks checkout. An order is real the
// moment it's in the database; the email is a courtesy on top of that.

const nodemailer = require("nodemailer");

function isConfigured() {
    return Boolean(process.env.EMAIL_USER && process.env.EMAIL_APP_PASSWORD);
}

let cachedTransporter = null;

function getTransporter() {
    if (!isConfigured()) return null;
    if (!cachedTransporter) {
        cachedTransporter = nodemailer.createTransport({
            service: "gmail",
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_APP_PASSWORD,
            },
        });
    }
    return cachedTransporter;
}

/**
 * Fire-and-forget from the caller's point of view: resolves to true/false
 * rather than throwing, so a mail failure (bad credentials, Gmail hiccup)
 * never becomes a 500 on an order that already succeeded. Every caller still
 * gets a console line either way, so a silently-broken mail setup doesn't
 * stay silent in the server log.
 */
async function sendMail({ to, subject, html }) {
    const transporter = getTransporter();
    if (!transporter) {
        console.warn(`[mailer] EMAIL_USER/EMAIL_APP_PASSWORD not set — skipped "${subject}" to ${to}`);
        return false;
    }
    if (!to) {
        console.warn(`[mailer] No recipient address — skipped "${subject}"`);
        return false;
    }

    try {
        await transporter.sendMail({
            from: `"${process.env.EMAIL_FROM_NAME || "JAAPA"}" <${process.env.EMAIL_USER}>`,
            to,
            subject,
            html,
        });
        console.log(`[mailer] Sent "${subject}" to ${to}`);
        return true;
    } catch (error) {
        console.error(`[mailer] Failed to send "${subject}" to ${to}:`, error.message);
        return false;
    }
}

module.exports = { isConfigured, sendMail };
