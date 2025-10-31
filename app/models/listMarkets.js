const mongoose = require('mongoose');

const runnerSchema = new mongoose.Schema({
  selectionId: { type: Number, required: false },
  runnerName: { type: String, required: false },
});

const marketSchema = new mongoose.Schema({
  marketId: { type: String, required: false },
  marketName: { type: String, required: false },
  totalMatched: { type: Number, required: false },
  status: { type: String, required: false },
  // runners: [runnerSchema],
  eventId: { type: String },
  sportsId: { type: String },
  // updatedCronTime:{ type: String, default: '' },
  islocked: { type: Boolean, default: false }
});

const Market = mongoose.model('listMarket', marketSchema);

module.exports = Market;
