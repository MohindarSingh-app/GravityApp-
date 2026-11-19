const notFound = (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.originalUrl} not found`,
  });
};

/**
 * Global error handler.
 *
 * `ApiError` carries the HTTP status it should be reported with; anything else
 * is treated as an unexpected failure and reported as a 500 without leaking
 * internals to the client.
 */
const errorHandler = (err, req, res, next) => {
  if (res.headersSent) return next(err);

  const status = Number(err.status) || 500;
  if (status >= 500) {
    console.error('Unhandled error:', err);
  }

  return res.status(status).json({
    success: false,
    message: err.message || 'Internal server error',
    ...(err.details ? { details: err.details } : {}),
  });
};

module.exports = { notFound, errorHandler };
