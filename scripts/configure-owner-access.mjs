import { spawn, execFileSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { emitKeypressEvents } from 'node:readline'
import { fileURLToPath } from 'node:url'
import { hashOwnerPassword } from '../server/lib/ownerAuth.js'

export function ownerSetupArgs(argv) {
  const options = {}
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index]
    const value = argv[index + 1]
    if (
      !['--email', '--project-dir'].includes(key) ||
      !value ||
      value.startsWith('--') ||
      options[key]
    )
      throw new Error(
        'Usage: npm run owner:configure -- --email EMAIL --project-dir LINKED_PROJECT_DIRECTORY',
      )
    options[key] = value
  }
  const email = (options['--email'] || '').trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || !options['--project-dir'])
    throw new Error(
      'Provide the owner email and the existing linked CarPartsRadar project directory.',
    )
  return { email, projectDir: resolve(options['--project-dir']) }
}

export function ownerEnvironmentCommand(project, name) {
  if (project.projectName !== 'carpart-finder' || !/^prj_[A-Za-z0-9]+$/.test(project.projectId))
    throw new Error(
      'Refusing to configure a project other than the linked carpart-finder deployment.',
    )
  if (
    ![
      'OWNER_EMAIL',
      'OWNER_PASSWORD_HASH',
      'OWNER_SESSION_SECRET',
      'ANALYTICS_HASH_SECRET',
      'TRUST_PROXY_HOPS',
    ].includes(name)
  )
    throw new Error('Not an owner analytics environment variable.')
  return [
    'env',
    'add',
    name,
    'production',
    '--project',
    project.projectId,
    '--yes',
    '--non-interactive',
    name.endsWith('_SECRET') || name.endsWith('_HASH') ? '--sensitive' : '--no-sensitive',
  ]
}

function vercelCliPath() {
  let globalRoot
  if (process.env.npm_execpath) {
    globalRoot = execFileSync(process.execPath, [process.env.npm_execpath, 'root', '-g'], {
      encoding: 'utf8',
      timeout: 10_000,
      windowsHide: true,
    }).trim()
  } else if (process.platform === 'win32' && process.env.APPDATA) {
    globalRoot = join(process.env.APPDATA, 'npm', 'node_modules')
  }
  if (!globalRoot)
    throw new Error('Run through npm with the official Vercel CLI installed globally.')
  const packageDir = join(globalRoot, 'vercel')
  const metadata = JSON.parse(readFileSync(join(packageDir, 'package.json'), 'utf8'))
  const cli = resolve(packageDir, metadata.bin.vercel)
  if (metadata.name !== 'vercel' || !existsSync(cli))
    throw new Error('The official Vercel CLI was not found.')
  return cli
}

function hiddenPassword(prompt) {
  return new Promise((resolvePassword, reject) => {
    let value = ''
    process.stdout.write(prompt)
    process.stdin.setRawMode(true)
    process.stdin.resume()
    const finish = () => {
      process.stdin.removeListener('keypress', onKey)
      process.stdin.setRawMode(false)
      process.stdin.pause()
      process.stdout.write('\n')
    }
    function onKey(character, key) {
      if (key.ctrl && key.name === 'c') {
        value = ''
        finish()
        reject(new Error('Setup cancelled. No credentials were submitted.'))
      } else if (key.name === 'return' || key.name === 'enter') {
        finish()
        resolvePassword(value)
        value = ''
      } else if (key.name === 'backspace') value = [...value].slice(0, -1).join('')
      else if (character && !key.ctrl && !key.meta && Buffer.byteLength(value + character) <= 256)
        value += character
    }
    process.stdin.on('keypress', onKey)
  })
}

async function addEnvironment(cli, projectDir, project, name, value) {
  await new Promise((resolveAdded, reject) => {
    // Values travel over stdin, never shell interpolation, command arguments, or logs.
    const child = spawn(process.execPath, [cli, ...ownerEnvironmentCommand(project, name)], {
      cwd: projectDir,
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    })
    const timer = setTimeout(() => {
      child.kill()
      reject(
        new Error(
          `Saving ${name} timed out. Check Vercel before retrying; it may have been saved.`,
        ),
      )
    }, 30_000)
    child.stdout.resume()
    child.stderr.resume()
    child.stdin.on('error', () => {})
    child.on('error', () => {
      clearTimeout(timer)
      reject(new Error(`Could not run Vercel to save ${name}.`))
    })
    child.on('exit', (code) => {
      clearTimeout(timer)
      if (code === 0) resolveAdded()
      else
        reject(
          new Error(
            `Could not add ${name}. Check Vercel access and existing variables. Nothing is overwritten automatically.`,
          ),
        )
    })
    child.stdin.end(`${value}\n`)
  })
  console.log(`Saved ${name} for CarPartsRadar production.`)
}

async function main() {
  const { email, projectDir } = ownerSetupArgs(process.argv.slice(2))
  if (!process.stdin.isTTY)
    throw new Error(
      'Use a private interactive terminal. Password input is hidden and is never logged.',
    )
  const project = JSON.parse(readFileSync(join(projectDir, '.vercel', 'project.json'), 'utf8'))
  ownerEnvironmentCommand(project, 'OWNER_EMAIL')
  const cli = vercelCliPath()
  console.log(
    `Configure owner analytics for ${project.projectName} (${project.projectId}) in Vercel production.`,
  )
  console.log(
    'No code is deployed. Existing variables will not be overwritten. Password input is hidden.',
  )
  emitKeypressEvents(process.stdin)
  let password = await hiddenPassword(
    'Enter the password you want to use for this owner dashboard: ',
  )
  let confirmation = await hiddenPassword('Enter the same password again: ')
  if (password !== confirmation)
    throw new Error('Passwords did not match. No credentials were submitted.')
  confirmation = ''
  const passwordHash = await hashOwnerPassword(password)
  password = ''
  const values = {
    OWNER_SESSION_SECRET: randomBytes(32).toString('base64url'),
    OWNER_PASSWORD_HASH: passwordHash,
    OWNER_EMAIL: email,
    ANALYTICS_HASH_SECRET: randomBytes(32).toString('base64url'),
    TRUST_PROXY_HOPS: '1',
  }
  for (const [name, value] of Object.entries(values))
    await addEnvironment(cli, projectDir, project, name, value)
  console.log(
    'Owner access configuration saved. Deploy the reviewed web and API code after applying the analytics migration.',
  )
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    await main()
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
