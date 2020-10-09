const MySqlLib = require("../lib/mysql");

class LoginService {
  constructor() {
    this.collection = "login";
    this.mysqlDB = new MySqlLib();
  }

  // async getLogin() {
  //   const login = await this.mysqlDB.login(this.collection);
  //   return login || [];
  // }

  async getLogin(findlogin) {
    const login = await this.mysqlDB.getLogin(findlogin);
    return login || [];
  }

  async GetTypeUser(typeOfUser) {
    const TypesUser = await this.mysqlDB.getTypeUser(typeOfUser);
    return TypesUser || [];
  }

  async GetTypesUsers() {
    const TypesUsers = await this.mysqlDB.getTypesUsers();
    return TypesUsers || [];
  }

  async getUser(findlogin) {
    const login = await this.getLogin(findlogin);
    
    if (Object.keys(login).length === 0) {
      return null;
    }
    const user = await this.mysqlDB.getUser(login[0].Usuario)
    return {login, user} || [];
  }

  async getUsers() {
    const users = await this.mysqlDB.getUsers();
    return users || [];
  }

  async createUser({ user, login }) {
    const userCreated = await this.mysqlDB.createUser({ user });
    const loginCreated = await this.mysqlDB.createLogin(
      { login },
      userCreated.insertId
    );
    return { userCreated, loginCreated } || [];
  }
}

module.exports = LoginService;