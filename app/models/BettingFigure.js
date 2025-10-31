const mongoose = require('mongoose');
const BettingFigures = new mongoose.Schema({
  name: { type: String, required: true },
  amount: { type: Number, required: true },
  updatedAt: { type: Date },
  createdAt: { type: Date }
});
const BettingFigure = mongoose.model('BettingFigure', BettingFigures);
module.exports = BettingFigure;