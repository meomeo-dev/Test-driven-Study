import { createServer } from 'vite';

const url = `http://127.0.0.1:${process.env.STUDY_API_PORT ?? 43388}/api/health`;
const deadline = Date.now() + 120_000;
let lastError;
while (Date.now() < deadline) {
  try { const response = await fetch(url); if (response.ok) break; lastError = new Error(`API returned ${response.status}`); }
  catch (error) { lastError = error; }
  await new Promise(resolve => setTimeout(resolve, 300));
}
if (Date.now() >= deadline) throw new Error('Go API startup timed out', { cause: lastError });
const server = await createServer();
await server.listen();
server.printUrls();
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, async () => { await server.close(); process.exit(0); });
}
