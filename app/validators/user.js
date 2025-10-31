const { body, check } = require('express-validator');
const Users = require('../models/user');
// const verifySecureLogin = require('../middlewares/loginMiddleware');

module.exports.validate = (method) => {
  switch (method) {
    case 'registerUser': {
      return [
        body('userName', 'userName is required')
          .exists()
          .isString()
          .withMessage(' userName must be string'),
        body('reference', 'reference is required')
          .optional()
          .isString()
          .withMessage(' reference must be string'),
        body('isActive', 'isActive is required')
          .exists()
          .isBoolean()
          .withMessage(' isActive must be Boolean'),
        body('balance', 'balance is required')
          .optional()
          .isInt()
          .withMessage(' balance must be number'),
        body('downLineShare', 'downLineShare is required')
          .optional()
          .isInt()
          .withMessage(' downLineShare must be number'),
        body('phone', 'phone is required')
          .optional()
          .isString()
          .withMessage(' phone must be string')
          // .isLength({ min: 11, max: 14 })
          .withMessage(' phone min 11, max 14'),
        body('password', 'password is required')
          .exists()
          .isString()
          .withMessage('password must be string')
          .isLength({ min: 8 })
          .withMessage('Please enter a password at least 8 character long'),
        // .matches(/^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[^a-zA-Z0-9]).{8,}$/)
      ];
    }
    case 'login': {
      return [
        body('userName', 'userName is required')
          .exists()
          .isString()
          .withMessage(' userName must be string')
          .notEmpty()
          .withMessage('userName cannot be null'),
        body('password', 'password is required')
          .exists()
          .isString()
          .withMessage('password must be string')
          .notEmpty()
          .withMessage('password cannot be null'),
        // .matches(/^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])[a-zA-Z\d@$.!%#?&]/)
        // .withMessage(
        //   'Please enter a password at least 8 character and contain At least one uppercase.At least one lower case.At least one special character.At least One digit'
        // ),
      ];
    }
    case 'changePassword': {
      return [
        body('password', 'password is required')
          .exists()
          .isString()
          .withMessage(' password must be string'),
      ];
    }
    case 'updateUser': {
      return [
        (req, res, next) => {
          if (req.body.password) {
            const password = req.body.password;
            if (password.length < 8) {
              return res.status(400).send({
                message: 'Password must be at least 8 characters long',
              });
            }
          }
          next();
        },
        body('isActive', 'isActive is required')
          .optional()
          .isBoolean()
          .withMessage(' isActive must be Boolean')
          .notEmpty()
          .withMessage('isActive cannot be empty'),
        body('bettingAllowed', 'bettingAllowed is required')
          .optional()
          .isBoolean()
          .withMessage(' bettingAllowed must be Boolean'),
        body('canSettlePL', 'canSettlePL is required')
          .optional()
          .isBoolean()
          .withMessage(' canSettlePL must be Boolean'),
        body('phone', 'phone is required')
          .optional()
          .isString()
          .withMessage(' phone must be string'),
        body('reference', 'reference is required')
          .optional()
          .isString()
          .withMessage(' reference must be string'),
        body('notes', 'notes is required')
          .optional()
          .isString()
          .withMessage(' notes must be string'),
      ];
    }

    case 'searchUsers': {
      return [
        body('userName', 'userName is required')
          .exists()
          .isString()
          .withMessage('userName must be string '),
      ];
    }
    case 'getSingleUser': {
      return [
        body('id', 'id is required')
          .exists()
          .isString()
          .withMessage('id must be string '),
      ];
    }
    case 'activeUser': {
      return [
        body('id', 'id is required')
          .exists()
          .isString()
          .withMessage('id must be string '),
      ];
    }
    case 'deactiveUser': {
      return [
        body('id', 'id is required')
          .exists()
          .isString()
          .withMessage('id must be string '),
      ];
    }
    case 'checkValidation': {
      return [
        check('userName').notEmpty().withMessage('userName is required'),
        check('userName').custom((userName) => {
          return Users.findOne({ userName }).then((user) => {
            if (user == null) {
              return Promise.reject({message:'user does not exists',status:0});
            } else {
              return Promise.reject({message:'user already exists',status:1});
            }
          });
        }),
      ];
    }
    case 'settlePLAccount': {
      return [
        body('id', 'id is required')
          .exists()
          .isString()
          .withMessage('id must be string '),
        body('amount', 'amount is required')
          .exists()
          .withMessage('amount must be number '),
        body('description', 'description is required')
          .exists()
          .isString()
          .withMessage('description must be string ')
      ];
    }
    case 'userAccountSattlement': {
      return [
        body('userId', 'userId is required'),
        body('exposure', 'exposure is required'),
        body('availableBalance', 'availableBalance is required'),
        body('balance', 'balance is required'),
        body('clientPL', 'clientPL is required')
      ];
    } 
  }
};
