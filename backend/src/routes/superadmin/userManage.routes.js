const express = require("express");
const { getAllUsers, blockUser, unblockUser, deleteUser, dashboard } = require("../../controllers/superadmin/userManage.controller");
const { auth, allowRoles } = require("../../middleware/auth");

const router = express.Router();

// All routes superadmin-only
router.use(auth, allowRoles("superadmin"));

router.get("/dashboard", dashboard);
router.get("/users", getAllUsers);
router.patch("/users/:id/block", blockUser);
router.patch("/users/:id/unblock", unblockUser);
router.delete("/users/:id", deleteUser);

module.exports = router;
