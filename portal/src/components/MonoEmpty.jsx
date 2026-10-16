/**
 * Monochrome line illustrations for empty / error states. All strokes use
 * `currentColor`, so they follow the surrounding text colour in both themes.
 */

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'square', strokeLinejoin: 'miter' };

function TrayArt({ size = 72 }) {
  return (
    <svg width={size} height={size * 0.72} viewBox="0 0 100 72" aria-hidden="true">
      {/* Stacked sheets */}
      <rect x="30" y="6" width="40" height="30" {...stroke} strokeDasharray="3 3" opacity="0.45" />
      <rect x="24" y="14" width="52" height="30" {...stroke} opacity="0.7" />
      <path d="M32 24h26M32 31h18" {...stroke} opacity="0.7" />
      {/* Tray */}
      <path d="M10 42h22l4 9h28l4-9h22v24H10z" {...stroke} />
      <path d="M10 42l10-14M90 42L80 28" {...stroke} opacity="0.55" />
    </svg>
  );
}

function CompassArt({ size = 132 }) {
  return (
    <svg width={size} height={size * 0.8} viewBox="0 0 160 128" aria-hidden="true">
      <rect x="1" y="1" width="158" height="126" {...stroke} strokeDasharray="2 5" opacity="0.4" />
      <circle cx="80" cy="64" r="40" {...stroke} />
      <circle cx="80" cy="64" r="30" {...stroke} opacity="0.35" />
      <path d="M80 18v8M80 102v8M34 64h8M118 64h8" {...stroke} />
      <path d="M80 64l16-26-6 32z" fill="currentColor" />
      <path d="M80 64l-16 26 6-32z" {...stroke} />
      <circle cx="80" cy="64" r="3" fill="currentColor" />
    </svg>
  );
}

function LockArt({ size = 132 }) {
  return (
    <svg width={size} height={size * 0.8} viewBox="0 0 160 128" aria-hidden="true">
      <rect x="1" y="1" width="158" height="126" {...stroke} strokeDasharray="2 5" opacity="0.4" />
      <path d="M62 56V44a18 18 0 0136 0v12" {...stroke} />
      <rect x="52" y="56" width="56" height="44" {...stroke} />
      <rect x="52" y="56" width="56" height="44" fill="currentColor" opacity="0.08" />
      <path d="M80 72v12" {...stroke} strokeWidth="3" />
    </svg>
  );
}

function BrokenArt({ size = 132 }) {
  return (
    <svg width={size} height={size * 0.8} viewBox="0 0 160 128" aria-hidden="true">
      <rect x="1" y="1" width="158" height="126" {...stroke} strokeDasharray="2 5" opacity="0.4" />
      <path d="M40 34h80v60H40z" {...stroke} />
      <path d="M40 46h80" {...stroke} />
      <path d="M46 40h4M54 40h4M62 40h4" {...stroke} />
      <path d="M70 60l20 20M90 60L70 80" {...stroke} strokeWidth="3" />
    </svg>
  );
}

const ART = { empty: TrayArt, '404': CompassArt, '403': LockArt, error: BrokenArt };

export function MonoArt({ kind = 'empty', size }) {
  const Art = ART[kind] || TrayArt;
  return <Art size={size} />;
}

/** Drop-in for antd <Empty>; also used as the global ConfigProvider renderEmpty. */
export default function MonoEmpty({ description = 'Nothing here yet', compact = false, children }) {
  return (
    <div className={`mono-empty ${compact ? 'mono-empty--compact' : ''}`}>
      <span className="mono-empty__art"><TrayArt size={compact ? 44 : 72} /></span>
      <div className="mono-empty__text">{description}</div>
      {children && <div className="mono-empty__actions">{children}</div>}
    </div>
  );
}
