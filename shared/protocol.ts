// Contrato de mensajes compartido por servidor y app web. Ver CONTRATO.md.
// Todos los mensajes son JSON de texto con un campo `type`.
// Este archivo no puede importar nada de Node: lo usa también el navegador.

export type Team = 'rojo' | 'naranja';
export type ModuleIndex = 0 | 1 | 2;

export type CableColor = 'blanco' | 'negro' | 'rojo' | 'azul' | 'verde' | 'naranja' | 'amarillo';
export type SimonColor = 'rojo' | 'azul' | 'amarillo' | 'verde';

// Lo que viaja al móvil. Nunca incluye soluciones ni runas por revelar.
export type PublicChallenge =
  | { id: string; type: 'cables'; cables: { color: CableColor; rune: number; number: number }[] }
  | { id: string; type: 'simon'; turns: { leds: SimonColor[]; pattern: SimonColor[] }[] }
  | { id: string; type: 'candados'; headerRune: number; pads: number };


// ---------------------------------------------------------------------------
//  Móvil → servidor  (ws://HOST/ws)
// ---------------------------------------------------------------------------

export type ClientMessage =
  | { type: 'hello'; clientId: string }
  | { type: 'join'; team: Team }
  | { type: 'leave' }
  | { type: 'ready'; ready?: boolean }
  | { type: 'submit'; module: ModuleIndex; answer: unknown }
  | { type: 'switch'; module: ModuleIndex } // solo modo sin hardware
  | { type: 'deliver' }; // solo modo sin hardware

// ---------------------------------------------------------------------------
//  Servidor → móvil
// ---------------------------------------------------------------------------

export type Phase = 'lobby' | 'playing' | 'round_over' | 'session_over';
export type TeamStatus = 'playing' | 'defused' | 'timeout' | 'beaten';

export interface SeatView {
  team: Team;
  taken: boolean;
  connected: boolean;
  ready: boolean;
}

export interface ProgressView {
  simonTurn: number; // 0..3, turnos de Simon completados
  padIndex: number; // 0..3, candados abiertos
  revealed: (number | null)[]; // runas reveladas por cada candado abierto
  padValues: number[]; // números ya fijados en los candados abiertos
}

export interface TeamRoundView {
  status: TeamStatus;
  startsIn: number; // segundos de cuenta atrás que quedan (0 si ya arrancó)
  timeLeft: number;
  active: ModuleIndex;
  solved: [boolean, boolean, boolean];
  errors: number;
  attackOrder: ModuleIndex[]; // módulos en el orden en que se abrieron
  challenges: PublicChallenge[];
  progress: ProgressView;
}

export interface RoundResult {
  team: Team;
  status: TeamStatus;
  timeLeft: number;
}

export interface StateSnapshot {
  phase: Phase;
  you: { team: Team | null };
  seats: SeatView[];
  allReady: boolean;
  round: number;
  score: Record<Team, number>;
  deviceConnected: boolean;
  screenControls: boolean;
  mine: TeamRoundView | null;
  opponent: { team: Team; status: TeamStatus } | null;
  lastRound: { winner: Team | null; results: RoundResult[] } | null;
}

export type ServerMessage =
  | { type: 'state'; state: StateSnapshot }
  | { type: 'error'; code: string; message: string }
  | { type: 'lobby_state'; players: SeatView[]; allReady: boolean }
  | {
      type: 'match_start';
      round: number;
      challenges: PublicChallenge[];
      timeLeft: number;
      active: ModuleIndex;
      countdown: number; // segundos hasta que el reloj arranca
    }
  | { type: 'timer'; timeLeft: number }
  | { type: 'module_switch'; active: ModuleIndex }
  | {
      type: 'answer_result';
      module: ModuleIndex;
      correct: boolean;
      penalty: number;
      timeLeft: number;
      progress: ProgressView;
      reveal?: number | null; // Candados: runa revelada al acertar un candado
    }
  | { type: 'deliver_result'; accepted: false; solved: [boolean, boolean, boolean] } // entrega incompleta
  | { type: 'module_solved'; module: ModuleIndex; bonus: number; timeLeft: number }
  | { type: 'round_end'; team: Team; result: TeamStatus; timeLeft: number }
  | {
      type: 'round_summary';
      round: number;
      winner: Team | null;
      results: RoundResult[];
      score: Record<Team, number>;
      sessionOver: boolean;
    }
  | { type: 'device_status'; connected: boolean; screenControls: boolean };


// ---------------------------------------------------------------------------
//  Caja ESP32 ↔ servidor  (ws://HOST:8080/device) — fijado por el firmware
// ---------------------------------------------------------------------------

export type DeviceMessage =
  | { type: 'hello'; role: 'device'; id: string }
  | { type: 'button'; team: Team; button: 0 | 1 | 2 | 3 };

export type LedState = 0 | 1 | 2; // apagado · fijo · parpadeo

export type ToDeviceMessage =
  | ({ type: 'indicators' } & Partial<Record<Team, LedState[]>>)
  | { type: 'flash'; team: Team };
