/**
 * Global response helper
 * Standard format: { success, message, data }
 */

const successResponse = (res, statusCode = 200, message = "Success", data = null) => {
  return res.status(statusCode).json({ success: true, message, data });
};

const errorResponse = (res, statusCode = 500, message = "Something went wrong", data = null) => {
  return res.status(statusCode).json({ success: false, message, data });
};

module.exports = { successResponse, errorResponse };
