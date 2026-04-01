import { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';

// ─── Types ────────────────────────────────────────────────────

export interface ActiveVisit {
  apptId: string | number;
  petName: string;
  petImage?: string;
  ownerName: string;
  service: string;
  durationMinutes?: number;
  startedAt: Date;
  step: 'visit' | 'checkout';
}

interface ActiveVisitContextType {
  activeVisit: ActiveVisit | null;
  startVisit: (visit: Omit<ActiveVisit, 'startedAt' | 'step'>) => void;
  advanceToCheckout: (apptId: string | number) => void;
  clearVisit: () => void;
  elapsedMin: number;
}

// ─── Context ─────────────────────────────────────────────────

const ActiveVisitContext = createContext<ActiveVisitContextType>({
  activeVisit: null,
  startVisit: () => {},
  advanceToCheckout: () => {},
  clearVisit: () => {},
  elapsedMin: 0,
});

// ─── Provider ────────────────────────────────────────────────

export function ActiveVisitProvider({ children }: { children: ReactNode }) {
  const [activeVisit, setActiveVisit] = useState<ActiveVisit | null>(null);
  const [elapsedMin, setElapsedMin] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // tick elapsed time every minute
  useEffect(() => {
    if (activeVisit) {
      timerRef.current = setInterval(() => {
        const diff = Math.floor((Date.now() - activeVisit.startedAt.getTime()) / 60000);
        setElapsedMin(diff);
      }, 30000); // every 30 s is fine for display
      // initial calc
      setElapsedMin(Math.floor((Date.now() - activeVisit.startedAt.getTime()) / 60000));
    } else {
      setElapsedMin(0);
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [activeVisit]);

  const startVisit = (visit: Omit<ActiveVisit, 'startedAt' | 'step'>) => {
    setActiveVisit({ ...visit, startedAt: new Date(), step: 'visit' });
  };

  const advanceToCheckout = (apptId: string | number) => {
    setActiveVisit((prev) =>
      prev && String(prev.apptId) === String(apptId)
        ? { ...prev, step: 'checkout' }
        : prev
    );
  };

  const clearVisit = () => setActiveVisit(null);

  return (
    <ActiveVisitContext.Provider value={{ activeVisit, startVisit, advanceToCheckout, clearVisit, elapsedMin }}>
      {children}
    </ActiveVisitContext.Provider>
  );
}

// ─── Hook ────────────────────────────────────────────────────

export const useActiveVisit = () => useContext(ActiveVisitContext);
