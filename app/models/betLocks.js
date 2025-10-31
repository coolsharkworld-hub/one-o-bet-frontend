// const mongoose = require('mongoose');

// const betLockSchema = new mongoose.Schema({
//   betLockStatus: { type: Number, required: true, default: 0 },
//   users: [
//     {
//       user: {
//         type: mongoose.Schema.Types.ObjectId,
//         ref: 'User',
//         required: true,
//       },
//       selected: { type: Boolean, required: true, default: false },
//       userName: { type: String, required: false },
//       userId: { type: Number, required: true },
//       marketId: { type: Number, required: true },
//       marketName: { type: String, required: false },
//     },
//   ],
//   createdAt: { type: Number },
//   updatedAt: { type: Number },
// });

// betLockSchema.pre('save', function (next) {
//   const now = new Date().getTime() / 1000;
//   if (!this.createdAt) {
//     this.createdAt = now;
//   } else {
//     this.updatedAt = now;
//   }
//   next();
// });

// const BetLock = mongoose.model('BetLock', betLockSchema);

// module.exports = BetLock;
