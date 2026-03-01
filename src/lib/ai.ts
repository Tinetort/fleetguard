import { GoogleGenAI } from '@google/genai'

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })

export type DamageSeverity = 'green' | 'yellow' | 'red'

export interface AnalysisResult {
  severity: DamageSeverity
  notes: string
}

/**
 * Rewrites raw damage notes from previous shift into a casual, humorous
 * heads-up message in the style of the workplace (EMS, fire, police).
 * Example: "Hey — last crew flagged a busted headlight on this rig. Check it before you Code 3 anyone."
 */
export async function generateHandoffWarning(
  damageNotes: string,
  orgType: string = 'ems'
): Promise<string> {
  const styleGuides: Record<string, string> = {
    ems: 'EMS/ambulance style. Use paramedic slang (Code 3, BLS, ALS, load and go, etc.). Casual, warm, a bit funny.',
    fire: 'Fire department style. Use firefighter slang (fully involved, charge the line, SCBA, etc.). Friendly and professional.',
    police: 'Law enforcement style. Use police slang (code 4, signal, 10-4, backup, etc.). Straight-talking with dry humor.',
  }
  const style = styleGuides[orgType] || styleGuides.ems

  const prompt = `
  You are writing a short heads-up message to the incoming crew about a vehicle issue reported by the previous shift.
  Style: ${style}

  Previous shift reported this damage/issue:
  "${damageNotes}"

  Rules:
  - Start with "Hey —"
  - Mention what the previous crew noted, but rewrite it in casual spoken language
  - Keep it under 20 words
  - Sound like a colleague talking to a colleague, not a formal report
  - No emojis, plain text only
  - End with a period or exclamation mark

  Examples:
  "Hey — last crew said the back door latch is acting up. Give it a look before you load anyone."
  "Hey — previous shift flagged a busted headlight. Might wanna sort that before you Code 3 someone."
  "Hey — left side oxygen tank was low last shift. Confirm it's been swapped out."

  Respond with just the message, nothing else.
  `

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [prompt],
    })
    const text = response.text?.trim()
    if (!text) throw new Error('Empty warning')
    return text
  } catch (error: any) {
    console.error('[AI] Handoff warning failed:', error?.status || error?.message)
    // Fallback: plain text version
    return `Hey — previous crew reported: "${damageNotes.trim()}". Please check before your shift.`
  }
}

import { shiftGreetings } from './greetings'

/**
 * Generates a short, funny, personalized shift greeting for the crew member
 * by randomly selecting from a large list of pre-written phrases.
 */
export async function generateShiftGreeting(
  firstName: string,
  lastName: string,
  orgType: string = 'ems'
): Promise<string> {
  try {
    // 1. Get the array for the specific org type, or fallback to EMS
    const greetingsArray = shiftGreetings[orgType as keyof typeof shiftGreetings] || shiftGreetings.ems

    // 2. Pick a random greeting
    const randomIndex = Math.floor(Math.random() * greetingsArray.length)
    const selectedTemplate = greetingsArray[randomIndex]

    // 3. Inject the name
    return selectedTemplate.replace(/\{name\}/g, firstName)
  } catch (error) {
    console.error('Failed to generate static greeting:', error)
    // Absolute fallback just in case
    return `${firstName} — stay safe out there.`
  }
}

/**
 * Analyzes vehicle damage from TEXT NOTES and an optional PHOTO using Google Gemini AI.
 */
export async function analyzeDamage(notes: string | null, photoUrl?: string | null): Promise<AnalysisResult> {
  if ((!notes || !notes.trim()) && !photoUrl) {
    return { severity: 'green', notes: 'No damage reported.' }
  }

  const prompt = `
  You are an expert fleet mechanic for an Emergency Medical Services (EMS) company.
  Assess the severity of this vehicle damage report written by a crew member.
  
  Crew report: "${notes || 'No text provided. Rely on the image.'}"

  Severity levels:
  - "red": Critical — major mechanical failure, broken windshield, engine issue, collision damage, or any condition requiring the vehicle to be pulled from service immediately.
  - "yellow": Minor — small dent, cosmetic damage, missing non-critical supply, or an issue that can wait until end of shift.
  - "green": No real issue — normal wear and tear or a non-damage note.

  Respond with valid JSON only:
  { "severity": "red" | "yellow" | "green", "notes": "1-2 sentence explanation." }
  `

  try {
    const contents: any[] = [{ role: 'user', parts: [{ text: prompt }] }]

    if (photoUrl) {
      // Fetch the image to send as base64 to Gemini
      console.log('[AI] Fetching image for analysis:', photoUrl)
      const res = await fetch(photoUrl)
      if (res.ok) {
        const arrayBuffer = await res.arrayBuffer()
        const base64 = Buffer.from(arrayBuffer).toString('base64')
        const mimeType = res.headers.get('content-type') || 'image/jpeg'
        
        contents[0].parts.push({
          inlineData: {
            data: base64,
            mimeType
          }
        })
      } else {
        console.warn('[AI] Failed to fetch image for analysis')
      }
    }

    console.log('[AI] Sending request to Gemini...')
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: contents,
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

/**
 * Analyzes an EMT's manual handoff dispute and summarizes it into a professional,
 * concise 1-sentence note for the dispatcher dashboard.
 */
export async function analyzeDispute(rawDispute: string): Promise<string> {
  const prompt = `
  You are an expert emergency medical services fleet manager.
  An EMT just disputed the condition of their vehicle left by the previous shift with the following note:
  
  "${rawDispute}"

  Summarize their complaint in one clear, professional, short sentence (under 15 words) for the dispatcher dashboard.
  Start the sentence directly with the issue (e.g. "Cab left filthy and main oxygen empty.").
  Respond with just the summary sentence. No quotes, no intro.
  `

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [prompt],
    })
    const text = response.text?.trim()
    if (!text) throw new Error('Empty dispute analysis')
    
    // Add a custom prefix to make it clear this is a dispute summary
    return `Dispute Summary: ${text}`
  } catch (error: any) {
    console.error('[AI] Dispute analysis failed:', error?.status || error?.message)
    // Fallback if AI fails: just use the raw text truncated
    const truncated = rawDispute.length > 50 ? rawDispute.substring(0, 50) + '...' : rawDispute
    return `Dispute: ${truncated}`
  }
}
