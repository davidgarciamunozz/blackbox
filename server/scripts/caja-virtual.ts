// Caja virtual: simula el ESP32 desde el teclado para probar sin hardware.
// Uso: npx tsx scripts/caja-virtual.ts [host:puerto]
//   r0 r1 r2  → botón de módulo del equipo rojo      rx → entrega roja
//   n0 n1 n2  → botón de módulo del equipo naranja   nx → entrega naranja
import WebSocket from 'ws';
import readline from 'node:readline';

const HOST = process.argv[2] ?? 'localhost:8080';
const LED = ['·', '●', '◐'];
let ws: WebSocket;

function connect() {
  ws = new WebSocket(`ws://${HOST}/device`);
  ws.on('open', () => {
    console.log('✔ conectada');
    ws.send(JSON.stringify({ type: 'hello', role: 'device', id: 'caja-virtual' }));
  });
  ws.on('message', (d) => {
    const m = JSON.parse(d.toString());
    if (m.type === 'indicators') console.log(`  LEDs  rojo ${(m.rojo ?? []).map((v: number) => LED[v]).join(' ')}   naranja ${(m.naranja ?? []).map((v: number) => LED[v]).join(' ')}`);
    else if (m.type === 'flash') console.log(`  ⚡ destello ${m.team}`);
  });
  ws.on('close', () => { console.log('✖ desconectada, reintentando...'); setTimeout(connect, 2000); });
  ws.on('error', () => {});
}
connect();

readline.createInterface({ input: process.stdin }).on('line', (line) => {
  const m = line.trim().match(/^([rn])([012x])$/);
  if (!m) return console.log('  r0 r1 r2 rx · n0 n1 n2 nx');
  const team = m[1] === 'r' ? 'rojo' : 'naranja';
  const button = m[2] === 'x' ? 3 : Number(m[2]);
  ws.send(JSON.stringify({ type: 'button', team, button }));
});
