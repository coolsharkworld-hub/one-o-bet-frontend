const LoginActivity = require('../models/loginActivity');
const jwt = require('jsonwebtoken');
const config = require('config');

require('dotenv').config();
const secret = process.env.secret;

// const geoHash = require('ngeohash')

function verifySecureLogin(req, res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader) {
    const token = authHeader.split(' ')[1];
    check(req, res, next, token);
  } else {
    return res.status(404).send({ message: 'Authorization token is missing' });
  }
}

function check(req, res, next, token) {
  LoginActivity.findOneAndUpdate(
    {
      token: token,
      isActive: 'true',
    },
    {
      lastSeen: new Date().getTime(),
      location: req.location
        ? {
            type: 'Point',
            coordinates: geoHash.decode(req.location),
          }
        : null,
      region: req.region ? req.region : null,
    },
    { upsert: false, new: false },
    (err, userObj) => {
      if (err)
        return res
          .status(404)
          .send({ message: 'Failed to verify authorization token', err });
      if (!userObj)
        return res.status(404).send({
          message: 'Invalid or expired authorization token or inactive token',
        }); //when the testing, comment

      jwt.verify(token, secret, function (err, decoded) {
        // //console.log('decoded:', decoded);
        if (err)
          return res
            .status(404)
            .send({ message: 'Failed to verify authorization token', err });
        // if everything is good, save to request for use in other routes
        req.decoded = decoded;
        req.decoded.login = userObj;
        if (decoded.user !== userObj.email)
          return res
            .status(404)
            .send({ message: 'Invalid or expired authorization token' }); //when the testing, comment
        var dateNow = new Date();
        if (decoded.expr < dateNow.getTime()) {
          return res
            .status(404)
            .send({ message: 'Invalid or expired authorization token' });
        }
        next();
      });
    }
  );
}

module.exports = verifySecureLogin;
