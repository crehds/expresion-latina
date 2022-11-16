const MySQL = require('mysql');
const { config_mysql: config } = require('../config/');
const debug = require('debug')('app:mysql');

class MySqlLib {
  constructor() {
    this.client = new MySQL.createConnection({
      host: config.dbHostMysql,
      user: config.dbUserMysql,
      password: config.dbPasswordMysql,
      database: config.dbNameDBMysql
    });
  }

  connect() {
    return this.client.connect((err) => {
      if (err) return err;
      debug(`Connected succesfully to mysql with id: ${this.client.threadId}`);
    });
  }

  async query(sql, args) {
    debug('conectando');
    this.connect();
    try {
      const results = await new Promise((resolve, reject) => {
        this.client.query(sql, args, (err, rows, fields) => {
          debug(`Processing the query: ${sql}`);
          if (err) reject(err);
          resolve(rows);
        });
      });
      debug('Query results...');
      return results;
    } catch (error) {
      debug('Algo salió mal...');
      debug(error.stack);
      debug(error.sqlMessage);
      return error;
    }
  }

  //TODO FOR IMPLEMENTATION END CONNECTION

  //  query(sql, args) {
  //   debug("conectando");
  //   this.handleDisconnect(this.client);
  //   try {
  //     const results = new Promise((resolve, reject) => {
  //       this.connect();
  //       this.client.query(sql, args,
  //         (err,rows) => {
  //           this.client.end()
  //           debug(`Processing the query: ${sql}`);
  //           if (err) reject(err)
  //           debug("Query results...")
  //           console.log(this.client.state);
  //           this.client.end()
  //           resolve(rows);
  //         })
  //     })
  //     this.client.end();
  //     console.log(this.client.state);

  //     return results;
  //   } catch (error) {
  //     debug("Algo salió mal...");
  //     return error;
  //   }
  // }

  // handleDisconnect(client) {
  //   console.log(this.client);
  //   let template = this
  //   client.on('error', function (error) {
  //     if (!error.fatal) return;

  //     if (error.code !== 'PROTOCOL_CONNECTION_LOST') throw error;

  //     debug('> Re-connecting lost MySQL connection: ' + error.stack);

  //     NOTE: This assignment is to a variable from an outer scope; this is extremely important
  //     If this said `client =` it wouldn't do what you want. The assignment here is implicitly changed
  //     to `global.mysqlClient =` in node.
  //     template.client = MySQL.createConnection(client.config);
  //     template.handleDisconnect(template.client)
  //     template.connect();
  //     console.log('aqui');
  //   });
  // }

  async login(table) {
    try {
      const login = await this.query(`select * from ${table}`).then(
        (rows) => rows
      );
      return login;
    } catch (error) {
      return error;
    }
  }

  getLogin(login) {
    return this.query(
      `select * from login where login_name='${login.name}' and login_password='${login.password}'`
    );
  }

  nameLogin(loginName) {
    return this.query(`select * from login where login_name='${loginName}'`);
  }

  getUser(idusuario) {
    return this.query(`select * from usuario where idUsuario=${idusuario}`);
  }

  // INSERT INTO `expresionlatina`.`tipo_usuario` (`idTipo_usuario`, `tipo_usuario`) VALUES ('4', 'Becado');
  getUsers() {
    return this.query(`select * from usuario`);
  }

  createUser({ user }) {
    return this.query(
      `insert into usuario (nombre, apellido,fechaNacimiento,email, telefono,genero,Tipo_usuario) values ('${user.name}', '${user.lastname}','${user.edad}','${user.email}','${user.telefono}', '${user.genero}',7)`
    );
  }

  updateUser({ user }) {
    return this.query(
      `update usuario set nombre='${user.nombre}', apellido='${user.apellido}', edad='${user.edad}', email='${user.email}', telefono='${user.telefono}' where idUsuario=${user.idUsuario}`
    );
  }
  getTypeUser(typeOfUser) {
    debug(`Id de tipo de usuario a buscar: ${typeOfUser}`);
    return this.query(
      `select * from tipo_usuario where idTipo_usuario='${typeOfUser}'`
    ).then((rows) => rows);
  }

  getTypesUsers() {
    return this.query(`select * from tipo_usuario`).then((rows) => rows);
  }

  createLogin({ login }, userId) {
    return this.query(
      `insert into login (login_name, login_password, Usuario) values('${login.usuario}', '${login.password}', ${userId})`
    );
  }

  getProfesors() {
    return this.query(`select * from profesor`);
  }

  createProfesor({ profesor }) {
    return this.query(
      `insert into profesor (nombre, apellido, fechaNacimiento, email, telefono, genero, estado) values ('${profesor.nombre}','${profesor.apellido}','${profesor.fechaNacimiento}','${profesor.email}',
      '${profesor.telefono}','${profesor.genero}', 1)`
    );
  }

  saveImageProfesor({ profesorId }, pathImageprofesor) {
    return this.query(
      `update profesor set ruta_imageProfesor='${pathImageprofesor}' where idProfesor='${profesorId}'`
    );
  }

  getImageProfesor({ profesorId }) {
    return this.query(
      `select ruta_imageProfesor from profesor where idProfesor='${profesorId}'`
    );
  }

  getPathsImagesProfesors() {
    return this.query(
      `select idProfesor,nombre,apellido,ruta_imageProfesor from profesor`
    );
  }

  getDanceGenresProfesor(ProfesorId) {
    return this.query(
      `select idProfesor, idGenero_baile from generos_profesor where idProfesor=${ProfesorId}`
    );
  }

  getDanceGenres(danceGenreId) {
    return this.query(
      `select genero_baile from genero_baile where idGenero_baile=${danceGenreId}`
    );
  }

  setDanceGenresProfesor(ProfesorId, idDanceGenre) {
    return this.query(
      `insert into generos_profesor (idProfesor, idGenero_baile) values ('${ProfesorId}','${idDanceGenre}')`
    );
  }
}

module.exports = MySqlLib;
