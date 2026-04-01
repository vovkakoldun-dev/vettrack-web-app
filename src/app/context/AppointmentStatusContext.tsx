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
  const [overrides, setOverrides] = useState<Record<number, SharedApptStatus>>({});

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
