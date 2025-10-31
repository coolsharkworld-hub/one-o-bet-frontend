const mongoose = require('mongoose');

const casinoCallsSchema = new mongoose.Schema({
  userId: { type: Number },
  currency:  { type: String },
  partnerKey: { type: String },
  providerCode:  { type: String },
  providerTransactionId:  { type: String },
  gameCode:  { type: String },
  description:  { type: String },
  providerRoundId:  { type: String },
  id:  { type: String },
  amount:  { type: Number },
  referenceId:  { type: String },
  user: { type: Object, required: false },
  gameData: { type: Object, required: false },
  transactionData: { type: Object, required: false },
  timestamp: { type: String },
  type:  { type: String },
  cancelProcessed: { type: Number, default: 0 },
});




const AsianCasinoCalls = mongoose.model('AsianCasinoCalls', casinoCallsSchema);

module.exports = AsianCasinoCalls;
