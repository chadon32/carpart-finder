// Regenerates PWA PNG icons from public/icon.svg. Run: node scripts/generate-icons.mjs
import sharp from 'sharp'
import { mkdir } from 'node:fs/promises'

await mkdir('public/icons', { recursive: true })

const outputs = [
  ['public/icons/icon-192.png', 192],
  ['public/icons/icon-512.png', 512],
  ['public/icons/maskable-512.png', 512],
  ['public/apple-touch-icon.png', 180],
]

for (const [file, size] of outputs) {
  await sharp('public/icon.svg', { density: 300 }).resize(size, size).png().toFile(file)
  console.log(`wrote ${file} (${size}x${size})`)
}
