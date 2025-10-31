const mongoose = require('mongoose');
let Global = require('../global/settings');

const casinoSchema = new mongoose.Schema({
  category: { type: String },
  games: [
    {
      id: { type: String },
      name: { type: String },
      type: { type: String },
      subcategory: { type: String },
      details: { type: Object },
      new: { type: String },
      system: { type: String },
      position: { type: String },
      category: { type: String },
      licence: { type: String },
      plays: { type: String },
      rtp: { type: String },
      wagering: { type: String },
      gamename: { type: String },
      report: { type: String },
      mobile: { type: Boolean },
      // additional: {
      //   aspect_ratio: { type: String },
      //   width: { type: String },
      //   height: { type: String },
      //   scale_up: { type: Boolean },
      //   scale_down: { type: Boolean },
      //   stretching: { type: Boolean },
      //   html5: { type: Boolean },
      //   volatility: { type: String },
      //   max_exposure: { type: String },
      //   megaways: { type: Boolean },
      //   bonusbuy: { type: Boolean },
      //   jackpot_type: { type: String },
      // },
      additional: { type: Object },
      id_hash: { type: String },
      id_parent: { type: String },
      id_hash_parent: { type: String },
      freerounds_supported: { type: Boolean },
      featurebuy_supported: { type: Boolean },
      has_jackpot: { type: Boolean },
      provider: { type: String },
      provider_name: { type: String },
      play_for_fun_supported: { type: Boolean },
      image: { type: String },
      image_preview: { type: String },
      image_filled: { type: String },
      image_portrait: { type: String },
      image_square: { type: String },
      image_background: { type: String },
      image_bw: { type: String },
    },
  ],
});

casinoSchema.plugin(Global.aggregatePaginate);
casinoSchema.plugin(Global.paginate);

const CasinoGames = mongoose.model('casinogames', casinoSchema);

module.exports = CasinoGames;
