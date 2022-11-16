require('dotenv').config({ path: './server/.env' });

const config = {
  dev: process.env.NODE_ENV !== 'production',
  port: process.env.PORT || 4000,
  CORS: process.env.CORS
};

const config_mysql = {
  dbUserMysql: process.env.DB_USER_MYSQL,
  dbPasswordMysql: process.env.DB_PASSWORD_MYSQL,
  dbHostMysql: process.env.DB_HOST_MYSQL,
  dbNameDBMysql: process.env.DB_NAME_MYSQL
};

const config_mongo = {
  dbUserMongo: process.env.DB_USER_MONGO,
  dbPasswordMongo: process.env.DB_PASSWORD_MONGO,
  dbHostMongo: process.env.DB_HOST_MONGO,
  dbNameDBMongo: process.env.DB_NAME_MONGO
};

module.exports = { config, config_mysql, config_mongo };
