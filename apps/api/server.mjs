import { createServer } from 'node:http';

const port = Number(process.env.PORT || 3000);
const server = createServer((request, response) => {
  const healthy = request.method === 'GET' && request.url === '/api/health';
  response.writeHead(healthy ? 200 : 404, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  });
  response.end(JSON.stringify(healthy
    ? { status: 'ok', service: 'jaguar-api', stage: 'infrastructure' }
    : { error: 'Not found' }));
});
server.listen(port, '0.0.0.0', () => console.log(`Jaguar API listening on ${port}`));
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10000).unref();
  });
}
