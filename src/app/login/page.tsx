'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AlertCircle, LogIn } from 'lucide-react'
import { authenticate } from '../actions'
import Link from 'next/link'

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
                <Link href="/forgot-password" className="text-blue-400 text-xs font-semibold hover:text-blue-300">Forgot password?</Link>
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

          <div className="mt-8">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-slate-700" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-slate-900 px-3 text-slate-500 font-bold tracking-widest">Or continue with</span>
              </div>
            </div>

            <div className="mt-6 flex justify-center">
              <Button 
                variant="outline" 
                type="button"
                className="w-full h-14 bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white flex items-center justify-center gap-3"
                onClick={() => {
                  import('@/../utils/supabase/client').then(({ createClient }) => {
                    const supabase = createClient()
                    supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${window.location.origin}/auth/callback` } })
                  })
                }}
              >
                <svg className="h-5 w-5" aria-hidden="true" viewBox="0 0 24 24">
                  <path d="M12.0003 4.75C13.7703 4.75 15.3553 5.36002 16.6053 6.54998L20.0303 3.125C17.9502 1.19 15.2353 0 12.0003 0C7.31028 0 3.25527 2.69 1.28027 6.60998L5.27028 9.70498C6.21525 6.86002 8.87028 4.75 12.0003 4.75Z" fill="#EA4335" />
                  <path d="M23.49 12.275C23.49 11.49 23.415 10.73 23.3 10H12V14.51H18.47C18.18 15.99 17.34 17.25 16.08 18.1L19.945 21.1C22.2 19.01 23.49 15.92 23.49 12.275Z" fill="#4285F4" />
                  <path d="M5.26498 14.2949C5.02498 13.5699 4.88501 12.7999 4.88501 11.9999C4.88501 11.1999 5.01998 10.4299 5.26498 9.7049L1.275 6.60986C0.46 8.22986 0 10.0599 0 11.9999C0 13.9399 0.46 15.7699 1.28 17.3899L5.26498 14.2949Z" fill="#FBBC05" />
                  <path d="M12.0004 24.0001C15.2404 24.0001 17.9654 22.935 19.9454 21.095L16.0804 18.095C15.0054 18.82 13.6204 19.245 12.0004 19.245C8.8704 19.245 6.21537 17.135 5.26538 14.29L1.27539 17.385C3.25539 21.31 7.3104 24.0001 12.0004 24.0001Z" fill="#34A853" />
                </svg>
                <span>Continue with Google</span>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
