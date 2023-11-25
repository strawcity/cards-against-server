const dotenv = require("dotenv");
const path = require("path");

dotenv.config({
  path: path.resolve(__dirname, `${process.env.NODE_ENV}.env`),
});

export const config = {
  NODE_ENV: process.env.NODE_ENV || "development",
  CORS_ALLOW: process.env.CORS_ALLOW || "localhost",
  JWT_SECRET: process.env.JWT_SECRET,
};
