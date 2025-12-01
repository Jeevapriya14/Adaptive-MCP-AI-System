// server.js
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const app = express();
const PORT = process.env.PORT || 3000;

// ========== MIDDLEWARE ==========
app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.text({ type: 'text/plain' }));

// ========== MONGODB CONNECTION ==========
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ MongoDB Connected'))
  .catch(err => {
    console.error('❌ MongoDB Error:', err);
    process.exit(1);
  });

// ========== REDIS CONNECTION ==========
const redisClient = require('./config/redis');

// ========== START WORKERS ==========
require('./workers/emailWorker');
require('./workers/reminderWorker');

// ========== ROUTES ==========
// ❌ OLD (WRONG):
// app.post('/webhook', require('./routes/webhook'));

// ✅ NEW (CORRECT):
const webhookRoute = require('./routes/webhook');
app.use('/webhook', webhookRoute);   // <-- FIXED

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    redis: redisClient.isReady ? 'connected' : 'disconnected'

  });
});

// ========== ERROR HANDLER ==========
app.use((err, req, res, next) => {
  console.error('❌ Unhandled Error:', err);
  res.status(500).json({
    text: 'Internal server error. Please try again.'
  });
});

// ========== GRACEFUL SHUTDOWN ==========
process.on('SIGTERM', async () => {
  console.log('\n🛑 Shutting down gracefully...');
  await mongoose.connection.close();
  if (redisClient && redisClient.quit) await redisClient.quit();
  process.exit(0);
});

process.on('unhandledRejection', (err) => {
  console.error('❌ Unhandled Promise Rejection:', err);
});

// ========== START SERVER ==========
app.listen(PORT, () => {
  console.log('\n' + '='.repeat(70));
  console.log('🚀 SCOUTBUILD AI BOT ENGINE v2.0 - PRODUCTION READY');
  console.log('='.repeat(70));
  console.log(`📡 Port: ${PORT}`);
  console.log(`🤖 Webhook: POST /webhook`);
  console.log(`🧠 AI Engine: Google Gemini Pro`);
  console.log(`💾 Database: MongoDB Atlas`);
  console.log(`⚡ Cache: Redis Cloud`);
  console.log(`📧 Email: Gmail SMTP`);
  console.log(`🔗 Zoho Meetings: Enabled`);
  console.log('='.repeat(70));
  console.log('\n✅ 12 BOTS ACTIVE:');
  console.log('   1. Task Manager         7. News Bot');
  console.log('   2. Meeting Scheduler    8. Crypto Bot');
  console.log('   3. Travel Planner       9. Market Bot');
  console.log('   4. Reminder Bot         10. Business Insights');
  console.log('   5. Interview Scheduler  11. Coding Bot');
  console.log('   6. Weather Bot          12. Chat Bot');
  console.log('='.repeat(70) + '\n');
});
