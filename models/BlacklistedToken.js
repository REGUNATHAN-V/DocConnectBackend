//Only logout Info
const mongoose = require('mongoose');

const blacklistedTokenSchema = new mongoose.Schema({
  token: { type: String, required: true },
  userId: { type: String, required: true },
  date: { type: Date, default: Date.now },
});

module.exports = mongoose.model('BlacklistedToken', blacklistedTokenSchema);


