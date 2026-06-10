import * as http from 'node:http';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { WebSocketServer, WebSocket } from 'ws';
import {
  ensureSchema, pool, createAccount, findAccount, touchLogin, saveToken, accountForToken,
  listCharacters, getCharacter, createCharacter, deleteCharacter,
} from './db';
import { hashPassword, verifyPassword, newToken, validUsername, validPassword, validCharName } from './auth';
import { GameServer } from './game';

const PORT = Number(process.env.PORT ?? 8787);
const STATIC_DIR = path.join(__dirname, '..', 'dist');

const game = new GameServer();

// ---------------------------------------------------------------------------
// Tiny HTTP helpers
// ---------------------------------------------------------------------------

function json(res: http.ServerResponse, status: number, body: unknown): void {
  const data = JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) });
  res.end(data);
}

function readBody(req: http.IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => {
      data += c;
      if (data.length > 64 * 1024) reject(new Error('body too large'));
    });
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        reject(new Error('bad json'));
      }
    });
    req.on('error', reject);
  });
}

async function bearerAccount(req: http.IncomingMessage): Promise<number | null> {
  const auth = req.headers.authorization ?? '';
  const m = /^Bearer ([a-f0-9]{64})$/.exec(auth);
  if (!m) return null;
  return accountForToken(m[1]);
}

const MIME: Record<string, string> = {
  '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json',
};

function serveStatic(req: http.IncomingMessage, res: http.ServerResponse): void {
  let urlPath = (req.url ?? '/').split('?')[0];
  if (urlPath === '/') urlPath = '/index.html';
  const file = path.join(STATIC_DIR, path.normalize(urlPath).replace(/^([.][.][/\\])+/, ''));
  if (!file.startsWith(STATIC_DIR) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    // SPA fallback
    const index = path.join(STATIC_DIR, 'index.html');
    if (fs.existsSync(index)) {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      fs.createReadStream(index).pipe(res);
    } else {
      res.writeHead(404);
      res.end('not found (run `npm run build` to serve the client from the game server)');
    }
    return;
  }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] ?? 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}

// ---------------------------------------------------------------------------
// REST API
// ---------------------------------------------------------------------------

// Simple in-memory rate limiter for auth endpoints (per IP, sliding minute).
const authAttempts = new Map<string, number[]>();
function rateLimited(req: http.IncomingMessage): boolean {
  const ip = String(req.headers['x-forwarded-for'] ?? req.socket.remoteAddress ?? 'unknown').split(',')[0].trim();
  const now = Date.now();
  const windowStart = now - 60_000;
  const list = (authAttempts.get(ip) ?? []).filter((t) => t > windowStart);
  list.push(now);
  authAttempts.set(ip, list);
  if (authAttempts.size > 10_000) authAttempts.clear(); // memory backstop
  return list.length > 20;
}

async function handleApi(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  const url = (req.url ?? '').split('?')[0];
  try {
    if (req.method === 'POST' && (url === '/api/register' || url === '/api/login') && rateLimited(req)) {
      return json(res, 429, { error: 'too many attempts — wait a minute and try again' });
    }
    if (req.method === 'POST' && url === '/api/register') {
      const body = await readBody(req);
      if (!validUsername(body.username)) return json(res, 400, { error: 'username must be 3-24 chars (letters, digits, _)' });
      if (!validPassword(body.password)) return json(res, 400, { error: 'password must be at least 6 chars' });
      const existing = await findAccount(body.username);
      if (existing) return json(res, 409, { error: 'username already taken' });
      const account = await createAccount(body.username, await hashPassword(body.password));
      const token = newToken();
      await saveToken(token, account.id);
      return json(res, 200, { token, username: account.username });
    }
    if (req.method === 'POST' && url === '/api/login') {
      const body = await readBody(req);
      const account = typeof body.username === 'string' ? await findAccount(body.username) : null;
      if (!account || !(await verifyPassword(String(body.password ?? ''), account.password_hash))) {
        return json(res, 401, { error: 'invalid username or password' });
      }
      await touchLogin(account.id);
      const token = newToken();
      await saveToken(token, account.id);
      return json(res, 200, { token, username: account.username });
    }
    if (url === '/api/characters') {
      const accountId = await bearerAccount(req);
      if (accountId === null) return json(res, 401, { error: 'not authenticated' });
      if (req.method === 'GET') {
        const chars = await listCharacters(accountId);
        return json(res, 200, {
          characters: chars.map((c) => ({
            id: c.id, name: c.name, class: c.class, level: c.level,
            online: [...game.clients.values()].some((s) => s.characterId === c.id),
          })),
        });
      }
      if (req.method === 'POST') {
        const body = await readBody(req);
        if (!validCharName(body.name)) return json(res, 400, { error: 'invalid character name (2-16 letters)' });
        const validClasses = ['warrior', 'paladin', 'hunter', 'rogue', 'priest', 'shaman', 'mage', 'warlock', 'druid'];
        if (!validClasses.includes(body.class)) return json(res, 400, { error: 'invalid class' });
        const chars = await listCharacters(accountId);
        if (chars.length >= 10) return json(res, 400, { error: 'character limit reached' });
        try {
          const c = await createCharacter(accountId, body.name, body.class);
          return json(res, 200, { id: c.id, name: c.name, class: c.class, level: c.level });
        } catch (err: any) {
          if (String(err?.message).includes('unique') || err?.code === '23505') {
            return json(res, 409, { error: 'that name is taken' });
          }
          throw err;
        }
      }
    }
    const delMatch = /^\/api\/characters\/(\d+)$/.exec(url);
    if (req.method === 'DELETE' && delMatch) {
      const accountId = await bearerAccount(req);
      if (accountId === null) return json(res, 401, { error: 'not authenticated' });
      const ok = await deleteCharacter(accountId, Number(delMatch[1]));
      return json(res, ok ? 200 : 404, ok ? { ok: true } : { error: 'not found' });
    }
    if (req.method === 'GET' && url === '/api/status') {
      return json(res, 200, {
        ok: true,
        players_online: game.clients.size,
        names: [...game.clients.values()].map((s) => s.name),
      });
    }
    json(res, 404, { error: 'unknown endpoint' });
  } catch (err: any) {
    console.error('api error:', err);
    json(res, 500, { error: 'internal error' });
  }
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  // wait for the database (it may still be starting in docker)
  for (let attempt = 1; ; attempt++) {
    try {
      await pool.query('SELECT 1');
      break;
    } catch (err) {
      if (attempt >= 30) throw err;
      console.log(`waiting for postgres (attempt ${attempt})...`);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  await ensureSchema();
  console.log('database ready');

  const server = http.createServer((req, res) => {
    if ((req.url ?? '').startsWith('/api/')) void handleApi(req, res);
    else serveStatic(req, res);
  });

  const wss = new WebSocketServer({ noServer: true });
  server.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (url.pathname !== '/ws') {
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      void onConnection(ws, url);
    });
  });

  async function onConnection(ws: WebSocket, url: URL): Promise<void> {
    const token = url.searchParams.get('token') ?? '';
    const characterId = Number(url.searchParams.get('character') ?? 'NaN');
    const accountId = await accountForToken(token);
    if (accountId === null || !Number.isFinite(characterId)) {
      ws.send(JSON.stringify({ t: 'error', error: 'not authenticated' }));
      ws.close();
      return;
    }
    const character = await getCharacter(accountId, characterId);
    if (!character) {
      ws.send(JSON.stringify({ t: 'error', error: 'no such character' }));
      ws.close();
      return;
    }
    const result = game.join(ws, accountId, character.id, character.name, character.class, character.state);
    if ('error' in result) {
      ws.send(JSON.stringify({ t: 'error', error: result.error }));
      ws.close();
      return;
    }
    const session = result;
    console.log(`+ ${character.name} (${character.class}) joined — ${game.clients.size} online`);
    ws.on('message', (data) => {
      game.handleMessage(session, String(data));
    });
    ws.on('close', () => {
      void game.leave(session, 'disconnected');
      console.log(`- ${character.name} left — ${game.clients.size} online`);
    });
    ws.on('error', () => {
      void game.leave(session, 'connection error');
    });
  }

  game.start();
  server.listen(PORT, () => {
    console.log(`Eastbrook Vale server listening on http://localhost:${PORT}`);
    console.log(`  REST: /api/register /api/login /api/characters /api/status`);
    console.log(`  WS:   /ws?token=...&character=...`);
  });

  const shutdown = async () => {
    console.log('shutting down: saving characters...');
    game.stop();
    await game.saveAll('shutdown');
    await pool.end();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('fatal:', err);
  process.exit(1);
});
