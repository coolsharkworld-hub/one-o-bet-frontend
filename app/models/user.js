const mongoose = require('mongoose');
const Schema = mongoose.Schema;
var bcrypt = require('bcrypt');
let config = require('config');
let Global = require('../global/settings');
mongoose.set('debug', false);
const saltrounds = config.saltRounds;

/**
 * [UserSchema description]
 * @roles [ 0 (company) 1 (superAdmin), 2 (admin), 3 (superMaster), 4 (master), 5 (better)]
 *  @status [ 0 (in-active) 1 (active)s]
 */

const userSchema = new Schema({
  userName: { type: String, required: true, unique: false },
  password: { type: String, required: true },
  reference: { type: String, required: false },
  phone: { type: String, required: false },
  token: { type: String, default: '', index: true },
  role: { type: String, default: 0, index: true },
  isActive: { type: Boolean, default: true },
  status: { type: Number, default: 1 },
  notes: { type: String },
  userId: { type: Number, required: true, index: true, unique: true, default: 0 },
  passwordChanged: { type: Boolean, default: false },
  balance: { type: Number, default: 0, required: true },
  createdBy: { type: Number, default: 0 },
  downLineShare: { type: Number, default: 0 },
  bettingAllowed: { type: Boolean, default: true },
  canSettlePL: { type: Boolean, default: true },
  updatedBy: { type: Number },
  updatedAt: { type: Number },
  createdAt: { type: Number },
  isDeleted: { type: Boolean, required: false, default: false },
  clientPL: { type: Number, required: false, default: 0 },
  credit: { type: Number, required: false, default: 0 },
  creditLimit: { type: Number, default: 0 },
  availableBalance: { type: Number, default: 0 },
  exposure: { type: Number, default: 0 },
  blockedMarketPlaces: { type: Array },
  blockedSubMarkets: { type: Array },
  blockedSubMarketsByParent: { type: Array },
  betLockStatus: { type: Boolean },
  matchOddsStatus: { type: Boolean },
  baseCurrency: { type: String },
  creditRemaining: { type: Number, default: 0 },
  cash: { type: Number, default: 0 },
  remoteId: { type: Number },
  data: { type: Object, default: {} },
  activeBetPlacing: { type: Boolean, default: false },
});

userSchema.methods.hashPass = function (next) {
  // add some stuff to the users name
  bcrypt.hash(this.password, saltrounds, function (error, hash) {
    if (error) {
      return next(error);
    } else {
      this.password = hash;
      // next should be called after the password has been hashed
      // otherwise non hashed password will be saved in the db
      next();
    }
  });
};

// Sets the createdAt parameter equal to the current time
userSchema.pre('save', function (next) {
  if (!this.isModified('password')) {
    return next();
  } // Adding this statement solved the problem!!
  const user = this;
  var now = new Date().getTime();
  if (!this.createdAt) {
    this.createdAt = now;
    this.updatedAt = now;
  } else {
    this.updatedAt = now;
  }
  bcrypt.hash(user.password, saltrounds, function (error, hash) {
    if (error) {
      return next(error);
    } else {
      user.password = hash;
      // next should be called after the password has been hashed
      // otherwise non hashed password will be saved in the db
      next();
    }
  });
});
userSchema.plugin(Global.paginate);
userSchema.plugin(Global.aggregatePaginate);

userSchema.index({ userId: 1, isActive: 1 });
userSchema.index({ userId: 1 });
userSchema.index({ createdAt: -1 });
userSchema.index({ bettingAllowed: 1 });

const User = mongoose.model('User', userSchema);

module.exports = User;
