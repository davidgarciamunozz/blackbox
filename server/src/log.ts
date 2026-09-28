// Registro de partida → CSV. Entregable evaluable (L.T lo cruza con las encuestas).

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Team } from './config.js';

export interface LogEvent {
  session: number;
  round: number;
  team: Team;
  t: number; // segundos desde el inicio de la ronda
  event: 'start' | 'switch' | 'error' | 'progress' | 'solved' | 'deliver_incomplete' | 'end';
  module: string;
  detail: string;
  timeLeft: number;
}

export interface RoundRow {
  session: number;
  round: number;
  team: Team;
  result: string;
  timeLeftAtEnd: number;
  duration: number;
  challenges: string;
  attackOrder: string; // módulos en el orden en que se abrieron, p. ej. "cables>candados>simon"
  errorsTotal: number;
  errorsCables: number;
  errorsSimon: number;
  errorsCandados: number;
  errorTimes: string; // "12.3@simon;40.1@candados"
  solvedAtCables: number | '';
  solvedAtSimon: number | '';
  solvedAtCandados: number | '';
  activeTimeCables: number;
  activeTimeSimon: number;
  activeTimeCandados: number;
}

function csv(rows: object[], headers: string[]): string {
  const esc = (v: unknown) => {
    const s = String(v ?? '');
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.join(','), ...rows.map((r) => headers.map((h) => esc((r as any)[h])).join(','))].join('\n') + '\n';
}

const EVENT_HEADERS: (keyof LogEvent)[] = ['session', 'round', 'team', 't', 'event', 'module', 'detail', 'timeLeft'];
const ROUND_HEADERS: (keyof RoundRow)[] = [
  'session', 'round', 'team', 'result', 'timeLeftAtEnd', 'duration', 'challenges', 'attackOrder',
  'errorsTotal', 'errorsCables', 'errorsSimon', 'errorsCandados', 'errorTimes',
  'solvedAtCables', 'solvedAtSimon', 'solvedAtCandados',
  'activeTimeCables', 'activeTimeSimon', 'activeTimeCandados',
];

export class MatchLog {
  events: LogEvent[] = [];
  rounds: RoundRow[] = [];

  constructor(private dir: string | null = null) {}

  event(e: LogEvent) {
    this.events.push(e);
  }

  round(r: RoundRow) {
    this.rounds.push(r);
    this.persist();
  }

  eventsCsv() {
    return csv(this.events, EVENT_HEADERS);
  }

  roundsCsv() {
    return csv(this.rounds, ROUND_HEADERS);
  }

  // Se escribe a disco al cerrar cada equipo, para no perder nada si el servidor cae.
  persist() {
    if (!this.dir) return;
    mkdirSync(this.dir, { recursive: true });
    writeFileSync(join(this.dir, 'rondas.csv'), this.roundsCsv());
    writeFileSync(join(this.dir, 'eventos.csv'), this.eventsCsv());
  }
}
