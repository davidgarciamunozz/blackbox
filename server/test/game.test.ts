import { beforeEach, describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { config } from '../src/config.js';
import { ChallengePicker, loadChallenges } from '../src/challenges.js';
import { Game, type Bus } from '../src/game.js';
import { MatchLog } from '../src/log.js';
import type { ServerMessage, ToDeviceMessage } from '../src/protocol.js';

const file = loadChallenges(join(__dirname, '../data/retos.json'));

function setup() {
  let now = 1_000_000;
  const clock = { now: () => now };
  const sent: { to: string; msg: ServerMessage }[] = [];
  const device: ToDeviceMessage[] = [];
  const bus: Bus = {
    toTeam: (team, msg) => sent.push({ to: team, msg }),
    toAll: (msg) => sent.push({ to: 'all', msg }),
    toDevice: (msg) => device.push(msg),
    stateChanged: () => {},
  };
  const log = new MatchLog(null);
  // random = 0 → siempre el primer reto libre: resultados deterministas
  const game = new Game({ ...config }, new ChallengePicker(file, () => 0), bus, clock, log);
  return {
    game,
    sent,
    device,
    log,
    advance: (ms: number) => {
      now += ms;
      game.tick();
    },
    last: (type: string, to?: string) =>
      [...sent].reverse().find((s) => s.msg.type === type && (!to || s.to === to))?.msg as any,
  };
}

function startMatch(t: ReturnType<typeof setup>) {
  t.game.join('A', 'rojo');
  t.game.join('B', 'naranja');
  t.game.setReady('A', true);
  t.game.setReady('B', true);
  t.advance(config.countdown * 1000);
}

// Soluciones de los primeros retos del equipo rojo en retos.json
const ROJO = {
  cables: file.cables.find((c) => c.equipo === 'rojo')!,
  simon: file.simon.find((c) => c.equipo === 'rojo')!,
  candados: file.candados.find((c) => c.equipo === 'rojo')!,
};

function solveAll(t: ReturnType<typeof setup>) {
  t.game.submit('A', 0, ROJO.cables.solution);
  t.game.deviceButton('rojo', 1);
  for (const turn of ROJO.simon.turns) t.game.submit('A', 1, turn.solution);
  t.game.deviceButton('rojo', 2);
  for (const pad of ROJO.candados.pads) t.game.submit('A', 2, pad.solution);
}

describe('lobby', () => {
  it('arranca solo cuando los dos equipos están listos', () => {
    const t = setup();
    t.game.join('A', 'rojo');
    t.game.join('B', 'naranja');
    t.game.setReady('A', true);
    expect(t.game.phase).toBe('lobby');
    t.game.setReady('B', true);
    expect(t.game.phase).toBe('playing');
    expect(t.last('match_start', 'rojo').timeLeft).toBe(300);
  });

  it('no deja ocupar un bando con otro móvil conectado, pero sí uno desconectado', () => {
    const t = setup();
    t.game.join('A', 'rojo');
    expect(t.game.join('C', 'rojo')).toBe('team_taken');
    t.game.disconnect('A');
    expect(t.game.join('C', 'rojo')).toBeNull();
    expect(t.game.teamOf('C')).toBe('rojo');
  });
});

describe('seguridad', () => {
  it('match_start y el snapshot no contienen soluciones ni runas por revelar', () => {
    const t = setup();
    startMatch(t);
    const payload = JSON.stringify(t.last('match_start', 'rojo')) + JSON.stringify(t.game.snapshot('A'));
    expect(payload).not.toContain('solution');
    expect(payload).not.toContain('revealRune');
  });
});

describe('ronda', () => {
  let t: ReturnType<typeof setup>;
  beforeEach(() => {
    t = setup();
    startMatch(t);
  });

  it('el reloj baja y emite timer cada segundo', () => {
    t.advance(1000);
    expect(t.last('timer', 'rojo').timeLeft).toBe(299);
  });

  it('error en cables penaliza 40 s, el cable queda cortado y la reincidencia suma 5 s', () => {
    const wrong = ROJO.cables.solution === 0 ? 1 : 0;
    t.game.submit('A', 0, wrong);
    expect(t.last('answer_result', 'rojo')).toMatchObject({ correct: false, penalty: 40, timeLeft: 260 });
    expect(t.last('answer_result', 'rojo').progress.cut).toEqual([wrong]);
    expect(t.device.at(-1)).toEqual({ type: 'flash', team: 'rojo' });
    // volver a tocar el mismo cable no hace nada
    expect(t.game.submit('A', 0, wrong)).toBe('invalid_answer');
    expect(t.game.teams.rojo!.errors.length).toBe(1);
    // segundo error del equipo (en otro módulo): base de Simon 20 + 5
    t.game.deviceButton('rojo', 1);
    t.game.submit('A', 1, ['rojo', 'rojo', 'rojo', 'rojo'].map((c, i) => (ROJO.simon.turns[0].solution[i] === c ? 'azul' : c)));
    expect(t.last('answer_result', 'rojo').penalty).toBe(25);
  });

  it('acertar un módulo suma 10 s y apaga su LED', () => {
    t.game.submit('A', 0, ROJO.cables.solution);
    expect(t.last('module_solved', 'rojo')).toMatchObject({ module: 0, bonus: 10, timeLeft: 310 });
    expect(t.game.indicators().rojo).toEqual([0, 1, 1]);
  });

  it('solo se responde al módulo activo', () => {
    expect(t.game.submit('A', 1, ROJO.simon.turns[0].solution)).toBe('not_active');
  });

  it('los botones de la caja cambian el módulo activo y los LEDs', () => {
    expect(t.game.indicators().rojo).toEqual([2, 1, 1]);
    t.game.deviceButton('rojo', 2);
    expect(t.last('module_switch', 'rojo').active).toBe(2);
    expect(t.game.indicators().rojo).toEqual([1, 1, 2]);
    expect(t.game.indicators().naranja).toEqual([2, 1, 1]);
  });

  it('candados revela la runa solo al acertar', () => {
    t.game.deviceButton('rojo', 2);
    t.game.submit('A', 2, ROJO.candados.pads[0].solution);
    const r = t.last('answer_result', 'rojo');
    expect(r.reveal).toBe(ROJO.candados.pads[0].revealRune);
    expect(r.progress.padIndex).toBe(1);
  });

  it('simon avanza de turno en turno', () => {
    t.game.deviceButton('rojo', 1);
    t.game.submit('A', 1, ROJO.simon.turns[0].solution);
    expect(t.last('answer_result', 'rojo').progress.simonTurn).toBe(1);
  });

  it('entrega incompleta no hace nada; completa gana la ronda', () => {
    t.game.deviceButton('rojo', 3);
    expect(t.game.teams.rojo!.status).toBe('playing');
    solveAll(t);
    t.game.deviceButton('rojo', 3);
    expect(t.game.teams.rojo!.status).toBe('defused');
    expect(t.game.teams.naranja!.status).toBe('beaten');
    expect(t.game.phase).toBe('round_over');
    expect(t.game.score.rojo).toBe(1);
  });

  it('un equipo pierde por tiempo y el otro sigue jugando', () => {
    // naranja se queda sin tiempo a base de errores en Candados
    t.game.deviceButton('naranja', 2);
    const pad0 = file.candados.find((c) => c.equipo === 'naranja')!.pads[0].solution;
    for (let i = 0; i < 40 && t.game.teams.naranja!.status === 'playing'; i++) t.game.submit('B', 2, (pad0 + 1) % 10);
    expect(t.game.teams.naranja!.status).toBe('timeout');
    expect(t.game.teams.rojo!.status).toBe('playing');
    expect(t.game.phase).toBe('playing');
  });

  it('el reloj a cero es derrota', () => {
    t.advance(300_000);
    expect(t.game.teams.rojo!.status).toBe('timeout');
    expect(t.game.phase).toBe('round_over');
    expect(t.game.lastRound!.winner).toBeNull();
  });

  it('en modo sin hardware el móvil puede cambiar de módulo; con caja no', () => {
    t.game.setDeviceConnected(true);
    t.game.screenSwitch('A', 1);
    expect(t.game.teams.rojo!.active).toBe(0);
    t.game.setDeviceConnected(false);
    t.game.screenSwitch('A', 1);
    expect(t.game.teams.rojo!.active).toBe(1);
  });

  it('registra la ronda en el CSV', () => {
    t.advance(2000);
    t.game.submit('A', 0, ROJO.cables.solution === 0 ? 1 : 0);
    solveAll(t);
    t.game.deviceButton('rojo', 3);
    const rojo = t.log.rounds.find((r) => r.team === 'rojo')!;
    expect(rojo).toMatchObject({ result: 'defused', errorsTotal: 1, attackOrder: 'cables>simon>candados' });
    expect(t.log.roundsCsv().split('\n')[0]).toContain('attackOrder');
  });
});

describe('cuenta atrás', () => {
  it('el reloj no corre ni se aceptan respuestas hasta que termina', () => {
    const t = setup();
    t.game.join('A', 'rojo');
    t.game.join('B', 'naranja');
    t.game.setReady('A', true);
    t.game.setReady('B', true);
    expect(t.last('match_start', 'rojo').countdown).toBe(3);
    t.advance(2000);
    expect(t.game.submit('A', 0, ROJO.cables.solution)).toBe('not_playing');
    expect(t.game.timeLeft('rojo')).toBe(300);
    t.advance(1000);
    expect(t.game.submit('A', 0, ROJO.cables.solution)).toBeNull();
  });

  it('avisa al móvil cuando la entrega es incompleta', () => {
    const t = setup();
    startMatch(t);
    t.game.submit('A', 0, ROJO.cables.solution);
    t.game.deviceButton('rojo', 3);
    expect(t.last('deliver_result', 'rojo')).toEqual({ type: 'deliver_result', accepted: false, solved: [true, false, false] });
  });
});

describe('LEDs', () => {
  it('en el lobby están encendidos', () => {
    const t = setup();
    expect(t.game.indicators()).toEqual({ rojo: [1, 1, 1], naranja: [1, 1, 1] });
  });
});

describe('sesión', () => {
  it('tras 3 rondas la sesión termina y la siguiente arranca de cero', () => {
    const t = setup();
    t.game.join('A', 'rojo');
    t.game.join('B', 'naranja');
    for (let r = 0; r < 3; r++) {
      t.game.setReady('A', true);
      t.game.setReady('B', true);
      t.advance(400_000);
    }
    expect(t.game.phase).toBe('session_over');
    t.game.setReady('A', true);
    t.game.setReady('B', true);
    expect(t.game.round).toBe(1);
    expect(t.game.session).toBe(2);
  });

  it('no repite retos entre rondas de la misma sesión', () => {
    const t = setup();
    t.game.join('A', 'rojo');
    t.game.join('B', 'naranja');
    const seen = new Set<string>();
    for (let r = 0; r < 3; r++) {
      t.game.setReady('A', true);
      t.game.setReady('B', true);
      for (const c of t.game.teams.rojo!.challenges) {
        expect(seen.has(c.id)).toBe(false);
        seen.add(c.id);
      }
      t.advance(400_000);
    }
  });
});
