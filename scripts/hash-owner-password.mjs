import { emitKeypressEvents } from 'node:readline'
import { hashOwnerPassword } from '../server/lib/ownerAuth.js'

if (!process.stdin.isTTY) {
  console.error('Run this command in an interactive terminal. Passwords are read without echo.')
  process.exitCode = 1
} else {
  emitKeypressEvents(process.stdin)
  process.stdout.write('New owner password (12+ characters, input hidden): ')
  process.stdin.setRawMode(true)
  process.stdin.resume()
  let password = ''
  process.stdin.on('keypress', async (character, key) => {
    if (key.ctrl && key.name === 'c') {
      process.stdin.setRawMode(false)
      process.stdout.write('\n')
      process.exit(1)
    }
    if (key.name === 'return' || key.name === 'enter') {
      process.stdin.setRawMode(false)
      process.stdin.pause()
      process.stdin.removeAllListeners('keypress')
      process.stdout.write('\n')
      try {
        const hash = await hashOwnerPassword(password)
        password = ''
        process.stdout.write(`OWNER_PASSWORD_HASH=${hash}\n`)
      } catch (error) {
        password = ''
        console.error(error.message)
        process.exitCode = 1
      }
    } else if (key.name === 'backspace') password = password.slice(0, -1)
    else if (character && !key.ctrl && !key.meta && password.length < 256) password += character
  })
}
