const Contact = require('../../models/energy_website/contact.model');
const { successResponse, errorResponse } = require('../../utils/response');

exports.createContact = async (req, res) => {
  try {
    const { name, email, message } = req.body || {};
    if (!name || !email || !message) {
      return errorResponse(res, 400, 'Name, email and message are required');
    }
    const contact = await Contact.create(req.body);
    return successResponse(res, 201, 'Thank you! We will contact you soon.', contact);
  } catch (err) {
    return errorResponse(res, 500, err.message);
  }
};

exports.getContacts = async (req, res) => {
  try {
    const contacts = await Contact.find();
    return successResponse(res, 200, 'Contacts fetched', contacts.sort());
  } catch (err) {
    return errorResponse(res, 500, err.message);
  }
};
