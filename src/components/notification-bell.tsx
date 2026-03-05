'use client'

import { useState, useEffect, useRef } from 'react'
import { Bell, Check, CheckCheck, Circle } from 'lucide-react'
import { getUnreadNotifications, markAllNotificationsRead } from '@/app/actions'
import { createClient } from '@/../utils/supabase/client'
import { toast } from 'sonner'

interface Notification {
  id: string
  type: 'green' | 'yellow' | 'red'
  title: string
  body: string
  url: string
  is_read: boolean
  created_at: string
  vehicle_id?: string
}

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const unreadCount = notifications.filter(n => !n.is_read).length

  // Load initial notifications and set up realtime listener
  useEffect(() => {
    loadNotifications()
    
    const supabase = createClient()
    const channel = supabase
      .channel('realtime-notifications')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications' },
        (payload) => {
          const newNotif = payload.new as Notification
          setNotifications((prev) => [newNotif, ...prev])
          
          // Show toast popup
          if (newNotif.type === 'red') {
            toast.error(newNotif.title, { description: newNotif.body, duration: 8000 })
          } else if (newNotif.type === 'yellow') {
            toast.warning(newNotif.title, { description: newNotif.body, duration: 8000 })
          } else {
            toast.success(newNotif.title, { description: newNotif.body, duration: 5000 })
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function loadNotifications() {
    try {
      const data = await getUnreadNotifications()
      setNotifications(data)
    } catch (e) {
      console.error('Failed to load notifications', e)
    }
  }

  async function handleMarkAllRead() {
    setLoading(true)
    await markAllNotificationsRead()
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
    setLoading(false)
  }

  function timeAgo(dateStr: string) {
    const now = Date.now()
    const then = new Date(dateStr).getTime()
    const diff = Math.floor((now - then) / 1000)
    if (diff < 60) return 'just now'
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
    return `${Math.floor(diff / 86400)}d ago`
  }

  const typeConfig = {
    red:    { dot: 'bg-rose-500',    bg: 'bg-rose-50',    border: 'border-rose-200',   text: 'text-rose-700' },
    yellow: { dot: 'bg-amber-400',   bg: 'bg-amber-50',   border: 'border-amber-200',  text: 'text-amber-700' },
    green:  { dot: 'bg-emerald-500', bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700' },
  }

  return (
    <div className="relative" ref={ref}>
      {/* Bell Button */}
      <button
        onClick={() => { setOpen(!open); if (!open) loadNotifications() }}
        className={`relative p-2.5 rounded-xl border flex items-center justify-center transition-all ${
          unreadCount > 0
            ? 'bg-blue-50 border-blue-200 text-blue-600 hover:bg-blue-100'
            : 'bg-white border-slate-200 text-slate-400 hover:text-slate-600 hover:shadow'
        }`}
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-rose-500 text-white text-[10px] font-black rounded-full flex items-center justify-center animate-pulse shadow-sm">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 bg-slate-50/50">
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                disabled={loading}
                className="text-xs font-semibold text-blue-600 hover:text-blue-500 flex items-center gap-1 transition-colors"
              >
                <CheckCheck className="w-3.5 h-3.5" /> Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-[420px] overflow-y-auto divide-y divide-slate-100">
            {notifications.length === 0 ? (
              <div className="py-12 text-center">
                <Bell className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-slate-400 font-medium">No notifications yet</p>
                <p className="text-xs text-slate-300 mt-0.5">They'll appear here after crew inspections</p>
              </div>
            ) : (
              notifications.map(n => {
                const cfg = typeConfig[n.type] || typeConfig.green
                return (
                  <div
                    key={n.id}
                    className={`px-5 py-3.5 flex gap-3 items-start transition-colors ${
                      n.is_read ? 'opacity-60' : 'bg-white'
                    } hover:bg-slate-50`}
                  >
                    {/* Status dot */}
                    <div className="pt-1 shrink-0">
                      <span className={`block w-2.5 h-2.5 rounded-full ${cfg.dot} ${!n.is_read ? 'ring-4 ring-opacity-20' : ''} ${!n.is_read && n.type === 'red' ? 'ring-rose-200' : !n.is_read && n.type === 'yellow' ? 'ring-amber-200' : !n.is_read ? 'ring-emerald-200' : ''}`} />
                    </div>
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <span className={`text-xs font-black uppercase tracking-wider ${cfg.text}`}>{n.title}</span>
                        <span className="text-[10px] text-slate-400 font-medium shrink-0">{timeAgo(n.created_at)}</span>
                      </div>
                      <p className="text-sm text-slate-600 leading-snug line-clamp-2">{n.body}</p>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
