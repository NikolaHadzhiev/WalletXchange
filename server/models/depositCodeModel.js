const mongoose = require("mongoose");

const codeSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      required: true,
    },
    email: {
        type: String,
        required: true
    },
    stripeId: {
        type: String,
        required: true
    },
    veritificationCode: {
      type: String,
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Automatically remove expired codes using a MongoDB TTL index
codeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("depositCodes", codeSchema);
