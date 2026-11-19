function sendSuccess(res, data, statusCode = 200, message) {
  const payload = { success: true, data: data ?? {} };
  if (message) {
    payload.message = message;
  } else if (data && typeof data.message === 'string') {
    payload.message = data.message;
  }
  res.status(statusCode).json(payload);
}

module.exports = { sendSuccess };
