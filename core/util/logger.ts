import winston from "winston";

console.log("NODE_ENV", process.env.NODE_ENV);

export const logger = winston.createLogger({
  level: "info",
  format: winston.format.json(),
  transports: [
    // Write all logs with importance level of `info` or higher to `info.log`
    new winston.transports.File({ filename: "e2e.log", level: "info" }),
    // Normal console.log behavior
    new winston.transports.Console(),
  ],
});
