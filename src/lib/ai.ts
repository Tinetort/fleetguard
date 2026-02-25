import { GoogleGenAI } from '@google/genai'

// Initialize the Google GenAI SDK. 
// Requires GEMINI_API_KEY to be set in .env.local
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })

export type DamageSeverity = 'green' | 'yellow' | 'red'

export interface AnalysisResult {
  severity: DamageSeverity
  notes: string
}

/**
 * Analyzes vehicle damage using Google Gemini AI.
 * It takes optional text notes and an optional base64 image representation of the damage.
 */
export async function analyzeDamage(notes: string, base64Image?: string, mimeType?: string): Promise<AnalysisResult> {
  const hasPhoto = !!(base64Image && mimeType)
  const hasNotes = !!(notes && notes.trim())

  const prompt = `
  You are an expert, strict fleet mechanic for an Emergency Medical Services (EMS) company.
  Your job is to assess vehicle damage severity from the submitted report.

  ${hasNotes ? `Text report from the crew: "${notes}"` : 'No text notes provided.'}
  ${hasPhoto ? 'An image has been provided — CAREFULLY examine it for ANY visible damage, dents, broken glass, blood, debris, deformation, or safety hazards.' : ''}
  ${!hasNotes && hasPhoto ? 'Base your assessment ENTIRELY on the image. Look very carefully.' : ''}
  
  Severity levels:
  - "red": Critical safety issue — major body damage, broken windshield, deformed frame, engine problems, missing life-saving equipment. Vehicle MUST be pulled out of service immediately.
  - "yellow": Minor issue — small dents, cosmetic damage, missing non-critical supply. Needs attention but can finish the shift.
  - "green": Normal wear and tear, or genuinely no damage visible.
  
  You MUST respond with a valid JSON strictly following this schema:
  {
    "severity": "red" | "yellow" | "green",
    "notes": "A specific 1-2 sentence description of what you see and why you chose this severity."
  }
  `

  const contents: any[] = []
  
  if (base64Image && mimeType) {
    contents.push({
      inlineData: {
        data: base64Image,
        mimeType: mimeType
      }
    })
  }
  
  contents.push(prompt)

  const tryGenerate = async (): Promise<AnalysisResult> => {
    try {
      console.log(`[AI] Analyzing damage — hasPhoto: ${hasPhoto}, hasNotes: ${hasNotes}`)
      const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash-lite',
        contents: contents,
        config: {
          responseMimeType: 'application/json',
        }
      })

      const text = response.text
      console.log('[AI] Raw response:', text)
      if (!text) throw new Error('Empty response from AI')

      const result = JSON.parse(text) as AnalysisResult

      // Validate output
      if (!['green', 'yellow', 'red'].includes(result.severity)) {
        result.severity = 'yellow'
      }

      return result
    } catch (error: any) {
      // On 429: extract retryDelay and wait, then retry once
      if (error?.status === 429 || error?.message?.includes('429') || error?.message?.includes('RESOURCE_EXHAUSTED')) {
        const retryMatch = error?.message?.match(/"retryDelay":"(\d+)s"/)
        const waitSec = retryMatch ? Math.min(parseInt(retryMatch[1]), 60) : 30
        console.log(`[AI] Rate limited. Waiting ${waitSec}s then retrying...`)
        await new Promise(r => setTimeout(r, waitSec * 1000))

        // Retry once
        const response = await ai.models.generateContent({
          model: 'gemini-2.0-flash-lite',
          contents: contents,
          config: { responseMimeType: 'application/json' }
        })
        const text = response.text
        if (!text) throw new Error('Empty retry response')
        const result = JSON.parse(text) as AnalysisResult
        if (!['green', 'yellow', 'red'].includes(result.severity)) result.severity = 'yellow'
        console.log('[AI] Retry succeeded:', result)
        return result
      }
      throw error
    }
  }

  try {
    return await tryGenerate()
  } catch (error) {
    console.error('[AI] Gemini Analysis Error (final):', error)
    return {
      severity: hasPhoto ? 'yellow' : (hasNotes ? 'yellow' : 'green'),
      notes: `AI analysis failed — ${hasPhoto ? 'photo attached, flagged for manual dispatcher review' : 'manually flagged for review based on text input'}.`
    }
  }
}
