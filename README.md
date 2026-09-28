# Project Blackbox · software

**En producción:** https://blackbox-gnry.onrender.com · panel: `/admin?token=…`

Servidor del juego + app web para los móviles de los Artificieros. La caja ESP32 (firmware de P.L) se conecta al mismo servidor.

```
server/   Node + TypeScript. Lógica del juego, WebSocket, canal de la caja, registro CSV.
web/      React + Vite. Las pantallas del Figma.
shared/   Tipos del protocolo, compartidos por los dos.
CONTRATO.md  Todos los mensajes entre móvil, servidor y caja.
```

## Retos

Los retos reales llevan las soluciones, así que **no están en el repo**. Hay que copiar `retos.json` a
`server/data/retos.json` (está en `.gitignore`). Sin ese archivo el servidor usa `retos.ejemplo.json`: retos
inventados que sirven para desarrollar y para los tests, pero que no coinciden con el manual.

## Arrancar

```bash
npm install
npm run build      # compila la app web
npm start          # servidor en el puerto 8080 (PORT=8090 npm start si el 8080 está ocupado): sirve la app, /ws (móviles) y /device (caja)
```

Al arrancar, el servidor imprime la IP a la que tienen que apuntar los móviles (y `WS_HOST` del firmware).
Móviles, caja y ordenador en la **misma red WiFi de 2,4 GHz** (ver guía del dispositivo, §10).

Desarrollo con recarga en caliente (dos terminales):

```bash
npm run dev -w server     # servidor en :8080
npm run dev -w web        # app en :5173 (reenvía /ws y /api al servidor)
```

## Desplegar en Render (servidor en internet)

Con el servidor en internet la dirección es fija: el ESP32 se configura una sola vez y los móviles
entran desde cualquier red. Solo hace falta que la caja tenga internet (hotspot de 2,4 GHz con datos).

1. En Render: **New → Blueprint**, elegir este repo. Lee `render.yaml` y crea el servicio `blackbox` (plan gratis).
2. En el servicio → **Environment → Secret Files**: añadir un archivo llamado `retos.json` con el contenido de los
   retos reales. Guardar (redespliega solo). En los logs debe aparecer `Retos: /etc/secrets/retos.json`.
3. La URL queda tipo `https://blackbox-xxxx.onrender.com`. Ese es el enlace del QR/NFC.
4. El token de administración está en **Environment → ADMIN_TOKEN**. Panel: `https://…onrender.com/admin?token=EL_TOKEN`.

### Configuración del ESP32 para el servidor en Render

En la sección 1 del `.ino`:

```cpp
#define MODO_PRUEBA false
const char*    WS_HOST    = "blackbox-gnry.onrender.com";  // sin https:// ni barra final
const uint16_t WS_PORT    = 443;
const char*    WS_PATH    = "/device";
const bool     WS_USE_SSL = true;
```

Y `WIFI_SSID` / `WIFI_PASSWORD` del hotspot (2,4 GHz, con datos).

### A tener en cuenta en el plan gratis

- Si nadie lo usa en 15 min, el servidor se duerme; la primera visita tarda ~50 s en despertarlo.
  Antes de jugar, abrir la URL en un móvil y esperar a que cargue.
- El disco no es permanente: los CSV se pierden al reiniciar o redesplegar. **Descargarlos desde /admin al terminar.**

## Panel de administración

`/admin?token=…` muestra si la caja está conectada, quién está en el lobby y el marcador, y permite:
cambiar el **modo sin hardware** (automático / apagado / siempre), reiniciar la sesión y descargar los CSV.

## Probar sin hardware

- `npx tsx server/scripts/caja-virtual.ts` — caja por teclado (`r0 r1 r2 rx`, `n0 n1 n2 nx`).
- Si no hay caja conectada, los móviles muestran los botones de módulo y de entrega en pantalla (modo sin hardware).
- `npm test` — tests del motor del juego.
- `npx tsx server/scripts/smoke.ts` — con el servidor arrancado, juega una ronda completa con caja y móviles simulados.

## Registro para la evaluación

Cada ronda se guarda en `server/data/logs/<fecha>/rondas.csv` y `eventos.csv`, y se descarga en
`http://HOST:8080/api/logs/rondas.csv` y `/api/logs/eventos.csv`. También desde el panel `/admin`.

## Pendiente

- Runas: la app muestra el número como marcador. Cuando I.C entregue `rune-01.svg … rune-16.svg`, se copian a
  `web/src/assets/runes/` y se usan solas.
- Logotipo de la pantalla de inicio.
