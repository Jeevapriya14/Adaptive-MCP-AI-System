// config/bull.js
const Queue = require('bull');

const redisHost = process.env.REDIS_HOST || '127.0.0.1';
const redisPort = Number(process.env.REDIS_PORT || 6379);
const redisPassword = process.env.REDIS_PASSWORD || undefined;

function redisObj() {
  const o = { host: redisHost, port: redisPort };
  if (redisPassword) o.password = redisPassword;
  return o;
}

const emailQueue = new Queue('email-queue', { redis: redisObj() });
const reminderQueue = new Queue('reminder-queue', { redis: redisObj() });

emailQueue.on('error', (err) => console.error('EmailQueue error', err));
reminderQueue.on('error', (err) => console.error('ReminderQueue error', err));

module.exports = { emailQueue, reminderQueue };
