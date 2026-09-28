import type { CableColor, PublicChallenge } from '../../../shared/protocol';
import { Lcd, Rune, glowClass } from '../components/ui';
import { ModuleCasing } from './ModuleCasing';
import s from './modules.module.css';

type CablesChallenge = Extract<PublicChallenge, { type: 'cables' }>;

const CABLE_HEX: Record<CableColor, string> = {
  verde: '#30a46c',
  amarillo: '#d9a400',
  rojo: '#e5484d',
  azul: '#3b82f6',
  blanco: '#e6ebf2',
  negro: '#1b1c26',
  naranja: '#f08c2e',
};

export function Cables({
  challenge,
  cut,
  solved,
  errorAt,
  onCut,
}: {
  challenge: CablesChallenge;
  cut: number[]; // cables ya cortados (el servidor los recuerda, también los fallados)
  solved: boolean;
  errorAt: number | null;
  onCut: (index: number) => void;
}) {
  return (
    <ModuleCasing challengeId={challenge.id} solved={solved} name="Cables" hint={solved ? 'Resuelto' : 'Corta uno · un toque responde'} shake={errorAt}>
      <div className={`dither dither-cavidad ${s.cavity}`}>
        {challenge.cables.map((cable, i) => {
          const isCut = cut.includes(i);
          return (
          <button
            key={i}
            type="button"
            className={`dither dither-panel ${s.cable} ${isCut ? s.cableCut : ''}`}
            disabled={solved || isCut}
            onClick={() => onCut(i)}
            aria-label={isCut ? `Cable ${cable.color} cortado` : `Cortar cable ${cable.color}, número ${cable.number}`}
          >
            <Rune id={cable.rune} size={60} fontSize={26} />
            <span className={s.wire}>
              <span className={s.wireLabel}>{cable.color}</span>
              <span className={s.terminal} />
              {isCut ? (
                <span className={s.barCut}>
                  <span style={{ background: CABLE_HEX[cable.color] }} />
                  <span style={{ background: CABLE_HEX[cable.color] }} />
                </span>
              ) : (
                <span className={s.bar} style={{ background: CABLE_HEX[cable.color] }} />
              )}
              <span className={s.terminal} />
            </span>
            <Lcd className={s.number}>
              <span className={glowClass}>{cable.number}</span>
            </Lcd>
          </button>
          );
        })}
      </div>
    </ModuleCasing>
  );
}
