import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'

export interface PetRow {
  id: string
  name: string
  species: string
  breed: string | null
  date_of_birth: string | null
  sex: string | null
  weight_kg: number | null
  photo_url: string | null
  microchip_id: string | null
  is_active: boolean
  created_at: string
  client_id: string | null
  clients: { id: string; first_name: string; last_name: string; phone: string | null } | null
}

export interface AddPetValues {
  client_id: string
  name: string
  species: string
  breed?: string
  date_of_birth?: string
  sex?: string
  weight_kg?: number
  microchip_id?: string
  photo_url?: string
}

export function usePets() {
  const [pets, setPets] = useState<PetRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchPets = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error: err } = await supabase
      .from('pets')
      .select('id, name, species, breed, date_of_birth, sex, weight_kg, photo_url, microchip_id, is_active, created_at, client_id, clients(id, first_name, last_name, phone)')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
    if (err) {
      setError(err.message)
    } else {
      setPets((data as PetRow[]) ?? [])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchPets()
  }, [fetchPets])

  const addPet = useCallback(async (values: AddPetValues) => {
    const { data, error: err } = await supabase
      .from('pets')
      .insert([{ is_active: true, ...values }])
      .select('id, name, species, breed, date_of_birth, sex, weight_kg, photo_url, microchip_id, is_active, created_at, client_id, clients(id, first_name, last_name, phone)')
      .single()
    if (!err) {
      await fetchPets()
    }
    return { data, error: err }
  }, [fetchPets])

  const updatePet = useCallback(async (id: string, values: Partial<AddPetValues>) => {
    const { error: err } = await supabase.from('pets').update(values).eq('id', id)
    if (!err) await fetchPets()
    return { error: err }
  }, [fetchPets])

  const deactivatePet = useCallback(async (id: string) => {
    const { error: err } = await supabase.from('pets').update({ is_active: false }).eq('id', id)
    if (!err) setPets(prev => prev.filter(p => p.id !== id))
    return { error: err }
  }, [])

  return { pets, loading, error, refetch: fetchPets, addPet, updatePet, deactivatePet }
}
