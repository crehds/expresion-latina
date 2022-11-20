const MongoLib = require("../lib/mongodb");

class PostersService {
  constructor() {
    this.collection = "posters";
    this.mongoDB = new MongoLib();
  }

  async getPosters({ tags }) {
    const query = tags && { tags: { $in: tags } };
    const posters = await this.mongoDB.getAll(this.collection, query);

    return posters || [];
  }

  async getPoster({ posterId }) {
    const poster = await this.mongoDB.get(this.collection, posterId);
    return poster || {};
  }

  async createPoster({ posters }) {
    const createdPosterId = await this.mongoDB.create(this.collection, posters);
    return createdPosterId;
  }

  async updatePoster({ posterId, poster }) {
    const updatedProductId = await this.mongoDB.update(
      this.collection,
      posterId,
      poster
    );
    return updatedProductId;
  }

  async deletePoster({ posterId }) {
    const deletedPosterId = await this.mongoDB.delete(
      this.collection,
      posterId
    );

    return deletedPosterId;
  }

  async deletePosters() {
    const deletedPosters = await this.mongoDB.deleteAll(this.collection);
    return deletedPosters;
  }
}

module.exports = PostersService;
