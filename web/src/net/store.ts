// Conexión con el servidor y estado del móvil.
// El servidor es la única fuente de verdad: este store guarda el último
// snapshot que manda y los efectos pasajeros (error, bonus, entrega rechazada).

import { useSyncExternalStore } from 'react';
import type { ClientMessage, ModuleIndex, ServerMessage, StateSnapshot, Team } from '../../../shared/protocol';

export type Fx =
  | { kind: 'error'; module: ModuleIndex; penalty: number; at: number }
  | { kind: 'progress'; module: ModuleIndex; at: number }
  | { kind: 'solved'; module: ModuleIndex; bonus: number; at: number }
  | { kind: 'deliver_rejected'; solved: [boolean, boolean, boolean]; at: number };

export interface ClientState {
  connected: boolean;
  state: StateSnapshot | null;
  // Momento local (performance.now) en que la cuenta atrás llega a cero.
  countdownEndsAt: number | null;
  fx: Fx | null;
  lastError: string | null;
}

let current: ClientState = {
  connected: false,
  state: null,
  countdownEndsAt: null,
  fx: null,
  lastError: null,
};

const listeners = new Set<() => void>();

function set(patch: Partial<ClientState>) {
  current = { ...current, ...patch };
  for (const l of listeners) l();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useGame(): ClientState {
  return useSyncExternalStore(subscribe, () => current);
}

// ---------------------------------------------------------------------------
//  Identidad del móvil: sobrevive a recargas y caídas de WiFi.
// ---------------------------------------------------------------------------

function loadClientId(): string {
  const make = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
  try {
    const saved = localStorage.getItem('blackbox-client-id');
    if (saved) return saved;
    const id = make();
    localStorage.setItem('blackbox-client-id', id);
    return id;
  } catch {
    return make();
  }
}

const clientId = loadClientId();

// ---------------------------------------------------------------------------
//  WebSocket con reconexión
// ---------------------------------------------------------------------------

let ws: WebSocket | null = null;
let retry = 0;

function url() {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  return `${proto}://${location.host}/ws`;
}

export function connect() {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;
  ws = new WebSocket(url());
  ws.onopen = () => {
    retry = 0;
    set({ connected: true });
    send({ type: 'hello', clientId });
  };
  ws.onmessage = (e) => {
    try {
      onMessage(JSON.parse(e.data));
    } catch {
      /* mensaje ilegible: se ignora */
    }
  };
  ws.onclose = () => {
    ws = null;
    set({ connected: false });
    // Reintento rápido: el WiFi del evento se va a caer.
    const delay = Math.min(2000, 250 * 2 ** retry++);
    setTimeout(connect, delay);
  };
  ws.onerror = () => ws?.close();
}

// Al volver de segundo plano, el socket suele estar muerto sin haberse cerrado.
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') connect();
  });
}

export function send(msg: ClientMessage) {
  if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
}

function onMessage(msg: ServerMessage) {
  const now = performance.now();
  switch (msg.type) {
    case 'state': {
      const startsIn = msg.state.mine?.startsIn ?? 0;
      set({
        state: msg.state,
        countdownEndsAt: startsIn > 0 ? now + startsIn * 1000 : null,
      });
      break;
    }
    case 'timer':
      if (current.state?.mine) {
        set({ state: { ...current.state, mine: { ...current.state.mine, timeLeft: msg.timeLeft } } });
      }
      break;
    case 'match_start':
      set({ countdownEndsAt: now + msg.countdown * 1000, fx: null });
      break;
    case 'answer_result':
      set({
        fx: msg.correct
          ? { kind: 'progress', module: msg.module, at: now }
          : { kind: 'error', module: msg.module, penalty: msg.penalty, at: now },
      });
      break;
    case 'module_solved':
      set({ fx: { kind: 'solved', module: msg.module, bonus: msg.bonus, at: now } });
      break;
    case 'deliver_result':
      set({ fx: { kind: 'deliver_rejected', solved: msg.solved, at: now } });
      break;
    case 'lobby_state':
      if (current.state) set({ state: { ...current.state, seats: msg.players, allReady: msg.allReady } });
      break;
    case 'device_status':
      if (current.state) {
        set({ state: { ...current.state, deviceConnected: msg.connected, screenControls: msg.screenControls } });
      }
      break;
    case 'error':
      set({ lastError: msg.code });
      break;
    default:
      break;
  }
}

// ---------------------------------------------------------------------------
//  Acciones
// ---------------------------------------------------------------------------

export function endCountdown() {
  if (current.countdownEndsAt) set({ countdownEndsAt: null });
}

export const actions = {
  join: (team: Team) => send({ type: 'join', team }),
  leave: () => send({ type: 'leave' }),
  ready: (ready = true) => send({ type: 'ready', ready }),
  submit: (module: ModuleIndex, answer: unknown) => send({ type: 'submit', module, answer }),
  switchModule: (module: ModuleIndex) => send({ type: 'switch', module }),
  deliver: () => send({ type: 'deliver' }),
};
