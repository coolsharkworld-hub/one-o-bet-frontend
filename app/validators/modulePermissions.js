const { body } = require("express-validator");

module.exports.validate = (method) => {
  switch (method) {
    case "addModulePermissions": {
      return [
        body("module", "module is required")
          .exists()
          .isString()
          .withMessage(" module must be string"),
      ];
    }
  }
};
