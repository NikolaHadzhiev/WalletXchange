const mongoose = require("mongoose");

const deletedUserSchema = new mongoose.Schema(
  {
    deleteId: {
      type: String,
      required: true,
    },
    firstName: {
        type: String,
        required: true
    },
    lastName: {
        type: String,
        required: true
    },
    requests: [],
    transactions: [],
    deletionDate: { type: Date, default: Date.now }
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("deletedUsers", deletedUserSchema);
