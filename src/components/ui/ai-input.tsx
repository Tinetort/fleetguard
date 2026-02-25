'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Sparkles } from 'lucide-react'

interface AiInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  value: string
  onValueChange: (val: string) => void
}

export function AiInput({ value, onValueChange, className, placeholder, ...props }: AiInputProps) {
  const [suggestion, setSuggestion] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (!value || value.trim().length === 0) {
      setSuggestion('')
      return
    }

    if (debounceRef.current) clearTimeout(debounceRef.current)

    debounceRef.current = setTimeout(async () => {
      setIsLoading(true)
      try {
        const res = await fetch('/api/ai-suggest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: value }),
        })
        const data = await res.json()
        // Only show suggestion if it's non-empty and user value hasn't changed
        setSuggestion(data.suggestion ? data.suggestion : '')
      } catch {
        setSuggestion('')
      } finally {
        setIsLoading(false)
      }
    }, 300)

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [value])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (suggestion && (e.key === 'Tab' || e.key === 'ArrowRight')) {
      e.preventDefault()
      onValueChange(value + suggestion)
      setSuggestion('')
    }
    if (props.onKeyDown) props.onKeyDown(e)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSuggestion('')
    onValueChange(e.target.value)
  }

  // Full combined display text: the user's value + ghost suggestion
  const ghostText = suggestion ? value + suggestion : value

  return (
    <div className="relative w-full">
      {/* Ghost / suggestion layer — positioned behind the real input */}
      <div
        aria-hidden="true"
        className="absolute inset-0 flex items-center px-3 pointer-events-none overflow-hidden"
      >
        <span className="font-medium text-sm whitespace-pre">
          {/* Make user-typed portion invisible so only the ghost part shows */}
          <span className="text-transparent">{value}</span>
          {suggestion && (
            <span className="text-slate-400 opacity-70">{suggestion}</span>
          )}
        </span>
      </div>

      {/* Real input on top — transparent background so ghost is visible below */}
      <input
        {...props}
        type="text"
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={suggestion ? undefined : placeholder}
        className={[
          'relative w-full h-12 px-3 rounded-md border border-slate-300 bg-transparent',
          'text-sm font-medium text-slate-900',
          'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
          'placeholder:text-slate-400',
          className || ''
        ].join(' ')}
      />

      {/* Loading/status indicator */}
      {isLoading && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
          <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
        </div>
      )}
      {suggestion && !isLoading && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
          <Sparkles className="w-4 h-4 text-amber-500" />
        </div>
      )}
    </div>
  )
}
