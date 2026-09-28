import type { ReactNode } from 'react';
import { Casing, Lcd, Screws, glowClass } from './ui';
import s from '../screens/screens.module.css';

export interface SummaryRow {
  label: string;
  value: ReactNode;
  color?: string;
  block?: boolean; // valor en una segunda línea (p. ej. el orden de ataque)
}

export function Summary({ rows }: { rows: SummaryRow[] }) {
  return (
    <Casing className={s.summary}>
      <Screws corners={['tl', 'tr']} inset={8} />
      <Lcd className={s.summaryScreen}>
        {rows.map((r) => (
          <div key={r.label} className={`${s.summaryRow} ${r.block ? s.summaryBlock : ''}`}>
            <span className={glowClass}>{r.label}</span>
            <span className={`${s.summaryValue} ${glowClass}`} style={r.color ? { color: r.color } : undefined}>
              {r.value}
            </span>
          </div>
        ))}
      </Lcd>
    </Casing>
  );
}
