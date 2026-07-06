import fs from 'fs'
import path from 'path'
import { GoogleGenerativeAI } from '@google/generative-ai'
import 'dotenv/config'

const leavesPath = path.resolve(process.cwd(), 'leaves.json')
const leaves = JSON.parse(fs.readFileSync(leavesPath, 'utf8'))

const commonParts = [
  'Brake Pads', 'Brake Rotors', 'Brake Calipers', 'Brake Shoes', 'Brake Drums', 'Master Cylinder',
  'Oil Filter', 'Air Filter', 'Cabin Air Filter', 'Fuel Filter', 'Transmission Filter',
  'Tires', 'Wheels', 'Battery', 'Spark Plugs', 'Ignition Coil', 'Spark Plug Wires',
  'Alternator', 'Starter', 'Radiator', 'Water Pump', 'Thermostat', 'Cooling Fan',
  'Timing Belt', 'Timing Chain', 'Serpentine Belt', 'Drive Belt Tensioner',
  'Headlight Bulb', 'Tail Light Bulb', 'Fog Light', 'Turn Signal Assembly',
  'Windshield Wipers', 'Wiper Motor', 'Washer Fluid Pump',
  'Shocks and Struts', 'Coil Springs', 'Control Arm', 'Ball Joint', 'Tie Rod Ends', 'Sway Bar Links',
  'CV Axle', 'Drive Shaft', 'Wheel Bearing', 'Hub Assembly',
  'Fuel Pump', 'Fuel Injector', 'Oxygen Sensor', 'Mass Air Flow Sensor', 'Throttle Body',
  'Catalytic Converter', 'Muffler', 'Exhaust Manifold',
  'Side Mirror', 'Rear View Mirror', 'Window Regulator', 'Door Handle',
  'Engine Mount', 'Transmission Mount', 'Oil Pan', 'Valve Cover Gasket', 'Head Gasket',
  'AC Compressor', 'AC Condenser', 'Heater Core', 'Blower Motor'
]

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

async function run() {
  console.log('Generating mappings for ' + commonParts.length + ' parts...')
  
  const prompt = `
  You are an automotive data expert mapping car parts to official eBay category IDs.
  Here are some of the available eBay Leaf Categories (ID - Name):
  ${leaves.map(l => l.id + ' - ' + l.name).join('\n')}
  
  Given the following common car parts, output a JSON object mapping each part name to the most specific matching eBay Category ID from the list above. If a specific category doesn't exist, use the closest parent or a related category. DO NOT make up IDs. Only use IDs from the provided list.
  
  Format exactly as a valid JSON object:
  {
    "Brake Pads": "57357",
    ...
  }
  
  Parts to map:
  ${commonParts.join(', ')}
  `
  
  const result = await model.generateContent(prompt)
  let text = result.response.text()
  
  // Clean up markdown fences if present
  if (text.includes('\`\`\`json')) {
    text = text.split('\`\`\`json')[1].split('\`\`\`')[0]
  } else if (text.includes('\`\`\`')) {
    text = text.split('\`\`\`')[1].split('\`\`\`')[0]
  }
  
  const mapping = JSON.parse(text.trim())
  fs.writeFileSync('generated_mappings.json', JSON.stringify(mapping, null, 2))
  console.log('Successfully wrote generated_mappings.json with ' + Object.keys(mapping).length + ' mappings.')
}

run().catch(console.error)
