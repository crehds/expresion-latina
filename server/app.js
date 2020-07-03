const express = require("express");
const debug = require("debug")("app:server");
const loginRouter = require("./routes/api/login");
const inicioRouter = require("./routes/api/inicio");
//app
const app = express();

//middlewares globales
app.use(express.json());

// app.use(function(req, res, next) {
//   res.header("Access-Control-Allow-Origin", "http://localhost:3000"); // update to match the domain you will make the request from
//   res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
//   next();
// });
app.use("/login", loginRouter)
app.use("/inicio", inicioRouter)

const server = app.listen(4000, function () {
  debug(`Listening http://localhost:${server.address().port}`);
});
