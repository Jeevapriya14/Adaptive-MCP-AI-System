const Queue = require("bull");
const nodemailer = require("nodemailer");
const emailQueue = new Queue("email-queue", {
  redis: {
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT,
    password: process.env.REDIS_PASSWORD
  }
});
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});
emailQueue.process(async (job) => {
  const { to, subject, text, html } = job.data;

  await transporter.sendMail({
    from: `"MCP AI" <${process.env.SMTP_USER}>`,
    to,
    subject,
    text,
    html
  });

  console.log(` Email sent → ${to}`);
});
emailQueue.on("ready", () => {
  console.log(" Email Worker ready");
});

emailQueue.on("error", (err) => {
  console.error("❌ Email Worker error:", err.message);
});

module.exports = emailQueue;
