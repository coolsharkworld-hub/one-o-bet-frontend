const mongoose = require("mongoose");

const AsianTableOddSchema = new mongoose.Schema({
  tableId: { type: String, index: true },
  t1: { type: Array, default: [] },
  t2: { type: Array, default: [] },
  t3: { type: Array, default: [] },
  gstatus: { type: String },
  result: { type: Array, default: [] },
  history: { type: Array, default: [] },
  roundId: { type: String },
});

const AsianTableOdd = mongoose.model("asiantableodd", AsianTableOddSchema);
module.exports = AsianTableOdd;
