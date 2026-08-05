import { GoogleGenerativeAI } from '@google/generative-ai'
import { verifyFitmentProof } from '../lib/fitmentProof.js'

const apiKey = process.env.GEMINI_API_KEY
// Using the older sdk that was already in the project for consistency
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null

const clamp = (value) => String(value ?? '').replace(/[\r\n]+/g, ' ').trim().slice(0, 60)

export function buildRepairGuidePrompt({ year, make, model, trim, part }) {
  const vehicleInfo = `${clamp(year)} ${clamp(make)} ${clamp(model)} ${trim ? clamp(trim) : ''}`.trim()
  const safePart = clamp(part)

  return `You are an automotive repair information assistant. A user wants to replace the "${safePart}" on their ${vehicleInfo}.
Provide a cautious step-by-step overview for replacing this part.

Format your response in Markdown with the following sections:
1. **Difficulty & Time:** Estimated difficulty (1-10) and a broad time range.
2. **Tools Required:** A bulleted list of tools commonly needed.
3. **Safety Warnings:** Critical precautions and when a qualified technician is the safer choice.
4. **Step-by-Step Overview:** Clear, numbered removal and installation stages.
5. **Verification:** Checks the user should perform before driving.
6. **Pro Tips:** One or two practical tips.

Safety rules:
- Do not provide or guess numeric torque specifications, fluid capacities, pressure values, alignment values, lift points, or other vehicle-specific service specifications. The application has not supplied an authoritative service manual.
- Wherever an exact specification is required, say to obtain it from the manufacturer service manual for the exact VIN/trim before proceeding.
- Do not present diagnosis, part fitment, or the procedure as confirmed.
- For brakes, steering, airbags, high-voltage systems, fuel systems, or structural work, clearly advise professional help when the user lacks the proper training or equipment.
- Never invent a source, service bulletin, specification, or tool requirement.

Be concise and practical. Do not include pleasantries or conversational filler.`
}

export async function generateRepairGuide(req, res) {
  const { year, make, model, trim, part, listingId, source, fitmentProof } = req.body

  if (!year || !make || !model || !part || !listingId || !source || !fitmentProof) {
    return res.status(400).json({ error: 'A verified vehicle and listing are required for repair guidance.' })
  }

  if (!verifyFitmentProof(fitmentProof, {
    listingId,
    year,
    make,
    model,
    trim: trim || '',
    part,
    source,
  })) {
    return res.status(409).json({
      error: 'This listing is not currently verified for the selected vehicle. Choose a verified marketplace match before generating a guide.',
    })
  }

  if (!genAI) {
    return res.status(503).json({ error: 'The AI guide is temporarily unavailable. Please try again later.' })
  }

  const prompt = buildRepairGuidePrompt({ year, make, model, trim, part })

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
