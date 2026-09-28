// Página mínima de administración para las pruebas: /admin?token=…
// Sin dependencias: se sirve tal cual desde el servidor.

export const ADMIN_PAGE = /* html */ `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Blackbox · admin</title>
<style>
  :root { color-scheme: dark; font-family: system-ui, sans-serif; }
  body { margin: 0; padding: 20px 16px 40px; background: #23242f; color: #eaf4ff; max-width: 520px; margin-inline: auto; }
  h1 { font-size: 20px; margin: 0 0 16px; }
  section { background: #2f3042; border-radius: 8px; padding: 14px 16px; margin-bottom: 14px; }
  h2 { font-size: 13px; text-transform: uppercase; letter-spacing: .06em; color: #aaafc2; margin: 0 0 10px; }
  .row { display: flex; gap: 8px; flex-wrap: wrap; }
  button, a.btn { flex: 1; min-width: 90px; padding: 12px; border: 0; border-radius: 6px; background: #4c4e68; color: #eaf4ff; font: inherit; font-weight: 600; text-align: center; text-decoration: none; cursor: pointer; }
  button.on { background: #22d3ee; color: #0b1e24; }
  button.danger { background: #ff4d4d; color: #200; }
  .dot { display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-right: 6px; vertical-align: middle; }
  p { margin: 6px 0; line-height: 1.4; }
  small { color: #aaafc2; }
  #err { color: #ff4d4d; }
</style>
</head>
<body>
<h1>Blackbox · administración</h1>
<p id="err"></p>

<section>
  <h2>Estado</h2>
  <p><span class="dot" id="devDot"></span>Caja: <b id="dev">…</b></p>
  <p>Fase: <b id="phase">…</b> · Ronda <b id="round">…</b> · Marcador <b id="score">…</b></p>
  <p>Móviles: <b id="seats">…</b></p>
</section>

<section>
  <h2>Modo sin hardware (botones en pantalla)</h2>
  <div class="row">
    <button data-mode="auto">Automático</button>
    <button data-mode="off">Apagado</button>
    <button data-mode="always">Siempre</button>
  </div>
  <p><small>Automático: solo si la caja se desconecta. Apagado: nunca, manda la caja. Siempre: para probar sin caja.</small></p>
</section>

<section>
  <h2>Registro (CSV)</h2>
  <div class="row">
    <a class="btn" id="csvRondas">rondas.csv</a>
    <a class="btn" id="csvEventos">eventos.csv</a>
  </div>
  <p><small>Descargalos al terminar cada sesión: si el servidor se reinicia, se pierden.</small></p>
</section>

<section>
  <h2>Partida</h2>
  <div class="row"><button class="danger" id="reset">Reiniciar sesión</button></div>
  <p><small>Vuelve todos al lobby y pone el marcador a cero.</small></p>
</section>

<script>
  const token = new URLSearchParams(location.search).get('token') || '';
  const q = token ? '?token=' + encodeURIComponent(token) : '';
  const $ = (id) => document.getElementById(id);
  $('csvRondas').href = '/api/logs/rondas.csv' + q;
  $('csvEventos').href = '/api/logs/eventos.csv' + q;

  async function call(path, method = 'GET') {
    const sep = path.includes('?') ? '&' : '?';
    const r = await fetch(path + (token ? sep + 'token=' + encodeURIComponent(token) : ''), { method });
    if (r.status === 401) { $('err').textContent = 'Token incorrecto: abrí /admin?token=TU_TOKEN'; throw new Error('401'); }
    return r;
  }

  async function refresh() {
    try {
      const s = await (await fetch('/api/state')).json();
      $('dev').textContent = s.deviceConnected ? 'conectada' : 'desconectada';
      $('devDot').style.background = s.deviceConnected ? '#3afb0a' : '#ff4d4d';
      $('phase').textContent = s.phase;
      $('round').textContent = s.round;
      $('score').textContent = 'Cian ' + s.score.rojo + ' – ' + s.score.naranja + ' Magenta';
      $('seats').textContent = s.seats.map((x) => (x.team === 'rojo' ? 'Cian' : 'Magenta') + ': ' + (x.connected ? (x.ready ? 'listo' : 'conectado') : 'libre')).join(' · ');
      document.querySelectorAll('[data-mode]').forEach((b) => b.classList.toggle('on', b.dataset.mode === s.screenControlsMode));
    } catch {}
  }

  document.querySelectorAll('[data-mode]').forEach((b) =>
    b.addEventListener('click', async () => { await call('/api/screen-controls?mode=' + b.dataset.mode, 'POST'); refresh(); }));
  $('reset').addEventListener('click', async () => {
    if (confirm('¿Reiniciar la sesión? Se pierde la partida en curso.')) { await call('/api/reset', 'POST'); refresh(); }
  });
  refresh();
  setInterval(refresh, 2000);
</script>
</body>
</html>`;
