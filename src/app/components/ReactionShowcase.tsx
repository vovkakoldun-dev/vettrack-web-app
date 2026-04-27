/**
 * Inline animated demo for the HugoChat tour: a fake message bubble with a
 * row of emoji reactions that pop in on a stagger and then keep gently
 * floating. Loops every few seconds so users always see the animation.
 */
const REACTIONS = ['👍', '❤️', '😂', '🎉', '🔥'] as const;

export function ReactionShowcase() {
  return (
    <div
      style={{
        position: 'relative',
        backgroundColor: 'color-mix(in srgb, var(--text-primary) 4%, transparent)',
        border: '1px solid var(--border-color)',
        borderRadius: 10,
        padding: '12px 12px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        overflow: 'hidden',
      }}
    >
      {/* Faux message bubble */}
      <div
        style={{
          alignSelf: 'flex-start',
          maxWidth: '88%',
          padding: '8px 12px',
          borderRadius: 14,
          borderTopLeftRadius: 4,
          backgroundColor: 'var(--surface-elevated)',
          color: 'var(--text-primary)',
          fontSize: 12,
          lineHeight: 1.4,
        }}
      >
        Hugo just got vaccinated! 🐶
      </div>

      {/* Reaction row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          paddingLeft: 4,
          fontSize: 18,
          minHeight: 28,
        }}
      >
        {REACTIONS.map((e, i) => (
          <span
            key={e}
            className="vt-reaction"
            style={{
              ['--d' as any]: `${i * 0.55}s`,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 28,
              height: 28,
              borderRadius: 9999,
              backgroundColor: 'var(--surface-white)',
              border: '1px solid var(--border-color)',
              boxShadow: '0 2px 4px rgba(0,0,0,0.06)',
            }}
            aria-hidden
          >
            {e}
          </span>
        ))}
      </div>

      <style>{`
        @keyframes vtReactionPop {
          0%, 5%   { transform: scale(0.4) translateY(8px); opacity: 0; }
          12%      { transform: scale(1.18) translateY(-3px); opacity: 1; }
          18%      { transform: scale(1) translateY(0); opacity: 1; }
          70%      { transform: scale(1) translateY(0); opacity: 1; }
          80%      { transform: scale(1.06) translateY(-2px); opacity: 1; }
          100%     { transform: scale(0.4) translateY(8px); opacity: 0; }
        }
        .vt-reaction {
          /* Total cycle ≈ 3.5s; staggered via --d (~0.55s per item),
             so the chain reads naturally and loops forever. */
          animation: vtReactionPop 3.5s cubic-bezier(0.34, 1.56, 0.64, 1) infinite;
          animation-delay: var(--d, 0s);
          will-change: transform, opacity;
        }
        @media (prefers-reduced-motion: reduce) {
          .vt-reaction { animation: none !important; opacity: 1 !important; transform: none !important; }
        }
      `}</style>
    </div>
  );
}

export default ReactionShowcase;
