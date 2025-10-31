const { body } = require("express-validator");

module.exports.validate = (method) => {
  switch (method) {
    case "addModulePermissionsUser": {
      return [
        body("allowedModules", "allowedModules is required")
          .exists()
          .isArray()
          .withMessage(" allowedModules must be array"),
      ];
    }
  }
};
