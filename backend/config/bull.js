
const Queue = require('bull');

const redisConfig = {
  redis: {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: Number(process.env.REDIS_PORT || 6379),
    username: process.env.REDIS_USERNAME || undefined,
    password: process.env.REDIS_PASSWORD || undefined
  }
};

const emailQueue = new Queue('email-queue', redisConfig);
const reminderQueue = new Queue('reminder-queue', redisConfig);

emailQueue.on('error', (err) => {
  console.error('EmailQueue error:', err.message);
});

reminderQueue.on('error', (err) => {
  console.error('ReminderQueue error:', err.message);
});

module.exports = {
  emailQueue,
  reminderQueue
};
