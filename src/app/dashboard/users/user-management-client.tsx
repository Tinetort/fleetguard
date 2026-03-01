'use client'

import { useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ArrowLeft, Users, UserPlus, KeyRound, Copy, Check, ShieldAlert } from 'lucide-react'
import Link from 'next/link'
import { createEmployee, resetEmployeePassword } from '@/app/actions'

interface User {
  id: string
  username: string
  role: string
  org_type: string
  created_at: string
  temp_password: boolean
}

export default function UserManagementClient({ initialUsers }: { initialUsers: User[] }) {
  const [users, setUsers] = useState<User[]>(initialUsers)
  const [isAddingUser, setIsAddingUser] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null)
  const [generatedUsername, setGeneratedUsername] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  // Reset temp password modal
  const [resettingUser, setResettingUser] = useState<User | null>(null)
  const [resetError, setResetError] = useState<string | null>(null)

  async function handleAddUser(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsSubmitting(true)
    setGeneratedPassword(null)

    const formData = new FormData(e.currentTarget)
    const firstName = formData.get('firstName') as string
    const lastName = formData.get('lastName') as string
    const role = formData.get('role') as string

    try {
      const result = await createEmployee(firstName, lastName, role)
      if (result.error) {
        alert(result.error)
      } else if (result.username && result.tempPassword) {
        setGeneratedUsername(result.username)
        setGeneratedPassword(result.tempPassword)
        // Optimistically update the list
        setUsers([{
          id: Math.random().toString(),
          username: result.username,
          role,
          org_type: 'ems', // Default for now
          created_at: new Date().toISOString(),
          temp_password: true
        }, ...users])
      }
    } catch (err) {
      alert('Failed to create user')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleResetPassword(userId: string) {
    setResetError(null)
    try {
      const result = await resetEmployeePassword(userId)
      if (result.error) {
        setResetError(result.error)
      } else if (result.tempPassword) {
        setGeneratedUsername(resettingUser!.username)
        setGeneratedPassword(result.tempPassword)
        // Optimistically update the user's temp_password flag in the list
        setUsers(users.map(u => u.id === userId ? { ...u, temp_password: true } : u))
      }
    } catch (err) {
      setResetError('Failed to reset password')
    }
  }

  const copyToClipboard = () => {
    if (generatedPassword && generatedUsername) {
      navigator.clipboard.writeText(`Username: ${generatedUsername}\nPassword: ${generatedPassword}`)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const closeModals = () => {
    setIsAddingUser(false)
    setGeneratedPassword(null)
    setGeneratedUsername(null)
    setResettingUser(null)
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-12">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/dashboard">
              <Button variant="ghost" size="icon" className="rounded-full bg-white shadow-sm border border-slate-200">
                <ArrowLeft className="w-5 h-5 text-slate-600" />
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-extrabold text-slate-900 flex items-center gap-2">
                <Users className="w-7 h-7 text-blue-600" /> Manage Users
              </h1>
              <p className="text-sm font-medium text-slate-500 mt-1">{users.length} active accounts</p>
            </div>
          </div>

          <Button 
            onClick={() => setIsAddingUser(true)}
            className="rounded-xl shadow-md transition-all active:scale-[0.98] bg-blue-600 hover:bg-blue-500 text-white font-bold h-12 px-6"
          >
            <UserPlus className="w-5 h-5 mr-2" /> Add Employee
          </Button>
        </div>

        {/* User List */}
        <Card className="shadow-lg border-0 overflow-hidden rounded-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-100/50 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-6 py-4">Username</th>
                  <th className="px-6 py-4">Role</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Joined</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map(user => (
                  <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-bold text-slate-900">{user.username}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                        user.role === 'director' ? 'bg-purple-100 text-purple-700' :
                        user.role === 'manager' ? 'bg-blue-100 text-blue-700' :
                        user.role === 'paramedic' ? 'bg-rose-100 text-rose-700' :
                        user.role === 'nurse' ? 'bg-teal-100 text-teal-700' :
                        'bg-slate-100 text-slate-700'
                      }`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {user.temp_password ? (
                         <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-700">
                           <ShieldAlert className="w-3 h-3" /> Needs Password Change
                         </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-700">
                           <Check className="w-3 h-3" /> Active
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-slate-500 font-medium">
                      {new Date(user.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="text-slate-500 hover:text-blue-600 bg-white border border-slate-200 shadow-sm"
                        onClick={() => setResettingUser(user)}
                      >
                        <KeyRound className="w-4 h-4 mr-2 text-slate-400" /> Reset Password
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Add User Modal */}
        {(isAddingUser || generatedPassword) && !resettingUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
              
              {generatedPassword ? (
                <div className="p-8 text-center">
                  <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Check className="w-8 h-8" />
                  </div>
                  <h2 className="text-2xl font-black text-slate-900 mb-2">Account Created!</h2>
                  <p className="text-slate-500 text-sm mb-6">Share these temporary credentials with the employee. They will be forced to change the password upon first login.</p>
                  
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 text-left relative group">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Username</p>
                    <p className="text-lg font-black text-slate-800 mb-4 font-mono">{generatedUsername}</p>
                    
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Temp Password</p>
                    <p className="text-xl font-black text-blue-600 font-mono tracking-widest">{generatedPassword}</p>
                    
                    <button 
                      onClick={copyToClipboard}
                      className="absolute top-4 right-4 p-2.5 rounded-xl bg-white border border-slate-200 text-slate-500 shadow-sm hover:text-blue-600 hover:border-blue-200 transition-all active:scale-95"
                      title="Copy credentials"
                    >
                      {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                  
                  <Button onClick={closeModals} className="w-full mt-6 h-12 rounded-xl text-md font-bold">Done</Button>
                </div>
              ) : (
                <>
                  <div className="px-8 pt-8 pb-6 border-b border-slate-100">
                    <h2 className="text-2xl font-black text-slate-900">Add New Employee</h2>
                    <p className="text-slate-500 text-sm mt-1">Generate a new account with a temporary password.</p>
                  </div>
                  <form onSubmit={handleAddUser} className="p-8 space-y-5">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider pl-1">First Name</label>
                        <Input name="firstName" required className="h-12 bg-slate-50 border-slate-200" placeholder="John" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider pl-1">Last Name</label>
                        <Input name="lastName" required className="h-12 bg-slate-50 border-slate-200" placeholder="Doe" />
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider pl-1">Role</label>
                      <select name="role" className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none appearance-none">
                        <option value="emt">EMT</option>
                        <option value="paramedic">Paramedic</option>
                        <option value="nurse">Nurse</option>
                        <option value="manager">Manager</option>
                        <option value="director">Director</option>
                      </select>
                    </div>

                    <div className="pt-4 flex gap-3">
                      <Button type="button" variant="outline" className="flex-1 h-12 rounded-xl" onClick={closeModals}>Cancel</Button>
                      <Button type="submit" className="flex-1 h-12 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold shadow-md" disabled={isSubmitting}>
                        {isSubmitting ? 'Creating...' : 'Create Account'}
                      </Button>
                    </div>
                  </form>
                </>
              )}
            </div>
          </div>
        )}

        {/* Reset Password Modal */}
        {resettingUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full overflow-hidden flex flex-col p-8 text-center animate-in zoom-in-95 duration-200">
              
              {!generatedPassword ? (
                <>
                  <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-6">
                    <KeyRound className="w-8 h-8" />
                  </div>
                  <h2 className="text-xl font-black text-slate-900 mb-2">Reset Password?</h2>
                  <p className="text-slate-500 text-sm mb-6">This will invalidate <strong>{resettingUser.username}</strong>'s current password and generate a new temporary one.</p>
                  
                  {resetError && <p className="text-rose-500 text-sm mb-4 font-bold">{resetError}</p>}

                  <div className="flex gap-3">
                    <Button type="button" variant="outline" className="flex-1 h-12 rounded-xl" onClick={closeModals}>Cancel</Button>
                    <Button 
                      onClick={() => handleResetPassword(resettingUser.id)} 
                      className="flex-1 h-12 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold shadow-md"
                    >
                      Reset
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Check className="w-8 h-8" />
                  </div>
                  <h2 className="text-2xl font-black text-slate-900 mb-2">Password Reset!</h2>
                  <p className="text-slate-500 text-sm mb-6">Share this new temporary password with <strong>{generatedUsername}</strong>.</p>
                  
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 text-left relative group mb-6">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">New Temp Password</p>
                    <p className="text-xl font-black text-blue-600 font-mono tracking-widest">{generatedPassword}</p>
                    
                    <button 
                      onClick={copyToClipboard}
                      className="absolute top-1/2 -translate-y-1/2 right-4 p-2.5 rounded-xl bg-white border border-slate-200 text-slate-500 shadow-sm hover:text-blue-600 hover:border-blue-200 transition-all active:scale-95"
                      title="Copy credentials"
                    >
                      {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                  
                  <Button onClick={closeModals} className="w-full h-12 rounded-xl text-md font-bold">Done</Button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
