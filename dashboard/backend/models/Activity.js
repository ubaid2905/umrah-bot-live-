// dashboard/backend/models/Activity.js
const mongoose = require('mongoose');

const activitySchema = new mongoose.Schema({
  phoneNumber: {
    type: String,
    required: true,
    index: true
  },
  userMessage: {
    type: String,
    required: true
  },
  botResponse: {
    type: String,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  sessionId: String,
  messageType: {
    type: String,
    enum: ['text', 'image', 'document'],
    default: 'text'
  },
  metadata: {
    responseTime: Number,
    tokenCount: Number
  }
});

// Create index for efficient querying
activitySchema.index({ phoneNumber: 1, timestamp: -1 });

module.exports = mongoose.model('Activity', activitySchema);
