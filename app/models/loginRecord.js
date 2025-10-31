/**
 * A schema class for the login Activity,
 * which will handle the login session
 * @type {schema}
 */
let mongoose = require('mongoose')
let Schema = mongoose.Schema

let LoginRecordSchema = new Schema({
	userName: { type: String },
	userId: { type: Number, required: true, default: 0 },
	locationData: { type: Schema.Types.Mixed },
    ipAddress: { type: String },
	createdAt: { type: Number },
})



const loginRecord = mongoose.model('loginRecord', LoginRecordSchema)
module.exports = loginRecord;