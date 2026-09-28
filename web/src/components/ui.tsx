import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from 'react';
import tornillo from '../assets/figma/tornillo.svg';
import s from './ui.module.css';

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

// ---------------------------------------------------------------------------

export function Screen({ children, className, style }: { children: ReactNode; className?: string; style?: CSSProperties }) {
  return (
    <main className={cx('dither', s.screen, className)} style={style}>
      {children}
    </main>
  );
}

// ---------------------------------------------------------------------------

type Corner = 'tl' | 'tr' | 'bl' | 'br';

export function Screws({ corners = ['tl', 'tr', 'bl', 'br'], inset = 9 }: { corners?: Corner[]; inset?: number }) {
  const pos: Record<Corner, CSSProperties> = {
    tl: { top: inset, left: inset },
    tr: { top: inset, right: inset },
    bl: { bottom: inset, left: inset },
    br: { bottom: inset, right: inset },
  };
  return (
    <>
      {corners.map((c) => (
        <img key={c} src={tornillo} width={12} height={12} alt="" className={s.screw} style={pos[c]} />
      ))}
    </>
  );
}

export function Casing({
  children,
  className,
  style,
  bronze,
  ...rest
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  bronze?: boolean;
  'data-challenge'?: string;
}) {
  return (
    <div
      className={cx('dither', bronze ? 'dither-bronce' : 'dither-carcasa', s.casing, bronze && s.bronze, className)}
      style={style}
      {...rest}
    >
      {children}
    </div>
  );
}

export function Lcd({
  children,
  className,
  style,
  thin,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  thin?: boolean;
}) {
  return (
    <div className={cx(s.lcd, thin && s.lcdThin, className)} style={style}>
      {children}
    </div>
  );
}

export const glowClass = s.glow;

// ---------------------------------------------------------------------------

type KeyVariant = 'primary' | 'secondary' | 'off' | 'light';

export function Key({
  variant = 'primary',
  big,
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: KeyVariant; big?: boolean }) {
  return (
    <button
      type="button"
      className={cx(
        s.key,
        s[variant],
        variant === 'secondary' && 'dither dither-carcasa',
        big && s.big,
        className,
      )}
      {...rest}
    />
  );
}

// ---------------------------------------------------------------------------

export function Led({ color, on, size = 12, glow }: { color: string; on: boolean; size?: number; glow?: string }) {
  return (
    <span
      className={cx(s.led, on && s.ledOn)}
      style={{
        width: size,
        height: size,
        background: color,
        boxShadow: glow ? `0 0 8px ${glow}, 0 0 16px ${glow}` : undefined,
      }}
    />
  );
}

// ---------------------------------------------------------------------------

// Glifo de bando: rombo para Cian, círculo para Magenta.
export function TeamGlyph({ theme, size = 12, color, glow }: { theme: 'cian' | 'magenta'; size?: number; color?: string; glow?: boolean }) {
  const fill = color ?? (theme === 'cian' ? 'var(--cian)' : 'var(--magenta)');
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" aria-hidden style={glow ? { filter: `drop-shadow(0 0 6px ${fill})` } : undefined}>
      {theme === 'cian' ? <path d="M6 0L12 6L6 12L0 6Z" fill={fill} /> : <circle cx="6" cy="6" r="6" fill={fill} />}
    </svg>
  );
}

// ---------------------------------------------------------------------------

// Las ilustraciones de runas se cargan solas si existen en assets/runes/rune-NN.svg
// (entrega de I.C). Mientras no estén, se muestra el número como marcador.
const runeFiles = import.meta.glob('../assets/runes/rune-*.svg', { eager: true, import: 'default' }) as Record<string, string>;

function runeSrc(id: number): string | undefined {
  const nn = String(id).padStart(2, '0');
  return runeFiles[`../assets/runes/rune-${nn}.svg`];
}

export function Rune({ id, size, fontSize }: { id: number; size: number; fontSize: number }) {
  const src = runeSrc(id);
  return (
    <span className={cx(s.rune, !src && s.runePlaceholder)} style={{ width: size, height: size, fontSize }} aria-label={`Runa ${id}`}>
      {src ? <img src={src} alt="" /> : id}
    </span>
  );
}

// ---------------------------------------------------------------------------

export function Eyebrow({ children, color, glow }: { children: ReactNode; color?: string; glow?: boolean }) {
  return (
    <p className={s.eyebrow} style={{ color, textShadow: glow ? `0 0 16px ${color}` : undefined }}>
      {children}
    </p>
  );
}

export function Title({ children, size }: { children: ReactNode; size?: number }) {
  return (
    <h1 className={s.title} style={size ? { fontSize: size } : undefined}>
      {children}
    </h1>
  );
}

export function Body({ children, size }: { children: ReactNode; size?: number }) {
  return (
    <p className={s.body} style={size ? { fontSize: size } : undefined}>
      {children}
    </p>
  );
}
