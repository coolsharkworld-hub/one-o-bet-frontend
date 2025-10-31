function checkRole(req, res, next) {
  const role = req.decoded.role; // Assuming the user role is stored in req.decoded.role
  // Define the roles that the user can register based on their own role
  if (req.body.role) {
  const allowedRoles = {
    0: ["1", "2", "3", "4", "5"], // Company can register any user type
    1: ["2", "3", "4", "5"], // SuperAdmin can register any user type except Company
    2: ["3", "4", "5"], // Admin can register any user type except Company and SuperAdmin
    3: ["4", "5"], // SuperMaster can register Master and User
    4: ["5"], // Master can register User only
  };

  // Check if the user is allowed to register the requested user type

  const requestedRole = req.body.role;
  //console.log("requestRole", req.body.role);
  if (!allowedRoles[role].includes(requestedRole)) {
    return res.status(404).json({ message: "You are not authorized to do this operation" });
    }
  }
  // If the user is allowed, proceed to the next middleware or route handler
  next();
}

module.exports = checkRole;
