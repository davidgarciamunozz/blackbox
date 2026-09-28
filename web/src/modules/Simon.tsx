import { useEffect, useState } from 'react';
import type { PublicChallenge, SimonColor } from '../../../shared/protocol';
import { Lcd } from '../components/ui';
import { ModuleCasing } from './ModuleCasing';
import s from './modules.module.css';

type SimonChallenge = Extract<PublicChallenge, { type: 'simon' }>;

const COLOR: Record<SimonColor, { fill: string; shade: string; glow: string }> = {
  rojo: { fill: 'var(--simon-rojo)', shade: 'var(--simon-rojo-sombra)', glow: 'rgba(239, 68, 68, 0.6)' },
  verde: { fill: 'var(--simon-verde)', shade: 'var(--simon-verde-sombra)', glow: 'rgba(34, 197, 94, 0.6)' },
  azul: { fill: 'var(--simon-azul)', shade: 'var(--simon-azul-sombra)', glow: 'rgba(59, 130, 246, 0.6)' },
  amarillo: { fill: 'var(--simon-amarillo)', shade: 'var(--simon-amarillo-sombra)', glow: 'rgba(234, 179, 8, 0.6)' },
};

// Orden fijo de luces y botones, como en el Figma.
const LIGHTS: SimonColor[] = ['rojo', 'verde', 'azul', 'amarillo'];
const PADS: SimonColor[] = ['rojo', 'verde', 'azul', 'amarillo'];

export function Simon({
  challenge,
  turn,
  solved,
  errorAt,
  onSubmit,
}: {
  challenge: SimonChallenge;
  turn: number; // turnos ya completados (0..3)
  solved: boolean;
  errorAt: number | null;
  onSubmit: (presses: SimonColor[]) => void;
}) {
  const [presses, setPresses] = useState<SimonColor[]>([]);

  // Al cambiar de turno o al fallar, se vacían las pulsaciones.
  useEffect(() => setPresses([]), [turn, errorAt]);

  const current = challenge.turns[Math.min(turn, challenge.turns.length - 1)];
  const waiting = presses.length >= 4;

  // Si la respuesta del servidor no llega (WiFi caído), se libera el teclado.
  useEffect(() => {
    if (!waiting) return;
    const t = setTimeout(() => setPresses([]), 3000);
    return () => clearTimeout(t);
  }, [waiting]);

  function press(color: SimonColor) {
    if (solved || waiting) return;
    const next = [...presses, color];
    setPresses(next);
    if (next.length === 4) onSubmit(next);
  }

  return (
    <ModuleCasing challengeId={challenge.id} solved={solved}
      bronze
      name="Simon"
      hint={solved ? 'Resuelto' : `Turno ${turn + 1} de ${challenge.turns.length}`}
      shake={errorAt}
    >
      <Lcd className={s.simonDisplay}>
        {solved ? (
          <div className={s.solvedBanner} style={{ height: 204 }}>
            Módulo resuelto
          </div>
        ) : (
          <>
            <span className={s.sectionLabel}>Luces</span>
            <div className={s.lights}>
              {LIGHTS.map((c) => {
                const on = current.leds.includes(c);
                return (
                  <span
                    key={c}
                    className={`${s.light} ${on ? s.lightOn : ''}`}
                    style={on ? { background: COLOR[c].fill, boxShadow: `0 0 8px ${COLOR[c].glow}` } : undefined}
                    aria-label={`Luz ${c} ${on ? 'encendida' : 'apagada'}`}
                  />
                );
              })}
            </div>

            <div className={s.separator} />
            <span className={s.sectionLabel}>Patrón</span>
            <div className={s.pattern}>
              {current.pattern.map((c, i) => (
                <span key={i} style={{ display: 'contents' }}>
                  {i > 0 && <span className={s.arrow}>&gt;</span>}
                  <span className={s.step} style={{ background: COLOR[c].fill, ['--shade' as string]: COLOR[c].shade }}>
                    {i + 1}
                  </span>
                </span>
              ))}
            </div>

            <div className={s.separator} />
            <span className={s.sectionLabel}>Tus pulsaciones</span>
            <div className={s.presses}>
              {[0, 1, 2, 3].map((i) =>
                presses[i] ? (
                  <span key={i} className={s.press} style={{ background: COLOR[presses[i]].fill }} />
                ) : (
                  <span key={i} className={`${s.press} ${s.pressEmpty}`} />
                ),
              )}
            </div>
          </>
        )}
      </Lcd>

      <div className={s.pads}>
        {PADS.map((c) => (
          <button
            key={c}
            type="button"
            className={s.pad}
            style={{ background: COLOR[c].fill, ['--shade' as string]: COLOR[c].shade }}
            disabled={solved || waiting}
            onClick={() => press(c)}
          >
            {c}
          </button>
        ))}
      </div>
    </ModuleCasing>
  );
}
