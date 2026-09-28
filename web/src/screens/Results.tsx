import type { StateSnapshot, Team, TeamRoundView } from '../../../shared/protocol';
import { Franja, Placa, formatClock } from '../components/device';
import { Summary } from '../components/Summary';
import { Body, Eyebrow, Key, Lcd, Screen, Screws, TeamGlyph, Title, glowClass } from '../components/ui';
import { actions } from '../net/store';
import { MODULE_NAMES, TEAM_UI } from '../teams';
import s from './screens.module.css';

// 16 · Victoria  /  17 · Derrota
export function Resultado({
  state,
  team,
  mine,
  onNext,
}: {
  state: StateSnapshot;
  team: Team;
  mine: TeamRoundView;
  onNext: () => void;
}) {
  const won = mine.status === 'defused';
  const roundOver = state.phase !== 'playing';
  const opponentPlaying = state.opponent?.status === 'playing';
  const solvedCount = mine.solved.filter(Boolean).length;
  const order = mine.attackOrder.map((m) => MODULE_NAMES[m]).join(' > ');
  const last = MODULE_NAMES[mine.active];

  return (
    <Screen className={s.game}>
      <Franja team={team} timeLeft={mine.timeLeft} solved={mine.solved} active={null} fx={null} />
      <div className={s.result}>
        {won ? (
          <>
            <Eyebrow color="var(--ok)" glow>
              Artefacto desarmado
            </Eyebrow>
            <Title size={32}>Ronda ganada</Title>
          </>
        ) : (
          <>
            <Eyebrow color="var(--danger)" glow>
              {mine.status === 'timeout' ? 'Tiempo agotado' : 'El rival desarmó primero'}
            </Eyebrow>
            <Title size={32}>Ronda perdida</Title>
            {opponentPlaying && <Body size={15}>El otro equipo sigue jugando.</Body>}
          </>
        )}

        <Summary
          rows={
            won
              ? [
                  { label: 'Tiempo restante', value: formatClock(mine.timeLeft) },
                  { label: 'Módulos resueltos', value: `${solvedCount} de 3` },
                  { label: 'Errores totales', value: mine.errors },
                  { label: 'Orden de ataque', value: order, block: true },
                ]
              : [
                  { label: 'Módulos resueltos', value: `${solvedCount} de 3` },
                  { label: 'Errores totales', value: mine.errors },
                  { label: 'Último módulo', value: last },
                ]
          }
        />

        <div className={s.actions}>
          {roundOver ? (
            <Key big variant="secondary" onClick={onNext} style={{ fontSize: 12 }}>
              {state.phase === 'session_over' ? 'Ver marcador final' : 'Siguiente ronda · cambiar roles'}
            </Key>
          ) : (
            <Key big variant="off" disabled style={{ fontSize: 12 }}>
              Esperando al otro equipo
            </Key>
          )}
        </div>
      </div>
      <Placa text={`Blackbox · ronda ${state.round} de 3`} />
    </Screen>
  );
}

// 18 · Marcador (entre rondas y al final de la sesión)
export function Marcador({ state, team }: { state: StateSnapshot; team: Team }) {
  const final = state.phase === 'session_over';
  const nextRound = state.round + 1;
  const mySeat = state.seats.find((x) => x.team === team);
  const [a, b] = state.seats.map((x) => x.team);
  const leader = state.score[a] === state.score[b] ? null : state.score[a] > state.score[b] ? a : b;

  return (
    <Screen>
      <div className={s.stack} style={{ marginTop: 106 }}>
        <Eyebrow>{final ? 'Partida terminada' : `Ronda ${nextRound} de 3`}</Eyebrow>
        <Title size={32}>{final ? (leader ? `Gana ${TEAM_UI[leader].name}` : 'Empate') : 'Marcador'}</Title>
        <Body size={15}>
          {final ? 'Tres rondas jugadas. Gana quien más rondas se llevó.' : 'Cambian los roles. Nadie es Artificiero dos veces seguidas.'}
        </Body>
      </div>

      <div className={s.teams} style={{ marginTop: 95, padding: '0 16px' }}>
        {state.seats.map((seat) => {
          const ui = TEAM_UI[seat.team];
          return (
            <div key={seat.team} data-team={ui.theme} className={`dither dither-carcasa ${s.scoreCard}`} style={{ border: '3px solid var(--team)', borderRadius: 8 }}>
              <Screws corners={['tl', 'tr']} />
              <TeamGlyph theme={ui.theme} size={26} glow />
              <Lcd className={s.scoreScreen}>
                <span className={glowClass}>{state.score[seat.team]}</span>
              </Lcd>
              <span className={s.teamName}>{ui.name}</span>
            </div>
          );
        })}
      </div>

      <div className={s.actions} style={{ marginTop: 70 }}>
        {mySeat?.ready ? (
          <Key big variant="off" onClick={() => actions.ready(false)}>
            Listo · enviado
          </Key>
        ) : (
          <Key big onClick={() => actions.ready(true)}>
            {final ? 'Nueva partida' : `Listo para la ronda ${nextRound}`}
          </Key>
        )}
      </div>
    </Screen>
  );
}
