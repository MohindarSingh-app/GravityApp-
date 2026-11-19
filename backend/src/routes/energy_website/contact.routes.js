const express = require("express");
const { createContact, getContacts } = require("../../controllers/energy_website/contact.controller");
const { auth, allowRoles } = require("../../middleware/auth");

const router = express.Router();

router.post("/", createContact);                              // public
router.get("/", auth, allowRoles("admin", "superadmin"), getContacts); // protected

module.exports = router;
