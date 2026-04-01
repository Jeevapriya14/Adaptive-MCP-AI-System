
require('dotenv').config();
const { emailQueue } = require('../config/bull');
const nodemailer = require('nodemailer');

const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
const smtpPort = Number(process.env.SMTP_PORT || 587);
const smtpUser = process.env.SMTP_USER || process.env.GMAIL_USER;
const smtpPass = process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD;

if (!smtpUser || !smtpPass) {
  console.error(' SMTP credentials missing. Set SMTP_USER / SMTP_PASS or GMAIL_USER / GMAIL_APP_PASSWORD.');
}

const transporter = nodemailer.createTransport({
  host: smtpHost,
  port: smtpPort,
  secure: smtpPort === 465, // true for 465, false for 587
  auth: {
    user: smtpUser,
    pass: smtpPass
  },
  tls: {
    // Helpful on some hosts that intercept TLS; keep false in prod unless necessary
    rejectUnauthorized: false
  },
  connectionTimeout: 30_000,
  greetingTimeout: 30_000,
  socketTimeout: 30_000
});

emailQueue.process(5, async (job) => { // concurrency 5
  const { mailOptions } = job.data;
  try {
    console.log(' Sending mail job:', job.id, 'to:', mailOptions.to);
    const info = await transporter.sendMail(mailOptions);
    console.log(` Email sent to ${mailOptions.to} (messageId:${info.messageId})`);
    return { success: true, info };
  } catch (error) {
    console.error('Email Send Error:', error.message || error);
    // rethrow so Bull can retry as configured
    throw error;
  }
});

emailQueue.on('completed', (job) => {
  console.log(` Email Job ${job.id} completed`);
});

emailQueue.on('failed', (job, err) => {
  console.error(`Email Job ${job.id} failed:`, err?.message || err);
});

console.log(' Email worker started and listening...');
