const Users = require('../models/user')

function checkAccess(req, res, next) {
  let role = req.decoded.role
  let url = req.url
  url = url.replace('/api/', '')
  url = url.split('/')[0]
  url = url.split('?')[0]

  //if role is subadmin then check if he has access of the api or not
  if (role == 3) {
    Users.findOne({
      email: req.decoded.user, apis: {
        $in: [url]
      }
    },
      (err, user) => {
        if (err) return res.send({ message: 5022 })
        else if (!user) return res.send({ message: 5022 })
        else return next()
      })
  }
  else next()
}

module.exports = checkAccess
