import { useState, useEffect, useCallback, useRef } from 'react'
import { useTenantDb } from '../context/TenantContext';
import { getOrgContext } from './useOrgContext'

export interface AppointmentRow {
  id: string
  scheduled_at: string
  duration_minutes: number | null
  status: string
  reason: string | null
  notes: string | null
  room: string | null
  room_id: string | null
  created_at: string
  pets: { id: string; name: string; species: string; breed: string | null; photo_url: string | null } | null
  clients: { id: string; first_name: string; last_name: string; phone: string | null } | null
  staff: { id: string; profiles: { first_name: string; last_name: string } | null } | null
  services: { id: string; name: string; price: number | null } | null
  clinic_rooms: { id: string; name: string } | null
}

export interface AddAppointmentValues {
  pet_id: string
  client_id: string
  vet_id?: string
  service_id?: string
  scheduled_at: string
  duration_minutes?: number
  reason?: string
  notes?: string
  status?: string
}

export function useAppointments(dateFilter?: string) {
  const db = useTenantDb();
  const [appointments, setAppointments] = useState<AppointmentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchAppointments = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { organizationId } = await getOrgContext()
      let query = db
        .from('appointments')
        .select('id, scheduled_at, duration_minutes, status, reason, notes, room, room_id, created_at, pets(id, name, species, breed, photo_url), clients(id, first_name, last_name, phone), staff!appointments_vet_id_fkey(id, profiles:profiles!staff_profile_id_fkey(first_name, last_name)), services(id, name, price), clinic_rooms(id, name)')
        .eq('organization_id', organizationId)
        .order('scheduled_at', { ascending: true })

      if (dateFilter) {
        // Convert local date boundaries to UTC so timezone-aware queries work correctly.
        // e.g. "2026-04-11" in UTC-7 → start = 2026-04-11T07:00:00Z, end = 2026-04-12T06:59:59Z
        const startOfDay = new Date(`${dateFilter}T00:00:00`);
        const endOfDay = new Date(`${dateFilter}T23:59:59`);
        query = query
          .gte('scheduled_at', startOfDay.toISOString())
          .lte('scheduled_at', endOfDay.toISOString())
      }

      const { data, error: err } = await query
      if (err) {
        setError(err.message)
      } else {
        setAppointments((data as AppointmentRow[]) ?? [])
      }
    } catch (e: any) {
      setError(e.message)
    }
    setLoading(false)
  }, [dateFilter])

  useEffect(() => {
    fetchAppointments()
  }, [fetchAppointments])

  // Listen for cross-page data changes — debounced to prevent cascade refetch storms
  const refetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const handler = () => {
      if (refetchTimerRef.current) clearTimeout(refetchTimerRef.current);
      refetchTimerRef.current = setTimeout(() => fetchAppointments(), 300);
    }
    window.addEventListener('clientDataChanged', handler)
    window.addEventListener('petDataChanged', handler)
    return () => {
      window.removeEventListener('clientDataChanged', handler)
      window.removeEventListener('petDataChanged', handler)
      if (refetchTimerRef.current) clearTimeout(refetchTimerRef.current);
    }
  }, [fetchAppointments])

  const addAppointment = useCallback(async (values: AddAppointmentValues) => {
    const { organizationId, clinicId } = await getOrgContext();
    const { data, error: err } = await db
      .from('appointments')
      .insert([{
        organization_id: organizationId,
        clinic_id: clinicId,
        status: 'Scheduled',
        ...values,
      }])
      .select('id, scheduled_at, duration_minutes, status, reason, notes, room, room_id, created_at, pets(id, name, species, breed, photo_url), clients(id, first_name, last_name, phone), staff!appointments_vet_id_fkey(id, profiles:profiles!staff_profile_id_fkey(first_name, last_name)), services(id, name, price), clinic_rooms(id, name)')
      .single()
    if (!err) {
      await fetchAppointments()
      window.dispatchEvent(new CustomEvent('appointmentDataChanged'))
    }
    return { data, error: err }
  }, [fetchAppointments])

  const updateStatus = useCallback(async (id: string, status: string) => {
    // Free the room when appointment ends
    const freeRoom = ['Completed', 'Cancelled', 'No Show'].includes(status);
    // Optimistic update — instant UI feedback
    setAppointments(prev => prev.map(a => a.id === id ? { ...a, status, ...(freeRoom ? { room: null, room_id: null } : {}) } : a));
    const { organizationId } = await getOrgContext()
    const updatePayload: Record<string, unknown> = { status };
    if (freeRoom) { updatePayload.room = null; updatePayload.room_id = null; }
    const { error: err } = await db
      .from('appointments')
      .update(updatePayload)
      .eq('id', id)
      .eq('organization_id', organizationId)
    if (err) {
      await fetchAppointments() // Revert on error
    } else {
      window.dispatchEvent(new CustomEvent('appointmentDataChanged'))
    }
    return { error: err }
  }, [fetchAppointments])

  const updateStatusWithRoom = useCallback(
    async (id: string, status: string, room: string, scheduledAt?: string, roomId?: string) => {
      const { organizationId } = await getOrgContext()
      const updatePayload: Record<string, unknown> = { status, room }
      if (roomId !== undefined) updatePayload.room_id = roomId || null
      if (scheduledAt) updatePayload.scheduled_at = scheduledAt
      const { error: err } = await db
        .from('appointments')
        .update(updatePayload)
        .eq('id', id)
        .eq('organization_id', organizationId)
      if (!err) {
        await fetchAppointments()
        window.dispatchEvent(new CustomEvent('appointmentDataChanged'))
      }
      return { error: err }
    },
    [fetchAppointments],
  )

  const deleteAppointment = useCallback(async (id: string) => {
    // Optimistic delete — remove from UI immediately
    const prev = appointments;
    setAppointments(p => p.filter(a => a.id !== id));
    const { organizationId } = await getOrgContext()
    const { error: err } = await db.from('appointments').delete().eq('id', id).eq('organization_id', organizationId)
    if (err) {
      setAppointments(prev); // Revert on error
    } else {
      window.dispatchEvent(new CustomEvent('appointmentDataChanged'))
    }
    return { error: err }
  }, [appointments])

  return { appointments, loading, error, refetch: fetchAppointments, addAppointment, updateStatus, updateStatusWithRoom, deleteAppointment }
}
