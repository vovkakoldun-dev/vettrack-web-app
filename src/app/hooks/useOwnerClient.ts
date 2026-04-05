import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../context/AuthContext'

export interface OwnerClient {
  id: string
  firstName: string
  lastName: string
  fullName: string
  initials: string
  email: string
  phone: string
  address: string
  city: string | null
  state: string | null
  zip: string | null
}

const EMPTY: OwnerClient = {
  id: '',
  firstName: '',
  lastName: '',
  fullName: '',
  initials: '',
  email: '',
  phone: '',
  address: '',
  city: null,
  state: null,
  zip: null,
}

export function useOwnerClient() {
  const { user } = useAuth()
  const [client, setClient] = useState<OwnerClient>(EMPTY)
  const [clientId, setClientId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchClient = useCallback(async () => {
    if (!user) { setLoading(false); return }
    try {
      const { data } = await supabase
        .from('clients')
        .select('id, first_name, last_name, email, phone, address, city, state, zip')
        .eq('profile_id', user.id)
        .limit(1)
        .single()

      if (data) {
        const fn = data.first_name || ''
        const ln = data.last_name || ''
        setClient({
          id: data.id,
          firstName: fn,
          lastName: ln,
          fullName: `${fn} ${ln}`.trim(),
          initials: [fn, ln].filter(Boolean).map(w => w[0]).join('').toUpperCase().slice(0, 2),
          email: data.email || '',
          phone: data.phone || '',
          address: data.address || '',
          city: data.city,
          state: data.state,
          zip: data.zip,
        })
        setClientId(data.id)
      }
    } catch {
      // No linked client
    }
    setLoading(false)
  }, [user])

  useEffect(() => { fetchClient() }, [fetchClient])

  return { client, clientId, loading, refetch: fetchClient }
}
