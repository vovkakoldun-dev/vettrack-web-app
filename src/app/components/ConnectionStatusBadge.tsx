import { RefreshCw, WifiOff, Wifi } from 'lucide-react';
import { useConnectionStatus, ConnectionState } from '../hooks/useConnectionStatus';

const STATE_CONFIG: Record<ConnectionState, {
  icon: React.ElementType;
  color: string;
  bg: string;
  border: string;
  spin?: boolean;
}> = {
  connected: {
    icon: Wifi,
    color: 'var(--text-secondary)',
    bg: 'var(--surface-elevated)',
    border: 'var(--border-color)',
  },
  disconnected: {
    icon: WifiOff,
    color: '#EF4444',
    bg: '#EF444412',
    border: '#EF444440',
  },
  reconnecting: {
    icon: RefreshCw,
    color: '#F4A261',
    bg: '#F4A26112',
    border: '#F4A26140',
    spin: true,
  },
};

export function ConnectionStatusBadge() {
  const { state, label, refresh } = useConnectionStatus();
  const cfg = STATE_CONFIG[state];
  const Icon = cfg.icon;

  return (
    <button
      onClick={refresh}
      title={state === 'connected' ? `Last sync: ${label}` : label}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '6px 12px',
        borderRadius: '8px',
        backgroundColor: cfg.bg,
        border: `1px solid ${cfg.border}`,
        fontSize: '13px',
        color: cfg.color,
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        outline: 'none',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.opacity = '0.8';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.opacity = '1';
      }}
    >
      <Icon
        style={{
          width: '12px',
          height: '12px',
          flexShrink: 0,
          animation: cfg.spin ? 'spin 1s linear infinite' : undefined,
        }}
      />
      {state === 'connected' && <>Last sync: {label}</>}
      {state === 'disconnected' && <>Offline — tap to retry</>}
      {state === 'reconnecting' && <>Reconnecting…</>}

      {/* Inline keyframes for the spin animation */}
      {cfg.spin && (
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      )}
    </button>
  );
}
