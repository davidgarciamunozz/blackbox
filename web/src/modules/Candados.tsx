import { useEffect, useState } from 'react';
import type { ProgressView, PublicChallenge } from '../../../shared/protocol';
import { Key, Lcd, Led, Rune, glowClass } from '../components/ui';
import { ModuleCasing } from './ModuleCasing';
import s from './modules.module.css';

type CandadosChallenge = Extract<PublicChallenge, { type: 'candados' }>;

export function Candados({
  challenge,
  progress,
  solved,
  errorAt,
  onSubmit,
}: {
  challenge: CandadosChallenge;
  progress: ProgressView;
  solved: boolean;
  errorAt: number | null;
  onSubmit: (pad: number, value: number) => void;
}) {
  const current = progress.padIndex;
  const [value, setValue] = useState(0);

  // Cada candado nuevo empieza en 0.
  useEffect(() => setValue(0), [current]);

  const step = (d: number) => setValue((v) => (v + d + 10) % 10);

  return (
    <ModuleCasing challengeId={challenge.id} solved={solved} name="Candados" hint={solved ? 'Resuelto' : 'De arriba abajo · orden estricto'} shake={errorAt}>
      <div className={`dither dither-cavidad ${s.headerRune}`}>
        <Rune id={challenge.headerRune} size={78} fontSize={34} />
        <div>
          <div className={s.headerRuneLabel}>Runa de cabecera</div>
          <p className={s.headerRuneText}>Describísela a tu Guía. Ella da el primer número.</p>
        </div>
      </div>

      <div className={s.lockList}>
        {Array.from({ length: challenge.pads }, (_, i) => {
          const done = i < current;
          const active = i === current && !solved;
          const locked = i > current;
          const revealed = progress.revealed[i];
          return (
            <section
              key={i}
              className={`dither dither-panel ${s.lock} ${done ? s.lockDone : ''} ${locked ? s.lockLocked : ''} ${active ? s.lockActive : ''}`}
              aria-label={`Candado ${i + 1}`}
            >
              <div className={s.lockTop}>
                <span className={s.lockLabel}>Candado {i + 1}</span>
                {done ? (
                  <Led on size={10} color="var(--ok)" glow="rgba(58, 251, 10, 0.6)" />
                ) : active ? (
                  <Led on size={10} color="var(--team)" glow="var(--team-glow)" />
                ) : (
                  <Led on={false} size={10} color="var(--lcd-separador)" />
                )}
              </div>
              <div className={s.lockRow}>
                <Key variant="light" className={s.arrowKey} disabled={!active} onClick={() => step(-1)} aria-label="Bajar número">
                  &lt;
                </Key>
                <Lcd className={s.value}>
                  <span className={glowClass}>{done ? progress.padValues[i] ?? '·' : active ? value : '-'}</span>
                </Lcd>
                <Key variant="light" className={s.arrowKey} disabled={!active} onClick={() => step(1)} aria-label="Subir número">
                  &gt;
                </Key>
                <Key
                  variant={active ? 'primary' : 'off'}
                  className={s.confirm}
                  disabled={!active}
                  onClick={() => onSubmit(i, value)}
                >
                  {done ? 'OK' : 'Fijar'}
                </Key>
                {done && revealed != null ? (
                  <span style={{ marginLeft: 'auto', display: 'flex' }}>
                    <Rune id={revealed} size={52} fontSize={24} />
                  </span>
                ) : (
                  <Lcd thin className={s.reveal}>
                    <span>{done ? '·' : '?'}</span>
                  </Lcd>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </ModuleCasing>
  );
}
