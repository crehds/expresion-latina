const { config_mongo } = require("../config");
const { MongoClient, ObjectId, GridFSBucket } = require("mongodb");
const debug = require("debug")("app:mongodb");
const fs = require("fs");
const assert = require("assert");
const USER = encodeURIComponent(config_mongo.dbUserMongo);
const PASSWORD = encodeURIComponent(config_mongo.dbPasswordMongo);
const DB_NAME = config_mongo.dbNameDBMongo;

const MONGO_URI = `mongodb+srv://${USER}:${PASSWORD}@${config_mongo.dbHostMongo}/${config_mongo.dbNameDBMongo}?retryWrites=true&w=majority`;

const { PassThrough } = require("stream");

class MongoLib {
  constructor() {
    this.client = new MongoClient(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
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
          debug("Connected succesfully to mongo");
          resolve(this.client.db(this.dbName));
        });
      });
    }
    return MongoLib.connection;
  }

  getAll(collection, query) {
    return this.connect().then((db) => {
      return db.collection(`${collection}.files`).find(query).toArray();
    });
  }

  get(collection, id) {
    return this.connect().then((db) => {
      return db
        .collection(`${collection}.files`)
        .findOne({ _id: ObjectId(id) });
    });
  }

  // create(collection, poster) {
  //   return this.connect()
  //     .then((db) => {
  //       let posterCollection = new GridFSBucket(db, {
  //         bucketName: collection,
  //       });
  //       return fs
  //         .createReadStream(poster.path)
  //         .pipe(posterCollection.openUploadStream("portada2"))
  //         .on("error", function (error) {
  //           if (error) assert.ifError(error);
  //         })
  //         .on("finish", function () {
  //           debug("done!");
  //         });
  //     })
  //     .then((result) => result);
  // }

  create(collection, posters) {
    return posters.map((poster) => {
      const filename = this.connect()
        .then((db) => {
          let posterCollection = new GridFSBucket(db, {
            bucketName: collection,
          });
          return fs
            .createReadStream(poster.path)
            .pipe(posterCollection.openUploadStream("portada2"))
            .on("error", function (error) {
              if (error) assert.ifError(error);
            })
            .on("finish", function () {
              debug("done!");
            })
        })
        .then((result) => {
          return result.filename;
        });
      return filename;
    });
  }

  update(collection, id, data) {
    return this.connect()
      .then((db) => {
        return db
          .collection(collection)
          .updateOne({ _id: ObjectId(id) }, { $set: data }, { upsert: true });
      })
      .then((result) => result.upsertedId || id);
  }

  delete(collection, id) {
    return this.connect()
      .then((db) => {
        let bucket = new GridFSBucket(db, { bucketName: collection });
        return bucket.delete(ObjectId(id), (error) => {
          if (error) {
            debug("error on deleting...");
            assert.ifError(error);
          }
        });
      })
      .then(() => id);
  }

  deleteAll(collection) {
    return this.connect()
      .then((db) => {
        let bucket = new GridFSBucket(db, { bucketName: collection });
        return bucket
          .drop((error) => {
            if (error) {
              debug("error on dropping...");
              assert.ifError(error);
            }
            debug("posters deleted");
          })
          .then(() => {
            let files = db.collection(`${collection}.files`).find().toArray();
            let chunks = db.colletion(`${collection}.chunks`).find().toArray();
            return { files, chunks };
          });
      })
      .then((result) => {
        console.log(result);
        return result
          ? { files: result.files, chunks: result.chunks }
          : `Something getting wrong`;
      });
  }
}

module.exports = MongoLib;
