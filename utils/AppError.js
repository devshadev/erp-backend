class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.success = false;

    // Maintains proper stack trace (V8 engines)
    Error.captureStackTrace(this, this.constructor);
  }
}

export default AppError;
