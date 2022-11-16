const os = require('os');
const networkInterfaces = os.networkInterfaces();

function localAddress(arr) {
  return arr.map((e) => ({
    ...e,
    ruta_imageProfesor: `http://${networkInterfaces.eth0[0].address}:4000${e.ruta_imageProfesor}`
  }));
}

module.exports = { localAddress };
