import type { ReactNode } from 'react';
import { Casing, Screws } from '../components/ui';
import s from './modules.module.css';

export function ModuleCasing({
  name,
  hint,
  bronze,
  shake,
  challengeId,
  children,
}: {
  challengeId: string;
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
    </Casing>
  );
}
