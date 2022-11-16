const MongoLib = require('../lib/mongo');
const createArrayImg = require('./utils');
class PostersService {
  constructor() {
    this.collection = 'posters';
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
    const arrayCreatedPosters = await this.createOrUpdate(null, posters);
    return arrayCreatedPosters || [];
  }

  async updatePoster({ postersId, posters }) {
    const updatedPosterId = await this.createOrUpdate(postersId, posters);
    return updatedPosterId;
  }

  async createOrUpdate(postersId, posters) {
    let action = '';
    let data = [];
    if (postersId === null) {
      action = (collection, poster) => this.mongoDB.create(collection, poster);
      data = createArrayImg(null, posters);
    } else {
      action = (collection, poster) => this.mongoDB.update(collection, poster);
      data = createArrayImg(postersId, posters);
    }
    const results = await this.execAction(action, data);
    return results || [];
  }

  async execAction(action, data) {
    const promises = data.map(async (poster) => {
      let createdPosterId = await action(this.collection, poster);
      return createdPosterId;
    });
    const resolvedPromises = await Promise.all(promises);
    return resolvedPromises;
  }

  async deletePoster({ postersId }) {
    const ids = postersId.split(',');
    const promises = ids.map(async (posterId) => {
      let deletedPoster = await this.mongoDB.delete(this.collection, posterId);
      return deletedPoster;
    });

    const deletedPosterIds = await Promise.all(promises);

    return deletedPosterIds;
  }

  async deletePosters() {
    const deletedPosters = await this.mongoDB.deleteAll(this.collection);
    return deletedPosters;
  }
}

module.exports = PostersService;
