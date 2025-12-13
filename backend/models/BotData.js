const mongoose = require('mongoose');

const botDataSchema = new mongoose.Schema({
  // OWNER EMAIL (optional for all bots except task/reminder)
  email: {
    type: String,
    required: false,       // <-- FIXED
    default: null,
    index: true
  },

  // BOT TYPE (task, meeting, travel, etc.)
  botType: {
    type: String,
    required: true,
    index: true
  },

  // FULL PAYLOAD (title, date, attendees, etc.)
  data: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },

  // ACTIVE STATUS
  status: {
    type: String,
    enum: ["active", "completed", "deleted"],
    default: "active"
  },

  // For reminders / scheduled events
  scheduledDate: {
    type: Date,
    default: null
  },

  // TIMESTAMPS
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Indexes for fast record lookups
botDataSchema.index({ email: 1, botType: 1 });
botDataSchema.index({ status: 1, scheduledDate: 1 });

module.exports = mongoose.model("BotData", botDataSchema);
