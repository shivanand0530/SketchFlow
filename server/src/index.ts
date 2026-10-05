import app from './app.js';
import { env } from './config/env.js';
import { createServer } from 'node:http';
import { CollaborationServer } from './collaboration/websocketServer.js';
import { logger } from './logging.js';

const server = createServer(app);
new CollaborationServer().attach(server);
server.listen(env.PORT, () => logger.info('SketchFlow API started', { port: env.PORT, environment: env.NODE_ENV }));
const shutdown = (signal: string) => {
  logger.info('SketchFlow API stopping', { signal });
  server.close(() => process.exit(0));
};
process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));
