import { GoogleGenAI } from '@google/genai'

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })

export type DamageSeverity = 'green' | 'yellow' | 'red'

export interface AnalysisResult {
  severity: DamageSeverity
  notes: string
}

/**
 * Analyzes vehicle damage from TEXT NOTES ONLY using Google Gemini AI.
 * Photos are handled separately (auto-flagged yellow) without calling AI,
 * to conserve API quota and avoid slow analysis.
 */
export async function analyzeDamage(notes: string): Promise<AnalysisResult> {
  if (!notes || !notes.trim()) {
    return { severity: 'green', notes: 'No damage reported.' }
  }

  const prompt = `
  You are an expert fleet mechanic for an Emergency Medical Services (EMS) company.
  Assess the severity of this vehicle damage report written by a crew member.

  Crew report: "${notes}"

  Severity levels:
  - "red": Critical — major mechanical failure, broken windshield, engine issue, collision damage, or any condition requiring the vehicle to be pulled from service immediately.
  - "yellow": Minor — small dent, cosmetic damage, missing non-critical supply, or an issue that can wait until end of shift.
  - "green": No real issue — normal wear and tear or a non-damage note.

  Respond with valid JSON only:
  { "severity": "red" | "yellow" | "green", "notes": "1-2 sentence explanation." }
  `

  try {
    console.log('[AI] Analyzing text notes:', notes.substring(0, 80))
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash-lite',
      contents: [prompt],
      config: { responseMimeType: 'application/json' }
    })

    const text = response.text
    if (!text) throw new Error('Empty response from AI')

    const result = JSON.parse(text) as AnalysisResult
    if (!['green', 'yellow', 'red'].includes(result.severity)) result.severity = 'yellow'
    console.log('[AI] Result:', result.severity, '-', result.notes?.substring(0, 80))
    return result
  } catch (error: any) {
    console.error('[AI] Analysis failed:', error?.status || error?.message)
    // Fallback: treat any reported text damage as yellow for dispatcher to review
    return {
      severity: 'yellow',
      notes: 'AI analysis unavailable — manually flagged for dispatcher review.'
    }
  }
}
