const mongoose = require("mongoose");
let Global = require("../global/settings");

const asianGamesSchema = new mongoose.Schema({
  name: { type: String },
  code: { type: String },
  providerCode: { type: String },
  providerName: { type: String },
  thumb: { type: String },
  category: [
    {
      name: { type: String },
      code: { type: String },
      thumb: { type: String },
    },
  ],
});

asianGamesSchema.plugin(Global.aggregatePaginate);
asianGamesSchema.plugin(Global.paginate);

const AsianGames = mongoose.model("asiangames", asianGamesSchema);

module.exports = AsianGames;
