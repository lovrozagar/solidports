// Exits 1, naming the port, when anything answers on it over IPv4 or IPv6. The fixed-port test
// servers run this first because `serve` 14 moves to a random port when its port is taken, even with
// --no-port-switching, and the tests would then load another process's pages.
//   node scripts/assert-port-free.mjs <port>
import net from 'node:net';

const port = Number(process.argv[2]);
if (!Number.isInteger(port) || port <= 0) {
  console.error('usage: node scripts/assert-port-free.mjs <port>');
  process.exit(2);
}

const answers = (host) =>
  new Promise((resolve) => {
    const socket = net.connect({ host, port });
    socket.setTimeout(1000);
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.once('error', () => resolve(false));
  });

for (const host of ['127.0.0.1', '::1']) {
  // eslint-disable-next-line no-await-in-loop -- one host at a time, to name the one that answers
  if (await answers(host)) {
    console.error(
      `port ${port} is taken (${host} answers); stop that server or wait for it, then rerun`,
    );
    process.exit(1);
  }
}
