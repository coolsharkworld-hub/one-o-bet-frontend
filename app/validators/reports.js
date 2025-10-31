const { body, query } = require('express-validator');

module.exports.validate = (method) => {
  switch (method) {
    case 'cashDepositLedger': {
      return [
        body('startDate', 'startDate is required')
          .optional()
          .isString()
          .withMessage(' startDate must be string'),
        body('endDate', 'endDate is required')
          .optional()
          .isString()
          .withMessage('endDate must be string'),
        body('userId', 'userId is required')
          .exists()
          .isInt()
          .withMessage('userId must be a number'),
      ];
    }
    case 'getDailyPLReport': {
      return [
        query('startDate', 'startDate is required')
          .exists()
          .isString()
          .withMessage(' startDate must be string'),
        query('endDate', 'endDate is required')
          .exists()
          .isString()
          .withMessage('endDate must be string')
      ];
    }
    case 'dailyPLSportsWiseReport': {
      return [
        query('userId', 'userId is required')
          .exists()
          .isInt()
          .withMessage('userId must be a number'),
        query('startDate', 'startDate is required')
          .exists()
          .isString()
          .withMessage(' startDate must be string'),
        query('endDate', 'endDate is required')
          .exists()
          .isString()
          .withMessage('endDate must be string'),
      ];
    }
    
    case 'dailyPlMarketsReports': {
      return [
        query('userId', 'userId is required')
          .exists()
          .isInt()
          .withMessage('userId must be a number'),
        query('marketId', 'marketId is required')
          .optional()
          .isString()
          .withMessage('marketId must be a string'),
        query('startDate', 'startDate is required')
          .exists()
          .isString()
          .withMessage(' startDate must be string'),
        query('endDate', 'endDate is required')
          .exists()
          .isString()
          .withMessage('endDate must be string'),
      ];
    }
    case 'bookDetail2Report': {
      return [
        query('userId', 'userId is required')
          .optional()
          .isInt()
          .withMessage('userId must be a number'),
        query('startDate', 'startDate is required')
          .exists()
          .isString()
          .withMessage(' startDate must be string'),
        query('endDate', 'endDate is required')
          .exists()
          .isString()
          .withMessage('endDate must be string'),
      ];
    }
  }
};
