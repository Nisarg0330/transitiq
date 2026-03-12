/**
 * TransitIQ — Logger
 * ===================
 * Shared Winston logger used across all API files.
 */

import winston from "winston";

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: winston.format.combine(
    winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    winston.format.colorize(),
    winston.format.printf(({ timestamp, level, message }) => {
      return `${timestamp} [${level}] api — ${message}`;
    })
  ),
  transports: [
    new winston.transports.Console(),
  ],
});
