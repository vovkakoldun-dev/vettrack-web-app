import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: {
    value: string;
    isPositive: boolean;
  };
  iconColor: string;
  onClick?: () => void;
}

export function StatCard({ title, value, icon: Icon, trend, iconColor, onClick }: StatCardProps) {
  return (
    <div
      className={`bg-[var(--surface-white)] p-6 border border-[var(--border-color)] transition-all ${
        onClick ? 'cursor-pointer hover:border-[var(--brand-green-text)] hover:shadow-sm' : ''
      }`}
      style={{ borderRadius: '12px' }}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-[var(--text-secondary)]" style={{ fontSize: '14px', fontWeight: 400 }}>
            {title}
          </p>
          <p className="text-[var(--text-primary)] mt-2" style={{ fontSize: '32px', fontWeight: 700, lineHeight: 1.25 }}>
            {value}
          </p>
          {trend && (
            <p className={`mt-2 ${trend.isPositive ? 'text-[var(--brand-green-text)]' : 'text-[#F4A261]'}`} style={{ fontSize: '14px', fontWeight: 400 }}>
              {trend.value}
            </p>
          )}
        </div>
        <div style={{
          width: '42px', height: '42px', borderRadius: '12px', flexShrink: 0,
          position: 'relative',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {/* Tinted background — uses opacity so CSS variables work */}
          <div style={{
            position: 'absolute', inset: 0, borderRadius: '12px',
            backgroundColor: iconColor, opacity: 0.12,
          }} />
          {/* Border ring */}
          <div style={{
            position: 'absolute', inset: 0, borderRadius: '12px',
            border: `1px solid ${iconColor}`, opacity: 0.28,
          }} />
          <Icon style={{ width: '19px', height: '19px', color: iconColor, position: 'relative', zIndex: 1 }} />
        </div>
      </div>
    </div>
  );
}
