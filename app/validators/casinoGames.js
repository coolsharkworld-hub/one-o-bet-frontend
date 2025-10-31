const { body } = require('express-validator');

module.exports.validate = (method) => {
  switch (method) {
    case 'addSelectedCasinoCategories': {
      return [
        body('casinoCategories', 'Please provide an array of casinoCategories')
          .exists()
          .isArray()
          .custom((casinoCategories) => {
            if (casinoCategories) {
              casinoCategories.forEach((category) => {
                if (!category._id) {
                  throw new Error('Please provide a valid category ID.');
                }
                if (
                  category.status !== undefined &&
                  typeof category.status !== 'number'
                ) {
                  throw new Error('status must be a number.');
                }
                // if (!Array.isArray(category.games)) {
                //   throw new Error('games must be an array.');
                // }
              });
            }
            return true;
          }),
      ];
    }
  }
};
