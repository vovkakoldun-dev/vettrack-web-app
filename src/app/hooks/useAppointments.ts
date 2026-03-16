import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'

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
  staff: { id: string; first_name: string; last_name: string } | null
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
    let query = supabase
      .from('appointments')
      .select('id, scheduled_at, duration_minutes, status, reason, notes, created_at, pets(id, name, species, breed, photo_url), clients(id, first_name, last_name, phone), staff(id, first_name, last_name), services(id, name, price)')
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
    setLoading(false)
  }, [dateFilter])

  useEffect(() => {
    fetchAppointments()
  }, [fetchAppointments])

  const addAppointment = useCallback(async (values: AddAppointmentValues) => {
    const { data, error: err } = await supabase
      .from('appointments')
      .insert([{
        organization_id: '00000000-0000-0000-0000-000000000001',
        clinic_id: '00000000-0000-0000-0000-000000000002',
        status: 'Pending',
        ...values,
      }])
      .select('id, scheduled_at, duration_minutes, status, reason, notes, created_at, pets(id, name, species, breed, photo_url), clients(id, first_name, last_name, phone), staff(id, first_name, last_name), services(id, name, price)')
      .single()
    if (!err) {
      await fetchAppointments()
    }
    return { data, error: err }
  }, [fetchAppointments])

  const updateStatus = useCallback(async (id: string, status: string) => {
    const { error: err } = await supabase
      .from('appointments')
      .update({ status })
      .eq('id', id)
    if (!err) {
      setAppointments(prev => prev.map(a => a.id === id ? { ...a, status } : a))
    }
    return { error: err }
  }, [])

  const deleteAppointment = useCallback(async (id: string) => {
    const { error: err } = await supabase.from('appointments').delete().eq('id', id)
    if (!err) {
      setAppointments(prev => prev.filter(a => a.id !== id))
    }
    return { error: err }
  }, [])

  return { appointments, loading, error, refetch: fetchAppointments, addAppointment, updateStatus, deleteAppointment }
}
