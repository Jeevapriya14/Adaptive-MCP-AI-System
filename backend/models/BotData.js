const mongoose = require('mongoose');

const botDataSchema = new mongoose.Schema({
  email: {
    type: String,
    required: false,       
    default: null,
    index: true
  },
  botType: {
    type: String,
    required: true,
    index: true
  },

  data: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },

  status: {
    type: String,
    enum: ["active", "completed", "deleted"],
    default: "active"
  },

  scheduledDate: {
    type: Date,
    default: null
  },

  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

botDataSchema.index({ email: 1, botType: 1 });
botDataSchema.index({ status: 1, scheduledDate: 1 });

module.exports = mongoose.model("BotData", botDataSchema);
