// Piezas fijas del «dispositivo»: franja persistente, placa de base y barra sin hardware.

import type { ModuleIndex, Team } from '../../../shared/protocol';
import type { Fx } from '../net/store';
import { MODULE_NAMES, TEAM_UI } from '../teams';
import { Casing, Key, Lcd, Led, Screws, TeamGlyph, glowClass } from './ui';
import s from './device.module.css';

export function formatClock(seconds: number) {
  const t = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
}

const FX_MS = 1400;

export function Franja({
  team,
  timeLeft,
  solved,
  active,
  fx,
}: {
  team: Team;
  timeLeft: number;
  solved: boolean[];
  active: ModuleIndex | null;
  fx: Fx | null;
}) {
  const ui = TEAM_UI[team];
  const recent = fx && performance.now() - fx.at < FX_MS ? fx : null;
  const error = recent?.kind === 'error' ? recent : null;
  const bonus = recent?.kind === 'solved' ? recent : null;

  const tone = error || timeLeft <= 0 ? s.clockDanger : timeLeft <= 30 ? s.clockWarn : '';

  return (
    <Casing className={s.franja}>
      <Screws />
      <Lcd thin className={s.identity}>
        <TeamGlyph theme={ui.theme} />
        <span className={glowClass}>{ui.name}</span>
      </Lcd>

      <Lcd className={`${s.clock} ${tone} ${error ? s.clockFlash : ''}`} key={error ? `e${error.at}` : 'clock'}>
        <span className={`${s.clockValue} ${glowClass}`} role="timer" aria-live="off">
          {formatClock(timeLeft)}
        </span>
        {error && (
          <span className={`${s.delta} ${glowClass}`} style={{ color: 'var(--danger)' }}>
            -{error.penalty}s
          </span>
        )}
        {bonus && (
          <span key={bonus.at} className={`${s.delta} ${glowClass}`} style={{ color: 'var(--ok)' }}>
            +{bonus.bonus}s
          </span>
        )}
      </Lcd>

      <Lcd thin className={s.modules}>
        {[0, 1, 2].map((m) =>
          solved[m] ? (
            <Led key={m} on color="var(--ok)" glow="rgba(58, 251, 10, 0.6)" />
          ) : m === active ? (
            <Led key={m} on color="var(--team)" glow="var(--team-glow)" />
          ) : (
            <Led key={m} on={false} color="var(--team-apagado)" />
          ),
        )}
      </Lcd>
    </Casing>
  );
}

export function Placa({ text }: { text: string }) {
  const grill = (
    <span className={s.grill} aria-hidden>
      {[0, 1, 2, 3, 4].map((i) => (
        <span key={i} />
      ))}
    </span>
  );
  return (
    <Casing className={s.placa}>
      {grill}
      <span className={s.serial}>{text}</span>
      {grill}
    </Casing>
  );
}

// Modo sin hardware: si la caja se cae, los botones pasan a la pantalla.
export function FallbackBar({
  active,
  onSwitch,
  onDeliver,
}: {
  active: ModuleIndex;
  onSwitch: (m: ModuleIndex) => void;
  onDeliver: () => void;
}) {
  return (
    <Casing className={s.fallback}>
      <span className={s.legend}>Modo sin hardware · botones en pantalla</span>
      <div className={s.fallbackRow}>
        {([0, 1, 2] as ModuleIndex[]).map((m) => (
          <Key key={m} variant={m === active ? 'primary' : 'light'} onClick={() => onSwitch(m)} aria-pressed={m === active}>
            {MODULE_NAMES[m]}
          </Key>
        ))}
        <Key variant="light" className={s.deliver} onClick={onDeliver} aria-label="Entregar">
          <span className={s.deliverIcon} />
        </Key>
      </div>
    </Casing>
  );
}
