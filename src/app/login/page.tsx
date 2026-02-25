'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AlertCircle, LogIn } from 'lucide-react'
import { authenticate } from '../actions'

export default function LoginPage() {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)
    
    const formData = new FormData(e.currentTarget)
    
    try {
      const result = await authenticate(formData)
      if (result?.error) {
        setError(result.error)
      }
      // If success, the server action will redirect users automatically
    } catch (err: any) {
      // Next.js redirect() throws a NEXT_REDIRECT error internally — re-throw it
      if (err?.digest?.startsWith('NEXT_REDIRECT')) throw err
      console.error(err)
      setError('An unexpected error occurred')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
          <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-blue-600/10 blur-[120px]" />
      </div>

      <Card className="z-10 w-full max-w-md shadow-2xl border-slate-800 bg-slate-900 overflow-hidden relative">
        <div className="bg-blue-600 h-2 w-full" />
        <CardHeader className="space-y-2 pb-6 pt-8">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-slate-800 rounded-2xl border border-slate-700">
              <LogIn className="w-8 h-8 text-blue-400" />
            </div>
          </div>
          <CardTitle className="text-3xl font-extrabold text-center text-slate-100">
            Welcome Back
          </CardTitle>
          <CardDescription className="text-center text-slate-400 font-medium text-base">
            Sign in to Smart Rig Check
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center gap-3 text-rose-400 animate-in fade-in slide-in-from-top-4 duration-500">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <p className="font-semibold text-sm">{error}</p>
            </div>
          )}
          
          <form onSubmit={onSubmit} className="space-y-6">
            <div className="space-y-3">
              <Label htmlFor="username" className="text-slate-300 font-bold text-xs uppercase tracking-wider">Username</Label>
              <Input 
                id="username" 
                name="username" 
                type="text" 
                autoComplete="username"
                required 
                placeholder="e.g. ivan.emt"
                className="h-12 bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-500 focus:ring-2 focus:ring-blue-500/50" 
              />
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <Label htmlFor="password" className="text-slate-300 font-bold text-xs uppercase tracking-wider">Password</Label>
                <button type="button" className="text-blue-400 text-xs font-semibold hover:text-blue-300">Forgot password?</button>
              </div>
              <Input 
                id="password" 
                name="password" 
                type="password" 
                autoComplete="current-password"
                required 
                placeholder="••••••••"
                className="h-12 bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-500 focus:ring-2 focus:ring-blue-500/50" 
              />
            </div>

            <Button 
              type="submit" 
              disabled={isSubmitting} 
              className="w-full h-14 text-lg font-bold rounded-xl shadow-md transition-all active:scale-[0.98] bg-blue-600 hover:bg-blue-500 text-white border border-blue-500"
            >
              {isSubmitting ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
