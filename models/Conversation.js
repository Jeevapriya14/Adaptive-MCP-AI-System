const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true
  },
  email: String,
  botType: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['active', 'completed', 'cancelled', 'error'],
    default: 'active'
  },
  currentStep: {
    type: Number,
    default: 0
  },
  collectedData: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
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

conversationSchema.index({ userId: 1, status: 1 });

module.exports = mongoose.model('Conversation', conversationSchema);