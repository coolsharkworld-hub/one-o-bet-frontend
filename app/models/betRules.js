const mongoose = require('mongoose');

const betRulesSchema = new mongoose.Schema({
  marketId: { type: String, required: true },
  subMarketId: { type: String, required: true },
  matchId: { type: Number, required: true },
  userId: { type: Number, required: true },
  content: { type: String, required: true },
  createdAt: { type: Number },
  updatedAt: { type: Number },
});

betRulesSchema.pre('save', function (next) {
  var now = new Date().getTime();
  if (!this.createdAt) {
    this.createdAt = now;
  } else {
    this.updatedAt = now;
  }
  next();
});

const BetRules = mongoose.model('betRules', betRulesSchema);
module.exports = BetRules;
