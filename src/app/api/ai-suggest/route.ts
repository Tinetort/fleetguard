import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenAI } from '@google/genai'

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })

// Local EMS dictionary for instant fallback when AI quota is hit
// Key: lowercase prefix, Value: suggested completion (what comes AFTER the prefix)
const EMS_DICTIONARY: Record<string, string> = {
  'o': 'xygen Cylinder',
  'ox': 'ygen Cylinder',
  'oxy': 'gen Level PSI',
  'oxyg': 'en Level PSI',
  'g': 'auze 4x4',
  'ga': 'uze 4x4',
  'gau': 'ze 4x4',
  'gauz': 'e 4x4',
  '4': 'x4 Gauze Pads',
  '4x': '4 Gauze Pads',
  '4x4': ' Gauze Pads',
  's': 'tretcher Check',
  'st': 'retcher Check',
  'str': 'etcher Check',
  'stre': 'tcher Check',
  'stret': 'cher Check',
  'b': 'andages',
  'ba': 'ndages',
  'ban': 'dages',
  'band': 'ages',
  'banda': 'ges',
  'bandage': 's',
  'a': 'ED Pads',
  'ae': 'D Pads',
  'aed': ' Pads',
  'bl': 'ood Pressure Cuff',
  'blo': 'od Pressure Cuff',
  'bloo': 'd Pressure Cuff',
  'blood': ' Pressure Cuff',
  'c': 'ervical Collar',
  'ce': 'rvical Collar',
  'cer': 'vical Collar',
  'm': 'onitor Check',
  'mo': 'nitor Check',
  'mon': 'itor Check',
  'moni': 'tor Check',
  'd': 'efibrillator',
  'de': 'fibrillator',
  'def': 'ibrillator',
  'iv': ' Bag (1000mL)',
  'iv ': 'Bag (1000mL)',
  'e': 'pigastric Kit',
  'ep': 'inephrine',
  'epi': 'nephrine',
  'n': 'itrile Gloves',
  'ni': 'trile Gloves',
  'nit': 'rile Gloves',
  'glo': 'ves (L/M/S)',
  'glove': 's (L/M/S)',
  'puls': 'e Oximeter',
  'pulse': ' Oximeter',
  'suc': 'tion Unit',
  'suct': 'ion Unit',
  'sp': 'lints',
  'spl': 'ints',
  'spli': 'nts',
  'split': 's',
  'l': 'aryngoscope',
  'la': 'ryngoscope',
  'lar': 'yngoscope',
  'po': 'rtable Oxygen PSI',
  'por': 'table Oxygen PSI',
  'port': 'able Oxygen PSI',
  'porta': 'ble Oxygen PSI',
  'fire': ' Extinguisher',
  'f': 'ire Extinguisher',
  'fi': 're Extinguisher',
  'fir': 'e Extinguisher',
  't': 'ourniquets',
  'to': 'urniquets',
  'tour': 'niquets',
  'tourn': 'iquets',
  'radio': ' Check',
  'r': 'adio Check',
  'ra': 'dio Check',
  'rad': 'io Check',
  'p': 'ortable O2 PSI',
}

function getDictionarySuggestion(text: string): string {
  const lower = text.toLowerCase()
  // Try exact prefix match first
  if (EMS_DICTIONARY[lower]) return EMS_DICTIONARY[lower]
  // Try partial: find longest matching key that is a prefix of what user typed
  const keys = Object.keys(EMS_DICTIONARY).filter(k => lower.startsWith(k))
  if (keys.length > 0) {
    const longest = keys.sort((a, b) => b.length - a.length)[0]
    const suggestion = EMS_DICTIONARY[longest]
    // Return only the part that hasn't been typed yet
    const fullWord = longest + suggestion
    if (fullWord.toLowerCase().startsWith(lower)) {
      return fullWord.slice(text.length)
    }
  }
  return ''
}

export async function POST(req: NextRequest) {
  const { text } = await req.json().catch(() => ({ text: '' }))

  if (!text || text.trim().length === 0) {
    return NextResponse.json({ suggestion: '' })
  }

  // 1. Try AI first (gemini-1.5-flash has 1500 req/day free tier)
  try {
    const prompt = `You are an EMS ambulance checklist assistant. Complete the checklist item.
Input: "${text}"
Context: ambulance equipment, oxygen, medications, bandages, monitors, stretchers, bags, gloves, splints.
Rules:
- ALWAYS provide a completion even for a single letter. Examples: "O" → "xygen Cylinder", "G" → "auze 4x4", "4" → "x4 Gauze Pads"
- Return ONLY the text that follows what the user typed. Do NOT repeat their input.
- Maximum 4 words. No quotes, no markdown.`

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: prompt,
      config: { maxOutputTokens: 15, temperature: 0.2 }
    })

    const rawText = response.candidates?.[0]?.content?.parts?.[0]?.text
      || (response as any).text
      || ''

    let suggestion = rawText.trim()
      .replace(/^["'`]/, '').replace(/["'`]$/, '').replace(/\.$/, '').trim()

    // Strip if AI accidentally repeated the input prefix
    const lowerText = text.toLowerCase()
    if (suggestion.toLowerCase().startsWith(lowerText)) {
      suggestion = suggestion.slice(text.length).trimStart()
    }

    if (suggestion) {
      return NextResponse.json({ suggestion, source: 'ai' })
    }
  } catch (error: any) {
    const msg = error?.message || ''
    if (!msg.includes('429') && !msg.includes('RESOURCE_EXHAUSTED')) {
      console.error('AI Suggest Error:', msg)
    }
    // fall through to dictionary
  }

  // 2. Fallback: local EMS dictionary (instant, no API call)
  const dictSuggestion = getDictionarySuggestion(text)
  return NextResponse.json({ suggestion: dictSuggestion, source: 'dictionary' })
}
