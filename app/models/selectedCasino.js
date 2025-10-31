const mongoose = require('mongoose');
let Global = require('../global/settings');

const selectedCasinoSchema = new mongoose.Schema({
  category: { type: String },
  status: { type : String },
  games: [
    {
      id: { type: String },
      name: { type: String },
      type: { type: String },
      allowedBetamount: { type: Number, default: 0 },
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
      additional: { type: Object }, // for any additional value
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
      isDashboard: { type: Boolean, default: false }
    },
  ],
});

selectedCasinoSchema.plugin(Global.aggregatePaginate);
selectedCasinoSchema.plugin(Global.paginate);

selectedCasinoSchema.index({ 'games.isDashboard': 1 });
selectedCasinoSchema.index({ 'games.mobile': 1 });

const selectedCasino = mongoose.model('selectedCasino', selectedCasinoSchema);

module.exports = selectedCasino;
