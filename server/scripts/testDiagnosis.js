/**
 * Regression suite for the symptom → parts diagnostic engine.
 *
 * Run with:  node server/scripts/testDiagnosis.js   (or `npm run test:diagnose`)
 *
 * No test framework needed — this imports the pure matcher directly and
 * asserts on results, so it's fast and dependency-free. Each case pins a
 * natural-language phrase to the expected top-match entry id (or explicit
 * NO_MATCH), guarding against keyword collisions and recall regressions as the
 * 140-entry knowledge base grows.
 */
import { diagnoseSymptom } from '../symptoms.js'

const NO_MATCH = Symbol('NO_MATCH')

// [phrase, expected top-match id | NO_MATCH]
const CASES = [
  // --- core happy paths ---
  ['white smoke coming out my exhaust', 'white-smoke'],
  ['blue smoke from the tailpipe', 'blue-smoke'],
  ['black smoke when I accelerate', 'black-smoke'],
  ['grinding noise when I press the brake pedal', 'brake-grinding'],
  ['brakes squealing', 'brake-squeal'],
  ['pulsing brake pedal when stopping', 'brake-vibration'],
  ['brake pedal goes to the floor', 'brake-soft-pedal'],
  ['car pulls to one side when braking', 'brake-pulling'],
  ['car pulls to the left on the highway', 'pull-while-driving'],
  ['clicking when I turn', 'click-turning'],
  ['humming that gets louder with speed', 'hum-speed'],
  ['engine overheating', 'overheating'],
  ['coolant leaking on the ground', 'coolant-leak'],
  ['oil spots under my car', 'oil-leak'],
  ['my engine runs really rough', 'misfire-rough'],
  ['rough idle', 'misfire-rough'],
  ['wont start just rapid clicking', 'no-start-clicking'],
  ['ac blowing warm', 'ac-warm'],
  ['no air coming from the vents', 'blower-dead'],
  ['heater blows cold air', 'no-heat'],
  ['power window wont go up', 'window-stuck'],
  ['wipers streaking', 'wiper-streak'],
  ['headlight is out', 'headlight-out'],
  ['clutch is slipping', 'clutch-slipping'],
  ['transmission slips and revs but wont accelerate', 'trans-slipping'],
  ['car jerks when it changes gears', 'trans-hard-shift'],
  ['rotten egg smell from the exhaust', 'rotten-egg'],
  ['inner edge of my tires is bald', 'uneven-tire-wear'],
  ['whining noise when I turn the steering wheel', 'steering-whine'],
  ['steering wheel is really hard to turn', 'hard-steering'],

  // --- the false-positive fix: gas/accelerator pedal must NOT hit brakes ---
  ['gas pedal vibration 40mph', NO_MATCH],
  ['accelerator pedal vibrates', 'wheel-vibration-speed'],
  ['vibration at highway speed', 'wheel-vibration-speed'],
  ['my car shakes at 65 mph', 'wheel-vibration-speed'],

  // --- vague / junk must NOT produce a confident (mis)diagnosis ---
  ['my car is making a weird noise', NO_MATCH],
  ['something smells bad', NO_MATCH],
  ['noise', NO_MATCH],
  ['engine', NO_MATCH],
  ['hello world this is not a car problem', NO_MATCH],
  ['', NO_MATCH],
]

let passed = 0
const failures = []

for (const [phrase, expected] of CASES) {
  const matches = diagnoseSymptom(phrase)
  const topId = matches[0]?.id ?? null

  const ok = expected === NO_MATCH ? matches.length === 0 : topId === expected
  if (ok) {
    passed += 1
  } else {
    failures.push({
      phrase,
      expected: expected === NO_MATCH ? 'NO_MATCH' : expected,
      got: topId ? `${topId} [${matches[0].confidence}]` : 'NO_MATCH',
    })
  }
}

console.log(`\nDiagnosis regression: ${passed}/${CASES.length} passed`)
if (failures.length > 0) {
  console.error(`\n${failures.length} FAILURE(S):`)
  for (const f of failures) {
    console.error(`  "${f.phrase}"\n     expected: ${f.expected}\n     got:      ${f.got}`)
  }
  process.exit(1)
}
console.log('All diagnosis cases passed.\n')
