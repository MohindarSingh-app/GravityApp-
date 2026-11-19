const AppError = require('../../utils/energy_service/AppError');
const { logError } = require('../../utils/energy_service/logger');

function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: 'The requested resource was not found.',
      requestId: req.requestId,
    },
  });
}

function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  logError(err);

  const requestId = req && req.requestId ? req.requestId : undefined;

  if (err.type === 'entity.parse.failed' || (err instanceof SyntaxError && err.status === 400)) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_JSON',
        message: 'Request body must be valid JSON.',
        requestId,
      },
    });
  }

  if (err.type === 'entity.too.large' || err.status === 413) {
    return res.status(413).json({
      success: false,
      error: {
        code: 'PAYLOAD_TOO_LARGE',
        message: 'Request body is too large.',
        requestId,
      },
    });
  }

  if (err instanceof AppError || err.isOperational) {
    const body = {
      success: false,
      error: {
        code: err.code || 'ERROR',
        message: err.message,
        requestId,
      },
    };
    if (err.details) {
      body.error.details = err.details;
    }
    return res.status(err.statusCode || err.status || 400).json(body);
  }

  return res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Something went wrong. Please try again.',
      requestId,
    },
  });
}

module.exports = { notFoundHandler, errorHandler };
