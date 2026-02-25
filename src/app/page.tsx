import Link from 'next/link'
import { ArrowRight, ShieldPlus, Activity, MenuSquare } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-900 pb-16 flex flex-col justify-center items-center text-slate-100 overflow-hidden relative">
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
          <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-blue-600/20 blur-[120px]" />
          <div className="absolute top-[60%] -right-[10%] w-[60%] h-[60%] rounded-full bg-emerald-600/10 blur-[120px]" />
      </div>

      <div className="z-10 w-full max-w-4xl px-6 md:px-12 mx-auto text-center space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-700">
        
        <div className="space-y-6">
          <div className="mx-auto w-24 h-24 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-3xl p-1 shadow-2xl flex items-center justify-center mb-8 rotate-3 hover:rotate-6 transition-transform duration-300">
            <div className="w-full h-full bg-slate-900 rounded-2xl flex items-center justify-center">
              <ShieldPlus className="w-12 h-12 text-blue-400" />
            </div>
          </div>
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight">
            Smart <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">Rig Check</span>
          </h1>
          <p className="text-xl md:text-2xl text-slate-400 max-w-2xl mx-auto font-medium">
            The next-generation fleet management and pre-shift inspection system for elite EMS teams.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 max-w-2xl mx-auto mt-12">
            <Link href="/rig-check" className="group">
              <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 p-8 rounded-3xl hover:bg-slate-800 hover:border-blue-500/50 transition-all duration-300 h-full flex flex-col items-center justify-center text-center space-y-4 hover:-translate-y-2 shadow-xl">
                <div className="p-4 bg-blue-500/10 rounded-2xl text-blue-400 group-hover:bg-blue-500 group-hover:text-white transition-colors duration-300">
                  <MenuSquare className="w-10 h-10" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold mb-2">EMT Portal</h3>
                  <p className="text-slate-400 mb-6">Submit pre-shift inspections from your mobile device.</p>
                </div>
                <div className="flex items-center text-blue-400 font-semibold group-hover:text-white mt-auto">
                  Launch App <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </Link>

            <Link href="/dashboard" className="group">
              <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 p-8 rounded-3xl hover:bg-slate-800 hover:border-emerald-500/50 transition-all duration-300 h-full flex flex-col items-center justify-center text-center space-y-4 hover:-translate-y-2 shadow-xl">
                <div className="p-4 bg-emerald-500/10 rounded-2xl text-emerald-400 group-hover:bg-emerald-500 group-hover:text-white transition-colors duration-300">
                  <Activity className="w-10 h-10" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold mb-2">Manager Dashboard</h3>
                  <p className="text-slate-400 mb-6">Real-time overview of fleet operational status.</p>
                </div>
                <div className="flex items-center text-emerald-400 font-semibold group-hover:text-white mt-auto">
                  View Fleet <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </Link>
        </div>

        <div className="pt-16 text-slate-500 text-sm font-medium">
          Built for Care Ambulance Systems. Requires authorized access.
        </div>
      </div>
    </div>
  )
}
