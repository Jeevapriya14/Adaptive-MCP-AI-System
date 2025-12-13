// services/emailService.js
const nodemailer = require('nodemailer');
const { emailQueue, reminderQueue } = require('../config/bull');

/* ---------------------------------------------------------
   TRANSPORTER (PRODUCTION GMAIL SMTP)
--------------------------------------------------------- */
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: false,                 // TLS on port 587
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});


/* ---------------------------------------------------------
   SEND CONFIRMATION EMAIL (HTML)
--------------------------------------------------------- */
async function sendConfirmation(email, botType, data) {
  try {
    const html = generateHTML(botType, data);

    const mailOptions = {
      from: process.env.GMAIL_USER,
      to: email,
      subject: `✅ ${botType.toUpperCase()} Created — ScoutBuild`,
      html
    };

    await emailQueue.add({ mailOptions });

    console.log(`📧 Confirmation queued → ${email}`);
  } catch (err) {
    console.error("❌ sendConfirmation Error →", err?.message || err);
  }
}

/* ---------------------------------------------------------
   SEND PLAIN TEXT EMAIL (Weather, News, Crypto, Market, Coding)
--------------------------------------------------------- */
async function sendPlainText(email, subject, text) {
  try {
    const mailOptions = {
      from: process.env.GMAIL_USER,
      to: email,
      subject,
      text
    };

    await emailQueue.add({ mailOptions });

    console.log(`📨 Plain email queued → ${email}`);
  } catch (err) {
    console.error("❌ sendPlainText Error →", err?.message || err);
  }
}

/* ---------------------------------------------------------
   SEND REMINDER MAIL (1 DAY BEFORE)
--------------------------------------------------------- */
async function scheduleReminder(email, recordId, botType, data) {
  try {
    const rawDate = data.date || data.dueDate || data.startDate || data.departureDate;
    if (!rawDate) return console.log("⚠️ No reminder date found.");

    const eventDate = new Date(rawDate);
    if (isNaN(eventDate.getTime())) {
      return console.log("⚠️ Invalid event date → skip reminder.");
    }

    const reminderAt = new Date(eventDate.getTime() - 24 * 60 * 60 * 1000);
    const now = new Date();

    if (reminderAt <= now) {
      return console.log("⚠️ Event already near → reminder not scheduled.");
    }

    const delay = reminderAt.getTime() - now.getTime();

    await reminderQueue.add(
      { email, recordId, botType, data },
      { delay }
    );

    console.log(`⏰ Reminder scheduled → ${reminderAt.toISOString()}`);
  } catch (err) {
    console.error("❌ scheduleReminder Error →", err?.message || err);
  }
}

/* ---------------------------------------------------------
   HTML TEMPLATE (Beautiful UI)
--------------------------------------------------------- */
function generateHTML(botType, data) {
  let rows = "";

  for (const [key, value] of Object.entries(data)) {
    if (value === undefined || value === null || String(value).trim() === "") continue;

    rows += `
      <tr>
        <td style="padding: 10px 12px; font-weight: bold; background:#fafafa; border-bottom:1px solid #eee;">
          ${formatLabel(key)}
        </td>
        <td style="padding: 10px 12px; border-bottom:1px solid #eee;">
          ${value}
        </td>
      </tr>
    `;
  }

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { background:#f4f4f4; padding:20px; font-family:Arial, sans-serif; }
        .card {
          max-width: 650px;
          margin: auto;
          background:white;
          border-radius:12px;
          overflow:hidden;
          box-shadow:0 4px 18px rgba(0,0,0,0.1);
        }
        .header {
          background:linear-gradient(135deg,#6366f1,#8b5cf6);
          color:white;
          padding:20px;
          font-size:20px;
          text-align:center;
        }
        table {
          width:100%;
          border-collapse:collapse;
          margin-top:10px;
        }
        .footer {
          text-align:center;
          padding:15px;
          color:#777;
          font-size:13px;
        }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="header">
          ✅ ${botType.toUpperCase()} Created Successfully!
        </div>

        <div style="padding:20px;">
          <h2 style="margin-bottom:10px;">📌 Details:</h2>
          <table>${rows}</table>
        </div>

        <div class="footer">
          🤖 Powered by <b>ScoutBuild AI Bot Engine</b>
        </div>
      </div>
    </body>
    </html>
  `;
}

/* ---------------------------------------------------------
   Convert key → readable format
--------------------------------------------------------- */
function formatLabel(str) {
  return str
    .replace(/([A-Z])/g, " $1")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

/* ---------------------------------------------------------
   EXPORTS
--------------------------------------------------------- */
module.exports = {
  sendConfirmation,
  sendPlainText,
  scheduleReminder
};

