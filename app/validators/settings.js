const { body } = require('express-validator');

module.exports.validate = (method) => {
  switch (method) {
    case 'updateDefaultTheme': {
      return [
        body('_id', 'please enter _id')
          .exists()
          .isString()
          .withMessage('_id must be string'),
        body('defaultThemeName', 'please enter defaultThemeName')
          .exists()
          .isString()
          .withMessage('defaultThemeName must be string'),
      ];
    }
    case 'updateDefaultLoginPage': {
      return [
        body('_id', 'please enter _id')
          .exists()
          .isString()
          .withMessage('_id must be string'),
        body('defaultLoginPage', 'please enter defaultLoginPage')
          .exists()
          .isString()
          .withMessage('defaultLoginPage must be string'),
      ];
    }
    case 'addTermsAndConditions': {
      return [
        body(
          'termAndConditionsContent',
          'please enter termAndConditionsContent'
        )
          .exists()
          .isString()
          .withMessage('termAndConditionsContent must be string'),
      ];
    }
    case 'addPrivacyPolicy': {
      return [
        body('privacyPolicyContent', 'please enter privacyPolicyContent')
          .exists()
          .isString()
          .withMessage('privacyPolicyContent must be string'),
      ];
    }
    case 'updateDefaultExchange': {
      return [
        body('exchangeRates')
          .isArray({ min: 1 })
          .withMessage('exchangeRates must be a non-empty array'),
        body('exchangeRates.*.currency')
          .exists()
          .withMessage('currency is required')
          .isString()
          .withMessage('currency must be a string'),
        body('exchangeRates.*.exchangeAmount')
          .exists()
          .withMessage('exchangeAmount is required')
          .isNumeric()
          .withMessage('exchangeAmount must be a number'),
        body('exchangeRates.*._id')
          .exists()
          .withMessage('_id is required')
          .isString()
          .withMessage('_id must be a string'),
      ];
    }
    case 'updateDefaultBetSizes': {
      return [
        body('betLimits', 'betLimits are required')
          .exists()
          .isArray({ min: 0 })
          .withMessage('betLimits must be array'),
        body('betLimits.*.maxAmount')
          .exists()
          .withMessage('maxAmount is required')
          .isInt()
          .withMessage('maxAmount must be a number'),
        body('betLimits.*._id')
          .exists()
          .withMessage('_id is required')
          .isString()
          .withMessage('_id must be a string'),
      ];
    }
    case "SetAsianDashboard": {
      return [
        body('tableId', 'tableId is required'),
        body('isDashboard', 'isDashboard is required'),
      ];
    }
    default:{

    }
  }
};
