// Servidor de Project Blackbox.
//   http://HOST:8080/          → app web (web/dist)
//   ws://HOST:8080/ws          → móviles
//   ws://HOST:8080/device      → caja ESP32 (WebSocket plano, protocolo del firmware)
//   http://HOST:8080/api/...   → registro CSV y utilidades

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { networkInterfaces } from 'node:os';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, type WebSocket } from 'ws';
import { config, TEAMS, type Team } from './config.js';
import { ChallengePicker, loadChallenges } from './challenges.js';
import { Game, type Bus } from './game.js';
import { MatchLog } from './log.js';
import type { ClientMessage, DeviceMessage, ServerMessage, ToDeviceMessage } from './protocol.js';

const here = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(here, '../data');
const WEB_DIST = join(here, '../../web/dist');
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const log = new MatchLog(join(DATA_DIR, 'logs', stamp));

// ---------------------------------------------------------------------------
//  Conexiones
// ---------------------------------------------------------------------------

const phones = new Map<WebSocket, string | null>(); // socket → clientId
const devices = new Set<WebSocket>();

function send(ws: WebSocket, msg: unknown) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
}

const bus: Bus = {
  toTeam(team: Team, msg: ServerMessage) {
    for (const [ws, id] of phones) if (id && game.teamOf(id) === team) send(ws, msg);
  },
  toAll(msg: ServerMessage) {
    for (const ws of phones.keys()) send(ws, msg);
  },
  toDevice(msg: ToDeviceMessage) {
    for (const ws of devices) send(ws, msg);
  },
  stateChanged() {
    for (const [ws, id] of phones) send(ws, { type: 'state', state: game.snapshot(id) });
  },
};

const challenges = loadChallenges(join(DATA_DIR, 'retos.json'));
const game = new Game(config, new ChallengePicker(challenges), bus, undefined, log);
setInterval(() => game.tick(), 100);

// ---------------------------------------------------------------------------
//  Móviles
// ---------------------------------------------------------------------------

function onPhoneMessage(ws: WebSocket, raw: string) {
  let msg: ClientMessage;
  try {
    msg = JSON.parse(raw);
  } catch {
    return;
  }
  const clientId = phones.get(ws) ?? null;
  const fail = (code: string | null) => {
    if (code) send(ws, { type: 'error', code, message: code });
  };

  if (msg.type === 'hello') {
    if (typeof msg.clientId !== 'string' || !msg.clientId) return;
    phones.set(ws, msg.clientId);
    game.connect(msg.clientId);
    send(ws, { type: 'state', state: game.snapshot(msg.clientId) });
    return;
  }
  if (!clientId) return fail('hello_required');

  switch (msg.type) {
    case 'join':
      fail(game.join(clientId, msg.team));
      send(ws, { type: 'state', state: game.snapshot(clientId) });
      break;
    case 'leave':
      game.leave(clientId);
      break;
    case 'ready':
      game.setReady(clientId, msg.ready ?? true);
      break;
    case 'submit':
      fail(game.submit(clientId, msg.module, msg.answer));
      break;
    case 'switch':
      game.screenSwitch(clientId, msg.module);
      break;
    case 'deliver':
      game.screenDeliver(clientId);
      break;
  }
}

function onPhoneClose(ws: WebSocket) {
  const id = phones.get(ws);
  phones.delete(ws);
  // Solo se marca desconectado si no le queda otro socket abierto con el mismo id.
  if (id && ![...phones.values()].includes(id)) game.disconnect(id);
}

// ---------------------------------------------------------------------------
//  Caja ESP32
// ---------------------------------------------------------------------------

function onDeviceMessage(ws: WebSocket, raw: string) {
  let msg: DeviceMessage;
  try {
    msg = JSON.parse(raw);
  } catch {
    return;
  }
  if (msg.type === 'hello') {
    // Siempre se responde con el estado completo: la caja se recupera sola tras reiniciar.
    send(ws, { type: 'indicators', ...game.indicators() });
  } else if (msg.type === 'button' && TEAMS.includes(msg.team) && typeof msg.button === 'number') {
    game.deviceButton(msg.team, msg.button);
  }
}

// ---------------------------------------------------------------------------
//  HTTP
// ---------------------------------------------------------------------------

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.woff2': 'font/woff2',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
};

function serveStatic(req: IncomingMessage, res: ServerResponse) {
  const urlPath = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname);
  let file = normalize(join(WEB_DIST, urlPath));
  if (!file.startsWith(WEB_DIST)) return res.writeHead(403).end();
  if (!existsSync(file) || statSync(file).isDirectory()) file = join(WEB_DIST, 'index.html'); // SPA
  if (!existsSync(file)) {
    res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
    return res.end('Servidor Blackbox activo. La app web aún no está compilada (npm run build -w web).');
  }
  res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' });
  res.end(readFileSync(file));
}

const server = createServer((req, res) => {
  const path = (req.url ?? '/').split('?')[0];
  if (path === '/api/logs/rondas.csv' || path === '/api/logs/eventos.csv') {
    const body = path.endsWith('rondas.csv') ? log.roundsCsv() : log.eventsCsv();
    res.writeHead(200, {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${path.split('/').pop()}"`,
    });
    return res.end(body);
  }
  if (path === '/api/state') {
    res.writeHead(200, { 'content-type': 'application/json' });
    return res.end(JSON.stringify({ ...game.snapshot(null), indicators: game.indicators() }, null, 2));
  }
  if (path === '/api/reset' && req.method === 'POST') {
    game.resetSession();
    return res.writeHead(204).end();
  }
  serveStatic(req, res);
});

const phoneWss = new WebSocketServer({ noServer: true });
const deviceWss = new WebSocketServer({ noServer: true });

server.on('upgrade', (req, socket, head) => {
  const path = (req.url ?? '').split('?')[0];
  if (path === '/device') deviceWss.handleUpgrade(req, socket, head, (ws) => deviceWss.emit('connection', ws, req));
  else if (path === '/ws') phoneWss.handleUpgrade(req, socket, head, (ws) => phoneWss.emit('connection', ws, req));
  else socket.destroy();
});

// Latido: detecta móviles que desaparecen sin cerrar (WiFi caído, pantalla bloqueada).
const alive = new WeakMap<WebSocket, boolean>();
setInterval(() => {
  for (const ws of phones.keys()) {
    if (alive.get(ws) === false) {
      ws.terminate();
      continue;
    }
    alive.set(ws, false);
    ws.ping();
  }
}, 10_000);

phoneWss.on('connection', (ws) => {
  phones.set(ws, null);
  alive.set(ws, true);
  ws.on('pong', () => alive.set(ws, true));
  ws.on('message', (d) => onPhoneMessage(ws, d.toString()));
  ws.on('close', () => onPhoneClose(ws));
  send(ws, { type: 'state', state: game.snapshot(null) });
});

deviceWss.on('connection', (ws, req) => {
  console.log(`✔ Caja conectada desde ${req.socket.remoteAddress}`);
  devices.add(ws);
  game.setDeviceConnected(true);
  ws.on('message', (d) => onDeviceMessage(ws, d.toString()));
  ws.on('close', () => {
    console.log('✖ Caja desconectada');
    devices.delete(ws);
    game.setDeviceConnected(devices.size > 0);
  });
});

server.listen(config.port, () => {
  const ips = Object.values(networkInterfaces())
    .flat()
    .filter((i) => i && i.family === 'IPv4' && !i.internal)
    .map((i) => i!.address);
  console.log('========================================');
  console.log('  BLACKBOX · servidor');
  console.log('========================================');
  console.log(`  Puerto ${config.port}`);
  for (const ip of ips) console.log(`  App:  http://${ip}:${config.port}   ·  Caja (WS_HOST): ${ip}`);
  console.log(`  Registro: ${join(DATA_DIR, 'logs', stamp)}`);
});
