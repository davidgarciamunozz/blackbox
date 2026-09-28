import type { SeatView, Team } from '../../../shared/protocol';
import { Body, Casing, Eyebrow, Key, Lcd, Led, Screen, Screws, TeamGlyph, Title, glowClass } from '../components/ui';
import { actions } from '../net/store';
import { TEAM_UI } from '../teams';
import s from './screens.module.css';

// 01 · Inicio: a donde lleva el QR/NFC de la caja.
export function Inicio({ onEnter }: { onEnter: () => void }) {
  const grill = (side: 'left' | 'right') => (
    <span className={s.deviceGrill} style={{ [side]: 31 }} aria-hidden>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <span key={i} />
      ))}
    </span>
  );
  return (
    <Screen>
      <div className={s.center} style={{ gap: 0 }}>
        <Casing className={s.device}>
          <Screws inset={10} />
          {grill('left')}
          {grill('right')}
          <Lcd className={s.logoScreen}>
            <div className={s.logoPlaceholder}>LOGOTIPO</div>
          </Lcd>
          <span className={s.deviceSerial}>BLACKBOX · MOD. 00</span>
          <span className={s.deviceLeds}>
            <Led on size={10} color="var(--cian)" glow="rgba(34, 211, 238, 0.6)" />
            <Led on={false} size={10} color="#1b5561" />
            <Led on={false} size={10} color="#1b5561" />
          </span>
        </Casing>
        <div className={s.stack} style={{ marginTop: 70 }}>
          <Title>Artefacto detectado</Title>
          <Body>Tu compañero necesita el manual antes de empezar.</Body>
        </div>
      </div>
      <div className={s.actions} style={{ marginBottom: 150 }}>
        <Key big onClick={onEnter}>
          Entrar al lobby
        </Key>
      </div>
    </Screen>
  );
}

// 02 · Elegir bando
export function ElegirBando({ me, seats }: { me: Team | null; seats: SeatView[] }) {
  return (
    <Screen>
      <div className={s.stack} style={{ marginTop: 106 }}>
        <Eyebrow>Project Blackbox</Eyebrow>
        <Title>Elegí tu bando</Title>
        <Body>Vos sos el Artificiero. Tu compañero se sienta enfrente, del lado de las luces.</Body>
      </div>

      <div className={s.teams} style={{ marginTop: 94, padding: '0 16px' }}>
        {seats.map((seat) => {
          const ui = TEAM_UI[seat.team];
          const mine = seat.team === me;
          const takenByOther = seat.taken && seat.connected && !mine;
          return (
            <button
              key={seat.team}
              type="button"
              data-team={ui.theme}
              className={`dither dither-carcasa ${s.teamCard} ${mine ? s.teamSelected : ''}`}
              style={{ border: mine ? undefined : '3px solid var(--contorno)', borderRadius: 8, filter: mine ? undefined : 'drop-shadow(0 6px 0 var(--contorno))' }}
              disabled={takenByOther}
              onClick={() => actions.join(seat.team)}
              aria-pressed={mine}
            >
              <Screws corners={['tl', 'tr']} />
              <Lcd className={s.teamScreen}>
                <TeamGlyph
                  theme={ui.theme}
                  size={46}
                  color={mine ? undefined : '#6a6d88'}
                  glow={mine}
                />
              </Lcd>
              <span className={s.teamName}>{ui.name}</span>
              {takenByOther && <span className={s.teamTaken}>OCUPADO</span>}
              <span className={s.teamLed}>
                {mine ? (
                  <Led on color="var(--team)" glow="var(--team-glow)" />
                ) : (
                  <Led on={false} color="#4a4c60" />
                )}
              </span>
            </button>
          );
        })}
      </div>

      <div className={s.actions} style={{ marginTop: 74 }} data-team={me ? TEAM_UI[me].theme : undefined}>
        <Key big variant={me ? 'primary' : 'off'} disabled={!me} onClick={() => actions.ready(true)}>
          Listo
        </Key>
        <p className={s.note}>Arranca cuando los dos Artificieros confirmen.</p>
      </div>
    </Screen>
  );
}

// 03 · Esperando al otro Artificiero
export function Esperando({ seats }: { seats: SeatView[] }) {
  const readyCount = seats.filter((x) => x.ready).length;
  const otherMissing = seats.some((x) => !x.taken || !x.connected);
  return (
    <Screen>
      <div className={s.stack} style={{ marginTop: 236 }}>
        <Title>Esperando</Title>
        <Body>{otherMissing ? 'Falta que el otro Artificiero elija bando.' : 'El otro Artificiero todavía no confirma.'}</Body>
      </div>
      <div className={s.center} style={{ flex: 'none', marginTop: 87 }}>
        <Casing className={s.waitPanel}>
          <Screws />
          <Lcd className={s.waitScreen}>
            <span className={s.blink}>
              <Led on size={14} color="var(--team)" glow="var(--team-glow)" />
            </span>
            <Led on={false} size={14} color="var(--team-apagado)" />
            <Led on={false} size={14} color="var(--team-apagado)" />
            <span className={`${s.waitCount} ${glowClass}`}>
              {readyCount} / {seats.length}
            </span>
          </Lcd>
        </Casing>
      </div>
      <div className={s.actions} style={{ marginTop: 100 }}>
        <Key big variant="off" onClick={() => actions.ready(false)} aria-label="Listo enviado. Tocar para cancelar">
          Listo · enviado
        </Key>
      </div>
    </Screen>
  );
}
