function checkAccess(req, res, next, roles, jsonAccess) {
	let url = req.url
	////console.log(url)
	url = url.replace('/api/', '')
	url = url.split('/')[0]
	url = url.split('?')[0]
	let method = req.method
	let role = req.decoded.role
	////console.log(role)
	if (role == 3) {
		//Class Here to GetInstance of Roles in Object. After that it will update after Add or Update Role
		//  ssTODO Note: Here Needs to be Implement the Roles base authentication via acl list
		//  Sub Role Base Authentication for admin portal.
	}
	if (jsonAccess[roles[role]][method.toLowerCase()].includes(url)) next()
	else return res.status(404).send({ message: 5022 })
}

module.exports = checkAccess