// Máquina de estados del juego. No sabe nada de red: recibe eventos y
// emite mensajes a través de un Bus. Única fuente de verdad.

import { MODULES, TEAMS, type Config, type ModuleIndex, type ModuleType, type Team } from './config.js';
import { ChallengePicker, toPublic, type ChallengeSet, type SimonColor } from './challenges.js';
import type {
  LedState,
  Phase,
  ProgressView,
  RoundResult,
  SeatView,
  ServerMessage,
  StateSnapshot,
  TeamStatus,
  ToDeviceMessage,
} from './protocol.js';
import type { MatchLog } from './log.js';

export interface Bus {
  toTeam(team: Team, msg: ServerMessage): void;
  toAll(msg: ServerMessage): void;
  toDevice(msg: ToDeviceMessage): void;
  // El estado general ha cambiado: el servidor reenvía un snapshot a cada móvil.
  stateChanged(): void;
}

export interface Clock {
  now(): number;
}

interface Seat {
  clientId: string | null;
  connected: boolean;
  ready: boolean;
}

interface TeamRound {
  challenges: ChallengeSet;
  status: TeamStatus;
  endsAt: number; // ms; el reloj corre mientras status === 'playing'
  frozenTimeLeft: number; // segundos, válido cuando ya no se juega
  active: ModuleIndex;
  activeSince: number;
  activeTime: [number, number, number];
  solved: [boolean, boolean, boolean];
  solvedAt: [number | null, number | null, number | null];
  errors: { t: number; module: ModuleIndex; penalty: number }[];
  attackOrder: ModuleIndex[];
  simonTurn: number;
  padIndex: number;
  revealed: (number | null)[];
  padValues: number[];
  cut: number[];
  lastSentSecond: number;
}

const SIMON_COLORS: SimonColor[] = ['rojo', 'azul', 'amarillo', 'verde'];
const SUBMIT_BUTTON = 3;

export class Game {
  phase: Phase = 'lobby';
  seats: Record<Team, Seat> = {
    rojo: { clientId: null, connected: false, ready: false },
    naranja: { clientId: null, connected: false, ready: false },
  };
  round = 0;
  session = 1;
  score: Record<Team, number> = { rojo: 0, naranja: 0 };
  deviceConnected = false;
  teams: Partial<Record<Team, TeamRound>> = {};
  roundStartedAt = 0; // momento en que arranca el reloj (tras la cuenta atrás)
  roundWinner: Team | null = null;
  lastRound: { winner: Team | null; results: RoundResult[] } | null = null;

  constructor(
    private cfg: Config,
    private picker: ChallengePicker,
    private bus: Bus,
    private clock: Clock = { now: () => Date.now() },
    private log: MatchLog | null = null,
  ) {}

  // =========================================================================
  //  Conexión de móviles y lobby
  // =========================================================================

  teamOf(clientId: string): Team | null {
    return TEAMS.find((t) => this.seats[t].clientId === clientId) ?? null;
  }

  connect(clientId: string): Team | null {
    const team = this.teamOf(clientId);
    if (team) {
      this.seats[team].connected = true;
      this.broadcastLobby();
    }
    return team;
  }

  disconnect(clientId: string) {
    const team = this.teamOf(clientId);
    if (!team) return;
    const seat = this.seats[team];
    seat.connected = false;
    // En el lobby, perder la conexión libera el "listo" para no arrancar a ciegas.
    if (this.phase !== 'playing') seat.ready = false;
    this.broadcastLobby();
  }

  join(clientId: string, team: Team): string | null {
    if (!TEAMS.includes(team)) return 'invalid_team';
    const current = this.teamOf(clientId);
    if (current === team) {
      this.seats[team].connected = true;
      return null;
    }
    const seat = this.seats[team];
    // Un asiento ocupado por un móvil desconectado se puede reclamar (cambio de teléfono).
    if (seat.clientId && seat.connected) return 'team_taken';
    if (this.phase === 'playing' && current) return 'in_match';
    if (current) this.releaseSeat(current);
    seat.clientId = clientId;
    seat.connected = true;
    seat.ready = false;
    this.broadcastLobby();
    this.bus.stateChanged();
    return null;
  }

  leave(clientId: string) {
    const team = this.teamOf(clientId);
    if (!team || this.phase === 'playing') return;
    this.releaseSeat(team);
    this.broadcastLobby();
    this.bus.stateChanged();
  }

  private releaseSeat(team: Team) {
    this.seats[team] = { clientId: null, connected: false, ready: false };
  }

  setReady(clientId: string, ready: boolean) {
    const team = this.teamOf(clientId);
    if (!team || this.phase === 'playing') return;
    this.seats[team].ready = ready;
    this.broadcastLobby();
    if (this.allReady()) this.startRound();
  }

  allReady() {
    return TEAMS.every((t) => this.seats[t].clientId && this.seats[t].connected && this.seats[t].ready);
  }

  seatViews(): SeatView[] {
    return TEAMS.map((team) => ({
      team,
      taken: this.seats[team].clientId !== null,
      connected: this.seats[team].connected,
      ready: this.seats[team].ready,
    }));
  }

  private broadcastLobby() {
    this.bus.toAll({ type: 'lobby_state', players: this.seatViews(), allReady: this.allReady() });
  }

  // =========================================================================
  //  Ronda
  // =========================================================================

  private startRound() {
    if (this.phase === 'session_over') this.newSession();
    const now = this.clock.now() + this.cfg.countdown * 1000;
    this.round += 1;
    this.phase = 'playing';
    this.roundStartedAt = now;
    this.roundWinner = null;
    for (const team of TEAMS) {
      this.seats[team].ready = false;
      this.teams[team] = {
        challenges: this.picker.pick(team),
        status: 'playing',
        endsAt: now + this.cfg.startTime * 1000,
        frozenTimeLeft: this.cfg.startTime,
        active: 0,
        activeSince: now,
        activeTime: [0, 0, 0],
        solved: [false, false, false],
        solvedAt: [null, null, null],
        errors: [],
        attackOrder: [0],
        simonTurn: 0,
        padIndex: 0,
        revealed: [],
        padValues: [],
        cut: [],
        lastSentSecond: this.cfg.startTime,
      };
    }
    for (const team of TEAMS) {
      const tr = this.teams[team]!;
      this.logEvent(team, 'start', '', tr.challenges.map((c) => c.id).join(' '));
      this.bus.toTeam(team, {
        type: 'match_start',
        round: this.round,
        challenges: tr.challenges.map(toPublic),
        timeLeft: this.cfg.startTime,
        active: 0,
        countdown: this.cfg.countdown,
      });
    }
    this.pushIndicators();
    this.bus.stateChanged();
  }

  private newSession() {
    this.session += 1;
    this.round = 0;
    this.score = { rojo: 0, naranja: 0 };
    this.lastRound = null;
    this.picker.reset();
  }

  resetSession() {
    this.phase = 'lobby';
    this.teams = {};
    for (const t of TEAMS) this.seats[t].ready = false;
    this.newSession();
    this.pushIndicators();
    this.broadcastLobby();
    this.bus.stateChanged();
  }

  timeLeft(team: Team): number {
    const tr = this.teams[team];
    if (!tr) return this.cfg.startTime;
    if (tr.status !== 'playing') return tr.frozenTimeLeft;
    // Durante la cuenta atrás el reloj está parado.
    const now = Math.max(this.clock.now(), this.roundStartedAt);
    return Math.max(0, (tr.endsAt - now) / 1000);
  }

  private secondsLeft(team: Team) {
    return Math.ceil(this.timeLeft(team));
  }

  // Llamado periódicamente por el servidor (p. ej. cada 100 ms).
  tick() {
    if (this.phase !== 'playing') return;
    for (const team of TEAMS) {
      const tr = this.teams[team];
      if (!tr || tr.status !== 'playing') continue;
      if (this.timeLeft(team) <= 0) {
        this.endTeam(team, 'timeout');
        continue;
      }
      const s = this.secondsLeft(team);
      if (s !== tr.lastSentSecond) {
        tr.lastSentSecond = s;
        this.bus.toTeam(team, { type: 'timer', timeLeft: s });
      }
    }
  }

  startsIn(): number {
    return Math.max(0, (this.roundStartedAt - this.clock.now()) / 1000);
  }

  // Equipo en juego y con el reloj ya corriendo. Nada se acepta durante la cuenta atrás.
  private playing(team: Team | null): TeamRound | null {
    if (!team || this.phase !== 'playing' || this.startsIn() > 0) return null;
    const tr = this.teams[team];
    return tr && tr.status === 'playing' ? tr : null;
  }

  // =========================================================================
  //  Botones (caja o pantalla en modo sin hardware)
  // =========================================================================

  deviceButton(team: Team, button: number) {
    if (!TEAMS.includes(team)) return;
    if (button === SUBMIT_BUTTON) this.deliver(team);
    else if (button === 0 || button === 1 || button === 2) this.switchModule(team, button);
  }

  screenControlsEnabled() {
    return this.cfg.screenControlsAlways || !this.deviceConnected;
  }

  screenSwitch(clientId: string, module: ModuleIndex) {
    if (!this.screenControlsEnabled()) return;
    const team = this.teamOf(clientId);
    if (team) this.switchModule(team, module);
  }

  screenDeliver(clientId: string) {
    if (!this.screenControlsEnabled()) return;
    const team = this.teamOf(clientId);
    if (team) this.deliver(team);
  }

  private switchModule(team: Team, module: ModuleIndex) {
    const tr = this.playing(team);
    if (!tr || ![0, 1, 2].includes(module)) return;
    if (tr.active === module) return;
    // Se permite cambiar a un módulo ya resuelto: el móvil lo muestra como completado.
    const now = this.clock.now();
    tr.activeTime[tr.active] += now - tr.activeSince;
    tr.active = module;
    tr.activeSince = now;
    if (tr.attackOrder[tr.attackOrder.length - 1] !== module) tr.attackOrder.push(module);
    this.logEvent(team, 'switch', MODULES[module], '');
    this.bus.toTeam(team, { type: 'module_switch', active: module });
    this.pushIndicators();
    this.bus.stateChanged();
  }

  private deliver(team: Team) {
    const tr = this.playing(team);
    if (!tr) return;
    if (tr.solved.every(Boolean)) {
      this.endTeam(team, 'defused');
    } else {
      // MVP: entrega incompleta no tiene efecto en el juego; el móvil solo lo muestra.
      this.logEvent(team, 'deliver_incomplete', '', '');
      this.bus.toTeam(team, { type: 'deliver_result', accepted: false, solved: [...tr.solved] as [boolean, boolean, boolean] });
    }
  }

  // =========================================================================
  //  Respuestas
  // =========================================================================

  submit(clientId: string, module: ModuleIndex, answer: unknown): string | null {
    const team = this.teamOf(clientId);
    const tr = this.playing(team);
    if (!team || !tr) return 'not_playing';
    if (module !== tr.active) return 'not_active';
    if (tr.solved[module]) return 'already_solved';

    const type = MODULES[module];
    let result: { correct: boolean; solved: boolean; reveal?: number | null } | null;
    switch (type) {
      case 'cables':
        result = this.checkCables(tr, answer);
        break;
      case 'simon':
        result = this.checkSimon(tr, answer);
        break;
      case 'candados':
        result = this.checkCandados(tr, answer);
        break;
    }
    if (!result) return 'invalid_answer';

    if (!result.correct) {
      this.applyError(team, tr, module);
      return null;
    }

    if (result.solved) {
      tr.solved[module] = true;
      tr.solvedAt[module] = this.elapsed();
      tr.endsAt += this.cfg.solveBonus * 1000;
      this.logEvent(team, 'solved', type, `+${this.cfg.solveBonus}`);
    } else {
      this.logEvent(team, 'progress', type, JSON.stringify(this.progress(tr)));
    }
    this.bus.toTeam(team, {
      type: 'answer_result',
      module,
      correct: true,
      penalty: 0,
      timeLeft: this.secondsLeft(team),
      progress: this.progress(tr),
      ...(type === 'candados' ? { reveal: result.reveal ?? null } : {}),
    });
    if (result.solved) {
      this.bus.toTeam(team, {
        type: 'module_solved',
        module,
        bonus: this.cfg.solveBonus,
        timeLeft: this.secondsLeft(team),
      });
      tr.lastSentSecond = this.secondsLeft(team);
      this.pushIndicators();
    }
    this.bus.stateChanged();
    return null;
  }

  private checkCables(tr: TeamRound, answer: unknown) {
    const c = tr.challenges[0];
    if (!Number.isInteger(answer) || (answer as number) < 0 || (answer as number) >= c.cables.length) return null;
    // Un cable ya cortado no se puede volver a cortar (ni penaliza).
    if (tr.cut.includes(answer as number)) return null;
    tr.cut.push(answer as number);
    const correct = answer === c.solution;
    return { correct, solved: correct };
  }

  private checkSimon(tr: TeamRound, answer: unknown) {
    const c = tr.challenges[1];
    if (!Array.isArray(answer) || answer.length !== 4 || !answer.every((x) => SIMON_COLORS.includes(x))) return null;
    const expected = c.turns[tr.simonTurn].solution;
    const correct = expected.every((col, i) => answer[i] === col);
    if (!correct) {
      if (this.cfg.simonErrorResets === 'module') tr.simonTurn = 0;
      return { correct: false, solved: false };
    }
    tr.simonTurn += 1;
    return { correct: true, solved: tr.simonTurn >= c.turns.length };
  }

  private checkCandados(tr: TeamRound, answer: unknown) {
    const c = tr.challenges[2];
    // Acepta un número o { pad, value }. Con pad se descartan envíos obsoletos.
    let value: unknown = answer;
    if (answer && typeof answer === 'object' && !Array.isArray(answer)) {
      const a = answer as { pad?: unknown; value?: unknown };
      if (a.pad !== undefined && a.pad !== tr.padIndex) return null;
      value = a.value;
    }
    if (!Number.isInteger(value) || (value as number) < 0 || (value as number) > 9) return null;
    const pad = c.pads[tr.padIndex];
    if (value !== pad.solution) {
      if (this.cfg.candadosErrorResets === 'module') {
        tr.padIndex = 0;
        tr.revealed = [];
        tr.padValues = [];
      }
      return { correct: false, solved: false };
    }
    tr.revealed[tr.padIndex] = pad.revealRune;
    tr.padValues[tr.padIndex] = value as number;
    tr.padIndex += 1;
    return { correct: true, solved: tr.padIndex >= c.pads.length, reveal: pad.revealRune };
  }

  penaltyFor(module: ModuleIndex, errorNumber: number): number {
    return this.cfg.penaltyBase[MODULES[module] as ModuleType] + this.cfg.penaltyStep * (errorNumber - 1);
  }

  private applyError(team: Team, tr: TeamRound, module: ModuleIndex) {
    const penalty = this.penaltyFor(module, tr.errors.length + 1);
    tr.errors.push({ t: this.elapsed(), module, penalty });
    tr.endsAt -= penalty * 1000;
    this.logEvent(team, 'error', MODULES[module], `-${penalty}`);
    this.bus.toDevice({ type: 'flash', team });
    this.bus.toTeam(team, {
      type: 'answer_result',
      module,
      correct: false,
      penalty,
      timeLeft: this.secondsLeft(team),
      progress: this.progress(tr),
    });
    tr.lastSentSecond = this.secondsLeft(team);
    if (this.timeLeft(team) <= 0) this.endTeam(team, 'timeout');
    this.bus.stateChanged();
  }

  private progress(tr: TeamRound): ProgressView {
    return { simonTurn: tr.simonTurn, padIndex: tr.padIndex, revealed: [...tr.revealed], padValues: [...tr.padValues], cut: [...tr.cut] };
  }

  // =========================================================================
  //  Fin de ronda
  // =========================================================================

  private endTeam(team: Team, status: TeamStatus) {
    const tr = this.teams[team];
    if (!tr || tr.status !== 'playing') return;
    const now = this.clock.now();
    tr.frozenTimeLeft = Math.max(0, (tr.endsAt - now) / 1000);
    tr.status = status;
    tr.activeTime[tr.active] += now - tr.activeSince;
    this.logEvent(team, 'end', '', status);
    this.recordRound(team, tr);
    this.bus.toAll({ type: 'round_end', team, result: status, timeLeft: Math.ceil(tr.frozenTimeLeft) });

    if (status === 'defused' && !this.roundWinner) {
      this.roundWinner = team;
      // Gana el primero que desarma: el rival deja de jugar.
      for (const other of TEAMS) if (other !== team) this.endTeam(other, 'beaten');
    }

    this.pushIndicators();
    this.bus.stateChanged();
    // La llamada recursiva de 'beaten' ya puede haber cerrado la ronda.
    if (this.phase === 'playing' && TEAMS.every((t) => this.teams[t]!.status !== 'playing')) this.finishRound();
  }

  private finishRound() {
    const winner = this.roundWinner;
    if (winner) this.score[winner] += 1;
    const results = TEAMS.map((team) => ({
      team,
      status: this.teams[team]!.status,
      timeLeft: Math.ceil(this.teams[team]!.frozenTimeLeft),
    }));
    this.lastRound = { winner, results };
    const sessionOver = this.round >= this.cfg.roundsPerSession;
    this.phase = sessionOver ? 'session_over' : 'round_over';
    this.bus.toAll({
      type: 'round_summary',
      round: this.round,
      winner,
      results,
      score: { ...this.score },
      sessionOver,
    });
    this.broadcastLobby();
    this.bus.stateChanged();
  }

  // =========================================================================
  //  Caja
  // =========================================================================

  setDeviceConnected(connected: boolean) {
    this.deviceConnected = connected;
    this.bus.toAll({ type: 'device_status', connected, screenControls: this.screenControlsEnabled() });
    if (connected) this.pushIndicators();
    this.bus.stateChanged();
  }

  indicators(): Record<Team, LedState[]> {
    const out = {} as Record<Team, LedState[]>;
    for (const team of TEAMS) {
      const tr = this.teams[team];
      if (this.phase === 'lobby' || !tr) out[team] = [this.cfg.lobbyLeds, this.cfg.lobbyLeds, this.cfg.lobbyLeds];
      else if (this.phase !== 'playing' || tr.status !== 'playing') out[team] = [0, 0, 0];
      else out[team] = tr.solved.map((s, i) => (s ? 0 : i === tr.active ? 2 : 1));
    }
    return out;
  }

  pushIndicators() {
    this.bus.toDevice({ type: 'indicators', ...this.indicators() });
  }

  // =========================================================================
  //  Snapshot para resincronizar un móvil que (re)conecta
  // =========================================================================

  snapshot(clientId: string | null): StateSnapshot {
    const team = clientId ? this.teamOf(clientId) : null;
    const tr = team ? this.teams[team] : undefined;
    const showRound = team && tr && this.phase !== 'lobby';
    const opp = team ? TEAMS.find((t) => t !== team)! : null;
    return {
      phase: this.phase,
      you: { team },
      seats: this.seatViews(),
      allReady: this.allReady(),
      round: this.round,
      score: { ...this.score },
      deviceConnected: this.deviceConnected,
      screenControls: this.screenControlsEnabled(),
      mine: showRound
        ? {
            status: tr.status,
            startsIn: this.phase === 'playing' ? this.startsIn() : 0,
            timeLeft: this.secondsLeft(team),
            active: tr.active,
            solved: [...tr.solved] as [boolean, boolean, boolean],
            errors: tr.errors.length,
            attackOrder: [...tr.attackOrder],
            challenges: tr.challenges.map(toPublic),
            progress: this.progress(tr),
          }
        : null,
      opponent: opp && this.teams[opp] && this.phase !== 'lobby' ? { team: opp, status: this.teams[opp]!.status } : null,
      lastRound: this.lastRound,
    };
  }

  // =========================================================================
  //  Registro
  // =========================================================================

  private elapsed() {
    return Math.round((this.clock.now() - this.roundStartedAt) / 100) / 10;
  }

  private logEvent(team: Team, event: Parameters<MatchLog['event']>[0]['event'], module: string, detail: string) {
    this.log?.event({
      session: this.session,
      round: this.round,
      team,
      t: this.elapsed(),
      event,
      module,
      detail,
      timeLeft: Math.round(this.timeLeft(team) * 10) / 10,
    });
  }

  private recordRound(team: Team, tr: TeamRound) {
    if (!this.log) return;
    const sec = (ms: number) => Math.round(ms / 100) / 10;
    const errs = (m: ModuleIndex) => tr.errors.filter((e) => e.module === m).length;
    this.log.round({
      session: this.session,
      round: this.round,
      team,
      result: tr.status,
      timeLeftAtEnd: Math.round(tr.frozenTimeLeft * 10) / 10,
      duration: this.elapsed(),
      challenges: tr.challenges.map((c) => c.id).join(' '),
      attackOrder: tr.attackOrder.map((m) => MODULES[m]).join('>'),
      errorsTotal: tr.errors.length,
      errorsCables: errs(0),
      errorsSimon: errs(1),
      errorsCandados: errs(2),
      errorTimes: tr.errors.map((e) => `${e.t}@${MODULES[e.module]}`).join(';'),
      solvedAtCables: tr.solvedAt[0] ?? '',
      solvedAtSimon: tr.solvedAt[1] ?? '',
      solvedAtCandados: tr.solvedAt[2] ?? '',
      activeTimeCables: sec(tr.activeTime[0]),
      activeTimeSimon: sec(tr.activeTime[1]),
      activeTimeCandados: sec(tr.activeTime[2]),
    });
  }
}
