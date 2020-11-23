const MySqlLib = require("../lib/mysql");
const { localAddress } = require("../utils/localAddress");
class AdminService {
  constructor() {
    this.mysqlDB = new MySqlLib();
  }

  async getProfesors() {
    const profesors = await this.mysqlDB.getProfesors();
    console.log(profesors);
    return profesors || [];
  }

  async createProfesor({ profesor }) {
    const profesorCreated = await this.mysqlDB.createProfesor({ profesor });
    return profesorCreated || [];
  }

  async saveImageProfesor({ profesorId }, pathImageProfesor) {
    const imageProfesor = await this.mysqlDB.saveImageProfesor(
      { profesorId },
      pathImageProfesor
    );
    return imageProfesor || [];
  }

  async getImageProfesor({ profesorId }) {
    const pathImageProfesor = await this.mysqlDB.getImageProfesor({
      profesorId,
    });
    return pathImageProfesor || [];
  }

  async getPathsImagesProfesors() {
    let pathsImagesProfesors = await this.mysqlDB.getPathsImagesProfesors();
    pathsImagesProfesors = localAddress(pathsImagesProfesors);
    return pathsImagesProfesors || [];
  }
}

module.exports = AdminService;
