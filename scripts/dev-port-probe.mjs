import { createConnection } from 'node:net';

export function listening(port, connect = createConnection) {
  return new Promise((resolve, reject) => {
    const socket = connect({ host: '127.0.0.1', port });
    socket.once('connect', () => { socket.destroy(); resolve(true); });
    socket.once('error', error => {
      socket.destroy();
      if (error.code === 'ECONNREFUSED') return resolve(false);
      // A reset during shutdown is transient activity, not proof of a free port.
      // Startup must not claim it; shutdown can probe again after the listener exits.
      if (error.code === 'ECONNRESET') return resolve(true);
      reject(error);
    });
    socket.setTimeout(1000, () => {
      socket.destroy();
      reject(new Error(`Port ${port} probe timed out`));
    });
  });
}
