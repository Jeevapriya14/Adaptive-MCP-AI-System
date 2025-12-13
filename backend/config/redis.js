const { createClient } = require("redis");

const client = createClient({
  socket: {
    host: process.env.REDIS_HOST,   // Host only
    port: process.env.REDIS_PORT,   // Port only
    tls: false                      // NON-TLS
  },
  password: process.env.REDIS_PASSWORD, // Redis password
});

client.on("connect", () => console.log("🔄 Redis Connecting..."));
client.on("ready", () => console.log("✅ Redis Connected (Non-TLS)"));
client.on("error", (err) => console.error("❌ Redis Error:", err.message));

client.connect().catch(err => console.error("Redis Connect Error:", err));

module.exports = {
  async get(key) {
    try {
      return client.isReady ? await client.get(key) : null;
    } catch {
      return null;
    }
  },
  async set(key, value, options) {
    try {
      return client.isReady ? await client.set(key, value, options) : null;
    } catch {
      return null;
    }
  },
  async del(key) {
    try {
      return client.isReady ? await client.del(key) : null;
    } catch {
      return null;
    }
  },
  quit: () => client.quit(),
  get isReady() {
    return client.isReady;
  }
};
