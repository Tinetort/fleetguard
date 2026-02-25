import { analyzeDamage } from './src/lib/ai'

async function testAI() {
  console.log('Testing Gemini API...')
  const result = await analyzeDamage('broken mirror')
  console.log('Result:', result)
}

testAI()
