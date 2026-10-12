import { randomUUID } from 'node:crypto';
import { repoState, implementationHash } from './core.mts';
import type { IncomingMessage, ServerResponse } from 'node:http';
const boot = { ...repoState(process.cwd()), implementationHash: implementationHash(process.cwd()),
  app: 'iglass-composition-studio', schema: 1, pid: process.pid, instance: randomUUID(), startedAt: new Date().toISOString(),
  node: process.version, executable: process.execPath, token: process.env.IG_START_TOKEN ?? null };
export function identityMiddleware(req: IncomingMessage, res: ServerResponse, next: () => void) {
  if ((req.url ?? '').split('?')[0] !== '/api/ig/identity' || req.method !== 'GET') return next();
  res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(boot));
}
