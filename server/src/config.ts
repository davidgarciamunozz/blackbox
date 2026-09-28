// Todo lo que depende de decisiones de diseño (pendientes de P.L) vive aquí,
// para poder ajustarlo en los playtests sin tocar la lógica.

import type { ModuleIndex, Team } from '../../shared/protocol.js';
export type { ModuleIndex, Team };

export const TEAMS: readonly Team[] = ['rojo', 'naranja'];

// Índice de módulo = índice del botón de la caja (0, 1, 2).
export const MODULES = ['cables', 'simon', 'candados'] as const;
export type ModuleType = (typeof MODULES)[number];

export const config = {
  port: Number(process.env.PORT ?? 8080),

  countdown: 3, // cuenta atrás 3-2-1 antes de que arranque el reloj
  startTime: 300, // segundos por equipo al empezar la ronda (5 min, P.L)
  solveBonus: 10, // segundos por módulo resuelto

  // Penalización por error (P.L): base por módulo + 5 s por cada error previo del equipo en la ronda.
  penaltyBase: {
    cables: 40,
    simon: 20,
    candados: 10,
  } satisfies Record<ModuleType, number>,
  penaltyStep: 5,

  // Qué pasa al fallar (P.L): el cable fallado queda cortado; Simon repite el turno;
  // Candados se queda en el mismo candado.
  simonErrorResets: 'turn' as 'turn' | 'module',
  candadosErrorResets: 'pad' as 'pad' | 'module',

  roundsPerSession: 3,

  // LEDs en el lobby: 0 apagados, 1 fijos (P.L: encendidos).
  lobbyLeds: 1 as 0 | 1,

  // Si true, el móvil puede cambiar de módulo y entregar aunque la caja esté conectada.
  // Si false, solo cuando la caja está desconectada (modo sin hardware).
  screenControlsAlways: process.env.SCREEN_CONTROLS === '1',
};

export type Config = typeof config;
