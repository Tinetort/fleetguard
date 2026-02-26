import { GoogleGenAI } from '@google/genai'

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })

export type DamageSeverity = 'green' | 'yellow' | 'red'

export interface AnalysisResult {
  severity: DamageSeverity
  notes: string
}

/**
 * Generates a short, funny, personalized shift greeting for the crew member.
 * Example: "MARK — no 5150s today and keep the coffee hot."
 */
export async function generateShiftGreeting(
  firstName: string,
  lastName: string,
  orgType: string = 'ems'
): Promise<string> {
  const styleGuides: Record<string, string> = {
    ems: 'You work for an EMS ambulance company. Use EMS/paramedic slang (5150, code 3, BLS, ALS, "clear", "load and go", etc.). Reference saving lives, coffee, long shifts.',
    fire: 'You work for a fire department. Use firefighter slang (fully involved, SCBA, RIT, "all hands", "charge the line", etc.). Reference fires, hose lines, brotherhood.',
    police: 'You work for a law enforcement agency. Use police slang (10-4, code 4, APB, "clear", backup, etc.). Reference staying safe and watching your six.',
  }
  const style = styleGuides[orgType] || styleGuides.ems

  const prompt = `
  Write a short, funny, personalized motivational message for a crew member starting their shift.
  Their name is ${firstName} ${lastName}. ${style}
  
  Rules:
  - Start by addressing them: FIRSTNAME IN ALL CAPS — (em dash, then message)
  - Keep it under 15 words total
  - Be funny, warm, and in the style of the job culture
  - No emojis — plain text only
  - End with a period or exclamation mark
  
  EMS examples:
  "MARK — no 5150s before lunch. After that, no promises."
  "SARAH — code 3 to greatness, but check your mirrors."
  "ALEX — keep the defibrillator charged and the coffee hotter."
  
  Respond with the message ONLY, no quotes, no explanation.
  `

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash-lite',
      contents: [prompt],
    })
    const text = response.text?.trim()
    if (!text) throw new Error('Empty greeting')
    return text
  } catch (error: any) {
    console.error('[AI] Greeting failed:', error?.status)
    const fallbacks: Record<string, string> = {
      ems: `${firstName.toUpperCase()} — stay sharp, drive safe, save lives.`,
      fire: `${firstName.toUpperCase()} — stay low, move fast, watch your six.`,
      police: `${firstName.toUpperCase()} — stay safe out there. We've got your back.`,
    }
    return fallbacks[orgType] || fallbacks.ems
  }
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
    return {
      severity: 'yellow',
      notes: 'AI analysis unavailable — manually flagged for dispatcher review.'
    }
  }
}
