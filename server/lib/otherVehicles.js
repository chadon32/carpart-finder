// Marketplace titles for universal or multi-vehicle parts often list vehicles
// instead of a make: "FITS Accord Civic Odyssey CR-V". When a title names
// several vehicles of other makes and not the one selected, the listing is for
// somebody else's car.
//
// Model names that are also ordinary words in a parts title are left out on
// purpose (spark, fit, edge, focus, charger, leaf, accent, pilot, transit...),
// so "spark plug wire" or "leaf spring clips" can never read as a vehicle.

export const COMMERCIAL_MAKES = [
  'kenworth', 'peterbilt', 'freightliner', 'mack', 'western star', 'navistar',
  'hino', 'mitsubishi fuso', 'blue bird', 'thomas built', 'caterpillar', 'john deere',
]

const MODELS_BY_MAKE = {
  honda: ['accord', 'civic', 'odyssey', 'cr-v', 'crv', 'ridgeline', 'hr-v', 'hrv', 'passport', 'crosstour', 'prelude', 's2000'],
  toyota: ['camry', 'corolla', 'rav4', 'tacoma', 'tundra', 'highlander', 'sienna', 'prius', '4runner', 'sequoia', 'avalon', 'venza', 'land cruiser', 'yaris', 'supra'],
  ford: ['f-150', 'f150', 'f-250', 'f-350', 'mustang', 'explorer', 'expedition', 'bronco', 'taurus', 'fiesta'],
  chevrolet: ['silverado', 'malibu', 'equinox', 'traverse', 'tahoe', 'suburban', 'impala', 'camaro', 'cruze', 'colorado', 'blazer', 'corvette'],
  gmc: ['sierra', 'yukon', 'acadia', 'envoy'],
  dodge: ['challenger', 'durango', 'caravan', 'dakota', 'neon'],
  jeep: ['wrangler', 'cherokee', 'grand cherokee', 'renegade', 'gladiator'],
  nissan: ['altima', 'sentra', 'maxima', 'murano', 'pathfinder', 'juke', '350z', '370z'],
  hyundai: ['elantra', 'sonata', 'tucson', 'santa fe', 'veloster', 'palisade', 'azera', 'kona'],
  kia: ['optima', 'sorento', 'sportage', 'telluride', 'stinger', 'cadenza', 'sedona', 'niro'],
  subaru: ['outback', 'forester', 'crosstrek', 'impreza', 'wrx', 'brz'],
  mazda: ['mazda3', 'mazda6', 'cx-5', 'cx-9', 'cx-3', 'cx-30', 'miata', 'mx-5'],
  volkswagen: ['jetta', 'passat', 'tiguan', 'atlas', 'beetle', 'touareg'],
  lexus: ['rx350', 'rx450h', 'es350', 'is250', 'is350', 'gs350', 'gx460', 'lx570', 'nx200t'],
  acura: ['tlx', 'tsx', 'rdx', 'mdx', 'ilx', 'rsx'],
  infiniti: ['g35', 'g37', 'q50', 'q60', 'qx60', 'qx80'],
  cadillac: ['escalade', 'cts', 'ats', 'xts', 'srx'],
  buick: ['enclave', 'encore', 'lacrosse', 'regal'],
  lincoln: ['navigator', 'mkz', 'mkx', 'mkc'],
  volvo: ['xc90', 'xc60', 'xc40', 's60', 's80', 'v70'],
  mitsubishi: ['outlander', 'lancer', 'galant'],
  mini: ['clubman', 'countryman'],
  porsche: ['cayenne', 'macan', 'boxster', 'cayman', 'panamera'],
  saturn: ['vue'],
  pontiac: ['grand prix'],
}

const MAKES_BY_MODEL = new Map()
for (const [make, models] of Object.entries(MODELS_BY_MAKE)) {
  for (const model of models) {
    const key = model.replace(/[^a-z0-9]+/g, ' ').trim()
    MAKES_BY_MODEL.set(key, [...(MAKES_BY_MODEL.get(key) ?? []), make])
  }
}

// Distinct models in the title that belong only to makes other than the
// selected one. `normalizedTitle` is space-padded lower-case words.
export function otherMakeModelsNamed(normalizedTitle, selectedMake) {
  const named = []
  for (const [model, makes] of MAKES_BY_MODEL) {
    if (!normalizedTitle.includes(` ${model} `)) continue
    if (makes.includes(selectedMake)) continue
    named.push(model)
  }
  return named
}

export const OTHER_VEHICLES_THRESHOLD = 2
