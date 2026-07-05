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
