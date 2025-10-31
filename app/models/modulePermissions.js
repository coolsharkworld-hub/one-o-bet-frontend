const mongoose = require("mongoose");
mongoose.set("debug", true);

let Global = require("../global/settings");
const modulePermissionsSchema = new mongoose.Schema({
  permissionId: { type: Number, required: true},
  module: { type: String, required: true, unique: true },
  createdAt: { type: Number },
  updatedAt: { type: Number },
});
modulePermissionsSchema.pre("save", function (next) {
  var now = new Date().getTime() / 1000;
  if (!this.createdAt) {
    this.createdAt = now;
  } else {
    this.updatedAt = now;
  }
  next();
});

modulePermissionsSchema.plugin(Global.paginate);
modulePermissionsSchema.plugin(Global.aggregatePaginate);

module.exports = mongoose.model("modulePermissions", modulePermissionsSchema);
