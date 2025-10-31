const { body, query } = require('express-validator');

module.exports.validate = (method) => {
  switch (method) {
    case 'addCashDeposit': {
      return [
        body('userId', 'userId is required')
          .exists()
          .isInt()
          .withMessage('userId must be number'),
        body('role', 'role is required')
          .exists()
          .isString()
          .withMessage(' role must be string'),
        body('amount', 'amount is required')
          .exists()
          .isInt()
          .withMessage('amount must be integer'),
        body('description', 'description is required')
          .optional()
          .isString()
          .withMessage('description must be string'),
      ];
    }
    case 'withDrawCashDeposit': {
      return [
        body('userId', 'userId is required')
          .exists()
          .isInt()
          .withMessage('userId must be number'),
        body('role', 'role is required')
          .exists()
          .isString()
          .withMessage(' role must be string'),
        body('amount', 'amount is required')
          .exists()
          .isInt()
          .withMessage('amount must be integer'),
        body('description', 'description is required')
          .optional()
          .isString()
          .withMessage('description must be string'),
      ];
    }
    case 'getAllCashDeposits': {
      return [
        query('userId', 'userId is required')
          .exists()
          .isInt()
          .withMessage('userId must be number'),
      ];
    }
  }
};
