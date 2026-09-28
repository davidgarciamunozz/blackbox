import type { Team } from '../../shared/protocol';

// El firmware de la caja usa los identificadores "rojo" y "naranja".
// En pantalla los bandos se llaman como en el Figma: Cian y Magenta.
// Si se decide otro nombre o color, se cambia solo aquí.
export const TEAM_UI: Record<Team, { name: string; theme: 'cian' | 'magenta' }> = {
  rojo: { name: 'Cian', theme: 'cian' },
  naranja: { name: 'Magenta', theme: 'magenta' },
};

export const MODULE_NAMES = ['Cables', 'Simon', 'Candados'] as const;
