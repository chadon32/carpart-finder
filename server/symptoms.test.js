import test from 'node:test'
import assert from 'node:assert/strict'
import { diagnoseSymptom } from './symptoms.js'

const top = (text) => diagnoseSymptom(text)[0]?.id ?? null
const systems = (text) => diagnoseSymptom(text).map((match) => match.system)

// "Stop" in these descriptions means the car is stopped, not that the brakes
// are being used. The first match on a shaking car at a red light used to be
// warped brake rotors, which sent an engine problem to the brake aisle.
test('shaking while stopped at a light is an engine problem, not a brake problem', () => {
  for (const text of [
    'car shakes when I stop at a light and the check engine light is on',
    'shakes when stopped at a red light',
    'my car vibrates when I am stopped at the stoplight',
    'shaking at a stop sign with the engine running',
  ]) {
    assert.equal(top(text), 'idle-vibration', text)
    assert.ok(!systems(text).includes('Brakes'), `${text} should not suggest brake parts`)
  }
})

test('a flashing check-engine light with shaking points to an active misfire', () => {
  for (const text of [
    'check engine light flashing and car shakes',
    'my check engine light is blinking and the car is shaking',
    'engine light is flashing',
    'flashing check engine light',
  ]) {
    assert.equal(top(text), 'misfire-rough', text)
  }
  const [match] = diagnoseSymptom('check engine light flashing and car shakes')
  assert.ok(match.safety, 'an active misfire carries a safety note')
})

test('braking descriptions still reach the brake entries', () => {
  assert.equal(top('steering wheel shakes when I brake'), 'brake-vibration')
  assert.equal(top('pulsing brake pedal when stopping'), 'brake-vibration')
  assert.equal(top('vibration when braking'), 'brake-vibration')
  assert.equal(top('grinding noise when I press the brake pedal'), 'brake-grinding')
})

test('a bare check-engine light is not turned into a guess', () => {
  assert.deepEqual(diagnoseSymptom('check engine light is on'), [])
})
