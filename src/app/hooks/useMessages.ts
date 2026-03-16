import { useState, useCallback } from 'react'
import { supabase } from '../../lib/supabase'

export interface ChatMessage {
  id: string
  conversation: string
  sender_name: string
  content: string
  created_at: string
}

const DEFAULT_SENDER = 'Sarah Chen'

export function useMessages(conversation: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(false)

  const fetchMessages = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('chat_messages')
      .select('id, conversation, sender_name, content, created_at')
      .eq('conversation', conversation)
      .order('created_at', { ascending: true })
      .limit(200)
    if (data) setMessages(data as ChatMessage[])
    setLoading(false)
  }, [conversation])

  const sendMessage = useCallback(async (content: string, senderName = DEFAULT_SENDER) => {
    const optimistic: ChatMessage = {
      id: crypto.randomUUID(),
      conversation,
      sender_name: senderName,
      content,
      created_at: new Date().toISOString(),
    }
    setMessages(prev => [...prev, optimistic])
    const { error } = await supabase
      .from('chat_messages')
      .insert([{ conversation, sender_name: senderName, content }])
    if (error) {
      // Roll back optimistic update on failure
      setMessages(prev => prev.filter(m => m.id !== optimistic.id))
      console.warn('Message send error:', error.message)
    }
  }, [conversation])

  return { messages, loading, fetchMessages, sendMessage }
}
