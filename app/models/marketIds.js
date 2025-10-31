const mongoose = require('mongoose');

const MarketIDsSchema = new mongoose.Schema({
  eventId: { type: String,index: true },
  marketId: { type: String,index: true },
  marketName:{ type: String},
  marketType:{ type: String, require: false},
  inPlay: { type: Boolean, default: false },
  lastCheck: { type: Number,default: 0 },
  sportID: { type: Number,default: 0 },
  index: { type: Number, default: 0 },
  status: {type: String},
  openDate: { type: Number, default: 0 },
  runners:  { type: mongoose.Schema.Types.Mixed },
  winnerInfo: { type: mongoose.Schema.Types.Mixed },
  lastResultCheckTime: { type: Number, default: 0 },
  readyForScore: { type: Boolean, default: false },
  manuelClose: { type: Boolean, default: false },
  winnerRunnerData: { type: String },
  totalMatched: { type: String, default: "0" },

});

const MarketIDS = mongoose.model('MarketIDS', MarketIDsSchema);
module.exports = MarketIDS;