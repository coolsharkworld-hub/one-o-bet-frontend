/**
 * A schema class for the login Activity,
 * which will handle the login session
 * @type {schema}
 */
let mongoose = require('mongoose')
let Schema = mongoose.Schema
// let Global = require('../global/settings')
mongoose.set('debug', true)

let LoginActivitySchema = new Schema({
	userName: { type: String },
	phone: { type: String },
	token: { type: String, default: '', index: true },
	isActive: { type: String, default: false },
	status: { type: Number, default: 0 },
	userId: { type: Number, required: true, default: 0 },
	balance: { type: Number },
	// deviceId: { type: String, default: '' },
	role: { type: String, default: 0 },
	ipAddress: { type: String },
	updatedAt: { type: Number },
	createdAt: { type: Number },
	createdBy: { type: Number },
})

LoginActivitySchema.pre('update', function (next) {
	var now = new Date().getTime()
	this.updatedAt = now
	next()
})

// LoginActivitySchema.index({ email: 1, deviceId: 1 })
// LoginActivitySchema.index({ userDetail: 1, token: 1, isSuspended: 1 })
// LoginActivitySchema.plugin(Global.paginate)
Schema({}, { usePushEach: true })
module.exports = mongoose.model('loginActivity', LoginActivitySchema)
