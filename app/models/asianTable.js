const mongoose = require("mongoose");

const AsianTableSchema = new mongoose.Schema({
  tableId: { type: String },
  tableName: { type: String, required: true },
  imageUrl: { type: String },
  isDashboard: { type: Boolean, default: false },
  status: { type: String },
});

const AsianTable = mongoose.model("asiantable", AsianTableSchema);
module.exports = AsianTable;
