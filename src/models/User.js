// src/models/User.js
const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
  username: { type: String, unique: true, sparse: true },
  email: { type: String, unique: true, required: true },
  otp: String,
  otpExpiry: Date,
  lastSeen: Date,
});

module.exports = mongoose.model("User", UserSchema);
