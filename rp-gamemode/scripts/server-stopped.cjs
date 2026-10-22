const dgram = require('node:dgram');
const net = require('node:net');
async function assertServerStopped(config) {
  if (config.listenHost !== '127.0.0.1' || config.uiListenHost !== '127.0.0.1') throw new Error('Only the approved loopback configuration is supported by this deployment tool');
  const port = config.port;
  if (!Number.isInteger(port) || port < 1 || port > 65534) throw new Error('Invalid server port');
  await new Promise((resolve, reject) => {
    const socket = dgram.createSocket('udp4');
    socket.once('error', error => { socket.close(); reject(new Error(`Server UDP port is occupied: ${error.code}`)); });
    socket.bind(port, '127.0.0.1', () => socket.close(resolve));
  });
  await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', error => reject(new Error(`Server HTTP port is occupied: ${error.code}`)));
    server.listen(port === 7777 ? 3000 : port + 1, '127.0.0.1', () => server.close(resolve));
  });
}
module.exports = { assertServerStopped };
