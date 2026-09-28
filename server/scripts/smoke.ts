// Prueba de humo: caja + 2 móviles simulados juegan una ronda contra el servidor real.
// Uso: servidor arrancado, luego `npx tsx scripts/smoke.ts [host:puerto]`
import WebSocket from 'ws';
import { readFileSync } from 'node:fs';

const HOST = process.argv[2] ?? 'localhost:8080';
const retos = JSON.parse(readFileSync(new URL('../data/retos.json', import.meta.url), 'utf8'));
const byId = (id: string) => [...retos.cables, ...retos.simon, ...retos.candados].find((r: any) => r.id === id);
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function open(path: string, name: string) {
  const ws = new WebSocket(`ws://${HOST}${path}`);
  const inbox: any[] = [];
  ws.on('message', (d) => { const m = JSON.parse(d.toString()); inbox.push(m); if (m.type !== 'timer' && m.type !== 'state') console.log(`  ${name} ←`, JSON.stringify(m).slice(0, 140)); });
  return new Promise<{ ws: WebSocket; inbox: any[]; send: (m: any) => void }>((res) =>
    ws.on('open', () => res({ ws, inbox, send: (m) => ws.send(JSON.stringify(m)) })));
}

await fetch(`http://${HOST}/api/reset`, { method: 'POST' });
const caja = await open('/device', 'caja');
caja.send({ type: 'hello', role: 'device', id: 'blackbox-01' });
const rojo = await open('/ws', 'rojo');
const naranja = await open('/ws', 'naranja');
rojo.send({ type: 'hello', clientId: 'smoke-rojo' });
naranja.send({ type: 'hello', clientId: 'smoke-naranja' });
rojo.send({ type: 'join', team: 'rojo' });
naranja.send({ type: 'join', team: 'naranja' });
await wait(100);
rojo.send({ type: 'ready' });
naranja.send({ type: 'ready' });
await wait(200);

const start = rojo.inbox.find((m) => m.type === 'match_start');
if (!start) throw new Error('no llegó match_start');
if (JSON.stringify(start).includes('solution')) throw new Error('¡la solución viajó al cliente!');
const [cab, sim, can] = start.challenges.map((c: any) => byId(c.id));

rojo.send({ type: 'submit', module: 0, answer: cab.solution === 0 ? 1 : 0 }); // error a propósito
rojo.send({ type: 'submit', module: 0, answer: cab.solution });
caja.send({ type: 'button', team: 'rojo', button: 1 });
await wait(100);
for (const t of sim.turns) rojo.send({ type: 'submit', module: 1, answer: t.solution });
caja.send({ type: 'button', team: 'rojo', button: 2 });
await wait(100);
for (const p of can.pads) rojo.send({ type: 'submit', module: 2, answer: p.solution });
await wait(100);
caja.send({ type: 'button', team: 'rojo', button: 3 });
await wait(300);

const summary = naranja.inbox.find((m) => m.type === 'round_summary');
console.log('\nResultado:', summary ? `ganador=${summary.winner}` : 'SIN round_summary');
console.log('Flash en caja:', caja.inbox.some((m) => m.type === 'flash'));
console.log('\n--- rondas.csv ---\n' + (await (await fetch(`http://${HOST}/api/logs/rondas.csv`)).text()));
for (const c of [caja, rojo, naranja]) c.ws.close();
process.exit(summary?.winner === 'rojo' ? 0 : 1);
