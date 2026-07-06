import { GoogleGenerativeAI } from '@google/generative-ai'

const apiKey = process.env.GEMINI_API_KEY
// Using the older sdk that was already in the project for consistency
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null

export async function generateRepairGuide(req, res) {
  if (!genAI) {
    return res.status(500).json({ error: 'GEMINI_API_KEY is not configured in the server environment.' })
  }

  const { year, make, model, trim, part } = req.body

  if (!year || !make || !model || !part) {
    return res.status(400).json({ error: 'Missing required vehicle or part information.' })
  }

  // Cap each field so an oversized/garbage body can't bloat the prompt (cost)
  // or be used to smuggle a long instruction into the model.
  const clamp = (v) => String(v).replace(/[\r\n]+/g, ' ').trim().slice(0, 60)
  const vehicleInfo = `${clamp(year)} ${clamp(make)} ${clamp(model)} ${trim ? clamp(trim) : ''}`.trim()
  const safePart = clamp(part)
  const prompt = `You are a master mechanic. A user wants to replace the "${safePart}" on their ${vehicleInfo}.
Provide a step-by-step repair guide for replacing this part.

Format your response in Markdown with the following sections:
1. **Difficulty & Time:** Estimated difficulty (1-10) and time required.
2. **Tools Required:** A bulleted list of tools needed.
3. **Safety Warnings:** Any critical safety precautions.
4. **Step-by-Step Instructions:** Clear, numbered steps for removal and installation.
5. **Pro Tips:** One or two mechanic tips to make the job easier or avoid common mistakes.

Be concise, practical, and highly specific to automotive repair. Do not include pleasantries or conversational filler.`

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })
    const result = await model.generateContent(prompt)
    const response = await result.response
    const text = response.text()
    
    res.json({ guide: text })
  } catch (err) {
    console.error('Error generating repair guide:', err?.message)
    // 503 + friendly copy: almost always a transient Gemini quota/availability
    // issue, not a client error. The UI can offer a retry.
    res.status(503).json({ error: 'The AI guide is temporarily unavailable. Please try again in a few minutes.' })
  }
}
