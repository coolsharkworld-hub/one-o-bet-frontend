const { body } = require('express-validator');

module.exports.validate = (method) => {
  switch (method) {
    case 'addAllowedMarketTypes': {
      return [
        body('blocked', 'blocked object is required and must be an object')
          .exists()
          .isObject()
      ];
    }
    case 'updateMarketStatus':{
      return [
        body('_id', 'market ID is required !').exists(),
        body('status', 'Status is required !').exists()
      ];
    }
  }
};
