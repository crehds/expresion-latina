const { config_mongo } = require('../config');
const { MongoClient, ObjectId } = require('mongodb');

const USER = encodeURIComponent(config_mongo.dbUserMongo);
const debug = require('debug')('app:mongo');
const PASSWORD = encodeURIComponent(config_mongo.dbPasswordMongo);
const DB_NAME = config_mongo.dbNameDBMongo;

const MONGO_URI = `mongodb+srv://${USER}:${PASSWORD}@${config_mongo.dbHostMongo}/${DB_NAME}?retryWrites=true&w=majority`;

class MongoLib {
  constructor() {
    this.client = new MongoClient(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    this.dbName = DB_NAME;
  }

  connect() {
    console.log(MONGO_URI);
    if (!MongoLib.connection) {
      MongoLib.connection = new Promise((resolve, reject) => {
        this.client.connect((err) => {
          if (err) {
            reject(err);
          }

          debug('Connected succesfully to mongo');
          resolve(this.client.db(this.dbName));
        });
      });
    }

    return MongoLib.connection;
  }

  getAll(collection, query) {
    return this.connect().then((db) => {
      return db.collection(collection).find(query).toArray();
    });
  }

  get(collection, id) {
    return this.connect().then((db) => {
      return db.collection(collection).findOne({ _id: ObjectId(id) });
    });
  }

  create(collection, { data }) {
    console.log(data);
    console.log(this);
    return this.connect()
      .then((db) => {
        debug('Creating poster...');
        return db.collection(collection).insertOne(data);
      })
      .then((result) => result.insertedId);
  }

  update(collection, { id, data }) {
    return this.connect()
      .then((db) => {
        debug('Updating poster...');
        console.log(id);
        return db
          .collection(collection)
          .updateOne({ _id: ObjectId(id) }, { $set: data }, { upsert: true });
      })
      .then((result) => result.upsertedId || id);
  }

  delete(collection, id) {
    return this.connect()
      .then((db) => {
        return db.collection(collection).deleteOne({ _id: ObjectId(id) });
      })
      .then(() => id);
  }

  deleteAll(collection) {
    return this.connect().then((db) => {
      return db.collection(collection).deleteMany({});
    });
  }
}

module.exports = MongoLib;
