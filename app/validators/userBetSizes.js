const { body } = require('express-validator');

module.exports.validate = (method) => {
  switch (method) {
    case 'updateBetSizes': {
      return [
        body('betSizes')
          .isArray({ min: 1 })
          .withMessage('betSizes must be a non-empty array'),
        body('betSizes.*.amount')
          .exists()
          .withMessage('amount is required')
          .isNumeric()
          .withMessage('amount must be a number'),
        body('betSizes.*._id')
          .exists()
          .withMessage('_id is required')
          .isString()
          .withMessage('_id must be a string'),
      ];
    }
  }
};
