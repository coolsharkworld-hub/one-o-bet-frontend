function checkAccess(req, res, next, jsonApis) {
	let url = req.url
	url = url.replace('/api/', '')
	url = url.split('/')[0]
	url = url.split('?')[0]
	if (jsonApis.includes(url)) next()
	else {
		return res.status(404).send({ message: "api not found" })
	}
}

module.exports = checkAccess