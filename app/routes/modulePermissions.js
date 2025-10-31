const express = require("express");
const { validationResult } = require("express-validator");
const  modulePermissions = require("../models/modulePermissions");
const  modulePermissionValidator = require("../validators/modulePermissions");

const loginRouter = express.Router();

function addModulePermissions(req, res) {
  const errors = validationResult(req);
  if (errors.errors.length !== 0) {
    return res.status(400).send({ errors: errors.errors });
  }
  if(req.decoded.role != 0){
    return res.status(404).send({message:"you are not allowed to add permissions module"})
  }
  modulePermissions.findOne()
  .sort({ permissionId: -1 })
  .exec((err, data) => {
    if (err) return res.status(404).send({ message: "permission not found", err });
    const permission = new modulePermissions(req.body);
    permission.permissionId = data ? data.permissionId + 1 : 0;
    permission.save((err,permission) => {
        if (err && err.code == 11000) {
            if (err.keyPattern.module == 1)
              return res.status(404).send({ message: "module already present" });
          }
        if (err) {
            return res.status(404).send({ message: "Error adding module permissions" ,err});
          }
          
          return res.send({ success: true, message: "Permission module added successfully", results: permission,
          });
        })
    })
}

loginRouter.post("/addModulePermissions", 
modulePermissionValidator.validate('addModulePermissions'),
addModulePermissions);

module.exports = {loginRouter} 
