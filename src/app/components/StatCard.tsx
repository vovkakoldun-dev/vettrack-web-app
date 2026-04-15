import { LucideIcon } from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────
interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: { value: string; isPositive: boolean };
  subtitle?: string;
  iconColor: string;
  onClick?: () => void;
}

// ── Component ───────────────────────────────────────────────────
export function StatCard({ title, value, icon: Icon, trend, subtitle, iconColor, onClick }: StatCardProps) {
  // Helper: transparent mix that works with hex AND css-variable colors
  const mix = (pct: number) => `color-mix(in srgb, ${iconColor} ${pct}%, transparent)`;

  return (
    <div
      className={`relative overflow-hidden transition-all duration-300 ${onClick ? 'cursor-pointer' : ''}`}
      style={{
        borderRadius: '20px',
        padding: '26px 28px',
        background: 'var(--surface-white)',
        border: '1px solid var(--border-color)',
      }}
      onClick={onClick}
      onMouseEnter={e => {
        const el = e.currentTarget;
        if (onClick) el.style.transform = 'translateY(-3px)';
        el.style.borderColor = mix(35);
        el.style.boxShadow = `0 8px 40px -12px ${mix(22)}, 0 0 0 1px ${mix(10)}`;
      }}
      onMouseLeave={e => {
        const el = e.currentTarget;
        el.style.transform = '';
        el.style.borderColor = '';
        el.style.boxShadow = '';
      }}
    >
      {/* ── Top accent gradient bar ── */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: '3px',
        background: `linear-gradient(90deg, transparent 0%, ${iconColor} 40%, ${iconColor} 60%, transparent 100%)`,
        opacity: 0.5,
      }} />

      {/* ── Ambient gradient mesh (asymmetric) ── */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0.045,
        background: `
          radial-gradient(ellipse 70% 50% at 0% 100%, ${iconColor} 0%, transparent 70%),
          radial-gradient(ellipse 50% 70% at 100% 0%, ${iconColor} 0%, transparent 60%)
        `,
      }} />

      {/* ── Content ── */}
      <div className="flex items-start justify-between" style={{ position: 'relative', zIndex: 1 }}>
        <div className="flex-1" style={{ minWidth: 0 }}>
          {/* Label */}
          <p className="text-[var(--text-secondary)]" style={{
            fontSize: '12px', fontWeight: 600,
            letterSpacing: '0.08em', textTransform: 'uppercase',
          }}>
            {title}
          </p>

          {/* Value */}
          <p className="text-[var(--text-primary)]" style={{
            fontSize: '36px', fontWeight: 800, lineHeight: 1,
            letterSpacing: '-0.03em', marginTop: '14px',
          }}>
            {value}
          </p>

          {/* Trend pill */}
          {trend && (
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: '4px',
              marginTop: '14px', padding: '3px 10px', borderRadius: '100px',
              background: trend.isPositive ? 'rgba(34,197,94,0.10)' : 'rgba(244,162,97,0.10)',
              fontSize: '12px', fontWeight: 600, lineHeight: '18px',
              color: trend.isPositive ? 'var(--brand-green-text)' : '#F4A261',
            }}>
              <span style={{ fontSize: '10px' }}>{trend.isPositive ? '▲' : '▼'}</span>
              {trend.value}
            </div>
          )}

          {/* Subtitle (simple text, alternative to trend) */}
          {subtitle && !trend && (
            <p className="text-[var(--text-secondary)]" style={{
              fontSize: '12px', fontWeight: 500, marginTop: '12px',
            }}>
              {subtitle}
            </p>
          )}
        </div>

        {/* ── Icon with glow ── */}
        <div style={{
          width: '52px', height: '52px', borderRadius: '16px', flexShrink: 0,
          position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {/* Static glow */}
          <div style={{
            position: 'absolute', inset: '-10px',
            background: `radial-gradient(circle, ${iconColor} 0%, transparent 70%)`,
            opacity: 0.14,
            borderRadius: '50%', filter: 'blur(8px)',
          }} />
          {/* Glass container */}
          <div style={{
            position: 'absolute', inset: 0, borderRadius: '16px',
            background: mix(10),
            border: `1px solid ${mix(12)}`,
            backdropFilter: 'blur(8px)',
          }} />
          <Icon style={{
            width: '24px', height: '24px', color: iconColor,
            position: 'relative', zIndex: 1,
          }} />
        </div>
      </div>

      {/* ── Bottom accent whisper ── */}
      <div style={{
        position: 'absolute', bottom: 0, left: '28px', right: '28px', height: '1px',
        background: `linear-gradient(90deg, transparent, ${mix(15)}, transparent)`,
      }} />
    </div>
  );
}
