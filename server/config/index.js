require("dotenv").config({ path: "./server/.env" });

const config = {
  dev: process.env.NODE_ENV !== "production",
  port: process.env.PORT || 4000,
  CORS: process.env.CORS,
  DB_USER: process.env.DB_USER,
  DB_PASSWORD: process.env.DB_PASSWORD,
  DB_HOST: process.env.DB_HOST,
  DB_NAME: process.env.DB_NAME,
};

const config_mongo = {
  dbUserMongo: process.env.DB_USER_MONGO,
  dbPasswordMongo: process.env.DB_PASSWORD_MONGO,
  dbHostMongo: process.env.DB_HOST_MONGO,
  dbNameDBMongo: process.env.DB_NAME_MONGO,
};

module.exports = { config, config_mongo };
