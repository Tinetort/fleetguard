'use client'

import { useState } from 'react'
import { resetPasswordWithToken } from '../actions'
import Link from 'next/link'

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    setLoading(true)
    setError(null)
    
    // resetPasswordWithToken now uses the active Supabase session (created via /auth/callback)
    const result = await resetPasswordWithToken(password)
    
    if (result?.error) {
      setError(result.error)
      setLoading(false)
    }
    // On success, action redirects to /login
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f172a] p-4">
      <div className="w-full max-w-md">
        <div className="bg-[#1e293b] rounded-2xl overflow-hidden shadow-2xl border border-white/5">
          <div className="h-1 w-full bg-gradient-to-r from-blue-500 to-indigo-500" />
          <div className="px-8 py-10">
            <div className="text-center mb-8">
              <div className="flex justify-center mb-4">
                <div className="w-14 h-14 rounded-2xl bg-slate-700 flex items-center justify-center">
                  <span className="text-2xl">🔓</span>
                </div>
              </div>
              <h1 className="text-2xl font-extrabold text-white">Set New Password</h1>
              <p className="text-slate-400 text-sm mt-2">Choose a strong new password for your account.</p>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-sm font-medium">
                ⚠️ {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">New Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Min. 6 characters"
                  required
                  autoFocus
                  className="w-full bg-[#0f172a] border border-slate-700 rounded-xl px-4 py-3.5 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Confirm Password</label>
                <input
                  type="password"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  placeholder="Repeat password"
                  required
                  className="w-full bg-[#0f172a] border border-slate-700 rounded-xl px-4 py-3.5 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold rounded-xl transition-all shadow-lg hover:shadow-blue-500/25"
              >
                {loading ? 'Saving...' : 'Save New Password'}
              </button>
            </form>

            <div className="mt-6 text-center">
              <Link href="/login" className="text-sm font-semibold text-slate-500 hover:text-slate-300 transition-colors">
                ← Back to Sign In
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
