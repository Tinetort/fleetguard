'use client'

import { useState } from 'react'
import { requestPasswordReset } from '../actions'
import Link from 'next/link'

export default function ForgotPasswordPage() {
  const [username, setUsername] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username.trim()) return
    setLoading(true)
    await requestPasswordReset(username)
    setLoading(false)
    setSubmitted(true)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f172a] p-4">
      <div className="w-full max-w-md">
        <div className="bg-[#1e293b] rounded-2xl overflow-hidden shadow-2xl border border-white/5">
          <div className="h-1 w-full bg-gradient-to-r from-blue-500 to-indigo-500" />
          <div className="px-8 py-10">
            {submitted ? (
              <div className="text-center space-y-4">
                <div className="flex justify-center mb-2">
                  <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center">
                    <span className="text-3xl">📬</span>
                  </div>
                </div>
                <h1 className="text-2xl font-extrabold text-white">Check your email</h1>
                <p className="text-slate-400 text-sm leading-relaxed">
                  If an account with that username has a recovery email on file, a password reset link has been sent. Check your inbox — the link expires in <strong className="text-white">1 hour</strong>.
                </p>
                <Link href="/login" className="block mt-6 text-sm font-semibold text-blue-400 hover:text-blue-300 transition-colors">
                  ← Back to Sign In
                </Link>
              </div>
            ) : (
              <>
                <div className="text-center mb-8">
                  <div className="flex justify-center mb-4">
                    <div className="w-14 h-14 rounded-2xl bg-slate-700 flex items-center justify-center">
                      <span className="text-2xl">🔑</span>
                    </div>
                  </div>
                  <h1 className="text-2xl font-extrabold text-white">Forgot Password?</h1>
                  <p className="text-slate-400 text-sm mt-2">Enter your username and we'll send a reset link to your recovery email.</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                  <div>
                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Username</label>
                    <input
                      type="text"
                      value={username}
                      onChange={e => setUsername(e.target.value)}
                      placeholder="e.g. ivan.emt"
                      autoFocus
                      required
                      className="w-full bg-[#0f172a] border border-slate-700 rounded-xl px-4 py-3.5 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold rounded-xl transition-all shadow-lg hover:shadow-blue-500/25"
                  >
                    {loading ? 'Sending...' : 'Send Reset Link'}
                  </button>
                </form>

                <div className="mt-6 text-center">
                  <Link href="/login" className="text-sm font-semibold text-slate-500 hover:text-slate-300 transition-colors">
                    ← Back to Sign In
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
