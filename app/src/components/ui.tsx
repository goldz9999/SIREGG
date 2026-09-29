import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { money } from '../lib/format';

/** Phosphor duotone icon; `n` is the icon class, e.g. "ph-receipt". */
export function Icon({ n, style, className }: { n: string; style?: CSSProperties; className?: string }) {
  return <i className={'ph-duotone ' + n + (className ? ' ' + className : '')} style={style} aria-hidden="true" />;
}

export function SearchInput({ value, onChange, placeholder, style }: {
  value: string; onChange: (v: string) => void; placeholder: string; style?: CSSProperties;
}) {
  return (
    <div className="search" style={style}>
      <Icon n="ph-magnifying-glass" />
      <input className="input" placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

export interface SegOption<T extends string> { value: T; label?: ReactNode; icon?: string; title?: string }

/** Segmented radio control. */
export function Seg<T extends string>({ name, value, options, onChange, optStyle, style }: {
  name: string; value: T; options: SegOption<T>[]; onChange: (v: T) => void; optStyle?: CSSProperties; style?: CSSProperties;
}) {
  return (
    <div className="seg" role="radiogroup" style={style}>
      {options.map((o) => (
        <label key={o.value} className="seg-opt" title={o.title} style={{ whiteSpace: 'nowrap', ...optStyle }}>
          <input type="radio" name={name} checked={value === o.value} onChange={() => onChange(o.value)} />
          {o.icon && <Icon n={o.icon} style={o.label ? undefined : { fontSize: 16 }} />}
          {o.label !== undefined && <span>{o.label}</span>}
        </label>
      ))}
    </div>
  );
}

export function Select({ value, options, onChange, label, style, className = 'input' }: {
  value: string; options: { v: string; l?: string }[]; onChange: (v: string) => void; label?: string; style?: CSSProperties; className?: string;
}) {
  return (
    <select className={className} value={value} aria-label={label} onChange={(e) => onChange(e.target.value)} style={style}>
      {options.map((o) => <option key={o.v} value={o.v}>{o.l ?? o.v}</option>)}
    </select>
  );
}

export function Dialog({ onClose, width = 440, children, gap }: { onClose: () => void; width?: number; children: ReactNode; gap?: number }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div data-pop="1" className="dialog" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}
        style={{ width: `min(${width}px, 100%)`, maxHeight: '90vh', overflow: 'auto', gap }}>
        {children}
      </div>
    </div>
  );
}

/** Panel heading icon on a tinted tile. */
export function TitleIcon({ n, size = 30 }: { n: string; size?: number }) {
  return (
    <span className="icon-tile" style={{ width: size, height: size, borderRadius: size > 28 ? 9 : 8, background: 'var(--color-accent-2-100)' }}>
      <Icon n={n} style={{ color: 'var(--color-accent-2)', fontSize: size > 28 ? 17 : 16 }} />
    </span>
  );
}

/** Money amount that counts up from zero the first time it renders. */
export function CountUp({ value }: { value: number }) {
  const [shown, setShown] = useState(() => (window.matchMedia('(prefers-reduced-motion: reduce)').matches ? value : 0));
  const target = useRef(value);
  useEffect(() => {
    target.current = value;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setShown(value); return; }
    const t0 = performance.now();
    const D = 950;
    let raf = 0;
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / D);
      setShown(p < 1 ? target.current * (1 - Math.pow(1 - p, 3)) : target.current);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <>{money(shown)}</>;
}

export function Pref({ on, label, desc, onToggle }: { on: boolean; label: string; desc: string; onToggle: () => void }) {
  return (
    <label className="pref">
      <input type="checkbox" className="check" checked={on} onChange={onToggle} />
      <span className="stack" style={{ gap: 2 }}>
        <span style={{ fontSize: 15 }}>{label}</span>
        <span className="muted" style={{ fontSize: 13 }}>{desc}</span>
      </span>
    </label>
  );
}
