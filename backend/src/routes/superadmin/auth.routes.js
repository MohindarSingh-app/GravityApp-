const express = require("express");
const { register, login } = require("../../controllers/superadmin/auth.controller");

const router = express.Router();

router.post("/register", register); // superadmin setup
router.post("/login", login);

module.exports = router;
