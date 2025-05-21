const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
  user: String,
  text: String,
  time: Date,
});

module.exports = mongoose.model('Message', MessageSchema);
