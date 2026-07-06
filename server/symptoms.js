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
      { terms: ['click', 'clicking', 'clicks', 'pop', 'popping', 'clunk'], weight: 4 },
      { terms: ['turn', 'turning', 'turns', 'corner', 'cornering', 'steering'], weight: 3 },
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
      { terms: ['misfire', 'misfiring', 'rough idle', 'idles rough', 'sputter', 'sputtering', 'stumble', 'stumbling', 'hesitat', 'shudder', 'bogs down'], weight: 5 },
      { terms: ['rough', 'roughly', 'poorly', 'badly', 'missing'], weight: 2 },
      { terms: ['check engine', 'idle', 'engine', 'runs', 'running', 'motor', 'accelerat'], weight: 3 },
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

  // ---- Exhaust smoke ----
  {
    id: 'white-smoke',
    title: 'White smoke from the exhaust (coolant burning)',
    system: 'Engine',
    summary:
      'Thick white smoke that lingers and smells sweet usually means coolant is entering the combustion chamber — most often a blown head gasket, sometimes a cracked head or block.',
    safety: 'Keep an eye on the temperature gauge — a head gasket leak can overheat and destroy the engine. Have it checked promptly.',
    keywords: [
      { terms: ['white smoke', 'white exhaust', 'sweet smoke', 'steam from exhaust', 'coolant smoke'], weight: 5 },
      { terms: ['smoke', 'smoking', 'exhaust', 'tailpipe', 'coolant', 'losing coolant', 'sweet smell'], weight: 2 },
    ],
    parts: [
      { name: 'Head Gasket', why: 'A blown head gasket letting coolant into the cylinders is the classic cause of sweet white smoke.', priority: 'likely' },
      { name: 'Coolant', why: 'You will need coolant to refill and to test for combustion gases in the system.', priority: 'possible' },
      { name: 'Thermostat', why: 'Overheating from a stuck thermostat can cause the gasket failure in the first place — worth checking.', priority: 'possible' },
    ],
  },
  {
    id: 'blue-smoke',
    title: 'Blue/grey smoke from the exhaust (burning oil)',
    system: 'Engine',
    summary:
      'Blue-tinged smoke means engine oil is being burned in the cylinders — commonly worn valve stem seals, worn piston rings, or a stuck PCV valve.',
    keywords: [
      { terms: ['blue smoke', 'grey smoke', 'gray smoke', 'burning oil', 'oil smoke', 'burning oil smell'], weight: 5 },
      { terms: ['smoke', 'smoking', 'exhaust', 'tailpipe', 'oil'], weight: 2 },
    ],
    parts: [
      { name: 'PCV Valve', why: 'A stuck PCV valve is the cheapest, most common cause of light oil burning — check it first.', priority: 'likely' },
      { name: 'Valve Cover Gasket', why: 'Leaking seals let oil into places it burns off; often replaced together.', priority: 'possible' },
      { name: 'Oil Filter', why: 'A fresh oil and filter change is worthwhile while diagnosing consumption.', priority: 'possible' },
    ],
  },
  {
    id: 'black-smoke',
    title: 'Black smoke from the exhaust (running rich)',
    system: 'Engine',
    summary:
      'Black smoke means the engine is burning too much fuel. Common causes are a clogged air filter, a dirty mass airflow sensor, or a leaking fuel injector.',
    keywords: [
      { terms: ['black smoke', 'dark smoke', 'sooty', 'running rich', 'too much fuel'], weight: 5 },
      { terms: ['smoke', 'smoking', 'exhaust', 'tailpipe'], weight: 2 },
    ],
    parts: [
      { name: 'Air Filter', why: 'A clogged air filter chokes airflow and richens the mixture — cheapest thing to rule out.', priority: 'likely' },
      { name: 'Mass Air Flow Sensor', why: 'A dirty or faulty MAF over-reports air and dumps in extra fuel.', priority: 'possible' },
      { name: 'Fuel Injector', why: 'A leaking or stuck-open injector floods a cylinder with fuel.', priority: 'possible' },
    ],
  },

  // ---- Leaks & smells ----
  {
    id: 'oil-leak',
    title: 'Oil leak / oil spots under the car',
    system: 'Engine',
    summary:
      'Dark brown or black spots under the engine are an oil leak — most often a leaking valve cover gasket or oil pan gasket, sometimes the front/rear main seal.',
    keywords: [
      { terms: ['oil leak', 'oil spot', 'oil drip', 'leaking oil', 'oil puddle', 'oil under', 'dripping oil'], weight: 5 },
      { terms: ['leak', 'drip', 'puddle', 'spot', 'stain', 'oil'], weight: 2 },
    ],
    parts: [
      { name: 'Valve Cover Gasket', why: 'The most common upper-engine oil leak, and an inexpensive fix.', priority: 'likely' },
      { name: 'Oil Pan Gasket', why: 'A leaking pan gasket drips from the lowest point of the engine.', priority: 'possible' },
      { name: 'Oil Filter', why: 'A loose or old filter (or its seal) is an easy source to rule out.', priority: 'possible' },
    ],
  },
  {
    id: 'coolant-leak',
    title: 'Coolant leak / green or orange puddle',
    system: 'Cooling',
    summary:
      'A bright green, orange, or pink puddle with a sweet smell is coolant. Usual sources are a cracked radiator, a split hose, or a failing water pump.',
    safety: 'Low coolant leads to overheating — top up and fix the leak before driving far.',
    keywords: [
      { terms: ['coolant leak', 'antifreeze', 'green puddle', 'orange puddle', 'pink fluid', 'sweet smell', 'losing coolant', 'coolant puddle'], weight: 5 },
      { terms: ['leak', 'puddle', 'drip', 'coolant', 'radiator', 'overheat'], weight: 2 },
    ],
    parts: [
      { name: 'Radiator Hose', why: 'Hoses harden and split with age — the cheapest and most common coolant leak.', priority: 'likely' },
      { name: 'Radiator', why: 'Plastic end-tanks and seams crack over time and weep coolant.', priority: 'possible' },
      { name: 'Water Pump', why: 'A weeping pump shaft seal leaves coolant behind the timing cover area.', priority: 'possible' },
    ],
  },
  {
    id: 'gas-smell',
    title: 'Strong gasoline smell',
    system: 'Fuel',
    summary:
      'A persistent raw fuel smell points to a leak in the fuel system — a cracked fuel line or hose, leaking injector seals, or (mildly) a loose gas cap.',
    safety: 'A fuel leak is a fire risk. Avoid driving until the source is found and fixed.',
    keywords: [
      { terms: ['gas smell', 'gasoline smell', 'fuel smell', 'smell of gas', 'petrol smell', 'fuel leak'], weight: 5 },
      { terms: ['smell', 'odor', 'leak', 'fuel', 'gas'], weight: 1 },
    ],
    parts: [
      { name: 'Fuel Line', why: 'Cracked rubber fuel hoses are a common source of a raw-gas smell.', priority: 'likely' },
      { name: 'Gas Cap', why: 'A worn or loose cap lets vapors escape — the cheapest thing to rule out.', priority: 'possible' },
      { name: 'Fuel Injector', why: 'Leaking injector O-rings weep fuel onto a hot engine.', priority: 'possible' },
    ],
  },
  {
    id: 'burning-smell',
    title: 'Burning smell while driving',
    system: 'Engine',
    summary:
      'A hot, burning smell can be oil dripping onto the exhaust, a slipping drive belt, or overheating brakes. The exact smell narrows it down — oily, rubbery, or hot-metal.',
    keywords: [
      { terms: ['burning smell', 'burning rubber', 'hot smell', 'smells like burning', 'acrid smell'], weight: 5 },
      { terms: ['smell', 'odor', 'burning', 'smoke'], weight: 1 },
    ],
    parts: [
      { name: 'Serpentine Belt', why: 'A slipping or misaligned belt smells like hot rubber.', priority: 'possible' },
      { name: 'Valve Cover Gasket', why: 'Oil leaking onto the hot exhaust manifold makes an acrid burning-oil smell.', priority: 'possible' },
      { name: 'Brake Pads', why: 'A dragging brake or riding the pedal overheats the pads and smells hot.', priority: 'possible' },
    ],
  },

  // ---- Running / performance ----
  {
    id: 'stalling-idle',
    title: 'Engine stalls or idles roughly and dies',
    system: 'Engine',
    summary:
      'An engine that idles unevenly and stalls — especially at stops — is often a dirty throttle body, a failing idle air control valve, or a vacuum leak.',
    keywords: [
      { terms: ['stall', 'stalls', 'stalling', 'dies at idle', 'shuts off', 'cuts out', 'dies when stopped'], weight: 5 },
      { terms: ['idle', 'idling', 'rough', 'stop', 'stops'], weight: 1 },
    ],
    parts: [
      { name: 'Throttle Body', why: 'Carbon buildup on the throttle body upsets idle and causes stalling; cleaning or replacement helps.', priority: 'likely' },
      { name: 'Idle Air Control Valve', why: 'A sticking IAC can\'t hold a steady idle, so the engine dies at stops.', priority: 'possible' },
      { name: 'Mass Air Flow Sensor', why: 'A dirty MAF skews the idle mixture and causes stalling.', priority: 'possible' },
    ],
  },
  {
    id: 'hard-start-cold',
    title: 'Hard to start, especially when cold',
    system: 'Engine',
    summary:
      'Long cranking before the engine catches — worse in the cold — often points to worn spark plugs, a weak battery, or a fuel-delivery problem.',
    keywords: [
      { terms: ['hard to start', 'hard start', 'takes a while to start', 'long crank', 'slow to start', 'wont start when cold', 'hard starting'], weight: 5 },
      { terms: ['start', 'starting', 'crank', 'cold', 'morning'], weight: 1 },
    ],
    parts: [
      { name: 'Spark Plugs', why: 'Worn plugs make cold starts drag; the cheapest tune-up item to renew.', priority: 'likely' },
      { name: 'Battery', why: 'A weak battery cranks slowly in the cold, dragging out starts.', priority: 'possible' },
      { name: 'Fuel Pump', why: 'A weak pump that bleeds down overnight causes long first-start cranking.', priority: 'possible' },
    ],
  },
  {
    id: 'knocking-accel',
    title: 'Knocking or pinging under acceleration',
    system: 'Engine',
    summary:
      'A metallic pinging or knocking when you accelerate hard is often pre-ignition ("spark knock") — commonly fouled spark plugs, carbon buildup, or a bad knock sensor.',
    keywords: [
      { terms: ['knock', 'knocking', 'ping', 'pinging', 'pinking', 'detonation', 'rattling under acceleration', 'spark knock'], weight: 5 },
      { terms: ['accelerat', 'acceleration', 'engine', 'load', 'hill'], weight: 1 },
    ],
    parts: [
      { name: 'Spark Plugs', why: 'Wrong or worn plugs are a frequent cause of spark knock.', priority: 'likely' },
      { name: 'Ignition Coil', why: 'A weak coil causes misfire-like knock under load.', priority: 'possible' },
      { name: 'Oxygen Sensor', why: 'A lazy O2 sensor leans the mixture and promotes detonation.', priority: 'possible' },
    ],
  },
  {
    id: 'engine-ticking',
    title: 'Ticking or tapping noise from the engine',
    system: 'Engine',
    summary:
      'A rhythmic tick that speeds up with RPM is often a valvetrain noise — low oil, a worn hydraulic lifter, or an exhaust manifold leak that ticks when cold.',
    keywords: [
      { terms: ['tick', 'ticking', 'tapping', 'clatter', 'lifter noise', 'valve tick'], weight: 5 },
      { terms: ['engine', 'top end', 'rpm', 'cold', 'noise'], weight: 1 },
    ],
    parts: [
      { name: 'Oil Filter', why: 'Low or dirty oil is the first thing to fix — a fresh oil and filter change often quiets lifters.', priority: 'likely' },
      { name: 'Exhaust Gasket', why: 'A leaking manifold gasket ticks loudest on a cold start.', priority: 'possible' },
    ],
  },
  {
    id: 'poor-mpg',
    title: 'Poor fuel economy / gas mileage dropped',
    system: 'Engine',
    summary:
      'A sudden drop in MPG usually traces to a worn sensor or clogged filter making the engine run inefficiently — commonly the oxygen sensor, air filter, or spark plugs.',
    keywords: [
      { terms: ['bad gas mileage', 'poor mpg', 'poor fuel economy', 'using more gas', 'mpg dropped', 'gas mileage', 'burning more fuel', 'worse mileage'], weight: 5 },
      { terms: ['fuel', 'gas', 'economy', 'mileage', 'efficiency'], weight: 1 },
    ],
    parts: [
      { name: 'Oxygen Sensor', why: 'A lazy O2 sensor is the #1 cause of a gradual MPG drop.', priority: 'likely' },
      { name: 'Air Filter', why: 'A clogged filter makes the engine work harder — cheap to renew.', priority: 'possible' },
      { name: 'Spark Plugs', why: 'Worn plugs waste fuel through weak combustion.', priority: 'possible' },
    ],
  },
  {
    id: 'idle-vibration',
    title: 'Vibration or shaking at idle',
    system: 'Engine',
    summary:
      'If the car shakes at a stop but smooths out while driving, the usual causes are a broken engine/transmission mount or a cylinder misfire.',
    keywords: [
      { terms: ['shake', 'shakes', 'shaking', 'vibrat', 'shudder', 'rough'], weight: 3 },
      { terms: ['idle', 'idling', 'stopped', 'parked', 'neutral', 'stop light', 'at a stop', 'when stopped', 'in park'], weight: 3 },
    ],
    parts: [
      { name: 'Motor Mount', why: 'A collapsed engine mount lets normal engine shake reach the cabin at idle.', priority: 'likely' },
      { name: 'Spark Plugs', why: 'A misfire is worst at idle; fresh plugs are the cheapest first step.', priority: 'possible' },
      { name: 'Ignition Coil', why: 'A failing coil causes an idle-shaking misfire on one cylinder.', priority: 'possible' },
    ],
  },

  // ---- Steering & suspension ----
  {
    id: 'steering-whine',
    title: 'Whining noise when turning the wheel',
    system: 'Steering',
    summary:
      'A whine or groan that rises as you turn — loudest at full lock — is the classic sign of low power-steering fluid or a failing power-steering pump.',
    keywords: [
      { terms: ['whine', 'whining', 'groan', 'groaning', 'moan when turning', 'noise when turning wheel'], weight: 5 },
      { terms: ['steering', 'turn', 'turning', 'wheel', 'power steering'], weight: 2 },
    ],
    parts: [
      { name: 'Power Steering Fluid', why: 'Low or old fluid is the cheapest, most common cause of steering whine.', priority: 'likely' },
      { name: 'Power Steering Pump', why: 'A worn pump whines under load and eventually fails.', priority: 'possible' },
    ],
  },
  {
    id: 'hard-steering',
    title: 'Steering feels heavy or stiff',
    system: 'Steering',
    summary:
      'If the wheel is hard to turn, especially at low speed, the power-steering system is usually at fault — low fluid, a failing pump, or a slipping belt.',
    keywords: [
      { terms: ['hard to steer', 'stiff steering', 'heavy steering', 'hard to turn', 'tough to turn', 'difficult to turn', 'steering is stiff', 'wont turn easily'], weight: 4 },
      { terms: ['steering', 'steer', 'turn', 'turning', 'wheel', 'power steering'], weight: 2 },
    ],
    parts: [
      { name: 'Power Steering Fluid', why: 'Low fluid is the first and cheapest thing to check for heavy steering.', priority: 'likely' },
      { name: 'Power Steering Pump', why: 'A failing pump can\'t provide enough assist, making the wheel heavy.', priority: 'possible' },
      { name: 'Serpentine Belt', why: 'A slipping belt underdrives the PS pump and mimics its failure.', priority: 'possible' },
    ],
  },
  {
    id: 'suspension-squeak',
    title: 'Squeaking or creaking suspension',
    system: 'Suspension',
    summary:
      'Creaks and squeaks over bumps or when turning at low speed usually come from dry or worn suspension bushings and ball joints.',
    keywords: [
      { terms: ['squeak', 'squeaking', 'creak', 'creaking', 'squeaky suspension', 'groaning over bumps'], weight: 5 },
      { terms: ['suspension', 'bump', 'turning', 'front end', 'low speed'], weight: 1 },
    ],
    parts: [
      { name: 'Control Arm', why: 'Worn control-arm bushings are a common source of suspension creaks.', priority: 'likely' },
      { name: 'Ball Joint', why: 'Dry or worn ball joints squeak as the suspension moves.', priority: 'possible' },
      { name: 'Sway Bar End Links', why: 'Worn end-link bushings creak over bumps and turns.', priority: 'possible' },
    ],
  },
  {
    id: 'pull-while-driving',
    title: 'Car pulls to one side while driving',
    system: 'Steering',
    summary:
      'Drifting to one side on a straight, level road usually means the alignment is off or tire pressures are uneven; worn suspension parts can also cause it.',
    keywords: [
      { terms: ['pull', 'pulls', 'pulling', 'drifts', 'drift', 'veers', 'veer', 'wanders', 'wander'], weight: 4 },
      { terms: ['left', 'right', 'one side', 'to the side', 'sideways'], weight: 2 },
      { terms: ['driving', 'straight', 'road', 'highway', 'alignment', 'freeway'], weight: 2 },
    ],
    parts: [
      { name: 'Tie Rod Ends', why: 'Worn tie rods throw off alignment and cause pulling; alignment needed after replacement.', priority: 'possible' },
      { name: 'Control Arm', why: 'Worn control-arm bushings shift alignment under load and cause a pull.', priority: 'possible' },
      { name: 'Tires', why: 'Uneven wear or pressure between sides is the simplest cause to rule out.', priority: 'possible' },
    ],
  },
  {
    id: 'uneven-tire-wear',
    title: 'Uneven or rapid tire wear',
    system: 'Suspension',
    summary:
      'Tires wearing more on one edge, or cupping, point to an alignment problem or worn suspension components like struts, tie rods, or control-arm bushings.',
    keywords: [
      { terms: ['uneven tire wear', 'tires wearing', 'inner edge', 'outer edge', 'cupping', 'cupped', 'feathering', 'bald', 'worn unevenly', 'scalloped'], weight: 4 },
      { terms: ['tire', 'tires', 'tread', 'wear', 'edge'], weight: 2 },
    ],
    parts: [
      { name: 'Tie Rod Ends', why: 'Worn tie rods cause toe misalignment and edge wear.', priority: 'likely' },
      { name: 'Shocks and Struts', why: 'Worn struts let the tire bounce, causing cupped/scalloped wear.', priority: 'possible' },
      { name: 'Tires', why: 'Badly worn tires need replacing regardless once the cause is fixed.', priority: 'possible' },
    ],
  },
  {
    id: 'sagging-corner',
    title: 'Car sits low on one corner',
    system: 'Suspension',
    summary:
      'A corner that sits noticeably lower usually means a broken coil spring or a collapsed strut/shock on that wheel.',
    keywords: [
      { terms: ['sits low', 'sagging', 'leans to one side', 'one corner low', 'broken spring', 'lower on one side'], weight: 5 },
      { terms: ['spring', 'strut', 'suspension', 'corner', 'ride height'], weight: 1 },
    ],
    parts: [
      { name: 'Shocks and Struts', why: 'A collapsed strut assembly (with spring) drops ride height on that corner.', priority: 'likely' },
      { name: 'Coil Spring', why: 'A cracked or broken coil spring lets that corner sag.', priority: 'possible' },
    ],
  },

  // ---- Transmission & drivetrain ----
  {
    id: 'trans-slipping',
    title: 'Transmission slipping / revs but slow to move',
    system: 'Transmission',
    summary:
      'If the engine revs climb but the car doesn\'t accelerate to match, an automatic transmission is slipping — most often low or burnt transmission fluid.',
    safety: 'Driving on a slipping transmission accelerates damage — address it soon.',
    keywords: [
      { terms: ['slipping', 'transmission slips', 'revs but', 'rpm climb', 'wont accelerate', 'gears slip', 'slips out of gear'], weight: 5 },
      { terms: ['transmission', 'gear', 'shift', 'automatic', 'accelerat'], weight: 1 },
    ],
    parts: [
      { name: 'Transmission Fluid', why: 'Low or degraded fluid is the leading cause of slipping — check and service first.', priority: 'likely' },
      { name: 'Transmission Filter', why: 'A clogged filter starves the transmission of fluid pressure.', priority: 'possible' },
    ],
  },
  {
    id: 'trans-hard-shift',
    title: 'Rough, jerky, or delayed shifting',
    system: 'Transmission',
    summary:
      'Harsh clunks, jerks, or a delay when the automatic changes gear are often caused by low/old transmission fluid or a worn transmission mount.',
    keywords: [
      { terms: ['hard shift', 'jerky shift', 'rough shifting', 'clunks into gear', 'delayed shift', 'bangs into gear', 'shifts hard', 'jerks when shifting', 'jerks when changing', 'changes gear', 'changing gear'], weight: 5 },
      { terms: ['jerk', 'jerks', 'jerky', 'clunk'], weight: 2 },
      { terms: ['transmission', 'gear', 'gears', 'shift', 'shifting', 'automatic', 'changing'], weight: 2 },
    ],
    parts: [
      { name: 'Transmission Fluid', why: 'Fresh fluid often restores smooth shifts on a neglected transmission.', priority: 'likely' },
      { name: 'Motor Mount', why: 'A broken transmission/engine mount turns normal shifts into hard clunks.', priority: 'possible' },
    ],
  },
  {
    id: 'clutch-slipping',
    title: 'Clutch slipping (manual)',
    system: 'Transmission',
    summary:
      'On a manual, if RPM rises without matching acceleration — especially in higher gears or uphill — the clutch is worn and slipping.',
    keywords: [
      { terms: ['clutch'], weight: 4 },
      { terms: ['slip', 'slips', 'slipping', 'worn', 'burning', 'not grabbing', 'wont grab', 'high bite'], weight: 3 },
      { terms: ['manual', 'gear', 'accelerat', 'rpm', 'uphill'], weight: 1 },
    ],
    parts: [
      { name: 'Clutch Kit', why: 'A slipping clutch means the disc is worn — replaced as a kit (disc, pressure plate, bearing).', priority: 'likely' },
    ],
  },

  // ---- Electrical & warning lights ----
  {
    id: 'abs-light',
    title: 'ABS warning light on',
    system: 'Brakes',
    summary:
      'An ABS light usually means one wheel-speed sensor has failed or is dirty. Normal braking still works, but anti-lock and stability control are disabled.',
    keywords: [
      { terms: ['abs light', 'abs warning', 'anti-lock light', 'abs sensor', 'traction control light'], weight: 5 },
      { terms: ['light', 'warning', 'dash', 'sensor'], weight: 1 },
    ],
    parts: [
      { name: 'Wheel Speed Sensor', why: 'A failed or contaminated wheel-speed (ABS) sensor is the most common trigger.', priority: 'likely' },
    ],
  },
  {
    id: 'tpms-light',
    title: 'Tire pressure (TPMS) light on',
    system: 'Wheels & Axles',
    summary:
      'A TPMS light usually just means a tire is low — check and inflate first. If it stays on with correct pressures, a tire-pressure sensor has likely failed (they die around 5–7 years).',
    keywords: [
      { terms: ['tpms', 'tire pressure light', 'low tire pressure', 'pressure warning', 'tire pressure sensor'], weight: 5 },
      { terms: ['tire', 'pressure', 'light', 'warning', 'sensor'], weight: 1 },
    ],
    parts: [
      { name: 'TPMS Sensor', why: 'A dead sensor battery keeps the light on even at correct pressure.', priority: 'possible' },
    ],
  },
  {
    id: 'airbag-light',
    title: 'Airbag / SRS warning light on',
    system: 'Electrical',
    summary:
      'An illuminated airbag light means the system has disabled itself and won\'t deploy. Common causes are a worn clock spring (behind the wheel) or a seat/belt sensor connector.',
    safety: 'With the light on, the airbags may not deploy in a crash. Have it diagnosed soon.',
    keywords: [
      { terms: ['airbag light', 'srs light', 'srs warning', 'supplemental restraint', 'airbag warning'], weight: 5 },
      { terms: ['light', 'warning', 'dash', 'seat'], weight: 1 },
    ],
    parts: [
      { name: 'Clock Spring', why: 'A broken clock spring behind the steering wheel is the classic airbag-light cause.', priority: 'possible' },
    ],
  },
  {
    id: 'slow-crank',
    title: 'Engine cranks slowly when starting',
    system: 'Electrical',
    summary:
      'A sluggish, labored crank — often with dimming lights — is a sign of a weak battery or, less often, corroded terminals or a failing alternator not keeping it charged.',
    keywords: [
      { terms: ['cranks slow', 'slow crank', 'slow to turn over', 'labored start', 'sluggish start', 'barely turns over', 'weak crank'], weight: 5 },
      { terms: ['crank', 'start', 'battery', 'turn over'], weight: 1 },
    ],
    parts: [
      { name: 'Battery', why: 'A weak or aging battery is the overwhelming cause of slow cranking.', priority: 'likely' },
      { name: 'Alternator', why: 'If the battery keeps going flat, the alternator may not be recharging it.', priority: 'possible' },
    ],
  },
  {
    id: 'fuel-gauge',
    title: 'Fuel gauge reads wrong or erratic',
    system: 'Fuel',
    summary:
      'A gauge that sticks, jumps, or reads empty/full incorrectly usually has a failing fuel-level sending unit inside the tank.',
    keywords: [
      { terms: ['fuel gauge', 'gas gauge', 'gauge stuck', 'gauge reads wrong', 'fuel gauge not working', 'gas gauge wrong'], weight: 5 },
      { terms: ['gauge', 'fuel', 'gas', 'tank', 'empty', 'full'], weight: 1 },
    ],
    parts: [
      { name: 'Fuel Pump', why: 'The level sender is part of the in-tank fuel pump assembly on most cars.', priority: 'likely' },
    ],
  },

  // ---- Climate ----
  {
    id: 'ac-musty',
    title: 'A/C smells musty or moldy',
    system: 'Climate',
    summary:
      'A musty, mildew smell when the A/C runs is moisture and mold on the evaporator and cabin air filter. A fresh cabin filter and an evaporator cleaning usually fix it.',
    keywords: [
      { terms: ['musty smell', 'moldy smell', 'mildew smell', 'ac smells', 'smells musty', 'dirty sock smell', 'vent smell'], weight: 5 },
      { terms: ['ac', 'a/c', 'air conditioning', 'vent', 'smell', 'cabin'], weight: 1 },
    ],
    parts: [
      { name: 'Cabin Air Filter', why: 'A dirty, damp cabin filter is the most common and cheapest cause of vent odor.', priority: 'likely' },
    ],
  },
  {
    id: 'no-heat',
    title: 'Heater blows cold / no heat',
    system: 'Climate',
    summary:
      'No warm air (with the engine at temperature) usually means low coolant, a thermostat stuck open, or a clogged heater core.',
    keywords: [
      { terms: ['no heat', 'heater not working', 'blows cold', 'heater blows cold', 'cabin cold', 'no warm air', 'heat not working'], weight: 5 },
      { terms: ['heat', 'heater', 'warm', 'cold', 'winter', 'defrost'], weight: 1 },
    ],
    parts: [
      { name: 'Thermostat', why: 'A thermostat stuck open keeps the engine (and heater) from reaching temperature.', priority: 'likely' },
      { name: 'Coolant', why: 'Low coolant means the heater core has nothing hot to circulate — check level first.', priority: 'possible' },
      { name: 'Heater Core', why: 'A clogged heater core blocks hot coolant from the cabin.', priority: 'possible' },
    ],
  },
  {
    id: 'blower-dead',
    title: 'Fan / blower not blowing air',
    system: 'Climate',
    summary:
      'If little or no air comes from the vents on any setting, the blower motor or its resistor has usually failed (if only some fan speeds work, it\'s the resistor).',
    keywords: [
      { terms: ['no air', 'fan not working', 'blower not working', 'no air blowing', 'blower motor', 'fan wont turn on', 'only high fan works', 'little air', 'weak airflow'], weight: 5 },
      { terms: ['fan', 'blower', 'vent', 'vents', 'air', 'speed'], weight: 1 },
    ],
    parts: [
      { name: 'Blower Motor', why: 'A dead blower motor stops airflow on all speeds.', priority: 'likely' },
      { name: 'Blower Motor Resistor', why: 'If only the highest fan speed works, the resistor is the usual culprit.', priority: 'possible' },
    ],
  },
  {
    id: 'window-stuck',
    title: 'Power window won\'t go up or down',
    system: 'Electrical',
    summary:
      'A power window that\'s dead or moves slowly/crookedly usually has a failed window regulator or window motor (a grinding noise points to the regulator).',
    keywords: [
      { terms: ['window wont go up', 'window wont go down', 'power window', 'window stuck', 'window motor', 'window regulator', 'window off track'], weight: 5 },
      { terms: ['window', 'glass', 'door', 'motor', 'switch'], weight: 1 },
    ],
    parts: [
      { name: 'Window Regulator', why: 'A broken regulator (often with the motor) is the most common power-window failure.', priority: 'likely' },
      { name: 'Window Motor', why: 'A dead motor leaves the window unresponsive even when the regulator is fine.', priority: 'possible' },
    ],
  },

  // ---- Noises under the car ----
  {
    id: 'rattle-under-car',
    title: 'Rattling noise from underneath',
    system: 'Exhaust',
    summary:
      'A rattle from under the car — worst at idle or over bumps — is often a loose exhaust heat shield or a failing exhaust hanger letting a pipe knock around.',
    keywords: [
      { terms: ['rattle', 'rattling', 'rattles'], weight: 3 },
      { terms: ['underneath', 'under the car', 'under car', 'below', 'from under', 'heat shield', 'exhaust'], weight: 3 },
      { terms: ['idle', 'idling', 'metallic'], weight: 1 },
    ],
    parts: [
      { name: 'Heat Shield', why: 'A rusted, loose exhaust heat shield is the most common source of an underbody rattle.', priority: 'likely' },
      { name: 'Muffler', why: 'A broken exhaust hanger or rusted muffler lets the system knock and rattle.', priority: 'possible' },
    ],
  },
  {
    id: 'brake-fluid-leak',
    title: 'Brake fluid leak / clear oily puddle',
    system: 'Brakes',
    summary:
      'A thin, clear-to-amber oily fluid near a wheel or under the master cylinder is brake fluid — from a leaking caliper, wheel cylinder, or brake line. This is serious.',
    safety: 'A brake-fluid leak can cause brake failure. Do not drive until it is repaired.',
    keywords: [
      { terms: ['brake fluid leak', 'brake fluid', 'leaking near wheel', 'clear fluid near tire', 'brake line leak'], weight: 5 },
      { terms: ['leak', 'fluid', 'brake', 'wheel', 'puddle'], weight: 1 },
    ],
    parts: [
      { name: 'Brake Caliper', why: 'A leaking caliper piston seal drips brake fluid at the wheel.', priority: 'likely' },
      { name: 'Brake Line', why: 'A rusted or cracked brake line leaks under pressure — a critical safety fix.', priority: 'possible' },
      { name: 'Brake Fluid', why: 'The system must be refilled and bled after any leak is repaired.', priority: 'possible' },
    ],
  },
  {
    id: 'overheating-idle',
    title: 'Engine overheats at idle or in traffic',
    system: 'Cooling',
    summary:
      'If the engine temperature rises when stopped or in traffic, but drops to normal once you start driving on the highway, it usually means the radiator cooling fan is not spinning or its relay has failed.',
    safety: 'Stop driving if the temperature gauge climbs into the red to avoid severe engine damage.',
    keywords: [
      { terms: ['overheat at idle', 'overheats in traffic', 'hot when stopped', 'hot at stoplight', 'temp rises stopped'], weight: 5 },
      { terms: ['fan not spinning', 'cooling fan', 'radiator fan'], weight: 2 }
    ],
    parts: [
      { name: 'Radiator Fan Assembly', why: 'A dead fan motor won\'t pull air through the radiator when the vehicle is stationary.', priority: 'likely' },
      { name: 'Radiator Fan Relay', why: 'A failed relay prevents the electrical fan from receiving power.', priority: 'possible' },
    ],
  },
  {
    id: 'engine-sluggish',
    title: 'Sluggish acceleration / loss of power',
    system: 'Engine',
    summary:
      'A general loss of power or sluggish response when accelerating can be caused by restricted airflow, a clogged fuel filter, or worn spark plugs.',
    keywords: [
      { terms: ['sluggish', 'loss of power', 'no power', 'slow acceleration', 'feels slow'], weight: 4 },
      { terms: ['accelerat', 'gas pedal', 'press gas'], weight: 2 }
    ],
    parts: [
      { name: 'Air Filter', why: 'A dirty, restricted air filter chokes the engine of oxygen.', priority: 'likely' },
      { name: 'Spark Plugs', why: 'Worn plugs fail to burn fuel efficiently under heavy load.', priority: 'possible' },
      { name: 'Fuel Filter', why: 'A clogged fuel filter starves the fuel injectors of pressure.', priority: 'possible' },
    ],
  },
  {
    id: 'brake-drag',
    title: 'Dragging brake / sticking caliper',
    system: 'Brakes',
    summary:
      'If a brake caliper is sticking, it keeps the pads pressed against the rotor while driving. This causes a hot wheel, a burning smell, and sluggish rolling.',
    safety: 'Excessive heat can boil brake fluid, causing partial or full brake loss. Inspect immediately.',
    keywords: [
      { terms: ['hot wheel', 'sticking brake', 'brake dragging', 'stuck caliper', 'dragging brake'], weight: 5 },
      { terms: ['burning smell', 'smell of burning', 'sluggish roll'], weight: 1 }
    ],
    parts: [
      { name: 'Brake Caliper', why: 'A seized caliper piston or corroded slide pins will fail to retract the pads.', priority: 'likely' },
      { name: 'Brake Hose', why: 'A collapsed rubber brake hose can act as a one-way check valve, keeping caliper pressure locked.', priority: 'possible' },
      { name: 'Brake Pads', why: 'Dragging brakes will glaze and ruin the brake pads.', priority: 'possible' },
    ],
  },
  {
    id: 'clutch-hydraulic-leak',
    title: 'Soft manual clutch pedal / gears grinding',
    system: 'Transmission',
    summary:
      'If a manual transmission won\'t shift into gear with the engine running, or the clutch pedal goes spongy or sinks to the floor, there is likely a leak in the clutch hydraulic system.',
    keywords: [
      { terms: ['clutch pedal soft', 'clutch to floor', 'wont shift manual', 'grinds shifting manual'], weight: 5 },
      { terms: ['spongy clutch', 'clutch fluid', 'gears grinding'], weight: 2 }
    ],
    parts: [
      { name: 'Clutch Slave Cylinder', why: 'Leaking slave cylinders are the most common source of manual clutch hydraulic failures.', priority: 'likely' },
      { name: 'Clutch Master Cylinder', why: 'The master cylinder generates the fluid pressure; internal seals can fail.', priority: 'possible' },
    ],
  },
  {
    id: 'rear-diff-noise',
    title: 'Differential hum or whine',
    system: 'Wheels & Axles',
    summary:
      'A howling, whining, or humming noise coming from the rear axle that changes volume with speed or when coasting usually indicates worn differential gears or low gear oil.',
    keywords: [
      { terms: ['rear noise', 'rear whine', 'diff whine', 'differential hum', 'rear axle roar'], weight: 5 },
      { terms: ['back of car', 'rear end', 'gears howling'], weight: 2 }
    ],
    parts: [
      { name: 'Differential Gear Oil', why: 'Low or degraded gear oil is the leading cause of early differential noise.', priority: 'likely' },
      { name: 'Differential Gasket', why: 'A leaking cover gasket lets fluid drip out, leading to gear damage.', priority: 'possible' },
    ],
  },
  {
    id: 'wiper-fluid-not-working',
    title: 'Windshield washers not spraying',
    system: 'Visibility',
    summary:
      'If washer fluid doesn\'t spray when activated and you hear no pump noise, the washer fluid pump has likely failed or its fuse is blown.',
    keywords: [
      { terms: ['washer fluid', 'washer pump', 'doesnt spray', 'wont spray', 'not spraying washer'], weight: 5 },
      { terms: ['windshield spray', 'wiper spray', 'washers dead'], weight: 2 }
    ],
    parts: [
      { name: 'Windshield Washer Pump', why: 'Electric washer pumps can burn out or seize over time.', priority: 'likely' },
      { name: 'Windshield Wipers', why: 'A good time to inspect and replace wiper blades for clean visibility.', priority: 'possible' },
    ],
  },
  {
    id: 'engine-running-cold',
    title: 'Engine runs cold / heater blows lukewarm',
    system: 'Cooling',
    summary:
      'If the engine takes an unusually long time to warm up, the temperature gauge stays very low, and the cabin heater only blows lukewarm, the thermostat is likely stuck open.',
    keywords: [
      { terms: ['wont warm up', 'takes long to warm', 'runs cold', 'heater lukewarm', 'gauge stays cold'], weight: 5 },
      { terms: ['slow to heat', 'engine cold', 'lukewarm air'], weight: 2 }
    ],
    parts: [
      { name: 'Thermostat', why: 'A thermostat stuck open constantly circulates coolant through the radiator, preventing the engine from reaching operating temp.', priority: 'likely' },
      { name: 'Coolant Temperature Sensor', why: 'A faulty sensor can send an artificially low temperature reading to the dashboard.', priority: 'possible' },
    ],
  },
  {
    id: 'electrical-dead-outlet',
    title: 'Cigarette lighter / 12V outlet not working',
    system: 'Electrical',
    summary:
      'If your phone charger has no power when plugged in, the most common cause is a blown fuse for the accessory power socket.',
    keywords: [
      { terms: ['cigarette lighter', '12v outlet', 'power outlet', 'charger wont work', 'no power charger'], weight: 5 },
      { terms: ['fuse blown', 'blown fuse', 'outlet dead'], weight: 2 }
    ],
    parts: [
      { name: 'Fuses', why: 'Accessories draw high current and frequently blow their respective fuses.', priority: 'likely' },
      { name: '12V Power Outlet', why: 'The metal socket itself can wear out or corrode internally.', priority: 'possible' },
    ],
  },
  {
    id: 'horn-not-working',
    title: 'Horn makes no sound',
    system: 'Electrical',
    summary:
      'If pressing the steering wheel horn button yields no sound, the cause is typically a failed horn unit, a blown fuse, or a broken steering column clock spring.',
    keywords: [
      { terms: ['horn doesnt work', 'horn dead', 'no sound horn', 'horn button'], weight: 5 },
      { terms: ['press steering wheel', 'honk'], weight: 1 }
    ],
    parts: [
      { name: 'Horn', why: 'Horns are exposed to rain/road debris behind the grill and frequently fail.', priority: 'likely' },
      { name: 'Clock Spring', why: 'The ribbon cable behind the airbag transfers the horn electrical signal; it can break with age.', priority: 'possible' },
    ],
  },
  {
    id: 'wheel-vibration-speed',
    title: 'Vibration or shaking at highway speed',
    system: 'Wheels & Axles',
    summary:
      'A steering wheel shake or body vibration that only occurs at high speeds (e.g. 55-70 mph) usually indicates unbalanced tires, out-of-round tires, or loose steering linkage.',
    keywords: [
      { terms: ['vibrates at speed', 'highway shake', 'vibrates 60 mph', 'steering wheel shakes high speed'], weight: 5 },
      { terms: ['highway vibration', 'shaking at 70', 'highway speed'], weight: 2 }
    ],
    parts: [
      { name: 'Tires', why: 'Improper tire balance is the most common cause of speed-specific vibrations.', priority: 'likely' },
      { name: 'Tie Rod Ends', why: 'Play in the tie rod ends lets the wheel flutter at highway speeds.', priority: 'possible' },
    ],
  },
  {
    id: 'engine-oil-warning',
    title: 'Oil pressure warning light on',
    system: 'Engine',
    summary:
      'A red oil can warning icon means the engine lacks oil pressure. Driving with low oil pressure will destroy engine bearings within minutes.',
    safety: 'CRITICAL: Turn off the engine immediately. Do not drive until the oil level is checked and the cause is resolved.',
    keywords: [
      { terms: ['oil light', 'oil pressure light', 'red oil can', 'oil pressure warning'], weight: 5 },
      { terms: ['low oil pressure', 'oil indicator'], weight: 2 }
    ],
    parts: [
      { name: 'Engine Oil', why: 'Checking and topping up low oil is the first critical step.', priority: 'likely' },
      { name: 'Oil Filter', why: 'A collapsed or clogged filter can restrict oil flow.', priority: 'possible' },
      { name: 'Oil Pressure Switch', why: 'A failed pressure sensor can trigger a false warning light on the dashboard.', priority: 'possible' },
    ],
  },
  {
    id: 'hybrid-cooling-fan',
    title: 'Check hybrid system warning / cooling fan noise',
    system: 'Climate',
    summary:
      'A "Check Hybrid System" alert or loud fan noise from the rear seats usually indicates that the hybrid high-voltage battery cooling fan is clogged with dust, pet hair, or debris, causing the battery pack to overheat.',
    safety: 'Driving with an overheated hybrid battery can cause permanent cell degradation or lead to sudden vehicle shutdown.',
    keywords: [
      { terms: ['check hybrid system', 'hybrid light', 'hybrid triangle', 'hybrid system warning'], weight: 5 },
      { terms: ['battery cooling fan', 'hybrid fan noise', 'fan loud rear seat'], weight: 2 }
    ],
    parts: [
      { name: 'Cabin Air Filter', why: 'Often, cleaning or replacing the high-voltage battery intake filter/screen restores proper cooling airflow.', priority: 'likely' },
      { name: 'Blower Motor', why: 'If the cooling fan assembly itself is failing or seizing, it must be replaced.', priority: 'possible' },
    ],
  },
  {
    id: 'ev-12v-battery',
    title: 'EV or Hybrid won\'t start / 12V auxiliary battery failure',
    system: 'Electrical',
    summary:
      'If your hybrid or electric vehicle won\'t turn on (no "READY" light) or displays erratic dashboard warnings, the standard 12-volt auxiliary battery is likely dead or weak. Many hybrid systems rely on the 12V battery to boot the high-voltage computers.',
    keywords: [
      { terms: ['wont start hybrid', 'wont start ev', 'no ready light', 'ready light wont come on', 'hybrid battery dead'], weight: 5 },
      { terms: ['auxiliary battery', '12v hybrid battery', 'ev 12v dead'], weight: 2 }
    ],
    parts: [
      { name: 'Battery', why: 'Standard 12V lead-acid or AGM auxiliary batteries degrade after 3-5 years and are the single most common cause of hybrid starting failures.', priority: 'likely' },
    ],
  },
  {
    id: 'turbo-boost-leak',
    title: 'Hissing or whooshing noise under acceleration (Boost leak)',
    system: 'Engine',
    summary:
      'A loud hissing, whistling, or whooshing sound under acceleration on a turbocharged engine indicates that compressed intake air is escaping through a split intercooler hose, charge pipe, or loose clamp.',
    keywords: [
      { terms: ['hissing accelerate', 'whooshing boost', 'air escaping sound', 'turbo hiss', 'loose clamp sound'], weight: 5 },
      { terms: ['split charge pipe', 'leak under load', 'wind noise acceleration'], weight: 2 }
    ],
    parts: [
      { name: 'Air Filter', why: 'Checking the intake ducting and intercooler hoses for cracks or loose clamps is the first step.', priority: 'likely' },
    ],
  },
  {
    id: 'turbo-wastegate-rattle',
    title: 'Metallic rattle or buzz under deceleration (Wastegate rattle)',
    system: 'Engine',
    summary:
      'A metallic rattling, buzzing, or vibrating noise heard briefly when letting off the throttle or under partial acceleration is commonly "wastegate rattle," caused by wear in the turbocharger\'s internal linkage arm.',
    keywords: [
      { terms: ['wastegate rattle', 'turbo rattle', 'deceleration rattle', 'buzz under deceleration', 'tinny rattle exhaust'], weight: 5 },
      { terms: ['throttle release rattle', 'wastegate play'], weight: 2 }
    ],
    parts: [
      { name: 'Turbocharger Assembly', why: 'Internal linkage wear usually requires rebuilding or replacing the turbocharger housing.', priority: 'likely' },
      { name: 'Turbocharger Wastegate Actuator', why: 'On some applications, an adjustable actuator rod or spring repair kit can resolve the play.', priority: 'possible' },
    ],
  },
  {
    id: 'turbo-oil-seal',
    title: 'Blue/grey smoke under hard acceleration (Leaking turbocharger seals)',
    system: 'Engine',
    summary:
      'Thick blue or grey smoke coming from the exhaust specifically under boost or acceleration indicates that engine oil is bypassing the internal bearings and seals of the turbocharger and burning in the exhaust system.',
    keywords: [
      { terms: ['smoke when accelerate', 'blue smoke acceleration', 'smoke under load', 'turbo burning oil', 'smoke on boost'], weight: 5 },
      { terms: ['exhaust oil smoke', 'oil past turbo'], weight: 2 }
    ],
    parts: [
      { name: 'Turbocharger Assembly', why: 'Leaking internal oil seals require a complete turbocharger replacement or professional rebuild.', priority: 'likely' },
      { name: 'Oil Filter', why: 'A fresh oil and filter change is essential after replacing a turbo to prevent immediate bearing damage.', priority: 'possible' },
    ],
  },
  {
    id: 'egr-stuck',
    title: 'Engine hesitates, surges, or pings (Clogged EGR valve)',
    system: 'Engine',
    summary:
      'An engine that hesitates when accelerating, surges at highway cruising speeds, or produces a metallic pinging sound (spark knock) may have a stuck or carbon-clogged Exhaust Gas Recirculation (EGR) valve.',
    keywords: [
      { terms: ['egr valve', 'engine surges', 'hesitation accelerating', 'egr stuck', 'p0401'], weight: 5 },
      { terms: ['exhaust gas recirculation', 'pinging highway', 'rough cruise'], weight: 2 }
    ],
    parts: [
      { name: 'EGR Valve', why: 'Carbon accumulation prevents the valve pintle from sealing or opening correctly.', priority: 'likely' },
      { name: 'EGR Gasket', why: 'A new sealing gasket is required whenever the EGR valve is removed or replaced.', priority: 'likely' },
    ],
  },
  {
    id: 'evap-purge-valve',
    title: 'Hard starting after refueling / check engine light (Failing EVAP purge valve)',
    system: 'Engine',
    summary:
      'If the engine crank time is long or it stalls immediately after filling up the fuel tank, the EVAP canister purge valve is likely stuck open, allowing raw fuel vapors to flood the intake manifold.',
    keywords: [
      { terms: ['hard start after gas', 'stalls after refueling', 'evap purge', 'purge valve', 'p0442'], weight: 5 },
      { terms: ['hard start gas station', 'evap canister leak'], weight: 2 }
    ],
    parts: [
      { name: 'Vapor Canister Purge Valve', why: 'The solenoid valve can stick open or fail electronically, allowing unmetered vacuum leaks and vapors.', priority: 'likely' },
    ],
  },
  {
    id: 'torque-converter-shudder',
    title: 'Vibration or shudder around 40-60 mph (Torque converter shudder)',
    system: 'Transmission',
    summary:
      'A brief shaking, vibration, or "riding over a rumble strip" sensation that occurs at light throttle when the transmission shifts or locks up (typically between 35 and 60 mph) is torque converter shudder.',
    keywords: [
      { terms: ['rumble strip vibration', 'transmission shudder', 'shudder 40 mph', 'shakes shifting gear', 'shudders under light acceleration'], weight: 5 },
      { terms: ['converter lockup shake', 'automatic transmission vibration'], weight: 2 }
    ],
    parts: [
      { name: 'Transmission Fluid', why: 'Old, depleted automatic transmission fluid (ATF) loses its frictional properties. A fluid exchange often resolves the shudder.', priority: 'likely' },
      { name: 'Transmission Filter', why: 'Replacing the filter ensures clean fluid flow to the transmission control solenoids.', priority: 'possible' },
    ],
  },
  {
    id: 'steering-inner-tie-rod',
    title: 'Clunking when turning wheel / vague steering (Worn inner tie rods)',
    system: 'Steering',
    summary:
      'A knock or clunk heard when turning the steering wheel at a stop, or a vague, loose feeling in the steering while driving, often indicates play in the inner tie rod joints under the steering rack boots.',
    safety: 'Worn tie rods can separate, leading to a complete loss of steering control. Have this inspected immediately.',
    keywords: [
      { terms: ['clunk turning wheel', 'loose steering column', 'inner tie rod', 'play in steering wheel', 'clunking steering'], weight: 5 },
      { terms: ['vague steering wheel', 'steering rack play'], weight: 2 }
    ],
    parts: [
      { name: 'Tie Rod Ends', why: 'Inner and outer tie rod ends work together to translate steering rack movement; replacing them restores steering tightness.', priority: 'likely' },
    ],
  },
  {
    id: 'clogged-catalytic-converter',
    title: 'Severe loss of power / sulfur exhaust smell (Clogged catalytic converter)',
    system: 'Exhaust',
    summary:
      'If your engine struggles to accelerate, won\'t rev past a certain limit, or has a strong sulfur (rotten egg) smell, the catalytic converter may be melted or clogged internally, creating excessive exhaust backpressure.',
    keywords: [
      { terms: ['clogged cat', 'clogged converter', 'clogged catalytic', 'wont rev past', 'lack of power rev'], weight: 5 },
      { terms: ['exhaust restriction', 'exhaust backpressure', 'rotten egg smell'], weight: 2 }
    ],
    parts: [
      { name: 'Catalytic Converter', why: 'A melted or collapsed internal ceramic honeycomb structure must be replaced to restore engine flow.', priority: 'likely' },
      { name: 'Oxygen Sensor', why: 'Faulty upstream sensors often cause the engine to run too rich, which ruins the catalytic converter.', priority: 'possible' },
    ],
  },
  {
    id: 'heater-core-leak',
    title: 'Sweet odor in cabin / greasy defroster fog (Leaking heater core)',
    system: 'Cooling',
    summary:
      'A sweet, syrupy smell inside the vehicle, a greasy, hard-to-clear film on the inside of the windshield when running the defroster, or wet spots in the passenger-side footwell indicates a leaking cabin heater core.',
    keywords: [
      { terms: ['sweet smell in cabin', 'wet passenger carpet', 'windshield fog greasy', 'sweet defroster smell'], weight: 5 },
      { terms: ['leaking heater core', 'heater core leak', 'cabin sweet odor'], weight: 2 }
    ],
    parts: [
      { name: 'Thermostat', why: 'Replacing the heater core involves disconnecting coolant lines; this is a good time to check general coolant loop components.', priority: 'possible' },
    ],
  },
  {
    id: 'engine-mount-wear',
    title: 'Vibration in gear at a stop / clunking (Worn engine mounts)',
    system: 'Engine',
    summary:
      'If the steering wheel or seats shake heavily when the automatic transmission is in "Drive" at a red light, but smooths out in "Neutral" or "Park", the rubber engine mounts are collapsed or torn.',
    keywords: [
      { terms: ['vibrates in drive', 'mount vibration idle', 'clunk gear reverse', 'bad motor mounts'], weight: 5 },
      { terms: ['shaking at red light', 'transmission mount collapsed'], weight: 2 }
    ],
    parts: [
      { name: 'Motor Mount', why: 'Worn or collapsed rubber mounts transfer normal engine vibration directly to the chassis.', priority: 'likely' },
    ],
  },
  {
    id: 'broken-coil-spring',
    title: 'Popping sound when turning wheel / lean (Cracked coil spring)',
    system: 'Suspension',
    summary:
      'A loud metallic pop or clunk when turning the steering wheel at slow speeds (especially when parking) often means a suspension coil spring has cracked or broken near its seat, causing the car to sag on one corner.',
    keywords: [
      { terms: ['broken coil spring', 'cracked spring', 'pop turning steering', 'spring rattle susp'], weight: 5 },
      { terms: ['coil spring snap', 'suspension spring clunk'], weight: 2 }
    ],
    parts: [
      { name: 'Shocks and Struts', why: 'Coil springs are mounted around the struts on modern cars; replacing the spring or the complete strut assembly restores proper ride height and control.', priority: 'likely' },
    ],
  },
  {
    id: 'wheel-hub-assembly-play',
    title: 'Wheel wobbles when jacked up / play (Loose wheel hub)',
    system: 'Wheels & Axles',
    summary:
      'If there is physical play or wiggle when shaking a jacked-up wheel (grabbing it at the top and bottom), the wheel hub assembly bearings have suffered severe wear.',
    safety: 'Severe bearing play can cause the wheel to separate from the vehicle while driving. Inspect and replace immediately.',
    keywords: [
      { terms: ['wheel play wobble', 'hub assembly loose', 'wheel shakes jacked', 'wheel bearing play'], weight: 5 },
      { terms: ['steering wiggle speed', 'play in wheel hub'], weight: 2 }
    ],
    parts: [
      { name: 'Wheel Bearing', why: 'Replacing the complete wheel hub assembly restores a tight wheel mount and silent rolling.', priority: 'likely' },
    ],
  },
  {
    id: 'ac-compressor-clutch-seized',
    title: 'Screech when A/C turns on / stalling (Seized A/C compressor)',
    system: 'Climate',
    summary:
      'A loud screeching sound when activating the A/C, a burning rubber smell, or an engine that bogs down and stalls whenever the climate control is turned on indicates a seized A/C compressor or pulley clutch.',
    keywords: [
      { terms: ['screech when ac turns on', 'ac compressor seized', 'belt burning ac on', 'clutch seized ac'], weight: 5 },
      { terms: ['engine dies when ac on', 'ac belt squeals'], weight: 2 }
    ],
    parts: [
      { name: 'AC Compressor', why: 'A seized compressor locks the accessory belt drive, requiring compressor replacement.', priority: 'likely' },
      { name: 'Serpentine Belt', why: 'A slipping or glazed belt due to compressor seizure must be replaced.', priority: 'likely' },
    ],
  },
  {
    id: 'starter-solenoid-clicking',
    title: 'Single loud click, engine won\'t crank (Worn starter contact)',
    system: 'Electrical',
    summary:
      'If you hear a single loud click when turning the key to start, but the engine does not spin or crank (and the dashboard lights do not dim), the starter motor solenoid contacts are worn or burnt.',
    keywords: [
      { terms: ['single click no start', 'loud click wont crank', 'starter solenoid click', 'click wont turn over'], weight: 5 },
      { terms: ['one click no start', 'starter click lights bright'], weight: 2 }
    ],
    parts: [
      { name: 'Starter', why: 'A worn starter motor or its solenoid must be replaced to restore reliable cranking.', priority: 'likely' },
    ],
  },
  {
    id: 'vacuum-leak',
    title: 'Whistling from engine bay / rough idle (Intake vacuum leak)',
    system: 'Engine',
    summary:
      'A whistling or hissing noise coming from under the hood at idle, accompanied by a rough idle or high idle speed (and lean codes P0171/P0174), indicates an intake vacuum leak.',
    keywords: [
      { terms: ['whistling engine bay', 'whistle under hood', 'high idle speed', 'vacuum leak whistle'], weight: 5 },
      { terms: ['intake gasket leak', 'hissing intake manifold'], weight: 2 }
    ],
    parts: [
      { name: 'Intake Manifold Gasket', why: 'Worn manifold gaskets or cracked vacuum hoses are the primary source of unmetered air leaks.', priority: 'likely' },
      { name: 'Oxygen Sensor', why: 'Vacuum leaks cause lean codes that trigger sensor warnings; replacing the gasket resolves the root issue.', priority: 'possible' },
    ],
  },
  {
    id: 'regen-braking-failure',
    title: 'Spongy brake pedal / reduced range (Regenerative braking fault)',
    system: 'Brakes',
    summary:
      'If your hybrid or EV displays a "Check Regenerative Brakes" or "Brake System" warning light, accompanied by a spongy or soft brake pedal and reduced battery recharge efficiency during deceleration, the regenerative braking system is experiencing a fault.',
    safety: 'Braking performance may be compromised, requiring more physical effort on the friction brakes. Have this diagnosed immediately.',
    keywords: [
      { terms: ['regenerative braking warning', 'check regenerative brakes', 'regen braking fault', 'hybrid brake warning light'], weight: 5 },
      { terms: ['spongy hybrid brake pedal', 'loss of regen charging', 'brake system stop safely'], weight: 2 }
    ],
    parts: [
      { name: 'Brake Pads', why: 'When regen fails, standard friction brakes absorb all energy, leading to rapid wear of pads and rotors.', priority: 'possible' },
      { name: 'Brake Fluid', why: 'Low or contaminated fluid can trigger hydraulic pressure faults in the integrated brake actuator.', priority: 'possible' },
    ],
  },
  {
    id: 'u-joint-wear',
    title: 'Low speed squeak / clunk shifting into gear (Worn universal joint)',
    system: 'Wheels & Axles',
    summary:
      'A rhythmic squeaking or chirping sound from under the vehicle at low speed, or a loud metallic "clunk" when shifting from Park to Drive or Reverse, indicates play or failed bearings inside a driveshaft universal joint (U-joint).',
    safety: 'A completely failed U-joint can cause the driveshaft to separate from the vehicle while driving, resulting in severe damage or loss of control.',
    keywords: [
      { terms: ['u-joint wear', 'driveshaft squeaking', 'clunk shifting drive', 'universal joint noise', 'chirp under car speed'], weight: 5 },
      { terms: ['clunk shifting park', 'driveshaft play clunk'], weight: 2 }
    ],
    parts: [
      { name: 'CV Axle', why: 'U-joints transmit driveshaft torque; replacing worn joints restores smooth rotation and eliminates play.', priority: 'likely' },
    ],
  },
  {
    id: 'timing-belt-wear',
    title: 'Clicking or slapping from front engine cover (Worn timing belt)',
    system: 'Engine',
    summary:
      'A ticking, clicking, or slapping noise coming from behind the front plastic timing cover suggests that the timing belt is stretched, has lost teeth, or the timing belt tensioner bearing is failing.',
    safety: 'CRITICAL: If the timing belt snaps on an interference engine, internal components (valves and pistons) will collide, causing catastrophic engine failure.',
    keywords: [
      { terms: ['clicking timing cover', 'timing belt slap', 'ticking front of engine', 'timing belt teeth worn'], weight: 5 },
      { terms: ['slapping under cover', 'timing cover clicking noise'], weight: 2 }
    ],
    parts: [
      { name: 'Timing Belt Kit', why: 'Replacing the timing belt, idler pulleys, and tensioner as a complete kit is critical to prevent belt failure.', priority: 'likely' },
      { name: 'Water Pump', why: 'The water pump is typically driven by the timing belt and should be replaced at the same time to save on duplicate labor.', priority: 'likely' },
    ],
  },
  {
    id: 'blend-door-actuator',
    title: 'Clicking behind dashboard / uneven climate control temperature',
    system: 'Climate',
    summary:
      'A rapid clicking, tapping, or knocking sound coming from behind the dashboard when turning on the car or changing temperature settings, often accompanied by AC blowing cold on one side and hot on the other, indicates a failed HVAC blend door actuator.',
    keywords: [
      { terms: ['clicking behind dashboard', 'blend door actuator click', 'ticking sound behind dash', 'ac hot one side cold other'], weight: 5 },
      { terms: ['climate control clicking', 'heater vent clicking'], weight: 2 }
    ],
    parts: [
      { name: 'Blower Motor', why: 'Actuators control the internal vent flaps; replacing the failed blend door motor resolves the clicking and restores temperature routing.', priority: 'possible' },
    ],
  },
  {
    id: 'exhaust-manifold-leak',
    title: 'Cold engine ticking noise that goes away when warm (Exhaust leak)',
    system: 'Exhaust',
    summary:
      'A rhythmic ticking or tapping sound coming from the engine bay when the vehicle is cold that fades or completely disappears as the engine warms up indicates an exhaust manifold leak (often due to a cracked manifold or broken mounting bolts).',
    safety: 'Leaking exhaust gas can contain carbon monoxide, which is dangerous if it enters the passenger cabin. Have this inspected and fixed promptly.',
    keywords: [
      { terms: ['ticking noise when cold', 'cold engine ticking', 'ticking goes away warm', 'cold tick exhaust'], weight: 5 },
      { terms: ['cracked exhaust manifold', 'broken manifold bolt', 'puffing sound cold'], weight: 2 }
    ],
    parts: [
      { name: 'Muffler', why: 'Replacing a leaking manifold gasket or cracked manifold assembly resolves the leak and stops the sound.', priority: 'possible' },
      { name: 'Exhaust Gasket', why: 'A new manifold gasket is required to seal the connection to the cylinder head.', priority: 'likely' },
    ],
  },
  {
    id: 'diesel-glow-plug-failure',
    title: 'Hard starting in cold weather / white smoke (Glow plug failure)',
    system: 'Engine',
    summary:
      'If your diesel vehicle is difficult to start in cold weather, runs very rough for a few minutes after starting, and emits white smoke from the tailpipe on startup, one or more glow plugs have failed.',
    keywords: [
      { terms: ['hard start cold diesel', 'glow plug warning', 'glow plug light flashing', 'white smoke startup diesel'], weight: 5 },
      { terms: ['rough idle cold diesel', 'diesel hard start cold weather'], weight: 2 }
    ],
    parts: [
      { name: 'Glow Plugs', why: 'Failing or burnt glow plugs cannot preheat the cylinders, leading to unburned diesel fuel and cold misfires.', priority: 'likely' },
    ],
  },
  {
    id: 'bad-ignition-wires',
    title: 'Engine hesitation under load or in wet weather (Worn plug wires)',
    system: 'Electrical',
    summary:
      'If your engine stumbles or hesitates when accelerating hard (especially uphill or in high gear) or runs rough specifically during heavy rain or damp mornings, the ignition spark plug wires are likely leaking voltage.',
    keywords: [
      { terms: ['hesitation under load', 'stumbles accelerating uphill', 'runs rough rain', 'spark plug wires leak'], weight: 5 },
      { terms: ['misfire under load', 'damp morning rough idle'], weight: 2 }
    ],
    parts: [
      { name: 'Spark Plugs', why: 'New spark plug wires restore solid voltage delivery to the plugs, preventing spark leakage and misfires.', priority: 'likely' },
      { name: 'Ignition Wires', why: 'Replacing dried out, cracked, or leaking plug wires is the direct fix.', priority: 'likely' },
    ],
  },
  {
    id: 'brake-booster-vacuum-leak',
    title: 'Stiff brake pedal / hissing under dashboard (Failed brake booster)',
    system: 'Brakes',
    summary:
      'If you hear a distinct hissing or vacuum leak noise from under the dashboard whenever you press the brake pedal, accompanied by a stiff/hard brake pedal and an engine that runs rough at stops when braking, the brake booster diaphragm has failed.',
    safety: 'A failed power brake booster increases stopping distances significantly. Inspect and replace immediately.',
    keywords: [
      { terms: ['stiff brake pedal', 'hissing under dashboard', 'hissing brake pedal', 'hard brake pedal whistle'], weight: 5 },
      { terms: ['rough idle holding brake', 'brake booster vacuum leak'], weight: 2 }
    ],
    parts: [
      { name: 'Brake Caliper', why: 'While calpiers manage stopping force, the booster provides the pedal assist; replacing a failed booster diaphragm is the direct cure.', priority: 'possible' },
      { name: 'Brake Fluid', why: 'A good time to bleed the brakes and refresh fluid levels.', priority: 'possible' },
    ],
  },
  {
    id: 'rod-bearing-knock',
    title: 'Deep, heavy metallic knocking under load (Spun rod bearing)',
    system: 'Engine',
    summary:
      'A deep, heavy, resonant metallic hammering or knocking sound from the lower engine block that gets significantly louder when accelerating (under load) typically indicates a spun connecting rod bearing.',
    safety: 'CRITICAL: Stop driving immediately. Continuing to run the engine with a spun bearing can cause the connecting rod to break and destroy the engine block.',
    keywords: [
      { terms: ['deep knocking sound', 'rod knock', 'heavy metallic knocking', 'knocks when accelerating', 'spun bearing', 'loud clunk under load'], weight: 5 },
      { terms: ['hammering sound lower engine', 'knocks worse when warm'], weight: 2 }
    ],
    parts: [
      { name: 'Engine Oil', why: 'Draining the oil to check for glitter-like metal shavings confirms catastrophic bearing failure.', priority: 'likely' },
      { name: 'Oil Filter', why: 'Cutting open the oil filter will reveal bearing material if a rod bearing has spun.', priority: 'possible' },
    ],
  },
  {
    id: 'lifter-tick',
    title: 'Light rhythmic tapping on cold start (Hydraulic lifter tick)',
    system: 'Engine',
    summary:
      'A high-pitched, rhythmic tapping or clicking noise (like a sewing machine) from the top of the engine that is loudest on a cold start and often fades as the engine warms up is usually hydraulic lifter tick.',
    keywords: [
      { terms: ['lifter tick', 'tapping noise top of engine', 'sewing machine sound engine', 'rhythmic clicking cold start', 'ticking fades warm'], weight: 5 },
      { terms: ['hydraulic lifter noise', 'valvetrain tick'], weight: 2 }
    ],
    parts: [
      { name: 'Engine Oil', why: 'Often caused by low oil pressure, dirty oil, or sludge preventing lifters from pumping up; an oil change or engine flush is the first step.', priority: 'likely' },
      { name: 'Oil Filter', why: 'Ensure a high-quality filter with a good anti-drainback valve is used to keep oil in the top end during cold starts.', priority: 'possible' },
    ],
  },
  {
    id: 'maf-sensor-failure',
    title: 'Erratic idle, surging, or stalling (MAF sensor failure)',
    system: 'Engine',
    summary:
      'If the engine idles very roughly, surges up and down, stalls unexpectedly, or runs excessively rich/lean regardless of throttle position, the Mass Airflow (MAF) sensor is likely dirty or failing.',
    keywords: [
      { terms: ['erratic idle mass air', 'maf sensor', 'surging idle constant', 'rich mixture rough idle', 'stalls unexpectedly idle'], weight: 5 },
      { terms: ['mass airflow failure', 'p0101'], weight: 2 }
    ],
    parts: [
      { name: 'Mass Air Flow Sensor', why: 'A failed or contaminated MAF sensor incorrectly calculates intake air mass, skewing the air-fuel ratio.', priority: 'likely' },
      { name: 'Air Filter', why: 'A dirty or torn air filter allows debris to contaminate the delicate MAF sensor hot wire.', priority: 'possible' },
    ],
  },
  {
    id: 'tps-sensor-failure',
    title: 'Jerking or dead spots during acceleration (TPS failure)',
    system: 'Engine',
    summary:
      'If the vehicle jerks violently, bucks, or has "dead spots" (where the engine hesitates or ignores the gas pedal) specifically as you press or release the accelerator, the Throttle Position Sensor (TPS) has failed.',
    keywords: [
      { terms: ['jerks gas pedal', 'dead spot acceleration', 'bucks when pressing gas', 'throttle position sensor', 'hesitates pressing pedal'], weight: 5 },
      { terms: ['tps sensor failure', 'skipping acceleration'], weight: 2 }
    ],
    parts: [
      { name: 'Throttle Position Sensor', why: 'Internal wear on the TPS potentiometer track causes voltage dropouts when you move the pedal.', priority: 'likely' },
    ],
  },
  {
    id: 'cv-axle-torn-boot',
    title: 'Grease inside wheel / clicking when turning (Torn CV boot)',
    system: 'Wheels & Axles',
    summary:
      'Finding thick, dark grease slung all over the inside of the front wheel well or suspension parts, combined with a rhythmic clicking noise when turning corners, indicates a torn CV axle boot and failing CV joint.',
    keywords: [
      { terms: ['grease inside wheel', 'torn cv boot', 'clicking turning corner', 'cv axle click', 'grease slung wheel well'], weight: 5 },
      { terms: ['cv joint failure', 'axle grease leak'], weight: 2 }
    ],
    parts: [
      { name: 'CV Axle', why: 'Once a boot tears, the joint loses grease and ingests dirt; the complete axle assembly must typically be replaced.', priority: 'likely' },
    ],
  },
  {
    id: 'bad-sway-bar-links',
    title: 'Rattling or clunking over small bumps (Worn sway bar links)',
    system: 'Suspension',
    summary:
      'A persistent, light rattling or clunking noise from the front suspension when driving over small bumps, cracks, or uneven pavement at low speeds (but quiet on smooth highways) usually points to worn sway bar end links.',
    keywords: [
      { terms: ['rattle over small bumps', 'sway bar links clunk', 'front end rattle low speed', 'clunk uneven pavement'], weight: 5 },
      { terms: ['stabilizer link noise', 'suspension rattle bumps'], weight: 2 }
    ],
    parts: [
      { name: 'Sway Bar Link', why: 'The ball joints on the ends of the stabilizer links wear out, creating play that rattles constantly over bumps.', priority: 'likely' },
    ],
  },
  {
    id: 'radiator-clogged',
    title: 'Overheats on highway but runs fine in town (Clogged radiator)',
    system: 'Cooling',
    summary:
      'If the engine runs cool in stop-and-go city traffic but the temperature gauge climbs toward overheating when driving at sustained highway speeds, the radiator core is likely restricted or clogged internally.',
    keywords: [
      { terms: ['overheats on highway', 'runs hot high speed', 'clogged radiator', 'temperature climbs highway', 'fine in town overheats highway'], weight: 5 },
      { terms: ['radiator restriction', 'poor cooling flow highway'], weight: 2 }
    ],
    parts: [
      { name: 'Radiator', why: 'A radiator clogged with mineral deposits cannot shed enough heat to handle the sustained thermal load of highway driving.', priority: 'likely' },
      { name: 'Thermostat', why: 'Always replace the thermostat when diagnosing overheating issues or replacing major cooling components.', priority: 'possible' },
    ],
  },
  {
    id: 'clogged-cabin-filter',
    title: 'Weak vent airflow / musty smell (Clogged cabin filter)',
    system: 'Climate',
    summary:
      'If the AC or heater fan sounds loud but very little air actually comes out of the dashboard vents, accompanied by a musty odor or windows that fog up easily, the cabin air filter is severely clogged.',
    keywords: [
      { terms: ['weak vent airflow', 'musty smell vents', 'clogged cabin filter', 'fan loud no air', 'windows fog easily inside'], weight: 5 },
      { terms: ['low ac airflow', 'heater blows weak'], weight: 2 }
    ],
    parts: [
      { name: 'Cabin Air Filter', why: 'A filter packed with leaves, dust, or mold restricts all HVAC airflow and introduces odors into the cabin.', priority: 'likely' },
      { name: 'Blower Motor', why: 'A completely blocked filter can cause the blower motor resistor to overheat and fail.', priority: 'possible' },
    ],
  },
  {
    id: 'gdi-carbon-buildup',
    title: 'Cold start misfires / hesitation (GDI Carbon Buildup)',
    system: 'Engine',
    summary:
      'In Gasoline Direct Injection (GDI) engines, rough idling (especially on cold starts), intermittent misfires, and hesitation during acceleration are often caused by severe carbon buildup baking onto the back of the intake valves, restricting airflow.',
    keywords: [
      { terms: ['carbon buildup', 'gdi misfire', 'cold start rough idle gdi', 'intake valve carbon', 'walnut blasting', 'hesitation direct injection'], weight: 5 },
      { terms: ['direct injection rough idle', 'p0300 cold start'], weight: 2 }
    ],
    parts: [
      { name: 'Intake Manifold Gasket', why: 'Removing the intake manifold to perform a borescope inspection and walnut blasting requires new manifold gaskets.', priority: 'likely' },
      { name: 'PCV Valve', why: 'A failing PCV system accelerates oil vapor deposition on the intake valves; replace it after carbon cleaning.', priority: 'possible' },
    ],
  },
  {
    id: 'dpf-regeneration-failure',
    title: 'Limp mode / exhaust warning (Clogged DPF)',
    system: 'Emissions',
    summary:
      'A clogged Diesel Particulate Filter (DPF) will trigger dashboard warnings ("Exhaust Filter Full"), drastically reduce power (limp mode), and cause frequent but failed regeneration cycles. This usually results from excessive short-trip driving.',
    keywords: [
      { terms: ['dpf clogged', 'diesel particulate filter', 'exhaust filter full', 'diesel limp mode', 'frequent regeneration', 'p242f'], weight: 5 },
      { terms: ['diesel sluggish acceleration', 'dpf warning light'], weight: 2 }
    ],
    parts: [
      { name: 'Diesel Particulate Filter (DPF)', why: 'If active forced regenerations fail to clear the soot, or the filter is physically damaged/melted, the entire unit must be replaced.', priority: 'possible' },
      { name: 'Differential Pressure Sensor', why: 'A faulty pressure sensor can trick the engine into thinking the DPF is clogged, causing false warnings.', priority: 'possible' },
    ],
  },
  {
    id: 'ev-isolation-fault',
    title: 'Hybrid system warning / no start (HV Isolation Fault)',
    system: 'Hybrid/EV',
    summary:
      'A "Service Hybrid System" warning accompanied by a no-start condition and DTC P0AA6 indicates a High-Voltage Isolation Fault. This means high-voltage electricity is leaking to the vehicle chassis, usually due to moisture intrusion, damaged HV cables, or internal battery/inverter failure.',
    safety: 'EXTREME DANGER: High-voltage systems can be lethal. An isolation fault means the vehicle chassis could be energized. DO NOT touch any orange cables or HV components. Seek immediate professional assistance.',
    keywords: [
      { terms: ['isolation fault', 'p0aa6', 'high voltage leak', 'service hybrid system', 'stop safely now', 'hybrid chassis voltage'], weight: 5 },
      { terms: ['ev no start warning', 'hybrid battery leak'], weight: 2 }
    ],
    parts: [
      { name: 'Hybrid Battery', why: 'Internal moisture or cell leakage within the main battery pack is a common source of isolation faults.', priority: 'possible' },
      { name: 'Inverter/Converter', why: 'Internal breakdown of capacitors or insulation within the inverter can leak voltage to the chassis.', priority: 'possible' },
    ],
  },
  {
    id: '10-speed-harsh-shifting',
    title: 'Violent shifting or "bang" engagements (10-Speed Transmission)',
    system: 'Transmission',
    summary:
      'In modern 10-speed transmissions, violently harsh shifts, delayed engagements, or loud "bangs" when downshifting (which return even after resetting adaptive learning) strongly point to a failing CDF clutch drum bushing or sticking valve body solenoids.',
    keywords: [
      { terms: ['10 speed harsh shift', 'cdf clutch drum', 'bang into gear', 'delayed engagement 10r80', 'valve body sticking'], weight: 5 },
      { terms: ['adaptive learning shift', 'transmission jerks 10 speed'], weight: 2 }
    ],
    parts: [
      { name: 'Valve Body', why: 'Worn aluminum bores or sticking solenoids in the valve body are often the first step in addressing harsh shifts before a full teardown.', priority: 'likely' },
      { name: 'Automatic Transmission Fluid', why: 'Fresh fluid and a pan gasket are required after any valve body or internal transmission repair.', priority: 'likely' },
    ],
  },
  {
    id: 'adas-sensor-misalignment',
    title: 'Phantom braking / erratic lane assist (ADAS Misalignment)',
    system: 'Safety/ADAS',
    summary:
      'If your vehicle unexpectedly slams on the brakes for no reason (phantom braking), bounces erratically between lane lines, or triggers collision warnings too late, the forward-facing camera or radar sensors likely require professional OEM calibration.',
    safety: 'WARNING: Misaligned ADAS sensors may fail to detect obstacles or trigger false emergency braking in traffic. Have the system professionally calibrated using laser targets.',
    keywords: [
      { terms: ['phantom braking', 'erratic lane assist', 'adas calibration', 'collision warning false', 'radar sensor misaligned', 'camera calibration'], weight: 5 },
      { terms: ['adaptive cruise fails', 'lane keep bouncing'], weight: 2 }
    ],
    parts: [
      { name: 'Forward Collision Camera', why: 'Replacing a cracked windshield or a faulty camera module requires strict OEM recalibration.', priority: 'possible' },
      { name: 'Radar Sensor', why: 'Even minor bumper impacts can bend the radar bracket, requiring bracket replacement and a complete calibration sweep.', priority: 'possible' },
    ],
  },
  {
    id: 'fuel-pump-failure',
    title: 'Whining from tank / loss of power under load (Fuel pump failure)',
    system: 'Fuel',
    summary:
      'A loud, abnormal whining or humming sound from the fuel tank area, combined with loss of power when accelerating, stalling in traffic, or a no-start condition after the engine cranks, indicates a failing in-tank fuel pump or fuel pump relay.',
    keywords: [
      { terms: ['fuel pump whining', 'loss of power accelerating', 'no start cranks fuel', 'fuel pump relay', 'stalls in traffic fuel'], weight: 5 },
      { terms: ['p0087 fuel pressure low', 'p0230 fuel pump circuit'], weight: 2 }
    ],
    parts: [
      { name: 'Fuel Pump', why: 'A worn fuel pump cannot build enough pressure to deliver fuel to the engine under load.', priority: 'likely' },
      { name: 'Fuel Filter', why: 'A clogged fuel filter starves the pump and can mimic pump failure symptoms.', priority: 'possible' },
    ],
  },
  {
    id: 'crankshaft-position-sensor',
    title: 'Intermittent stalling / no-start when hot (Crankshaft sensor failure)',
    system: 'Engine',
    summary:
      'If the engine stalls suddenly while driving and then refuses to restart (especially after heat-soaking), or if it cranks but will not fire intermittently, the Crankshaft Position Sensor (CKP) has likely failed. A classic symptom is a car that starts fine cold but dies after warming up.',
    keywords: [
      { terms: ['crankshaft position sensor', 'stalls when hot', 'no start hot engine', 'intermittent no start crank', 'p0335', 'p0336'], weight: 5 },
      { terms: ['ckp sensor failure', 'dies while driving restarts later'], weight: 2 }
    ],
    parts: [
      { name: 'Crankshaft Position Sensor', why: 'Internal thermal failure of the sensor causes it to lose signal when hot, preventing the ECU from firing the injectors and coils.', priority: 'likely' },
    ],
  },
  {
    id: 'head-gasket-failure',
    title: 'White smoke / milky oil / overheating (Blown head gasket)',
    system: 'Engine',
    summary:
      'Thick, sweet-smelling white smoke from the exhaust, a milkshake-like frothy substance on the oil dipstick or filler cap, unexplained coolant loss with no visible external leaks, and persistent overheating are the hallmark signs of a blown head gasket.',
    safety: 'CRITICAL: Stop driving immediately. Continuing to drive with a blown head gasket will cause catastrophic and irreversible engine damage from coolant contamination.',
    keywords: [
      { terms: ['white smoke exhaust', 'milky oil dipstick', 'blown head gasket', 'coolant loss no leak', 'bubbles in radiator'], weight: 5 },
      { terms: ['overheating coolant disappearing', 'sweet smell exhaust'], weight: 2 }
    ],
    parts: [
      { name: 'Head Gasket', why: 'The failed gasket allows coolant to leak into the combustion chambers or mix with engine oil.', priority: 'likely' },
      { name: 'Thermostat', why: 'Always replace the thermostat as part of a head gasket repair since it may have been damaged by overheating.', priority: 'possible' },
      { name: 'Engine Oil', why: 'After head gasket repair, the entire oil system must be flushed multiple times to remove all coolant contamination.', priority: 'likely' },
    ],
  },
  {
    id: 'wheel-bearing-failure',
    title: 'Speed-dependent humming or growling (Failing wheel bearing)',
    system: 'Wheels & Axles',
    summary:
      'A low-pitched humming or growling noise that increases with vehicle speed and changes pitch when you turn the steering wheel (louder one direction, quieter the other) is a classic failing wheel bearing. May also trigger ABS or traction control warning lights.',
    keywords: [
      { terms: ['humming noise speed', 'growling wheel bearing', 'noise changes turning', 'rumbling sound driving', 'wheel bearing play'], weight: 5 },
      { terms: ['abs light wheel noise', 'bearing hum gets louder speed'], weight: 2 }
    ],
    parts: [
      { name: 'Wheel Bearing', why: 'Worn or contaminated ball bearings create friction and noise that increases proportionally with wheel speed.', priority: 'likely' },
      { name: 'Wheel Hub Assembly', why: 'On many modern vehicles, the bearing is integrated into the hub and they are replaced as a single unit.', priority: 'likely' },
    ],
  },
  {
    id: 'parasitic-battery-drain',
    title: 'Battery dies overnight / needs frequent jump-starts (Parasitic drain)',
    system: 'Electrical',
    summary:
      'If a healthy, fully-charged battery repeatedly goes dead after the vehicle sits overnight or for a few days, an electrical component is drawing excessive current while the car is off. Common culprits include aftermarket accessories, stuck relays, trunk/glove box lights, and faulty body control modules.',
    keywords: [
      { terms: ['battery dies overnight', 'parasitic drain', 'dead battery sitting', 'battery keeps dying', 'needs jump start every morning'], weight: 5 },
      { terms: ['electrical draw test', 'something draining battery'], weight: 2 }
    ],
    parts: [
      { name: 'Battery', why: 'First verify the battery itself is healthy. Repeated deep discharges can permanently damage a battery.', priority: 'possible' },
      { name: 'Alternator', why: 'A shorted diode inside the alternator is a common hidden source of parasitic drain.', priority: 'possible' },
    ],
  },
  {
    id: 'cvt-shudder-failure',
    title: 'Shuddering / RPM flare during acceleration (CVT failure)',
    system: 'Transmission',
    summary:
      'A rhythmic shuddering or "rumble strip" vibration during light acceleration (10-30 mph), combined with engine RPMs surging without a corresponding increase in speed, indicates a failing CVT (Continuously Variable Transmission) belt/chain or valve body.',
    keywords: [
      { terms: ['cvt shudder', 'cvt judder', 'rpm flare cvt', 'cvt slipping acceleration', 'transmission shudder low speed'], weight: 5 },
      { terms: ['cvt whining noise', 'p17f0', 'cvt limp mode'], weight: 2 }
    ],
    parts: [
      { name: 'CVT Transmission Fluid', why: 'Degraded CVT fluid causes the steel belt to slip on the pulleys; a multi-stage drain and fill is the first step.', priority: 'likely' },
      { name: 'Valve Body', why: 'Sticking solenoids in the valve body cause inconsistent clamping pressure on the CVT belt.', priority: 'possible' },
    ],
  },
  {
    id: 'oxygen-sensor-failure',
    title: 'Poor fuel economy / rotten egg smell (O2 sensor failure)',
    system: 'Emissions',
    summary:
      'A significant drop in fuel economy, a rotten egg smell from the exhaust (from an overheating catalytic converter), rough idling, and a persistent Check Engine Light with codes in the P013x range typically point to a failed upstream oxygen (O2) sensor.',
    keywords: [
      { terms: ['poor fuel economy o2', 'rotten egg smell exhaust', 'oxygen sensor failure', 'p0131', 'p0133', 'p0134'], weight: 5 },
      { terms: ['failed emissions test', 'check engine light o2'], weight: 2 }
    ],
    parts: [
      { name: 'Oxygen Sensor', why: 'A sluggish or dead O2 sensor prevents the ECU from correcting the air-fuel mixture in real time.', priority: 'likely' },
    ],
  },
  {
    id: 'heater-core-leak',
    title: 'Foggy windshield / sweet smell / wet carpet (Heater core leak)',
    system: 'Cooling',
    summary:
      'If the inside of the windshield fogs up with a greasy, hard-to-wipe film when you turn on the defroster, you detect a sweet syrupy smell inside the cabin, and the passenger footwell carpet is damp or sticky, the heater core is leaking coolant inside the dashboard.',
    keywords: [
      { terms: ['foggy windshield inside', 'sweet smell cabin', 'heater core leak', 'wet passenger floor', 'greasy windshield film'], weight: 5 },
      { terms: ['coolant loss no external leak', 'antifreeze smell inside car'], weight: 2 }
    ],
    parts: [
      { name: 'Heater Core', why: 'A corroded or cracked heater core leaks hot coolant directly into the HVAC system and passenger compartment.', priority: 'likely' },
      { name: 'Heater Hoses', why: 'Inspect and replace the heater hoses connected to the core, as they may be cracked or swollen.', priority: 'possible' },
    ],
  },
  {
    id: 'cam-phaser-rattle',
    title: 'Cold start rattle / rough idle (VVT Cam Phaser failure)',
    system: 'Engine',
    summary:
      'A loud metallic clacking or rattling noise for 2-5 seconds immediately after a cold start that disappears once oil pressure builds, combined with rough idle and codes P0010/P0011/P0012, indicates worn Variable Valve Timing (VVT) cam phasers or solenoids.',
    keywords: [
      { terms: ['cold start rattle', 'cam phaser rattle', 'vvt solenoid', 'p0011', 'p0012', 'rattling startup disappears'], weight: 5 },
      { terms: ['variable valve timing noise', 'timing chain rattle cold'], weight: 2 }
    ],
    parts: [
      { name: 'VVT Solenoid', why: 'Clogged or failed VVT solenoids cannot properly control oil flow to the cam phasers, causing startup rattle and timing errors.', priority: 'likely' },
      { name: 'Engine Oil', why: 'Dirty or incorrect viscosity oil is the #1 cause of VVT system failures; always start with a fresh oil change.', priority: 'likely' },
    ],
  },
  {
    id: 'abs-wheel-speed-sensor',
    title: 'ABS + traction control lights on / false brake activation (Wheel speed sensor)',
    system: 'Brakes',
    summary:
      'Simultaneous illumination of the ABS and traction control warning lights, combined with unexpected brake pedal pulsation at low speeds (as if ABS is activating on dry pavement), typically indicates a failed wheel speed sensor or damaged tone ring in the hub assembly.',
    keywords: [
      { terms: ['abs light on traction control', 'brake pulsation low speed', 'abs activating dry road', 'wheel speed sensor', 'c0035', 'c0040'], weight: 5 },
      { terms: ['abs false activation', 'traction control light stays on'], weight: 2 }
    ],
    parts: [
      { name: 'Wheel Speed Sensor', why: 'A corroded or damaged sensor sends erratic speed data, causing the ABS computer to falsely activate.', priority: 'likely' },
      { name: 'Wheel Hub Assembly', why: 'Many vehicles integrate the speed sensor into the hub; a damaged tone ring inside requires full hub replacement.', priority: 'possible' },
    ],
  },
  {
    id: 'eps-failure',
    title: 'Heavy steering / EPS warning light (Electric power steering failure)',
    system: 'Steering',
    summary:
      'A sudden or gradual increase in steering effort (the wheel becomes very stiff and difficult to turn, especially at low speeds) accompanied by an EPS or steering warning light on the dashboard indicates a failure in the electric power steering motor, torque sensor, or control module.',
    keywords: [
      { terms: ['heavy steering eps', 'electric power steering failure', 'steering warning light', 'stiff steering wheel', 'eps motor failure'], weight: 5 },
      { terms: ['steering assist reduced', 'intermittent power steering loss'], weight: 2 }
    ],
    parts: [
      { name: 'EPS Motor', why: 'The electric assist motor on the steering column or rack has failed due to internal wear or overheating.', priority: 'possible' },
      { name: 'Steering Rack', why: 'On rack-mounted EPS systems, the motor and rack are often replaced as an integrated unit.', priority: 'possible' },
    ],
  },
  {
    id: 'seized-brake-caliper',
    title: 'Car pulls to one side / burning smell from wheel (Seized brake caliper)',
    system: 'Brakes',
    summary:
      'If the vehicle pulls strongly to one side while braking (or even while driving straight), one wheel is noticeably hotter than the others, and you detect a burning or acrid smell from that corner, a brake caliper piston or slide pin has seized, causing the pad to drag constantly.',
    safety: 'WARNING: A seized caliper can cause brake fade and severely compromise stopping power. Pull over safely if you smell burning brakes.',
    keywords: [
      { terms: ['pulls to one side braking', 'burning smell wheel', 'seized brake caliper', 'one wheel hot', 'car drags one side'], weight: 5 },
      { terms: ['caliper sticking', 'brake pad dragging'], weight: 2 }
    ],
    parts: [
      { name: 'Brake Caliper', why: 'A corroded caliper piston or seized slide pins prevent the caliper from releasing the brake pad.', priority: 'likely' },
      { name: 'Brake Pads', why: 'Pads on the affected caliper will be unevenly or excessively worn and must be replaced.', priority: 'likely' },
      { name: 'Brake Rotor', why: 'Constant heat from the dragging pad often warps or scores the rotor beyond resurfacing limits.', priority: 'possible' },
    ],
  },
  {
    id: 'window-regulator-failure',
    title: 'Window fell into door / grinding noise (Broken window regulator)',
    system: 'Body/Electrical',
    summary:
      'If the power window suddenly dropped into the door with a loud clunk, makes grinding or clicking noises when you press the switch, moves crooked, or does not respond at all (but you can hear the motor running), the window regulator cable or mechanism has snapped.',
    keywords: [
      { terms: ['window fell into door', 'window regulator broken', 'window grinding noise', "window won't go up", 'glass dropped into door'], weight: 5 },
      { terms: ['power window motor running no movement', 'window crooked off track'], weight: 2 }
    ],
    parts: [
      { name: 'Window Regulator', why: 'The cable-driven regulator mechanism has snapped, causing the glass to lose support and fall.', priority: 'likely' },
      { name: 'Window Motor', why: 'If no sound is heard at all when pressing the switch, the motor itself has failed (check fuse first).', priority: 'possible' },
    ],
  },
  {
    id: 'control-arm-bushing-worn',
    title: 'Clunking over bumps / alignment wanders (Worn control arm bushings)',
    system: 'Suspension',
    summary:
      'A hollow clunking or thunking noise when driving over bumps, combined with the vehicle wandering or pulling on the highway and uneven inner/outer tire wear, indicates severely worn control arm bushings allowing the suspension geometry to shift.',
    keywords: [
      { terms: ['clunking over bumps', 'control arm bushing worn', 'alignment wanders', 'suspension clunk pothole', 'loose steering highway'], weight: 5 },
      { terms: ['uneven tire wear inner edge', 'vague steering feel'], weight: 2 }
    ],
    parts: [
      { name: 'Control Arm', why: 'Worn rubber bushings allow the control arm to shift, destroying alignment geometry.', priority: 'likely' },
      { name: 'Control Arm Bushing', why: 'If available separately, the bushing can be pressed out and replaced without the entire arm.', priority: 'likely' },
    ],
  },
  {
    id: 'serpentine-belt-tensioner',
    title: 'Squealing on startup / accessory failures (Belt tensioner worn)',
    system: 'Engine',
    summary:
      'A loud squealing or chirping noise on cold startup or when turning on the AC, combined with flickering lights, heavy power steering, or weak AC cooling, indicates a worn serpentine belt tensioner that can no longer keep proper belt tension.',
    keywords: [
      { terms: ['serpentine belt squeal', 'belt tensioner noise', 'squealing startup cold', 'chirping engine belt', 'accessories failing belt'], weight: 5 },
      { terms: ['belt slipping ac on', 'alternator belt squeal'], weight: 2 }
    ],
    parts: [
      { name: 'Serpentine Belt', why: 'A cracked, glazed, or stretched belt cannot grip the pulleys and must be replaced with the tensioner.', priority: 'likely' },
      { name: 'Belt Tensioner', why: 'A worn tensioner bearing or weak spring allows the belt to slip, causing squealing and accessory underperformance.', priority: 'likely' },
    ],
  },
  {
    id: 'door-lock-actuator',
    title: 'Door won\'t lock/unlock / buzzing inside door (Lock actuator failure)',
    system: 'Body/Electrical',
    summary:
      'If one door refuses to lock or unlock via the key fob or interior switch, operates erratically (works sometimes, fails other times), or produces a buzzing, clicking, or grinding noise from inside the door panel, the electric door lock actuator motor has failed.',
    keywords: [
      { terms: ["door won't lock", 'door lock actuator', 'buzzing inside door', "door won't unlock", 'clicking noise door lock'], weight: 5 },
      { terms: ['power lock not working one door', 'lock motor grinding'], weight: 2 }
    ],
    parts: [
      { name: 'Door Lock Actuator', why: 'The internal motor and plastic gears inside the sealed actuator unit have stripped or burned out.', priority: 'likely' },
    ],
  },
  {
    id: 'ac-compressor-failure',
    title: 'AC blows warm / grinding noise when AC is on (Compressor failure)',
    system: 'Climate',
    summary:
      'If the AC blows warm air, the compressor clutch does not engage (no click when AC is turned on), or you hear loud grinding, rattling, or squealing from the compressor area specifically when the AC is activated, the AC compressor has failed mechanically.',
    keywords: [
      { terms: ['ac blows warm', 'ac compressor noise', 'compressor clutch not engaging', 'grinding noise ac on', 'ac seized compressor'], weight: 5 },
      { terms: ['no cold air car', 'ac not working refrigerant'], weight: 2 }
    ],
    parts: [
      { name: 'AC Compressor', why: 'Internal mechanical failure or a seized compressor prevents refrigerant from circulating through the system.', priority: 'likely' },
      { name: 'AC Condenser', why: 'If the compressor failed internally, metal debris contaminates the system; the condenser often needs replacement during a compressor swap.', priority: 'possible' },
    ],
  },
  {
    id: 'excessive-oil-consumption',
    title: 'Blue smoke / burning oil smell / oil level drops fast (Oil consumption)',
    system: 'Engine',
    summary:
      'If you see blue or bluish-gray smoke from the exhaust, detect a burning oil smell, and need to add oil frequently between changes (more than 1 quart per 1,000 miles), the engine is burning oil internally due to worn piston rings or leaking valve stem seals.',
    keywords: [
      { terms: ['blue smoke exhaust', 'burning oil smell', 'oil consumption excessive', 'adding oil frequently', 'oil level drops fast'], weight: 5 },
      { terms: ['piston rings worn', 'valve stem seals leaking'], weight: 2 }
    ],
    parts: [
      { name: 'PCV Valve', why: 'A stuck PCV valve pressurizes the crankcase and forces oil into the intake; this is the cheapest fix to try first.', priority: 'likely' },
      { name: 'Valve Cover Gasket', why: 'A leaking valve cover gasket can cause external oil burning on the exhaust manifold, creating smoke and smell.', priority: 'possible' },
    ],
  },
  {
    id: 'transfer-case-failure',
    title: 'Grinding in 4WD / service 4WD light (Transfer case failure)',
    system: 'Drivetrain',
    summary:
      'Grinding, clunking, or whining noises that appear only in 4WD or AWD mode, difficulty engaging or disengaging 4WD, a "Service 4WD" dashboard warning, or a binding/shuddering sensation during turns indicates a failing transfer case, worn chain, or low transfer case fluid.',
    keywords: [
      { terms: ['grinding 4wd', 'service 4wd light', 'transfer case noise', "4wd won't engage", 'binding turning 4wd'], weight: 5 },
      { terms: ['awd clunking noise', 'transfer case fluid leak'], weight: 2 }
    ],
    parts: [
      { name: 'Transfer Case Fluid', why: 'Low or degraded fluid causes internal overheating and accelerated chain/gear wear.', priority: 'likely' },
      { name: 'Transfer Case', why: 'Severely worn internal chains, bearings, or gears may require a complete unit replacement.', priority: 'possible' },
    ],
  },
  {
    id: 'dct-shudder',
    title: 'Shuddering from stop / rough low-speed shifting (DCT failure)',
    system: 'Transmission',
    summary:
      'In vehicles with a Dual-Clutch Transmission (DCT), a shuddering or jerking sensation when accelerating from a stop, rough shifting between 1st and 3rd gears, and delayed engagement into Drive or Reverse indicate worn clutch packs or a failing TCM calibration.',
    keywords: [
      { terms: ['dct shudder', 'dual clutch jerking', 'powershift shudder', 'rough shifting low speed dct', 'delayed engagement dual clutch'], weight: 5 },
      { terms: ['dps6 transmission', 'dsg shudder'], weight: 2 }
    ],
    parts: [
      { name: 'Clutch Assembly', why: 'The dual-clutch friction packs wear prematurely, especially in stop-and-go traffic, requiring replacement of the clutch module.', priority: 'likely' },
      { name: 'Automatic Transmission Fluid', why: 'Fluid contamination from worn clutch material accelerates TCM calibration failures.', priority: 'possible' },
    ],
  },
  {
    id: 'ignition-coil-failure',
    title: 'Single-cylinder misfire / flashing check engine light (Ignition coil failure)',
    system: 'Engine',
    summary:
      'A flashing Check Engine Light with a cylinder-specific misfire code (P0301-P0308), combined with rough idle, loss of power, and a raw fuel smell from the exhaust, typically indicates a failed coil-on-plug ignition coil. Confirm by swapping the suspected coil to another cylinder and checking if the code follows it.',
    keywords: [
      { terms: ['ignition coil failure', 'misfire one cylinder', 'flashing check engine', 'coil on plug', 'p0301', 'p0302', 'p0303', 'p0304'], weight: 5 },
      { terms: ['single cylinder misfire', 'coil swap test'], weight: 2 }
    ],
    parts: [
      { name: 'Ignition Coil', why: 'The internal windings of the coil have failed, preventing spark delivery to that cylinder.', priority: 'likely' },
      { name: 'Spark Plugs', why: 'Always replace the spark plug along with the coil, as a worn plug can shorten the life of a new coil.', priority: 'likely' },
    ],
  },
  {
    id: 'motor-mount-failure',
    title: 'Excessive vibration at idle / clunk shifting into gear (Broken motor mount)',
    system: 'Engine',
    summary:
      'Increased vibration felt through the cabin at idle, a loud clunk or thud when shifting from Park to Drive or Reverse, and visible engine rocking during acceleration indicate one or more engine or transmission mounts have torn or collapsed.',
    keywords: [
      { terms: ['vibration idle motor mount', 'clunk shifting park drive', 'engine rocks acceleration', 'motor mount broken', 'excessive engine vibration'], weight: 5 },
      { terms: ['transmission mount worn', 'engine tilts on acceleration'], weight: 2 }
    ],
    parts: [
      { name: 'Motor Mount', why: 'Torn rubber or collapsed hydraulic fluid in the mount allows the engine to move excessively and transmit vibration to the cabin.', priority: 'likely' },
      { name: 'Transmission Mount', why: 'Often fails at the same time as engine mounts; inspect all mounts when one is found broken.', priority: 'possible' },
    ],
  },
  {
    id: 'fuel-injector-failure',
    title: 'Dead cylinder / fuel smell in oil (Fuel injector failure)',
    system: 'Fuel',
    summary:
      'A single-cylinder misfire with code P020x, combined with a raw fuel smell from the exhaust, poor fuel economy, and possible fuel-diluted engine oil, indicates a fuel injector that is stuck open (flooding), stuck closed (starving), or has a failed electrical circuit.',
    keywords: [
      { terms: ['fuel injector failure', 'dead cylinder fuel', 'p0201', 'p0202', 'injector stuck open', 'fuel smell oil'], weight: 5 },
      { terms: ['clogged fuel injector', 'injector circuit open'], weight: 2 }
    ],
    parts: [
      { name: 'Fuel Injector', why: 'A stuck, clogged, or electrically failed injector cannot deliver the correct fuel spray pattern to its cylinder.', priority: 'likely' },
      { name: 'Fuel Injector O-Ring', why: 'Leaking O-rings at the injector seat cause external fuel leaks and fire hazards.', priority: 'possible' },
    ],
  },
  {
    id: 'cooling-fan-failure',
    title: 'Overheats at idle but fine on highway (Cooling fan not working)',
    system: 'Cooling',
    summary:
      'If the engine temperature climbs dangerously when sitting in traffic or at red lights but stays cool while driving at speed, the electric radiator cooling fan is not activating. Common causes are a dead fan motor, blown fan fuse, or a failed coolant temperature sensor/relay.',
    keywords: [
      { terms: ['overheats at idle', 'cooling fan not working', 'overheats traffic fine highway', 'fan not spinning', 'overheats stopped'], weight: 5 },
      { terms: ['cooling fan relay', 'radiator fan fuse blown'], weight: 2 }
    ],
    parts: [
      { name: 'Cooling Fan Motor', why: 'The electric motor that drives the radiator fan has seized or burned out.', priority: 'likely' },
      { name: 'Cooling Fan Relay', why: 'A failed relay prevents power from reaching the fan motor even when the engine is hot.', priority: 'possible' },
      { name: 'Coolant Temperature Sensor', why: 'A faulty sensor sends incorrect readings to the ECU, which never triggers the fan relay.', priority: 'possible' },
    ],
  },
  {
    id: 'clock-spring-failure',
    title: 'Airbag light on / horn and cruise not working (Clock spring failure)',
    system: 'Safety/ADAS',
    summary:
      'If the airbag warning light is on, the horn does not work, and steering wheel controls (cruise control, volume, phone) have stopped responding — especially if these failures happened simultaneously — the clock spring (spiral cable) inside the steering column has broken.',
    safety: 'WARNING: With a broken clock spring, the driver airbag may not deploy in a crash. Have this repaired immediately.',
    keywords: [
      { terms: ['airbag light on horn not working', 'clock spring failure', 'steering wheel buttons dead', 'cruise control not working airbag light', 'horn stopped working airbag'], weight: 5 },
      { terms: ['spiral cable broken', 'srs light steering'], weight: 2 }
    ],
    parts: [
      { name: 'Clock Spring', why: 'The internal ribbon cable has torn from repeated steering wheel rotation, severing all electrical connections through the column.', priority: 'likely' },
    ],
  },
  {
    id: 'exhaust-flex-pipe',
    title: 'Loud exhaust rumble / exhaust smell in cabin (Cracked flex pipe)',
    system: 'Exhaust',
    summary:
      'A loud rumbling, roaring, or hissing noise from under the front of the vehicle that gets louder during acceleration, combined with the smell of exhaust fumes entering the cabin, indicates the exhaust flex pipe (the braided metal section) has cracked or rusted through.',
    safety: 'WARNING: Exhaust fumes entering the cabin contain carbon monoxide, which is toxic. Have the flex pipe repaired immediately.',
    keywords: [
      { terms: ['loud exhaust noise front', 'exhaust flex pipe cracked', 'exhaust smell cabin', 'rumbling noise underneath', 'exhaust leak hissing'], weight: 5 },
      { terms: ['flex pipe rusted', 'exhaust vibration noise'], weight: 2 }
    ],
    parts: [
      { name: 'Exhaust Flex Pipe', why: 'The braided stainless steel mesh and internal bellows have cracked from metal fatigue, rust, or vibration stress.', priority: 'likely' },
    ],
  },
  {
    id: 'tpms-sensor-dead',
    title: 'Tire pressure light flashing then stays on (TPMS sensor battery dead)',
    system: 'Wheels & Axles',
    summary:
      'If the tire pressure warning light flashes for 60-90 seconds on startup before turning solid, and all tires are properly inflated, a TPMS sensor battery has died. TPMS sensors are sealed units with non-replaceable batteries that typically last 5-10 years.',
    keywords: [
      { terms: ['tpms light flashing', 'tire pressure light stays on', 'tpms sensor dead', 'tire pressure warning inflated', 'tpms battery dead'], weight: 5 },
      { terms: ['tpms relearn', 'tire sensor not reading'], weight: 2 }
    ],
    parts: [
      { name: 'TPMS Sensor', why: 'The sealed sensor unit has an expired internal battery and must be replaced as a complete assembly.', priority: 'likely' },
    ],
  },
  {
    id: 'clutch-failure-manual',
    title: 'Clutch slipping / grinding into gear (Manual clutch worn)',
    system: 'Transmission',
    summary:
      'In a manual transmission vehicle, if the engine RPMs rise without a corresponding increase in speed (slipping), you smell a burning friction odor, or you hear grinding when shifting gears, the clutch disc is worn out. A rattling noise at idle that disappears when pressing the clutch pedal may indicate a failing dual-mass flywheel.',
    keywords: [
      { terms: ['clutch slipping', 'grinding into gear manual', 'clutch burning smell', 'rpms rise no speed manual', 'clutch pedal spongy'], weight: 5 },
      { terms: ['dual mass flywheel rattle', 'hard shifting manual'], weight: 2 }
    ],
    parts: [
      { name: 'Clutch Kit', why: 'The friction disc, pressure plate, and throw-out bearing are typically replaced as a complete kit.', priority: 'likely' },
      { name: 'Flywheel', why: 'A scored or cracked flywheel (especially dual-mass units) must be replaced alongside the clutch kit.', priority: 'possible' },
    ],
  },
  {
    id: 'start-stop-battery-failure',
    title: 'Auto start-stop disabled / weak restart (AGM battery failure)',
    system: 'Electrical',
    summary:
      'If your vehicle\'s auto start-stop system disables itself, displays a warning on the dash, or restarts sluggishly, the primary cause is usually a degraded AGM/EFB battery, not a failing starter motor. The Battery Management System (BMS) disables the feature to prevent stranding you.',
    keywords: [
      { terms: ['auto start stop not working', 'start stop disabled', 'sluggish restart', 'agm battery start stop', 'start stop warning light'], weight: 5 },
      { terms: ['engine wont auto stop', 'auto start stop failure'], weight: 2 }
    ],
    parts: [
      { name: 'AGM/EFB Battery', why: 'Start-stop systems require specific deep-cycling batteries. A degraded battery will cause the system to lock out the auto-stop feature.', priority: 'likely' },
    ],
  },
  {
    id: 'epb-failure',
    title: 'Rear brakes stuck / EPB warning light (Electronic Parking Brake failure)',
    system: 'Brakes',
    summary:
      'A persistent or flashing red PARK/BRAKE light, grinding noises from the rear wheels, or the vehicle refusing to move because the rear brakes are stuck clamped indicate a failure in the Electronic Parking Brake (EPB). This requires entering "Service Mode" with a scan tool to repair.',
    safety: 'WARNING: Do not attempt to force the vehicle to drive with a stuck EPB, as this can destroy the braking system and cause a fire hazard.',
    keywords: [
      { terms: ['electronic parking brake stuck', 'epb failure', 'rear brakes stuck on', 'parking brake wont release', 'epb warning light flashing'], weight: 5 },
      { terms: ['epb motor grinding', 'service parking brake message'], weight: 2 }
    ],
    parts: [
      { name: 'EPB Actuator Motor', why: 'The electric motor mounted on the caliper has seized or stripped its internal gears.', priority: 'likely' },
      { name: 'Brake Caliper', why: 'The internal piston mechanism has seized, preventing the EPB motor from releasing the pads.', priority: 'possible' },
    ],
  },
  {
    id: 'differential-whine-chatter',
    title: 'Whining under load or chatter in turns (Differential wear)',
    system: 'Drivetrain',
    summary:
      'A whining or howling noise from the rear/front of the vehicle that changes pitch when you accelerate or decelerate indicates worn ring and pinion gears or bearings. A physical shudder or "chatter" during low-speed, tight turns points to worn limited-slip differential (LSD) clutch packs or missing friction modifier.',
    keywords: [
      { terms: ['differential whine', 'rear end howling acceleration', 'chatter in tight turns', 'limited slip shudder', 'ring and pinion noise'], weight: 5 },
      { terms: ['diff noise deceleration', 'rear differential binding'], weight: 2 }
    ],
    parts: [
      { name: 'Ring and Pinion Gear Set', why: 'Worn teeth on the main differential gears cause howling under load.', priority: 'possible' },
      { name: 'Differential Bearings', why: 'Worn pinion or carrier bearings cause a low-pitch rumble or whine.', priority: 'possible' },
      { name: 'Friction Modifier Additive', why: 'Adding the correct modifier to the gear oil often cures LSD chatter without mechanical repair.', priority: 'possible' },
    ],
  },
  {
    id: 'turbo-oil-seal',
    title: 'Blue smoke under boost / oil in intake (Turbo oil leak)',
    system: 'Engine',
    summary:
      'Thick blue exhaust smoke during heavy acceleration, pooled oil in the intercooler/boost pipes, or external oil drips from the turbocharger indicate oil leaking past the turbo seals. *Crucial:* This is often caused by a restricted oil drain line or high crankcase pressure (blow-by), not necessarily a failed turbo.',
    keywords: [
      { terms: ['blue smoke under boost', 'oil in intercooler', 'turbo oil seal leak', 'oil dripping from turbo', 'smoke on acceleration turbo'], weight: 5 },
      { terms: ['restricted turbo drain line', 'turbo shaft play'], weight: 2 }
    ],
    parts: [
      { name: 'Turbocharger Assembly', why: 'Excessive shaft play has allowed the compressor/turbine wheels to damage the housing and oil rings.', priority: 'possible' },
      { name: 'PCV Valve / Oil Separator', why: 'High crankcase pressure prevents oil from draining out of the turbo, forcing it past the seals.', priority: 'likely' },
    ],
  },
  {
    id: 'alternator-failure',
    title: 'Dimming lights / whining noise / battery light on (Alternator failure)',
    system: 'Electrical',
    summary:
      'A battery-shaped dashboard warning light, headlights that dim at idle, a high-pitched whining noise from the engine bay, and a vehicle that stalls while driving are classic signs of a failing alternator. Confirm by testing the battery voltage with the engine running (should be 14.0-14.5V).',
    keywords: [
      { terms: ['alternator failure', 'dimming headlights idle', 'battery light on driving', 'whining noise alternator', 'car dies while driving electrical'], weight: 5 },
      { terms: ['undercharging voltage', 'alternator test'], weight: 2 }
    ],
    parts: [
      { name: 'Alternator', why: 'The internal voltage regulator, diodes, or bearings have failed, preventing the unit from charging the battery and powering the vehicle.', priority: 'likely' },
      { name: 'Drive Belt / Serpentine Belt', why: 'A slipping or broken belt will prevent the alternator from spinning and generating power.', priority: 'possible' },
    ],
  },
  {
    id: 'starter-motor-failure',
    title: 'Single click / grinding / freewheeling on start (Starter failure)',
    system: 'Electrical',
    summary:
      'If you turn the key and hear a single loud "click" (but the battery is fully charged), a harsh grinding noise, or a high-pitched spinning sound without the engine turning over, the starter motor has failed. Tapping the starter with a hammer is only a temporary roadside trick to engage worn brushes.',
    keywords: [
      { terms: ['single click no crank', 'starter grinding noise', 'starter freewheeling spinning', 'starter motor failure', 'tap starter hammer'], weight: 5 },
      { terms: ['starter solenoid click', 'bendix gear not engaging'], weight: 2 }
    ],
    parts: [
      { name: 'Starter Motor', why: 'Worn internal brushes, a failed solenoid, or a damaged bendix gear prevent the starter from turning the engine flywheel.', priority: 'likely' },
    ],
  },
  {
    id: 'throttle-body-carbon',
    title: 'Rough idle / surging / limp mode / P0122 (Dirty Throttle Body)',
    system: 'Engine',
    summary:
      'An erratic or bouncing idle speed (surging), engine stalling when coming to a stop, or the vehicle suddenly dropping into "limp mode" with code P0122 (TPS circuit low) often indicates heavy carbon buildup inside the throttle body. Cleaning the throttle plate usually resolves the mechanical sticking.',
    keywords: [
      { terms: ['throttle body dirty', 'carbon buildup idle', 'surging idle bouncing', 'limp mode p0122', 'rough idle stalling stop'], weight: 5 },
      { terms: ['tps sensor code', 'clean throttle body'], weight: 2 }
    ],
    parts: [
      { name: 'Throttle Body Cleaner', why: 'A specialized solvent used to dissolve carbon deposits without damaging electronic throttle components.', priority: 'likely' },
      { name: 'Throttle Body Assembly', why: 'If cleaning does not resolve the P0122 code, the internal Throttle Position Sensor (TPS) or stepper motor has failed.', priority: 'possible' },
    ],
  },
  {
    id: 'catalytic-converter-clogged',
    title: 'Loss of power / rotten egg smell / glowing red (Clogged Catalytic Converter)',
    system: 'Exhaust',
    summary:
      'A severe lack of engine power, an overwhelming rotten egg (sulfur) smell, code P0420, and in extreme cases, the catalytic converter glowing red hot under the vehicle indicates a severe exhaust blockage. This is usually caused by unburned fuel from engine misfires melting the internal honeycomb structure.',
    safety: 'WARNING: A glowing red catalytic converter is a severe fire hazard. Stop driving immediately and fix the underlying engine misfire before replacing the converter.',
    keywords: [
      { terms: ['catalytic converter glowing red', 'rotten egg smell exhaust', 'clogged catalytic converter', 'loss of power p0420', 'exhaust backpressure blocked'], weight: 5 },
      { terms: ['melted cat', 'sulfur smell car'], weight: 2 }
    ],
    parts: [
      { name: 'Catalytic Converter', why: 'The internal substrate has melted or fractured, creating an exhaust restriction.', priority: 'likely' },
      { name: 'Spark Plugs / Ignition Coils', why: 'Must be inspected and replaced if misfires caused the unburned fuel that destroyed the converter.', priority: 'likely' },
    ],
  },
  {
    id: 'torque-converter-shudder',
    title: 'Rumble strip vibration at highway speeds (Torque converter shudder)',
    system: 'Transmission',
    summary:
      'A vibration that feels like driving over a rumble strip, typically occurring between 30-50 mph under light acceleration, is a classic sign of torque converter clutch (TCC) shudder. If lightly tapping the brake pedal while keeping your foot on the gas makes the vibration instantly stop, it confirms the TCC is the culprit.',
    keywords: [
      { terms: ['torque converter shudder', 'rumble strip vibration', 'vibration steady speed 40mph', 'tcc lockup shudder', 'transmission slipping torque converter'], weight: 5 },
      { terms: ['torque converter clutch failure', 'shudder stops tapping brake'], weight: 2 }
    ],
    parts: [
      { name: 'Torque Converter', why: 'The internal lockup clutch is worn or glazed, causing it to slip and chatter rather than engaging smoothly.', priority: 'likely' },
      { name: 'Automatic Transmission Fluid', why: 'Degraded or burnt fluid cannot provide the correct frictional properties for the clutch. A fluid flush is sometimes the first diagnostic step.', priority: 'possible' },
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
