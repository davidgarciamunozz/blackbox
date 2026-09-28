import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { CableColor, PublicChallenge, SimonColor, Team } from '../../shared/protocol.js';
export type { CableColor, PublicChallenge, SimonColor };

export interface CablesChallenge {
  id: string;
  equipo: Team;
  type: 'cables';
  cables: { color: CableColor; rune: number; number: number }[];
  solution: number;
}

export interface SimonChallenge {
  id: string;
  equipo: Team;
  type: 'simon';
  turns: { leds: SimonColor[]; pattern: SimonColor[]; solution: SimonColor[] }[];
}

export interface CandadosChallenge {
  id: string;
  equipo: Team;
  type: 'candados';
  headerRune: number;
  pads: { solution: number; revealRune: number | null }[];
}

export type Challenge = CablesChallenge | SimonChallenge | CandadosChallenge;
export type ChallengeSet = [CablesChallenge, SimonChallenge, CandadosChallenge];

export interface ChallengeFile {
  cables: CablesChallenge[];
  simon: SimonChallenge[];
  candados: CandadosChallenge[];
}

export function loadChallenges(path: string): ChallengeFile {
  return JSON.parse(readFileSync(path, 'utf8'));
}

// Los retos reales (con soluciones) no están en el repo: se copian a data/retos.json.
// Sin ellos se usan los de ejemplo, que sirven para desarrollar pero no coinciden con el manual.
export function challengesPath(dataDir: string): string {
  // En Render, retos.json se sube como «Secret File» y aparece en /etc/secrets.
  const candidates = [process.env.RETOS_PATH, join(dataDir, 'retos.json'), '/etc/secrets/retos.json'];
  for (const c of candidates) if (c && existsSync(c)) return c;
  console.warn('⚠ No existe data/retos.json: usando retos.ejemplo.json (no coinciden con el manual).');
  return join(dataDir, 'retos.ejemplo.json');
}

// ---------------------------------------------------------------------------
//  Lo que viaja al móvil. Nunca incluye soluciones ni runas por revelar.
// ---------------------------------------------------------------------------

export function toPublic(c: Challenge): PublicChallenge {
  switch (c.type) {
    case 'cables':
      return { id: c.id, type: 'cables', cables: c.cables.map((x) => ({ ...x })) };
    case 'simon':
      return {
        id: c.id,
        type: 'simon',
        turns: c.turns.map((t) => ({ leds: [...t.leds], pattern: [...t.pattern] })),
      };
    case 'candados':
      return { id: c.id, type: 'candados', headerRune: c.headerRune, pads: c.pads.length };
  }
}

// ---------------------------------------------------------------------------
//  Reparto: cada equipo solo recibe retos de su grupo y no repite en la sesión.
// ---------------------------------------------------------------------------

export class ChallengePicker {
  private used = new Set<string>();

  constructor(
    private file: ChallengeFile,
    private random: () => number = Math.random,
  ) {}

  reset() {
    this.used.clear();
  }

  pick(team: Team): ChallengeSet {
    return [
      this.pickOne(this.file.cables, team),
      this.pickOne(this.file.simon, team),
      this.pickOne(this.file.candados, team),
    ];
  }

  private pickOne<T extends Challenge>(pool: T[], team: Team): T {
    const mine = pool.filter((c) => c.equipo === team);
    if (mine.length === 0) throw new Error(`No hay retos para el equipo ${team}`);
    let fresh = mine.filter((c) => !this.used.has(c.id));
    if (fresh.length === 0) {
      // Se agotaron: se vuelven a permitir los de este tipo y equipo.
      for (const c of mine) this.used.delete(c.id);
      fresh = mine;
    }
    const chosen = fresh[Math.floor(this.random() * fresh.length)];
    this.used.add(chosen.id);
    return chosen;
  }
}
