const { body } = require('express-validator');

module.exports.validate = (method) => {
  switch (method) {
    case 'addBetLock': {
      return [
        body('selectedUsers', 'Please provide an array of selected user IDs')
          .optional()
          .isArray()
          .custom((selectedUsers) => {
            if (selectedUsers) {
              selectedUsers.forEach((user) => {
                if (!user.userId) {
                  throw new Error('Please provide a valid user ID.');
                }
                if (
                  user.betLockStatus !== undefined &&
                  typeof user.betLockStatus !== 'boolean'
                ) {
                  throw new Error('betLockStatus must be Boolean');
                }
              });
            }
            return true;
          }),
        body('allUsers')
          .optional()
          .isBoolean()
          .withMessage('Invalid value for allUsers.'),
        body('betLockStatus', 'betLockStatus is required')
          .optional()
          .isBoolean()
          .withMessage('Invalid value for betLockStatus'),
        // body('marketId', 'marketId is required')
        //   .exists()
        //   .isString()
        //   .withMessage('marketId must be string'),
      ];
    }
  }
};
