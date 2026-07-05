/**
 * Symptom → likely parts knowledge base.
 *
 * Deliberately rule-based (curated keyword matching), not an LLM: results are
 * deterministic, instant, free, and every entry was written from commonly
 * documented failure patterns. The UI presents these as "common causes", never
 * as a definitive diagnosis.
 *
 * Matching: each entry has keyword groups. A group counts (once) if ANY of its
 * terms appears in the text (word-prefix match, so "grind" hits "grinding").
 * The entry's score is the sum of matched group weights; entries scoring at
 * least MIN_SCORE are returned, best first, capped at MAX_MATCHES.
 */

const MIN_SCORE = 5
const MAX_MATCHES = 3

/** @typedef {{ name: string, why: string, priority: 'likely' | 'possible' }} SymptomPart */

const SYMPTOMS = [
  {
    id: 'brake-grinding',
    title: 'Worn brake pads (metal-on-metal)',
    system: 'Brakes',
    summary:
      'A metallic grinding or scraping noise when braking usually means the pad friction material is gone and the metal backing plate is cutting into the rotor.',
    safety: 'Braking is safety-critical — have this inspected and fixed as soon as possible.',
    keywords: [
      { terms: ['grind', 'scrape', 'scraping', 'metal on metal', 'metallic'], weight: 4 },
      { terms: ['brake', 'braking', 'pedal', 'stop', 'stopping', 'slow down'], weight: 3 },
      { terms: ['noise', 'sound', 'squeal', 'screech'], weight: 1 },
    ],
    parts: [
      { name: 'Brake Pads', why: 'Grinding almost always means the pad material is fully worn.', priority: 'likely' },
      { name: 'Brake Rotors', why: 'Metal-on-metal contact typically scores the rotor surface, so pads and rotors are usually replaced together.', priority: 'likely' },
      { name: 'Brake Hardware Kit', why: 'Worn clips and shims are cheap to replace while the brakes are apart.', priority: 'possible' },
    ],
  },
  {
    id: 'brake-squeal',
    title: 'Brake pads near end of life (wear indicator squeal)',
    system: 'Brakes',
    summary:
      'A high-pitched squeal when braking is usually the built-in wear indicator tab contacting the rotor — the pads are telling you they are almost done.',
    safety: 'Not an emergency yet, but plan to replace the pads soon before it becomes grinding.',
    keywords: [
      { terms: ['squeal', 'squeak', 'screech', 'high pitched', 'high-pitched'], weight: 4 },
      { terms: ['brake', 'braking', 'pedal', 'stop', 'stopping'], weight: 3 },
    ],
    parts: [
      { name: 'Brake Pads', why: 'The wear-indicator squeal means the friction material is nearly used up.', priority: 'likely' },
      { name: 'Brake Rotors', why: 'Worth measuring — replace if below minimum thickness or scored.', priority: 'possible' },
    ],
  },
  {
    id: 'brake-vibration',
    title: 'Warped or unevenly worn brake rotors',
    system: 'Brakes',
    summary:
      'A pulsing brake pedal or steering-wheel shake when braking usually points to uneven rotor thickness (often called "warped" rotors).',
    safety: 'Increases stopping distance — worth fixing promptly.',
    keywords: [
      { terms: ['shake', 'shakes', 'shaking', 'shudder', 'vibrat', 'pulsat', 'pulsing', 'wobble'], weight: 4 },
      { terms: ['brake', 'braking', 'pedal', 'stop', 'stopping'], weight: 3 },
      { terms: ['steering wheel'], weight: 1 },
    ],
    parts: [
      { name: 'Brake Rotors', why: 'Uneven rotor thickness is the usual cause of brake pulsation.', priority: 'likely' },
      { name: 'Brake Pads', why: 'New rotors should always get new pads for proper bedding.', priority: 'likely' },
    ],
  },
  {
    id: 'brake-soft-pedal',
    title: 'Soft or sinking brake pedal',
    system: 'Brakes',
    summary:
      'A spongy pedal or one that slowly sinks to the floor usually means air or moisture in the brake fluid, a fluid leak, or a failing master cylinder.',
    safety: 'Serious safety issue — do not drive until the brake system is inspected.',
    keywords: [
      { terms: ['soft', 'spongy', 'mushy', 'sinks', 'sinking', 'to the floor', 'goes down'], weight: 4 },
      { terms: ['brake', 'pedal'], weight: 3 },
    ],
    parts: [
      { name: 'Brake Master Cylinder', why: 'A sinking pedal with no visible leak is the classic master cylinder failure.', priority: 'likely' },
      { name: 'Brake Fluid', why: 'Old or contaminated fluid causes sponginess; the system needs a flush either way.', priority: 'likely' },
      { name: 'Brake Caliper', why: 'A leaking caliper piston seal can also drop pedal pressure.', priority: 'possible' },
    ],
  },
  {
    id: 'brake-pulling',
    title: 'Vehicle pulls to one side when braking',
    system: 'Brakes',
    summary:
      'Pulling left or right under braking usually means one brake caliper is sticking or one side\'s pads are worn far more than the other.',
    safety: 'Affects control in hard stops — inspect soon.',
    keywords: [
      { terms: ['pull', 'pulls', 'pulling', 'veers', 'veer', 'drifts to'], weight: 4 },
      { terms: ['brake', 'braking', 'stop', 'stopping'], weight: 3 },
    ],
    parts: [
      { name: 'Brake Caliper', why: 'A seized caliper piston or slide pin makes one wheel brake harder than the other.', priority: 'likely' },
      { name: 'Brake Pads', why: 'Uneven pad wear side-to-side causes the same pull.', priority: 'possible' },
    ],
  },
  {
    id: 'no-start-clicking',
    title: 'Rapid clicking, engine won\'t start',
    system: 'Electrical',
    summary:
      'Rapid clicking when you turn the key with no crank almost always means the battery can\'t deliver enough current — a weak/dead battery, corroded terminals, or a failing starter.',
    keywords: [
      { terms: ['click', 'clicking', 'clicks'], weight: 4 },
      { terms: ['start', 'starting', "won't start", 'wont start', 'turn over', 'crank', 'no start'], weight: 3 },
      { terms: ['dead', 'battery'], weight: 1 },
    ],
    parts: [
      { name: 'Battery', why: 'The single most common cause — especially if the battery is over 4 years old.', priority: 'likely' },
      { name: 'Starter', why: 'A single loud click (rather than rapid clicking) points at the starter solenoid.', priority: 'possible' },
      { name: 'Alternator', why: 'If the battery keeps dying, the alternator may not be recharging it.', priority: 'possible' },
    ],
  },
  {
    id: 'crank-no-start',
    title: 'Engine cranks but won\'t fire up',
    system: 'Engine',
    summary:
      'If the starter spins the engine normally but it never catches, the engine is missing fuel or spark — commonly a failing fuel pump, or worn ignition components.',
    keywords: [
      { terms: ['crank', 'cranks', 'cranking', 'turns over'], weight: 4 },
      { terms: ["won't start", 'wont start', 'no start', "doesn't start", 'doesnt start', 'not start', "won't fire", 'wont fire'], weight: 3 },
    ],
    parts: [
      { name: 'Fuel Pump', why: 'No fuel pressure is the most common crank-no-start on higher-mileage cars.', priority: 'likely' },
      { name: 'Spark Plugs', why: 'Badly fouled plugs can prevent starting, especially in cold weather.', priority: 'possible' },
      { name: 'Ignition Coil', why: 'Failed coils cut spark to the cylinders they serve.', priority: 'possible' },
    ],
  },
  {
    id: 'belt-squeal',
    title: 'Squealing from the engine bay (belt slip)',
    system: 'Engine',
    summary:
      'A squeal or chirp at startup or during acceleration — especially in cold or wet weather — usually means a glazed/worn serpentine belt or a weak tensioner.',
    keywords: [
      { terms: ['squeal', 'squealing', 'chirp', 'chirping', 'screech'], weight: 4 },
      { terms: ['start', 'startup', 'starting', 'cold', 'morning', 'accelerat', 'engine', 'hood', 'rev'], weight: 3 },
    ],
    parts: [
      { name: 'Serpentine Belt', why: 'Glazed or cracked belts slip on the pulleys and squeal under load.', priority: 'likely' },
      { name: 'Belt Tensioner', why: 'A weak tensioner lets even a good belt slip; often replaced together.', priority: 'possible' },
    ],
  },
  {
    id: 'overheating',
    title: 'Engine overheating',
    system: 'Cooling',
    summary:
      'A climbing temperature gauge, steam, or a hot-engine warning most commonly traces to a stuck thermostat, low/old coolant, or a failing water pump or radiator.',
    safety: 'Stop driving when the gauge climbs — continued overheating can destroy the engine.',
    keywords: [
      { terms: ['overheat', 'overheating', 'temperature gauge', 'temp gauge', 'steam', 'running hot', 'coolant', 'radiator'], weight: 5 },
    ],
    parts: [
      { name: 'Thermostat', why: 'A thermostat stuck closed is the cheapest and most common overheating cause.', priority: 'likely' },
      { name: 'Coolant', why: 'Low or degraded coolant can\'t carry heat away properly.', priority: 'likely' },
      { name: 'Water Pump', why: 'A worn impeller or leaking pump stops coolant circulation.', priority: 'possible' },
      { name: 'Radiator', why: 'Clogged or leaking radiators can\'t shed heat at speed or idle.', priority: 'possible' },
    ],
  },
  {
    id: 'clunk-bumps',
    title: 'Clunking or knocking over bumps',
    system: 'Suspension',
    summary:
      'A clunk, knock, or rattle over bumps and potholes most often comes from worn sway bar end links or control-arm bushings.',
    keywords: [
      { terms: ['clunk', 'clunking', 'knock', 'knocking', 'rattle', 'rattling', 'bang', 'banging'], weight: 4 },
      { terms: ['bump', 'bumps', 'pothole', 'rough road', 'uneven', 'speed bump', 'driveway'], weight: 3 },
      { terms: ['front', 'suspension'], weight: 1 },
    ],
    parts: [
      { name: 'Sway Bar End Links', why: 'The most common source of suspension clunks — cheap and quick to replace.', priority: 'likely' },
      { name: 'Control Arm', why: 'Worn bushings or ball joints in the control arm knock over bumps.', priority: 'possible' },
      { name: 'Shocks and Struts', why: 'Worn strut mounts also clunk, especially when turning over bumps.', priority: 'possible' },
    ],
  },
  {
    id: 'bouncy-ride',
    title: 'Bouncy, floaty ride or nose-diving when braking',
    system: 'Suspension',
    summary:
      'Excessive bouncing after bumps, a floaty highway feel, or nose-dive under braking means the shocks or struts are no longer damping the springs.',
    keywords: [
      { terms: ['bounce', 'bouncy', 'bouncing', 'nose dive', 'nosedive', 'nose-dive', 'floaty', 'floating', 'sways', 'body roll'], weight: 5 },
      { terms: ['bump', 'road', 'ride', 'highway'], weight: 1 },
    ],
    parts: [
      { name: 'Shocks and Struts', why: 'Worn dampers are the direct cause of a bouncy, poorly controlled ride.', priority: 'likely' },
    ],
  },
  {
    id: 'hum-speed',
    title: 'Humming or growling that rises with speed',
    system: 'Wheels & Axles',
    summary:
      'A hum, growl, or drone that gets louder with vehicle speed (and often changes when you swerve gently) is the classic sign of a worn wheel bearing.',
    keywords: [
      { terms: ['hum', 'humming', 'growl', 'growling', 'drone', 'droning', 'roar', 'roaring'], weight: 4 },
      { terms: ['speed', 'faster', 'highway', 'mph', 'accelerat'], weight: 3 },
      { terms: ['wheel', 'tire'], weight: 1 },
    ],
    parts: [
      { name: 'Wheel Bearing', why: 'The speed-dependent growl that changes with steering input is a textbook bearing symptom.', priority: 'likely' },
      { name: 'Tires', why: 'Cupped or unevenly worn tires make a similar drone — check tread wear pattern first.', priority: 'possible' },
    ],
  },
  {
    id: 'click-turning',
    title: 'Clicking or popping when turning',
    system: 'Wheels & Axles',
    summary:
      'A rhythmic clicking or popping during turns — especially sharp, accelerating turns — is the classic sign of a worn CV axle joint with a torn boot.',
    keywords: [
      { terms: ['click', 'clicking', 'pop', 'popping'], weight: 4 },
      { terms: ['turning', 'turns', 'corner', 'cornering', 'steering'], weight: 3 },
    ],
    parts: [
      { name: 'CV Axle', why: 'A clicking outer CV joint means the axle assembly needs replacement.', priority: 'likely' },
    ],
  },
  {
    id: 'loose-steering',
    title: 'Loose, wandering steering',
    system: 'Steering',
    summary:
      'Play in the steering wheel or a car that wanders and needs constant correction usually points to worn tie rod ends or ball joints.',
    safety: 'Worn steering linkage can fail suddenly — have it inspected soon.',
    keywords: [
      { terms: ['loose', 'wander', 'wandering', 'sloppy', 'play in', 'vague', 'drifts'], weight: 4 },
      { terms: ['steering', 'steer', 'wheel', 'lane'], weight: 3 },
    ],
    parts: [
      { name: 'Tie Rod Ends', why: 'The most common wear item behind steering play; alignment needed after replacement.', priority: 'likely' },
      { name: 'Ball Joint', why: 'Worn ball joints cause wander and clunks; check with the wheel off the ground.', priority: 'possible' },
      { name: 'Control Arm', why: 'Deteriorated bushings let the wheel shift under load.', priority: 'possible' },
    ],
  },
  {
    id: 'misfire-rough',
    title: 'Engine misfire / rough running',
    system: 'Engine',
    summary:
      'Rough idle, stumbling, hesitation on acceleration, or a flashing check-engine light typically means one or more cylinders are misfiring — most often spark plugs or ignition coils.',
    safety: 'A flashing check-engine light means an active misfire — avoid hard driving until fixed to protect the catalytic converter.',
    keywords: [
      { terms: ['misfire', 'misfiring', 'rough idle', 'idles rough', 'sputter', 'stumble', 'stumbling', 'hesitat', 'jerk', 'jerking', 'shudder', 'stalls', 'stalling'], weight: 5 },
      { terms: ['check engine', 'idle', 'accelerat', 'engine'], weight: 1 },
    ],
    parts: [
      { name: 'Spark Plugs', why: 'Worn plugs are the most common misfire cause and cheap to replace.', priority: 'likely' },
      { name: 'Ignition Coil', why: 'A failed coil kills its cylinder entirely; often found by swapping coils between cylinders.', priority: 'likely' },
      { name: 'Air Filter', why: 'A badly clogged filter leans out the mixture and worsens rough running.', priority: 'possible' },
      { name: 'Mass Air Flow Sensor', why: 'A dirty MAF skews the fuel mixture and causes hesitation.', priority: 'possible' },
    ],
  },
  {
    id: 'charging-issue',
    title: 'Charging system failure (battery light / dimming lights)',
    system: 'Electrical',
    summary:
      'A battery warning light, dimming or flickering lights, or a car that dies while driving points to the charging system — usually the alternator.',
    keywords: [
      { terms: ['battery light', 'alternator', 'dim', 'dimming', 'flicker', 'flickering', 'dies while driving', 'died while driving'], weight: 5 },
      { terms: ['lights', 'dash', 'headlights'], weight: 1 },
    ],
    parts: [
      { name: 'Alternator', why: 'The alternator powers the car and recharges the battery while driving.', priority: 'likely' },
      { name: 'Battery', why: 'Repeated deep discharge from a bad alternator often ruins the battery too.', priority: 'possible' },
      { name: 'Serpentine Belt', why: 'A slipping belt underdrives the alternator and mimics its failure.', priority: 'possible' },
    ],
  },
  {
    id: 'ac-warm',
    title: 'A/C blowing warm',
    system: 'Climate',
    summary:
      'Weak or warm A/C is most often just low refrigerant (a recharge, not a part) — but a failed compressor or clogged cabin filter are the common part-level causes.',
    keywords: [
      { terms: ['ac', 'a/c', 'air conditioning', 'air conditioner'], weight: 4 },
      { terms: ['warm', 'hot', 'not cold', 'not blowing cold', 'weak', 'barely'], weight: 3 },
    ],
    parts: [
      { name: 'AC Compressor', why: 'If the compressor clutch never engages, the system can\'t make cold air.', priority: 'possible' },
      { name: 'Cabin Air Filter', why: 'A clogged filter chokes airflow so even cold air feels weak.', priority: 'possible' },
    ],
  },
  {
    id: 'exhaust-loud',
    title: 'Loud exhaust / rumbling',
    system: 'Exhaust',
    summary:
      'A suddenly loud exhaust, rumble, or roar under the car usually means a rusted-through muffler, pipe, or a failed exhaust gasket.',
    keywords: [
      { terms: ['exhaust', 'muffler', 'tailpipe'], weight: 4 },
      { terms: ['loud', 'louder', 'noise', 'roar', 'rumble', 'rumbling', 'leak'], weight: 3 },
    ],
    parts: [
      { name: 'Muffler', why: 'Mufflers rust from the inside out and are the usual source of sudden exhaust noise.', priority: 'likely' },
      { name: 'Exhaust Gasket', why: 'A blown flange gasket leaks and ticks/roars, especially when cold.', priority: 'possible' },
    ],
  },
  {
    id: 'rotten-egg',
    title: 'Rotten egg (sulfur) smell',
    system: 'Exhaust',
    summary:
      'A rotten-egg smell from the exhaust means unburned sulfur compounds are getting through — typically a failing catalytic converter, sometimes triggered by a bad oxygen sensor.',
    keywords: [
      { terms: ['rotten egg', 'sulfur', 'sulphur', 'egg smell', 'eggs'], weight: 5 },
      { terms: ['smell', 'odor', 'stink'], weight: 1 },
    ],
    parts: [
      { name: 'Catalytic Converter', why: 'A worn-out catalyst can no longer process sulfur compounds.', priority: 'likely' },
      { name: 'Oxygen Sensor', why: 'A bad O2 sensor richens the mixture and can overwhelm a good converter.', priority: 'possible' },
    ],
  },
  {
    id: 'wiper-streak',
    title: 'Wipers streaking or chattering',
    system: 'Visibility',
    summary: 'Streaks, skipped patches, or chatter across the windshield mean the wiper blade rubber is worn or hardened.',
    keywords: [
      { terms: ['wiper', 'wipers', 'windshield'], weight: 4 },
      { terms: ['streak', 'streaking', 'chatter', 'chattering', 'skip', 'skipping', 'smear', 'smearing', 'squeak'], weight: 3 },
    ],
    parts: [
      { name: 'Windshield Wipers', why: 'Blades are consumables — replace roughly once a year.', priority: 'likely' },
    ],
  },
  {
    id: 'headlight-out',
    title: 'Headlight not working',
    system: 'Visibility',
    summary: 'One dead low or high beam is almost always a burned-out bulb; both sides at once points to a fuse or switch instead.',
    keywords: [
      { terms: ['headlight', 'head light', 'low beam', 'high beam'], weight: 4 },
      { terms: ['out', 'dead', 'not working', 'burned', 'burnt', 'stopped working', 'dim'], weight: 3 },
    ],
    parts: [
      { name: 'Headlight Bulb', why: 'Bulbs have a finite life; replace in pairs so brightness matches.', priority: 'likely' },
    ],
  },
]

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function groupMatches(text, group) {
  return group.terms.some((term) => new RegExp(`\\b${escapeRegex(term)}`, 'i').test(text))
}

/**
 * Match a free-text problem description against the knowledge base.
 * Returns up to MAX_MATCHES entries scoring >= MIN_SCORE, best first.
 */
export function diagnoseSymptom(text) {
  const t = String(text || '').toLowerCase().slice(0, 600)
  if (!t.trim()) return []

  return SYMPTOMS.map((entry) => {
    const score = entry.keywords.reduce(
      (sum, group) => (groupMatches(t, group) ? sum + group.weight : sum),
      0
    )
    return { entry, score }
  })
    .filter(({ score }) => score >= MIN_SCORE)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_MATCHES)
    .map(({ entry, score }) => ({
      id: entry.id,
      title: entry.title,
      system: entry.system,
      summary: entry.summary,
      safety: entry.safety || null,
      score,
      parts: entry.parts,
    }))
}
