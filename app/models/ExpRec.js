const mongoose = require('mongoose');
mongoose.set('debug', false);

let Global = require('../global/settings');
const ExpRec = new mongoose.Schema({
    userId: { type: Number },
    trans_from: { type: String, required: false },
    trans_from_id: { type: String, required: false },
    user_prev_balance: { type: Number },
    user_prev_availableBalance: { type: Number },
    user_prev_exposure: { type: Number, required: false },
    user_new_balance: { type: Number, required: false },
    user_new_availableBalance: { type: Number },
    trans_bet_status: { type: Number, default: 1 },
    user_new_exposure: { type: Number },
    sportsId: { type: Number },
    marketId: { type: String },
    createdAt: { type: Number },
    updatedAt:  { type: Number },
    calculatedExp: { type: String },
    calculateExp: { type: Boolean },
    position: { type: Number},
    exposureAmount: { type: Number },
    DateTime: {type: String, default: new Date()} 
});
ExpRec.pre('save', function (next) {
    let now = new Date().getTime();
    if (!this.createdAt) {
      this.createdAt = now;
    } else {
      this.updatedAt = now;
    }
    next();
});

ExpRec.plugin(Global.paginate);
ExpRec.plugin(Global.aggregatePaginate);

module.exports = mongoose.model('Exposures', ExpRec);
