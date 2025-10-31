const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const scoreSchema = new Schema({
  eventId: {
    type: String,
    required: true,
    index: true,
  },
  marketData: {
    type: String,
    required: true,
    index: true,
  },
  resultData: {
    type: Schema.Types.Mixed,
    required: true,
  },
  tableId: { type: String, index: true },
  description: { type: String },
});

const Score = mongoose.model("resultRecord", scoreSchema);

module.exports = Score;
