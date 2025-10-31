const mongoose = require("mongoose");
let Global = require("../global/settings");

const asianProvidersSchema = new mongoose.Schema({
  providerCode: { type: String },
  providerName: { type: String },
});

asianProvidersSchema.plugin(Global.aggregatePaginate);
asianProvidersSchema.plugin(Global.paginate);

const AsianProviders = mongoose.model("asianproviders", asianProvidersSchema);

module.exports = AsianProviders;
