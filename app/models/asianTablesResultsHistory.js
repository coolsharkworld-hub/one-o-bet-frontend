const mongoose = require("mongoose");

const AsianTableResultSchema = new mongoose.Schema({
  tableId: { type: String, index: true },
  resultId: { type: String },
  roundId: { type: String, index: true },
  result: { type: Array, default: [] },
});

const AsianTableResult = mongoose.model(
  "asiantableresult",
  AsianTableResultSchema
);
module.exports = AsianTableResult;
