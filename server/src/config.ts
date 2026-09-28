// Todo lo que depende de decisiones de diseño (pendientes de P.L) vive aquí,
// para poder ajustarlo en los playtests sin tocar la lógica.

export const TEAMS = ['rojo', 'naranja'] as const;
export type Team = (typeof TEAMS)[number];

// Índice de módulo = índice del botón de la caja (0, 1, 2).
export const MODULES = ['cables', 'simon', 'candados'] as const;
export type ModuleType = (typeof MODULES)[number];
export type ModuleIndex = 0 | 1 | 2;

export const config = {
  port: Number(process.env.PORT ?? 8080),

  startTime: 120, // segundos por equipo al empezar la ronda
  solveBonus: 10, // segundos por módulo resuelto

  // Penalización por error: [1.º, 2.º, 3.º y siguientes] errores del equipo en la ronda.
  penalties: {
    cables: [3, 5, 8],
    simon: [4, 6, 10],
    candados: [6, 10, 15],
  } satisfies Record<ModuleType, number[]>,

  // Qué pasa al fallar (pendiente de confirmar con P.L).
  simonErrorResets: 'turn' as 'turn' | 'module',
  candadosErrorResets: 'pad' as 'pad' | 'module',

  roundsPerSession: 3,

  // LEDs en el lobby: 0 apagados, 1 fijos.
  lobbyLeds: 0 as 0 | 1,

  // Si true, el móvil puede cambiar de módulo y entregar aunque la caja esté conectada.
  // Si false, solo cuando la caja está desconectada (modo sin hardware).
  screenControlsAlways: process.env.SCREEN_CONTROLS === '1',
};

export type Config = typeof config;
