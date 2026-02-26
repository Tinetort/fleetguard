'use client'

import { useRef, useEffect, useState, forwardRef, useImperativeHandle } from 'react'

export interface SignaturePadRef {
  clear: () => void
  isEmpty: () => boolean
  toDataURL: () => string
}

interface SignaturePadProps {
  label?: string
  required?: boolean
}

const SignaturePad = forwardRef<SignaturePadRef, SignaturePadProps>(
  ({ label = 'Signature', required = false }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const [isDrawing, setIsDrawing] = useState(false)
    const [hasDrawn, setHasDrawn] = useState(false)

    useImperativeHandle(ref, () => ({
      clear: () => {
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext('2d')
        if (!ctx) return
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        drawGuide(ctx, canvas)
        setHasDrawn(false)
      },
      isEmpty: () => !hasDrawn,
      toDataURL: () => {
        if (!hasDrawn) return ''
        return canvasRef.current?.toDataURL('image/png') || ''
      },
    }))

    function drawGuide(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) {
      ctx.setLineDash([4, 4])
      ctx.strokeStyle = '#cbd5e1'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(20, canvas.height - 30)
      ctx.lineTo(canvas.width - 20, canvas.height - 30)
      ctx.stroke()
      ctx.setLineDash([])

      ctx.font = '11px Inter, system-ui, sans-serif'
      ctx.fillStyle = '#94a3b8'
      ctx.fillText('Sign above this line', 20, canvas.height - 12)
    }

    useEffect(() => {
      const canvas = canvasRef.current
      if (!canvas) return

      // High DPI support
      const dpr = window.devicePixelRatio || 1
      const rect = canvas.getBoundingClientRect()
      canvas.width = rect.width * dpr
      canvas.height = rect.height * dpr
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.scale(dpr, dpr)

      // Drawing style
      ctx.strokeStyle = '#1e293b'
      ctx.lineWidth = 2
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'

      drawGuide(ctx, canvas)
    }, [])

    function getPos(e: React.MouseEvent | React.TouchEvent) {
      const canvas = canvasRef.current
      if (!canvas) return { x: 0, y: 0 }
      const rect = canvas.getBoundingClientRect()
      if ('touches' in e) {
        return {
          x: e.touches[0].clientX - rect.left,
          y: e.touches[0].clientY - rect.top,
        }
      }
      return {
        x: (e as React.MouseEvent).clientX - rect.left,
        y: (e as React.MouseEvent).clientY - rect.top,
      }
    }

    function startDraw(e: React.MouseEvent | React.TouchEvent) {
      e.preventDefault()
      const ctx = canvasRef.current?.getContext('2d')
      if (!ctx) return
      const pos = getPos(e)
      ctx.strokeStyle = '#1e293b'
      ctx.lineWidth = 2
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.beginPath()
      ctx.moveTo(pos.x, pos.y)
      setIsDrawing(true)
    }

    function draw(e: React.MouseEvent | React.TouchEvent) {
      if (!isDrawing) return
      e.preventDefault()
      const ctx = canvasRef.current?.getContext('2d')
      if (!ctx) return
      const pos = getPos(e)
      ctx.lineTo(pos.x, pos.y)
      ctx.stroke()
      setHasDrawn(true)
    }

    function stopDraw() {
      setIsDrawing(false)
    }

    return (
      <div className="space-y-2">
        <label className="text-slate-700 font-bold text-sm uppercase tracking-wide flex items-center gap-2">
          ✍️ {label}
          {required && <span className="text-rose-500">*</span>}
        </label>
        <div className="relative">
          <canvas
            ref={canvasRef}
            style={{ width: '100%', height: 160, touchAction: 'none' }}
            className="w-full bg-white border-2 border-slate-200 rounded-xl cursor-crosshair shadow-inner"
            onMouseDown={startDraw}
            onMouseMove={draw}
            onMouseUp={stopDraw}
            onMouseLeave={stopDraw}
            onTouchStart={startDraw}
            onTouchMove={draw}
            onTouchEnd={stopDraw}
          />
          {hasDrawn && (
            <button
              type="button"
              onClick={() => {
                const canvas = canvasRef.current
                if (!canvas) return
                const ctx = canvas.getContext('2d')
                if (!ctx) return
                ctx.clearRect(0, 0, canvas.width, canvas.height)
                drawGuide(ctx, canvas)
                setHasDrawn(false)
              }}
              className="absolute top-2 right-2 px-2 py-1 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg border border-slate-300 transition-colors"
            >
              Clear
            </button>
          )}
        </div>
        {required && !hasDrawn && (
          <p className="text-xs text-slate-400">Please sign above before submitting.</p>
        )}
      </div>
    )
  }
)

SignaturePad.displayName = 'SignaturePad'
export default SignaturePad
