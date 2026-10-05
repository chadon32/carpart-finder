import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import test from 'node:test'
import { ownerSetupArgs, ownerEnvironmentCommand } from './configure-owner-access.mjs'

test('owner setup requires an explicit email and linked project directory, never a password argument', () => {
  assert.equal(
    ownerSetupArgs(['--email', ' OWNER@example.test ', '--project-dir', '.']).email,
    'owner@example.test',
  )
  for (const args of [
    [],
    ['--email', 'broken', '--project-dir', '.'],
    ['--password', 'do-not-pass-secrets'],
    ['--email', 'owner@example.test'],
    ['--project-dir', '.', '--email', 'owner@example.test', '--email', 'other@example.test'],
  ])
    assert.throws(() => ownerSetupArgs(args))
})

test('production setup is scoped to CarPartsRadar and secrets never appear in CLI arguments', () => {
  const project = { projectName: 'carpart-finder', projectId: 'prj_fixture123' }
  const args = ownerEnvironmentCommand(project, 'OWNER_PASSWORD_HASH')
  assert.ok(args.includes('--sensitive'))
  assert.ok(args.includes('production'))
  assert.equal(args.includes('--force'), false)
  assert.equal(args.includes('--value'), false)
  assert.ok(ownerEnvironmentCommand(project, 'OWNER_EMAIL').includes('--no-sensitive'))
  assert.throws(() =>
    ownerEnvironmentCommand({ ...project, projectName: 'another-project' }, 'OWNER_EMAIL'),
  )
  assert.throws(() => ownerEnvironmentCommand(project, 'SUPABASE_SERVICE_ROLE_KEY'))
})

test('non-interactive setup refuses before reading a project or making external writes', () => {
  const result = spawnSync(
    process.execPath,
    [
      'scripts/configure-owner-access.mjs',
      '--email',
      'owner@example.test',
      '--project-dir',
      'missing-project',
    ],
    { encoding: 'utf8' },
  )
  assert.equal(result.status, 1)
  assert.match(result.stderr, /private interactive terminal/)
  assert.equal(result.stdout, '')
})
