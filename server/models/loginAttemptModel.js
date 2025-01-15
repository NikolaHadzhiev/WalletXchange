const mongoose = require("mongoose");

const loginAttemptSchema = new mongoose.Schema(
  {
    identifier: {
      type: String,
      required: true, // Can be IP or email
    },
    attempts: {
      type: Number,
      default: 0, // Number of failed attempts
    },
    blockedCount: {
      type: Number,
      default: 0 // Count of blocked times by email/ip
    },
    timeoutUntil: {
      type: Date,
      default: null, // Lockout expiration time
    },
    lastAttempt: {
      type: Date,
      default: Date.now, // Timestamp of the last attempt
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt fields
  }
);

module.exports = mongoose.model("loginAttempts", loginAttemptSchema);