'use client'

import { useEffect, useState } from 'react'
import { Shield } from 'lucide-react'

interface ShiftGreetingModalProps {
  greeting: string
  onClose: () => void
}

export default function ShiftGreetingModal({ greeting, onClose }: ShiftGreetingModalProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Trigger entrance animation
    const t = setTimeout(() => setVisible(true), 30)
    // Auto-dismiss after 7 seconds
    const auto = setTimeout(() => handleClose(), 7000)
    return () => { clearTimeout(t); clearTimeout(auto) }
  }, [])

  function handleClose() {
    setVisible(false)
    setTimeout(onClose, 400)
  }

  return (
    <div
      onClick={handleClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-6 cursor-pointer"
      style={{
        background: 'rgba(0,0,0,0.82)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        transition: 'opacity 0.4s ease',
        opacity: visible ? 1 : 0,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          transition: 'all 0.45s cubic-bezier(0.34, 1.56, 0.64, 1)',
          transform: visible ? 'scale(1) translateY(0)' : 'scale(0.88) translateY(32px)',
          opacity: visible ? 1 : 0,
        }}
        className="w-full max-w-sm"
      >
        {/* Card */}
        <div className="relative overflow-hidden rounded-3xl shadow-2xl"
          style={{
            background: 'linear-gradient(145deg, #0f172a 0%, #1e293b 60%, #0f172a 100%)',
            border: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          {/* Top accent bar */}
          <div style={{ height: 4, background: 'linear-gradient(90deg, #3b82f6, #6366f1, #8b5cf6)' }} />

          {/* Subtle corner glow */}
          <div style={{
            position: 'absolute', top: '-80px', right: '-80px',
            width: 200, height: 200, borderRadius: '50%',
            background: 'rgba(99,102,241,0.15)',
            filter: 'blur(40px)',
            pointerEvents: 'none',
          }} />

          <div className="px-8 pt-10 pb-8 text-center space-y-6">
            {/* Icon */}
            <div className="flex justify-center">
              <div style={{
                background: 'linear-gradient(135deg, #1d4ed8, #4f46e5)',
                borderRadius: 20,
                padding: 16,
                boxShadow: '0 0 30px rgba(99,102,241,0.5)',
              }}>
                <Shield size={32} color="white" />
              </div>
            </div>

            {/* Label */}
            <p style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              color: 'rgba(148,163,184,0.7)',
            }}>
              FleetGuard · Daily Brief
            </p>

            {/* Main greeting */}
            <p style={{
              fontSize: 22,
              fontWeight: 800,
              color: '#f1f5f9',
              lineHeight: 1.35,
              letterSpacing: '-0.01em',
            }}>
              {greeting}
            </p>

            {/* Divider */}
            <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '0 -8px' }} />

            {/* Dismiss button */}
            <button
              onClick={handleClose}
              style={{
                width: '100%',
                padding: '14px 0',
                borderRadius: 14,
                background: 'linear-gradient(135deg, #2563eb, #4f46e5)',
                color: 'white',
                fontWeight: 700,
                fontSize: 15,
                letterSpacing: '0.02em',
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 4px 20px rgba(79,70,229,0.4)',
                transition: 'opacity 0.2s ease, transform 0.2s ease',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLButtonElement).style.opacity = '0.9'
                ;(e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.02)'
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLButtonElement).style.opacity = '1'
                ;(e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'
              }}
            >
              Let's Go 🚑
            </button>

            <p style={{ fontSize: 11, color: 'rgba(148,163,184,0.5)', marginTop: 4 }}>
              Tap anywhere to dismiss
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
