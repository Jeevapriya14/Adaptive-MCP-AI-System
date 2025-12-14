const { reminderQueue } = require('../config/bull');
const nodemailer = require('nodemailer');
const BotData = require('../models/BotData');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

reminderQueue.process(async (job) => {
  const { email, recordId, botType, data } = job.data;
  
  try {
    const record = await BotData.findOne({ _id: recordId, status: { $ne: 'deleted' } });
    if (!record) {
      console.log(`⚠️ Record ${recordId} no longer active, skipping reminder`);
      return { skipped: true };
    }

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #ff6b6b; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
          .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 8px 8px; }
          .alert { background: #fff3cd; border: 1px solid #ffc107; padding: 15px; margin: 15px 0; border-radius: 4px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0;">⏰ Reminder: Tomorrow!</h1>
          </div>
          <div class="content">
            <div class="alert">
              <h2 style="margin-top: 0;"> Your ${botType} is scheduled for TOMORROW</h2>
            </div>
            <h3>Details:</h3>
            <pre>${JSON.stringify(data, null, 2)}</pre>
          </div>
          <div style="text-align: center; margin-top: 20px; color: #666; font-size: 12px;">
            <p> Automated reminder from MCP AI Engine</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const mailOptions = {
      from: process.env.GMAIL_USER,
      to: email,
      subject: `⏰ Reminder: ${botType.toUpperCase()} Tomorrow!`,
      html
    };

    await transporter.sendMail(mailOptions);
    console.log(`✅ Reminder sent to ${email} for ${botType}`);
    
    return { success: true };

  } catch (error) {
    console.error('❌ Reminder Send Error:', error.message);
    throw error;
  }
});

reminderQueue.on('completed', (job) => {
  console.log(`✅ Reminder Job ${job.id} completed`);
});

reminderQueue.on('failed', (job, err) => {
  console.error(`❌ Reminder Job ${job.id} failed:`, err.message);
});

console.log('⏰ Reminder worker started and listening...');