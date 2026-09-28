import { useEffect, useState } from 'react';
import type { ModuleIndex, StateSnapshot, Team, TeamRoundView } from '../../../shared/protocol';
import { FallbackBar, Franja, Placa } from '../components/device';
import { Summary } from '../components/Summary';
import { Body, Casing, Eyebrow, Key, Lcd, Screen, Screws, Title, glowClass } from '../components/ui';
import { Cables } from '../modules/Cables';
import { Candados } from '../modules/Candados';
import { Simon } from '../modules/Simon';
import { actions, endCountdown, type Fx } from '../net/store';
import { MODULE_NAMES } from '../teams';
import s from './screens.module.css';

// Re-renderiza hasta que caduque el efecto visual más reciente.
function useFxExpiry(fx: Fx | null, ms: number) {
  const [, force] = useState(0);
  useEffect(() => {
    if (!fx) return;
    const left = ms - (performance.now() - fx.at);
    if (left <= 0) return;
    const t = setTimeout(() => force((n) => n + 1), left + 16);
    return () => clearTimeout(t);
  }, [fx, ms]);
  return fx && performance.now() - fx.at < ms ? fx : null;
}

// 04 · Cuenta atrás
export function CuentaAtras({ endsAt }: { endsAt: number }) {
  const [now, setNow] = useState(() => performance.now());
  useEffect(() => {
    const t = setInterval(() => {
      const t2 = performance.now();
      setNow(t2);
      if (t2 >= endsAt) endCountdown();
    }, 100);
    return () => clearInterval(t);
  }, [endsAt]);
  const n = Math.max(1, Math.ceil((endsAt - now) / 1000));
  return (
    <Screen>
      <div className={s.center} style={{ gap: 70 }}>
        <Casing className={s.countdownDevice}>
          <Screws inset={10} />
          <Lcd className={s.countdownScreen}>
            <span key={n} className={`${glowClass} ${s.pop}`}>
              {n}
            </span>
          </Lcd>
        </Casing>
        <Body>El reloj arranca en cuanto llegue a cero.</Body>
      </div>
    </Screen>
  );
}

// 05–13, 19 · Módulo activo
export function Juego({ state, team, mine, fx }: { state: StateSnapshot; team: Team; mine: TeamRoundView; fx: Fx | null }) {
  const liveFx = useFxExpiry(fx, 1400);
  const rejected = useFxExpiry(fx?.kind === 'deliver_rejected' ? fx : null, 3500);
  const active = mine.active;
  const allSolved = mine.solved.every(Boolean);

  // Efecto de acierto/error: solo si ocurrió en el módulo que se está viendo.
  const errorAt = liveFx?.kind === 'error' && liveFx.module === active ? liveFx.at : null;
  const flashClass = liveFx?.kind === 'error' ? s.fxError : liveFx?.kind === 'solved' ? s.fxSolved : null;
  const flash = flashClass && <span key={liveFx!.at} className={`${s.flashOverlay} ${flashClass}`} aria-hidden />;

  const franja = <Franja team={team} timeLeft={mine.timeLeft} solved={mine.solved} active={allSolved ? null : active} fx={liveFx} />;
  const bottom = state.screenControls ? (
    <FallbackBar active={active} onSwitch={actions.switchModule} onDeliver={actions.deliver} />
  ) : (
    <Placa text={allSolved || rejected ? `Blackbox · ronda ${state.round} de 3` : `Blackbox · módulo ${active + 1} de 3`} />
  );

  if (rejected && rejected.kind === 'deliver_rejected') {
    const pending = rejected.solved.filter((x) => !x).length;
    return (
      <Screen className={s.game}>
        {franja}
        <div className={s.result} style={{ paddingTop: 54 }}>
          <Eyebrow color="var(--cuerpo)">Entrega rechazada</Eyebrow>
          <Title size={32}>{pending === 1 ? 'Todavía queda un módulo' : `Todavía quedan ${pending} módulos`}</Title>
          <Body size={15}>No hay penalización. El botón de la caja no hizo nada.</Body>
          <ModuleSummary solved={rejected.solved} />
        </div>
        {bottom}
      </Screen>
    );
  }

  if (allSolved) {
    return (
      <Screen className={s.game}>
        {flash}
        {franja}
        <div className={s.result} style={{ paddingTop: 54 }}>
          <Eyebrow color="var(--ok)" glow>
            Los tres módulos resueltos
          </Eyebrow>
          <Title size={32}>Apretá la entrega</Title>
          <Body size={15}>El botón grande de la caja, el que está hundido.</Body>
          <ModuleSummary solved={mine.solved} />
          {state.screenControls && (
            <div className={s.actions}>
              <Key big onClick={actions.deliver}>
                Entregar
              </Key>
            </div>
          )}
        </div>
        {bottom}
      </Screen>
    );
  }

  const challenge = mine.challenges[active];
  let module = null;
  if (challenge.type === 'cables') {
    module = <Cables challenge={challenge} cut={mine.progress.cut} solved={mine.solved[0]} errorAt={errorAt} onCut={(i) => actions.submit(0, i)} />;
  } else if (challenge.type === 'simon') {
    module = (
      <Simon
        challenge={challenge}
        turn={mine.progress.simonTurn}
        solved={mine.solved[1]}
        errorAt={errorAt}
        onSubmit={(p) => actions.submit(1, p)}
      />
    );
  } else {
    module = (
      <Candados
        challenge={challenge}
        progress={mine.progress}
        solved={mine.solved[2]}
        errorAt={errorAt}
        onSubmit={(pad, value) => actions.submit(2, { pad, value })}
      />
    );
  }

  return (
    <Screen className={s.game}>
      {flash}
      {franja}
      {module}
      {bottom}
    </Screen>
  );
}

function ModuleSummary({ solved }: { solved: boolean[] }) {
  return (
    <div style={{ width: '100%', display: 'flex', justifyContent: 'center', marginTop: 36 }}>
      <Summary
        rows={([0, 1, 2] as ModuleIndex[]).map((m) => ({
          label: MODULE_NAMES[m],
          value: solved[m] ? 'resuelto' : 'pendiente',
          color: solved[m] ? 'var(--ok)' : 'var(--warn)',
        }))}
      />
    </div>
  );
}
