# Project Blackbox · Contrato de API

Los tipos exactos están en `shared/protocol.ts` (los usan servidor y app). Todos los mensajes son JSON de texto con un campo `type`. Un único servidor en el puerto **8080**:

| Ruta | Quién | Protocolo |
|---|---|---|
| `http://HOST:8080/` | Móviles | App web |
| `ws://HOST:8080/ws` | Móviles | WebSocket plano |
| `ws://HOST:8080/device` | Caja ESP32 | WebSocket plano (fijado por el firmware) |
| `GET /api/logs/rondas.csv` · `GET /api/logs/eventos.csv` | L.T | Registro de partida |
| `GET /api/state` · `POST /api/reset` | Depuración | — |

**Identificadores fijos:** equipos `"rojo"` y `"naranja"` (los usa el firmware). En pantalla se muestran como **Cian** y **Magenta** (Figma); la correspondencia está en `web/src/teams.ts`. Módulos `0 = cables`, `1 = simon`, `2 = candados`, igual que los botones 0–2 de la caja. El botón `3` es la entrega. Las runas son números del `1` al `16`.

**Regla de oro:** ni `solution` ni `revealRune` salen nunca del servidor.

## Móvil → servidor

```jsonc
{ "type": "hello", "clientId": "uuid-guardado-en-localStorage" } // siempre lo primero; también al reconectar
{ "type": "join", "team": "rojo" }
{ "type": "leave" }
{ "type": "ready", "ready": true }
{ "type": "submit", "module": 0, "answer": 1 }                               // cables: índice del cable (0 = arriba)
{ "type": "submit", "module": 1, "answer": ["rojo","azul","rojo","verde"] }  // simon: las 4 pulsaciones del turno actual
{ "type": "submit", "module": 2, "answer": { "pad": 0, "value": 4 } }        // candados: número del candado actual
{ "type": "switch", "module": 2 }   // solo modo sin hardware
{ "type": "deliver" }               // solo modo sin hardware
```

## Servidor → móvil

```jsonc
{ "type": "state", "state": { ... } }   // snapshot completo: al conectar y en cada cambio de fase. El móvil pinta a partir de aquí.
{ "type": "lobby_state", "players": [{ "team", "taken", "connected", "ready" }], "allReady": false }
{ "type": "match_start", "round": 1, "challenges": [cables, simon, candados], "timeLeft": 120, "active": 0, "countdown": 3 }  // el reloj arranca tras la cuenta atrás
{ "type": "timer", "timeLeft": 87 }
{ "type": "module_switch", "active": 1 }
{ "type": "answer_result", "module": 2, "correct": true, "penalty": 0, "timeLeft": 82,
  "progress": { "simonTurn": 0, "padIndex": 1, "revealed": [7], "padValues": [4], "cut": [] }, "reveal": 7 }  // reveal solo en candados
{ "type": "deliver_result", "accepted": false, "solved": [true, false, true] }  // entrega incompleta (pantalla «Entrega rechazada»)
{ "type": "module_solved", "module": 1, "bonus": 10, "timeLeft": 92 }
{ "type": "round_end", "team": "rojo", "result": "defused" | "timeout" | "beaten", "timeLeft": 14 }
{ "type": "round_summary", "round": 1, "winner": "rojo" | null, "results": [...], "score": { "rojo": 1, "naranja": 0 }, "sessionOver": false }
{ "type": "device_status", "connected": false, "screenControls": true }  // screenControls → mostrar botones de módulo en pantalla
{ "type": "error", "code": "team_taken", "message": "..." }
```

Retos que recibe el móvil (sin soluciones):

```jsonc
{ "id": "cables-03", "type": "cables", "cables": [{ "color": "negro", "rune": 4, "number": 6 }, ...] }
{ "id": "simon-05", "type": "simon", "turns": [{ "leds": ["verde"], "pattern": ["azul","rojo","verde","rojo"] }, ...] }
{ "id": "candados-01", "type": "candados", "headerRune": 16, "pads": 3 }
```

## Caja ↔ servidor (sin cambios respecto a la guía de P.L)

```jsonc
// caja → servidor
{ "type": "hello", "role": "device", "id": "blackbox-01" }
{ "type": "button", "team": "rojo", "button": 2 }
// servidor → caja
{ "type": "indicators", "rojo": [1, 2, 0], "naranja": [1, 1, 1] }   // 0 apagado · 1 fijo · 2 parpadeo
{ "type": "flash", "team": "rojo" }
```

## Reglas del servidor (valores en `server/src/config.ts`)

- Cuenta atrás de 3 s antes de que arranque el reloj. 300 s (5 min) iniciales por equipo, +10 s por módulo resuelto.
- Penalización por error: base Cables 40 s, Simon 20 s, Candados 10 s, +5 s por cada error previo del equipo en la ronda.
- Fallo en Cables: el cable fallado queda cortado y se sigue con los demás. Fallo en Simon: se repite el turno. Fallo en Candados: se queda en el mismo candado.
- Solo se aceptan respuestas al módulo activo. Se puede cambiar a un módulo ya resuelto: el móvil lo muestra bloqueado con el aviso «Módulo resuelto».
- La entrega con los 3 módulos resueltos desarma la bomba. Incompleta: no pasa nada.
- El primer equipo que desarma gana la ronda y el rival pasa a `beaten`. Si un equipo cae por tiempo, el otro sigue jugando.
- Sesión de 3 rondas. Los retos no se repiten dentro de una sesión.
- LEDs en el lobby: encendidos.
