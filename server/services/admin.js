const MySqlLib = require("../lib/mysql");

class AdminService {
  constructor() {
    this.mysqlDB = new MySqlLib();
  }

  async getProfesors() {
    const profesors = await this.mysqlDB.getProfesors();
    console.log(profesors);
    return profesors || [];
  }

  async createProfesor ({profesor}) {
    const profesorCreated = await this.mysqlDB.createProfesor({profesor});
    return profesorCreated || [];
  }
}

module.exports = AdminService;
