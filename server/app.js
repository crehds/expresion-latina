const express = require('express');
const debug = require('debug')('app:server');
const path = require('path');
const loginRouter = require('./routes/api/login');
const inicioRouter = require('./routes/api/inicio');
const adminRouter = require('./routes/api/admin');
//app
const app = express();

//middlewares globales
app.use(express.json());
// app.use(express.urlencoded());
// app.use(function(req, res, next) {
//   res.header("Access-Control-Allow-Origin", "http://localhost:3000"); // update to match the domain you will make the request from
//   res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
//   next();
// });
app.use('/static', express.static(path.join(__dirname, 'uploads')));

app.use('/login', loginRouter);
app.use('/inicio', inicioRouter);
app.use('/admin', adminRouter);

const server = app.listen(4000, function () {
  debug(`Listening http://localhost:${server.address().port}`);
});
