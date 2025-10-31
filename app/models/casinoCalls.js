const mongoose = require('mongoose');

const casinoCallsSchema = new mongoose.Schema({
  action: { type: String, required: false },
  callerId: { type: String, required: false },
  callerPassword: { type: String, required: false },
  callerPrefix: { type: String, required: false },
  username: { type: String, required: false },
  remote_id: { type: Number, required: false },
  amount: { type: String, required: false },
  provider: { type: String, required: false },
  game_id: { type: String, required: false },
  transaction_id: { type: String, required: false },
  gameplay_final: { type: Number, required: false },
  round_id: { type: String, required: false },
  session_id: { type: String, required: false },
  key: { type: String, required: false },
  gamesession_id: { type: String, required: false },
  fee: { type: Number, required: false },
  tip_in_amount: { type: Number, required: false },
  is_freeround_bet: { type: Boolean, required: false },
  freeround_id: { type: String, required: false },
  odd_factor: { type: Number, required: false },
  jackpot_contribution_in_amount: { type: Number, required: false },
  jackpot_contribution_ids: { type: Array, required: false },
  jackpot_contribution_per_id: { type: Array, required: false },
  game_id_hash: { type: String, required: false }, // New field: game_id_hash
  is_freeround_win: { type: Number, required: false }, // New field: is_freeround_win
  freeround_spins_remaining: { type: Number, required: false }, // New field: freeround_spins_remaining
  freeround_completed: { type: Number, required: false }, // New field: freeround_completed
  is_promo_win: { type: Number, required: false }, // New field: is_promo_win
  is_jackpot_win: { type: Number, required: false }, // New field: is_jackpot_win
  jackpot_win_ids: { type: Array, required: false }, // New field: jackpot_win_ids
  jackpot_win_in_amount: { type: Number, required: false }, // New field: jackpot_win_in_amount
  createdAt: { type: Number },
  updatedAt:  { type: Number },
});

casinoCallsSchema.pre('save', function (next) {
  let now = new Date().getTime();
  if (!this.createdAt) {
    this.createdAt = now;
  } else {
    this.updatedAt = now;
  }
  next();
});
const CasinoCalls = mongoose.model('CasinoCalls', casinoCallsSchema);

module.exports = CasinoCalls;
