import { useEffect, useState } from 'react';
import { Body, Screen, Title } from './components/ui';
import { connect, useGame } from './net/store';
import { CuentaAtras, Juego } from './screens/Game';
import { ElegirBando, Esperando, Inicio } from './screens/Lobby';
import { Marcador, Resultado } from './screens/Results';
import s from './screens/screens.module.css';
import { TEAM_UI } from './teams';

export function App() {
  const { connected, state, countdownEndsAt, fx } = useGame();
  const [entered, setEntered] = useState(false);
  const [resultSeenRound, setResultSeenRound] = useState(0);

  useEffect(connect, []);

  const me = state?.you.team ?? null;

  // El color de bando tiñe toda la interfaz.
  useEffect(() => {
    document.documentElement.dataset.team = me ? TEAM_UI[me].theme : 'cian';
  }, [me]);

  const offline = !connected && <div className={s.offline}>Sin conexión · reconectando</div>;

  if (!state) {
    return (
      <Screen>
        <div className={s.center}>
          <Title size={28}>Conectando…</Title>
          <Body>Buscando el servidor del artefacto.</Body>
        </div>
      </Screen>
    );
  }

  const mine = state.mine;
  const mySeat = state.seats.find((x) => x.team === me);
  let screen;

  if (!me) {
    screen = entered || state.phase !== 'lobby' ? <ElegirBando me={null} seats={state.seats} /> : <Inicio onEnter={() => setEntered(true)} />;
  } else if (state.phase === 'lobby') {
    screen = mySeat?.ready ? <Esperando seats={state.seats} /> : <ElegirBando me={me} seats={state.seats} />;
  } else if (state.phase === 'playing' && mine) {
    if (countdownEndsAt && mine.status === 'playing') {
      screen = <CuentaAtras endsAt={countdownEndsAt} />;
    } else if (mine.status === 'playing') {
      screen = <Juego state={state} team={me} mine={mine} fx={fx} />;
    } else {
      screen = <Resultado state={state} team={me} mine={mine} onNext={() => {}} />;
    }
  } else if (mine && resultSeenRound !== state.round) {
    screen = <Resultado state={state} team={me} mine={mine} onNext={() => setResultSeenRound(state.round)} />;
  } else {
    screen = <Marcador state={state} team={me} />;
  }

  return (
    <>
      {offline}
      {screen}
    </>
  );
}
