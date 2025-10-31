const express = require("express");
const { validationResult } = require("express-validator");
const  modulePermissions = require("../models/modulePermissions");
const modulePermissionsUsers = require("../models/modulePermissionsUsers")
const  modulePermissionUsersValidator = require("../validators/modulePermissionUsers");
const loginRouter = express.Router();

function addModulePermissionsUser(req, res) {
    const errors = validationResult(req);
    if (errors.errors.length !== 0) {
      return res.status(400).send({ errors: errors.errors });
    }
    modulePermissions.find({}, (err, data) => {
      if (err || !data) return res.status(404).send({ message: "Error finding module permissions", err });
      const modules = data.map(item => item.module); // get all modules
      const allowedModules = req.body.allowedModules;
      if (!allowedModules.every(module => modules.includes(module))) { // check if all allowedModules are valid
        return res.status(400).send({ message: "module is not found" });
      }
      const permissionUser = new modulePermissionsUsers(req.body);
      permissionUser.userId = req.body.userId;
      permissionUser.module = modules.join(', '); // join modules with comma separator
      permissionUser.allowedModules = modules.filter(module => allowedModules.includes(module)); // filter allowedModules array
      permissionUser.save((err, permission) => {
        if (err && err.code == 11000) {
            if (err.keyPattern.userId == 1)
              return res.status(404).send({ message: "permission is already assign to this userId" });
          }
        if (err) {
          return res.status(404).send({ message: "Error adding module permissions users" });
        }
        return res.send({ success: true, message: "Permissions for user added successfully", results: permission });
      });
    });
  }


loginRouter.post("/addModulePermissionsUser", 
modulePermissionUsersValidator.validate('addModulePermissionsUser'),
addModulePermissionsUser);

module.exports = {loginRouter} 
