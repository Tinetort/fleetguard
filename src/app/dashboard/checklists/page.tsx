'use client'

import { useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AiInput } from '@/components/ui/ai-input'
import { createChecklist, createPdfChecklist } from '../../actions'
import { CheckCircle2, FileText, ListChecks, Plus, Trash2, ArrowLeft, Wand2 } from 'lucide-react'
import { INDUSTRY_PRESETS, type OrgType } from '@/lib/presets'

type Step = 'pickIndustry' | 'build'
type ChecklistType = 'manual' | 'pdf'

export default function ChecklistsPage() {
  const [step, setStep] = useState<Step>('pickIndustry')
  const [selectedOrg, setSelectedOrg] = useState<OrgType | null>(null)
  const [type, setType] = useState<ChecklistType>('manual')
  const [title, setTitle] = useState('')
  const [questions, setQuestions] = useState<string[]>([])
  const [currentQuestion, setCurrentQuestion] = useState('')
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSelectIndustry = (orgType: OrgType) => {
    setSelectedOrg(orgType)
    const preset = INDUSTRY_PRESETS[orgType]
    // Auto-fill title and questions from preset (if not custom)
    if (orgType !== 'custom' && preset.startOfShiftQuestions.length > 0) {
      setTitle(`${preset.label} — Start of Shift Check`)
      setQuestions(preset.startOfShiftQuestions)
    } else {
      setTitle('')
      setQuestions([])
    }
    setStep('build')
  }

  const handleAddQuestion = () => {
    if (currentQuestion.trim()) {
      setQuestions([...questions, currentQuestion.trim()])
      setCurrentQuestion('')
    }
  }

  const handleRemoveQuestion = (index: number) => {
    setQuestions(questions.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    setIsSubmitting(true)
    setError(null)

    try {
      if (type === 'manual') {
        if (questions.length === 0) {
          setError('Please add at least one question.')
          setIsSubmitting(false)
          return
        }
        const res = await createChecklist(title, 'manual', questions, null)
        if (res.error) throw new Error(res.error)
      } else {
        if (!pdfFile) {
          setError('Please select a PDF file before deploying.')
          setIsSubmitting(false)
          return
        }
        const formData = new FormData()
        formData.append('title', title)
        formData.append('file', pdfFile)
        const res = await createPdfChecklist(formData)
        if (res.error) throw new Error(res.error)
      }
      setSuccess(true)
      setTitle('')
      setQuestions([])
      setCurrentQuestion('')
      setPdfFile(null)
      setStep('pickIndustry')
      setSelectedOrg(null)
      setTimeout(() => setSuccess(false), 4000)
    } catch (err: any) {
      console.error(err)
      setError(err?.message || 'An unknown error occurred.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const colorMap: Record<string, string> = {
    blue:   'border-blue-200 bg-blue-50 hover:border-blue-400 hover:bg-blue-100',
    red:    'border-red-200 bg-red-50 hover:border-red-400 hover:bg-red-100',
    slate:  'border-slate-200 bg-slate-50 hover:border-slate-400 hover:bg-slate-100',
    amber:  'border-amber-200 bg-amber-50 hover:border-amber-400 hover:bg-amber-100',
    purple: 'border-purple-200 bg-purple-50 hover:border-purple-400 hover:bg-purple-100',
  }
  const activeColorMap: Record<string, string> = {
    blue:   'border-blue-500 bg-blue-100 ring-2 ring-blue-400',
    red:    'border-red-500 bg-red-100 ring-2 ring-red-400',
    slate:  'border-slate-500 bg-slate-200 ring-2 ring-slate-400',
    amber:  'border-amber-500 bg-amber-100 ring-2 ring-amber-400',
    purple: 'border-purple-500 bg-purple-100 ring-2 ring-purple-400',
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-12">
      <div className="max-w-4xl mx-auto space-y-8">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight text-slate-900">
            Checklist <span className="text-blue-600">Builder</span>
          </h1>
          <p className="text-slate-500 mt-2">Deploy inspection checklists to your team's devices instantly.</p>
        </div>

        {success && (
          <div className="p-4 bg-emerald-100 border border-emerald-200 rounded-xl flex items-center gap-3 text-emerald-800 animate-in fade-in slide-in-from-top-4 duration-500">
            <CheckCircle2 className="w-6 h-6 flex-shrink-0" />
            <p className="font-semibold">Checklist deployed to all vehicles successfully!</p>
          </div>
        )}

        {error && (
          <div className="p-4 bg-rose-100 border border-rose-200 rounded-xl text-rose-800">
            <p className="font-semibold text-sm">{error}</p>
          </div>
        )}

        {/* Step 1: Industry Picker */}
        {step === 'pickIndustry' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-slate-800 mb-1">Select your organization type</h2>
              <p className="text-slate-500 text-sm">We'll load a pre-built checklist template you can customize.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.values(INDUSTRY_PRESETS).map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => handleSelectIndustry(preset.id)}
                  className={`p-6 border-2 rounded-2xl flex flex-col items-start gap-3 transition-all text-left ${colorMap[preset.color]}`}
                >
                  <span className="text-4xl">{preset.icon}</span>
                  <div>
                    <h3 className="font-bold text-slate-900 text-base leading-snug">{preset.label}</h3>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">{preset.description}</p>
                  </div>
                  {preset.id !== 'custom' && (
                    <span className="text-xs font-semibold text-slate-400 mt-auto">
                      {preset.startOfShiftQuestions.length} items included
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Build / Edit Checklist */}
        {step === 'build' && selectedOrg && (
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <button
                onClick={() => { setStep('pickIndustry'); setSelectedOrg(null) }}
                className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-full text-sm font-bold text-slate-600">
                <span>{INDUSTRY_PRESETS[selectedOrg].icon}</span>
                <span>{INDUSTRY_PRESETS[selectedOrg].label}</span>
              </div>
            </div>

            {/* Type toggle */}
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => setType('manual')}
                className={`p-4 border-2 rounded-2xl flex items-center gap-3 transition-all ${type === 'manual' ? 'border-blue-600 bg-blue-50' : 'border-slate-200 hover:border-slate-300 bg-white'}`}
              >
                <div className={`p-2 rounded-full ${type === 'manual' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                  <ListChecks className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <h3 className={`font-bold text-sm ${type === 'manual' ? 'text-blue-900' : 'text-slate-600'}`}>Smart Checklist</h3>
                  <p className="text-xs text-slate-500">Build with AI</p>
                </div>
              </button>
              <button
                onClick={() => setType('pdf')}
                className={`p-4 border-2 rounded-2xl flex items-center gap-3 transition-all ${type === 'pdf' ? 'border-blue-600 bg-blue-50' : 'border-slate-200 hover:border-slate-300 bg-white'}`}
              >
                <div className={`p-2 rounded-full ${type === 'pdf' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                  <FileText className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <h3 className={`font-bold text-sm ${type === 'pdf' ? 'text-blue-900' : 'text-slate-600'}`}>Upload PDF</h3>
                  <p className="text-xs text-slate-500">Static document</p>
                </div>
              </button>
            </div>

            <Card className="border-0 shadow-lg overflow-hidden">
              <div className="bg-blue-600 h-2 w-full" />
              <CardHeader>
                <CardTitle>{type === 'manual' ? 'Edit Checklist Items' : 'Upload Protocol Document'}</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="space-y-3">
                    <Label htmlFor="title" className="font-bold">Checklist Name</Label>
                    <Input
                      id="title"
                      value={title}
                      onChange={e => setTitle(e.target.value)}
                      placeholder="e.g. Morning BLS Rig Check"
                      className="h-12 text-lg"
                      required
                    />
                  </div>

                  {type === 'pdf' && (
                    <div className="space-y-3">
                      <Label className="font-bold">Protocol Document</Label>
                      <label className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-xl cursor-pointer bg-slate-50 hover:bg-slate-100 transition-colors ${pdfFile ? 'border-blue-600 bg-blue-50/50' : 'border-slate-300'}`}>
                        <div className="flex flex-col items-center justify-center pt-5 pb-6 text-slate-500 text-center px-4 overflow-hidden">
                          <FileText className={`w-8 h-8 mb-2 ${pdfFile ? 'text-blue-500' : 'text-slate-400'}`} />
                          <p className="mb-2 text-sm truncate w-full">
                            {pdfFile ? <span className="font-bold text-blue-600">{pdfFile.name}</span> : <><span className="font-semibold">Click to upload</span> or drag and drop</>}
                          </p>
                          <p className="text-xs">PDF, DOCX (MAX. 10MB)</p>
                        </div>
                        <input
                          type="file"
                          className="hidden"
                          accept=".pdf,.doc,.docx"
                          onChange={(e) => { if (e.target.files?.[0]) setPdfFile(e.target.files[0]) }}
                        />
                      </label>
                    </div>
                  )}

                  {type === 'manual' && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <Label className="font-bold">Inspection Items</Label>
                        {INDUSTRY_PRESETS[selectedOrg].startOfShiftQuestions.length > 0 && questions.length === 0 && (
                          <button
                            type="button"
                            onClick={() => setQuestions(INDUSTRY_PRESETS[selectedOrg].startOfShiftQuestions)}
                            className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors"
                          >
                            <Wand2 className="w-3.5 h-3.5" /> Load {INDUSTRY_PRESETS[selectedOrg].icon} preset
                          </button>
                        )}
                      </div>

                      <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                        {questions.map((q, idx) => (
                          <div key={idx} className="flex items-center gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
                            <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold shrink-0">
                              {idx + 1}
                            </div>
                            <span className="flex-grow text-slate-700 font-medium text-sm">{q}</span>
                            <Button type="button" variant="ghost" size="icon" className="text-rose-500 hover:bg-rose-50 shrink-0 h-8 w-8" onClick={() => handleRemoveQuestion(idx)}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        ))}
                      </div>

                      <div className="flex items-stretch gap-2 flex-col">
                        <div className="relative">
                          <AiInput
                            value={currentQuestion}
                            onValueChange={setCurrentQuestion}
                            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddQuestion() } }}
                            placeholder="Type an item or let AI complete it... (Tab to accept)"
                            className="h-12 w-full"
                          />
                          <p className="text-xs text-slate-400 mt-2">✨ Press <kbd className="px-1 py-0.5 bg-slate-200 rounded text-slate-600 font-sans mx-1">Tab</kbd> to accept AI suggestion</p>
                        </div>
                        <Button
                          type="button"
                          onClick={handleAddQuestion}
                          className="h-12 w-full sm:w-auto px-8 bg-slate-900 hover:bg-slate-800 self-end mt-2"
                        >
                          <Plus className="w-4 h-4 mr-2" /> Add Item
                        </Button>
                      </div>
                    </div>
                  )}

                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full h-14 text-lg font-bold bg-blue-600 hover:bg-blue-700 mt-4"
                  >
                    {isSubmitting ? 'Deploying...' : '🚀 Deploy Checklist to All Vehicles'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}
