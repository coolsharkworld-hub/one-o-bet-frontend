let mongoose    = require('mongoose');
let Schema      = mongoose.Schema;
mongoose.set('debug', false);

let SportsBookSchema = new Schema({
    id: { type: Number },
    id_hash: { type: String },
    name: { type: String },
    type: { type: String },
    subcategory: { type: String },
    category: { type: String },
    gameName: { type: String },
    image_preview: { type: String },
    provider_name: { type: String },
    createdAt: { type: Number },
    createdAt: { type: Number },
});

SportsBookSchema.pre('save', function (next) {
  var now = new Date().getTime();
  if (!this.createdAt) {
    this.createdAt = now;
  } else {
    this.updatedAt = now;
  }
  next();
});

const SportsBook = mongoose.model('SportsBook', SportsBookSchema);

module.exports = SportsBook;
