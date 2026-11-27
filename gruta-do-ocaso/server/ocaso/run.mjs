import { once } from 'node:events';
import { createStandaloneGame } from './standalone.mjs';

const host = process.env.OCASO_HOST || '127.0.0.1';
const port = Number(process.env.PORT || 4286);
const server = await createStandaloneGame();
server.listen(port, host);
await once(server, 'listening');
console.log(`Gruta do Ocaso disponível em http://${host}:${server.address().port}`);

process.once('SIGINT', () => server.close());
process.once('SIGTERM', () => server.close());
