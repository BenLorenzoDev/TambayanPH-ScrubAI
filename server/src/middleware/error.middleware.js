import logger from '../utils/logger.js';
import config from '../config/index.js';

export const notFound = (req, res, next) => {
  const error = new Error(`Not Found - ${req.originalUrl}`);
  res.status(404);
  next(error);
};

export const errorHandler = (err, req, res, next) => {
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;

  logger.error(err.message, { stack: err.stack });

  res.status(statusCode).json({
    success: false,
    message: err.message,
    stack: config.env === 'production' ? null : err.stack,
  });
};
