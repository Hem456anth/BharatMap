import { createApp } from './app.js';

const port = Number(process.env.PORT || 8080);
const app = createApp();
const server = app.listen(port, () => console.log(JSON.stringify({ level: 'info', msg: `India MapOS listening on :${port}` })));
const shutdown = () => { server.close(() => process.exit(0)); setTimeout(() => process.exit(1), 8000).unref(); };
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
