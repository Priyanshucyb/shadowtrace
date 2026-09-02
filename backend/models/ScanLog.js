const mongoose = require('mongoose');
const ScanLogSchema = new mongoose.Schema({
  filename: String,
  fileSize: Number,
  mimeType: String,
  sha256Hash: String,
  exposureRiskScore: String,
  status: String,
  timestamp: { type: Date, default: Date.now }
});
module.exports = mongoose.model('ScanLog', ScanLogSchema);