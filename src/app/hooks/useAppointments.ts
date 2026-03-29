import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { getOrgContext } from './useOrgContext'

export interface AppointmentRow {
  id: string
  scheduled_at: string
  duration_minutes: number | null
  status: string
  reason: string | null
  notes: string | null
  created_at: string
  pets: { id: string; name: string; species: string; breed: string | null; photo_url: string | null } | null
  clients: { id: string; first_name: string; last_name: string; phone: string | null } | null
  staff: { id: string; profiles: { first_name: string; last_name: string } | null } | null
  services: { id: string; name: string; price: number | null } | null
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
  const [appointments, setAppointments] = useState<AppointmentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchAppointments = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { organizationId } = await getOrgContext()
      let query = supabase
        .from('appointments')
        .select('id, scheduled_at, duration_minutes, status, reason, notes, created_at, pets(id, name, species, breed, photo_url), clients(id, first_name, last_name, phone), staff!appointments_vet_id_fkey(id, profiles:profiles!staff_profile_id_fkey(first_name, last_name)), services(id, name, price)')
        .eq('organization_id', organizationId)
        .order('scheduled_at', { ascending: true })

      if (dateFilter) {
        query = query
          .gte('scheduled_at', `${dateFilter}T00:00:00`)
          .lte('scheduled_at', `${dateFilter}T23:59:59`)
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

  // Listen for cross-page data changes (client/pet edits may affect joined data)
  useEffect(() => {
    const handler = () => { fetchAppointments() }
    window.addEventListener('clientDataChanged', handler)
    window.addEventListener('petDataChanged', handler)
    return () => {
      window.removeEventListener('clientDataChanged', handler)
      window.removeEventListener('petDataChanged', handler)
    }
  }, [fetchAppointments])

  const addAppointment = useCallback(async (values: AddAppointmentValues) => {
    const { organizationId, clinicId } = await getOrgContext();
    const { data, error: err } = await supabase
      .from('appointments')
      .insert([{
        organization_id: organizationId,
        clinic_id: clinicId,
        status: 'Scheduled',
        ...values,
      }])
      .select('id, scheduled_at, duration_minutes, status, reason, notes, created_at, pets(id, name, species, breed, photo_url), clients(id, first_name, last_name, phone), staff!appointments_vet_id_fkey(id, profiles:profiles!staff_profile_id_fkey(first_name, last_name)), services(id, name, price)')
      .single()
    if (!err) {
      await fetchAppointments()
      window.dispatchEvent(new CustomEvent('appointmentDataChanged'))
    }
    return { data, error: err }
  }, [fetchAppointments])

  const updateStatus = useCallback(async (id: string, status: string) => {
    const { organizationId } = await getOrgContext()
    const { error: err } = await supabase
      .from('appointments')
      .update({ status })
      .eq('id', id)
      .eq('organization_id', organizationId)
    if (!err) {
      await fetchAppointments()
      window.dispatchEvent(new CustomEvent('appointmentDataChanged'))
    }
    return { error: err }
  }, [fetchAppointments])

  const deleteAppointment = useCallback(async (id: string) => {
    const { organizationId } = await getOrgContext()
    const { error: err } = await supabase.from('appointments').delete().eq('id', id).eq('organization_id', organizationId)
    if (!err) {
      await fetchAppointments()
      window.dispatchEvent(new CustomEvent('appointmentDataChanged'))
    }
    return { error: err }
  }, [fetchAppointments])

  return { appointments, loading, error, refetch: fetchAppointments, addAppointment, updateStatus, deleteAppointment }
}
