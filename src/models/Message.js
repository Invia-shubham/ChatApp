const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema({
  user: String,       // Sender
  text: String,
  time: { type: Date, default: Date.now },
  to: String,         // Optional: Receiver for private chat
});

module.exports = mongoose.model("Message", messageSchema);
