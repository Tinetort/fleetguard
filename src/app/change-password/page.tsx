'use client'

import { useState } from 'react'
import { updatePassword } from '@/app/actions'
import { ShieldAlert, ArrowRight, AlertCircle } from 'lucide-react'

export default function ChangePasswordPage() {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)
    
    const formData = new FormData(e.currentTarget)
    
    try {
      const result = await updatePassword(formData)
      if (result?.error) {
        setError(result.error)
      }
    } catch (err: any) {
      if (err?.digest?.startsWith('NEXT_REDIRECT')) throw err
      console.error(err)
      setError('An unexpected error occurred')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-900 overflow-hidden relative">
      <div className="absolute inset-0 z-0 opacity-20 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-blue-400 via-slate-900 to-slate-900"></div>
      
      <div className="w-full max-w-sm relative z-10 animate-in fade-in slide-in-from-bottom-6 duration-700">
        <div className="bg-white/10 backdrop-blur-xl border border-white/20 p-8 rounded-3xl shadow-2xl flex flex-col items-center">
          <div className="w-16 h-16 bg-amber-500/20 text-amber-400 rounded-full flex items-center justify-center mb-6 shadow-inner ring-1 ring-amber-400/50">
            <ShieldAlert className="w-8 h-8" />
          </div>
          
          <h1 className="text-2xl font-black text-white mb-2 text-center">Action Required</h1>
          <p className="text-sm text-slate-300 mb-6 text-center px-4 font-medium leading-relaxed">
            You must change your temporary password before accessing the system.
          </p>
          
          {error && (
            <div className="w-full mb-6 p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center gap-3 text-rose-400 animate-in fade-in slide-in-from-top-4 duration-500">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <p className="font-semibold text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={onSubmit} className="w-full space-y-5">
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-widest mb-1.5 pl-1">
                New Password
              </label>
              <input 
                type="password" 
                name="newPassword" 
                required 
                minLength={6}
                placeholder="••••••••"
                className="w-full px-4 py-3.5 bg-slate-900/50 border border-white/10 rounded-xl text-white placeholder-slate-500 font-medium focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all shadow-inner outline-none"
              />
              <p className="text-[10px] text-slate-400 mt-2 pl-1 uppercase font-bold tracking-wider">Must be at least 6 characters</p>
            </div>
            
            <button 
              type="submit" 
              disabled={isSubmitting}
              className="w-full relative group overflow-hidden bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold py-4 rounded-xl shadow-lg transition-all active:scale-[0.98] mt-2 disabled:opacity-50"
            >
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out"></div>
              <span className="relative flex items-center justify-center gap-2">
                {isSubmitting ? 'Saving...' : 'Save & Continue'} <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </span>
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
