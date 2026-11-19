const AppError = require('../../utils/energy_service/AppError');

function validate(schema) {
  return function validateRequest(req, _res, next) {
    const parsed = schema.safeParse({
      body: req.body ?? {},
      query: req.query ?? {},
      params: req.params ?? {},
    });

    if (!parsed.success) {
      const details = parsed.error.issues.slice(0, 20).map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      }));
      return next(new AppError(
        'Check the submitted fields and try again.',
        422,
        'VALIDATION_ERROR',
        details,
      ));
    }

    req.body = parsed.data.body;
    if (parsed.data.params) req.params = parsed.data.params;
    if (parsed.data.query) {
      Object.defineProperty(req, 'query', {
        configurable: true,
        enumerable: true,
        writable: true,
        value: parsed.data.query,
      });
    }
    return next();
  };
}

module.exports = { validate };
