import { useState, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { getOrgContext } from './useOrgContext'

export interface ChatMessage {
  id: string
  conversation_id: string
  sender_id: string
  content: string
  image_url: string | null
  created_at: string
}

export function useMessages(conversationId: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(false)

  const fetchMessages = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('messages')
      .select('id, conversation_id, sender_id, content, image_url, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(200)
    if (data) setMessages(data as ChatMessage[])
    setLoading(false)
  }, [conversationId])

  const sendMessage = useCallback(async (content: string, senderId: string, imageUrl?: string) => {
    const optimistic: ChatMessage = {
      id: crypto.randomUUID(),
      conversation_id: conversationId,
      sender_id: senderId,
      content,
      image_url: imageUrl || null,
      created_at: new Date().toISOString(),
    }
    setMessages(prev => [...prev, optimistic])
    const { organizationId } = await getOrgContext()
    const { error } = await supabase
      .from('messages')
      .insert([{
        organization_id: organizationId,
        conversation_id: conversationId,
        sender_id: senderId,
        content,
        image_url: imageUrl || null,
      }])
    if (error) {
      setMessages(prev => prev.filter(m => m.id !== optimistic.id))
      console.warn('Message send error:', error.message)
    }
  }, [conversationId])

  return { messages, loading, fetchMessages, sendMessage }
}
