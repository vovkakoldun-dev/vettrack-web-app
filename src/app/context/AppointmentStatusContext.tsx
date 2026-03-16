import { createContext, useContext, useState, ReactNode } from 'react';

export type SharedApptStatus = 'Waiting for Doctor' | 'In Progress' | 'Ready for Billing';

interface AppointmentStatusCtx {
  overrides: Record<number, SharedApptStatus>;
  setApptStatus: (id: number, status: SharedApptStatus) => void;
}

const AppointmentStatusContext = createContext<AppointmentStatusCtx>({
  overrides: {},
  setApptStatus: () => {},
});

export function AppointmentStatusProvider({ children }: { children: ReactNode }) {
  // Pre-seeded demo states to show the full workflow
  const [overrides, setOverrides] = useState<Record<number, SharedApptStatus>>({
    1: 'Ready for Billing', // Max (8:00 AM) — visit complete, awaiting payment
    4: 'In Progress',       // Bella (9:30 AM) — doctor is with the patient
  });

  function setApptStatus(id: number, status: SharedApptStatus) {
    setOverrides(prev => ({ ...prev, [id]: status }));
  }

  return (
    <AppointmentStatusContext.Provider value={{ overrides, setApptStatus }}>
      {children}
    </AppointmentStatusContext.Provider>
  );
}

export const useAppointmentStatus = () => useContext(AppointmentStatusContext);
