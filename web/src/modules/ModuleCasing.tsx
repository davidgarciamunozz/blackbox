import type { ReactNode } from 'react';
import { Casing, Screws } from '../components/ui';
import s from './modules.module.css';

export function ModuleCasing({
  name,
  hint,
  bronze,
  shake,
  challengeId,
  solved,
  children,
}: {
  challengeId: string;
  solved?: boolean;
  name: string;
  hint: string;
  bronze?: boolean;
  shake?: number | null; // cambia de valor para relanzar la sacudida de error
  children: ReactNode;
}) {
  return (
    <Casing bronze={bronze} className={`${s.module} ${shake ? s.shake : ''}`} key={shake ?? 'm'} data-challenge={challengeId}>
      <Screws corners={['bl', 'br']} />
      <header className={`${s.header} ${bronze ? s.headerBronze : ''}`}>
        <h2 className={s.name}>{name}</h2>
        <span className={s.hint}>{hint}</span>
      </header>
      {children}
      {solved && (
        // Módulo ya resuelto: se ve, pero no se puede tocar (evita penalizaciones accidentales).
        <div className={s.solvedOverlay} role="status">
          <div className={s.solvedStamp}>
            <span className={s.solvedTitle}>Módulo resuelto</span>
            <span className={s.solvedHint}>Cambiá de módulo con los botones de la caja</span>
          </div>
        </div>
      )}
    </Casing>
  );
}
