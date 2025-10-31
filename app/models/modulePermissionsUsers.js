const mongoose = require("mongoose");
mongoose.set("debug", true);

let Global = require("../global/settings");
const modulePermissionsUsersSchema = new mongoose.Schema({
  userId:{ type: Number, required: true, unique: true, index: true },
  allowedModules: { type: Array, required: true  },
  createdAt: { type: Number },
  updatedAt: { type: Number },
});
modulePermissionsUsersSchema.pre("save", function (next) {
  var now = new Date().getTime() / 1000;
  if (!this.createdAt) {
    this.createdAt = now;
  } else {
    this.updatedAt = now;
  }
  next();
});

modulePermissionsUsersSchema.plugin(Global.paginate);
modulePermissionsUsersSchema.plugin(Global.aggregatePaginate);

module.exports = mongoose.model("modulePermissionsUsers", modulePermissionsUsersSchema);
