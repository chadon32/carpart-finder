export const site = {
  name: 'CarPartsRadar',
  origin: 'https://carpartsradar.com',
  email: 'chadon322@gmail.com',
  updated: 'July 22, 2026',
  isoDate: '2026-07-22',
}

const nhtsaVin = {
  label: 'NHTSA VIN Decoder',
  url: 'https://www.nhtsa.gov/vin-decoder',
}

const nhtsaRecalls = {
  label: 'NHTSA Recall Lookup',
  url: 'https://www.nhtsa.gov/recalls',
}

const ftcWarranties = {
  label: 'FTC Consumer Advice: Warranties',
  url: 'https://consumer.ftc.gov/articles/warranties',
}

const ftcAutoWarranties = {
  label: 'FTC Consumer Advice: Auto Warranties and Service Contracts',
  url: 'https://consumer.ftc.gov/articles/auto-warranties-and-auto-service-contracts',
}

const ftcRepair = {
  label: 'FTC Consumer Advice: Auto Repair Basics',
  url: 'https://consumer.ftc.gov/articles/0211-auto-repair-basics',
}

export const guides = [
  {
    slug: 'how-to-confirm-car-part-fitment',
    category: 'Fitment basics',
    title: 'How to Confirm a Car Part Fits Before You Buy',
    description: 'A practical fitment checklist using the VIN, trim, engine, drivetrain, production date, and manufacturer part numbers.',
    intro: [
      'A listing that names your vehicle is a useful starting point, but it is not always enough to prove fitment. One model year can include several engines, transmissions, brake packages, body styles, and midyear production changes. The safest online purchase starts by identifying the exact configuration of the vehicle and then matching the part at more than one level.',
      'This guide explains the evidence CarPartsRadar looks for when comparing listings. It also shows what a shopper should verify before ordering. No automated catalog can replace the label on the old part, the vehicle manufacturer catalog, or an experienced parts professional when the application is ambiguous.',
    ],
    takeaways: [
      'Start with the full 17-character VIN whenever possible.',
      'Match engine, drivetrain, body style, trim, and production date, not only year and model.',
      'Cross-check the original equipment number and the replacement manufacturer catalog.',
      'Treat marketplace fitment labels as evidence, not as an unconditional guarantee.',
    ],
    sections: [
      {
        heading: 'Begin with the vehicle identity',
        paragraphs: [
          'Write down the year, make, model, trim, engine displacement, cylinder count, fuel type, transmission, drivetrain, and body style. A 2018 pickup with rear-wheel drive may use a different hub, driveshaft, or suspension component than the four-wheel-drive version. A sedan and hatchback sold under the same model name can also have different exhaust or body hardware.',
          'The VIN is the strongest starting point because it identifies a specific vehicle. NHTSA provides a public decoder, and manufacturer or dealer catalogs can often use the VIN to resolve option packages that a generic year-make-model selector cannot. VIN data is still not a universal part-number catalog, so keep the vehicle label and the old component available for a second check.',
        ],
      },
      {
        heading: 'Look for production splits and option codes',
        paragraphs: [
          'Catalog notes such as “built before 03/18,” “with heavy-duty brakes,” or “without sport suspension” are not minor details. They describe a production split. The build month is usually printed on the certification label inside the driver door opening. Option codes may appear on a glove-box, trunk, spare-tire, or door label, depending on the manufacturer.',
          'Brake rotor diameter, electrical connector shape, sensor count, axle ratio, wheel size, and emissions certification can all create fitment splits. When a listing includes one of these qualifiers, verify it directly. Do not infer a package from exterior appearance alone.',
        ],
      },
      {
        heading: 'Use part numbers as a second match',
        paragraphs: [
          'If the old part has a readable number, compare it with the original equipment number in the listing or manufacturer catalog. Replacement brands often publish an interchange list that maps their number to several original numbers. Exact punctuation can vary, but the full base number and suffix matter when a manufacturer revised the component.',
          'A matching number is especially useful for electronic modules, sensors, switches, pumps, and assemblies with similar housings. Appearance alone is weak evidence. Two components can share a casting while using different calibration, connector pinout, pulley, gear ratio, or internal specification.',
        ],
      },
      {
        heading: 'Inspect the listing evidence',
        paragraphs: [
          'Read the complete title, compatibility notes, condition description, included-parts list, warranty, and return policy. Confirm whether a photo shows the actual item or a representative image. Check that mounting points, connector count, terminal orientation, hose locations, and dimensions agree with the old component.',
          'For used parts, ask for the donor vehicle VIN and mileage when those details affect compatibility or remaining life. For remanufactured parts, review the core-return requirements before ordering. A low purchase price can become expensive if the seller requires return shipping on a heavy core.',
        ],
      },
      {
        heading: 'Know when to stop and ask',
        paragraphs: [
          'Pause the purchase when the listing conflicts with the manufacturer catalog, the old part has a different connector, or the application depends on an option you cannot identify. Send the seller the VIN and the number from the original component. A precise question gives the seller a better chance to confirm the application in writing.',
          'Safety-critical systems deserve extra caution. Brake, steering, restraint, and high-voltage components should be selected and installed with appropriate service information and training. If a wrong part could affect control of the vehicle, ask a qualified technician or parts department to confirm it before purchase.',
        ],
      },
    ],
    checklist: [
      'Decode the VIN and record the complete vehicle configuration.',
      'Check the build date and any option-code requirement.',
      'Compare the old part number with the listing interchange.',
      'Match connectors, mounting points, dimensions, and included hardware.',
      'Read the warranty, return window, restocking fee, and core policy.',
      'Save the listing and written fitment confirmation with the receipt.',
    ],
    sources: [nhtsaVin, nhtsaRecalls],
  },
  {
    slug: 'oem-vs-aftermarket-car-parts',
    category: 'Buying strategy',
    title: 'OEM vs. Aftermarket Car Parts: How to Choose',
    description: 'Compare original equipment, aftermarket, remanufactured, and used parts by fit, warranty, cost, and repair risk.',
    intro: [
      '“OEM” and “aftermarket” describe who supplied a part, not whether every example is automatically good or bad. An original equipment part can offer the simplest path to the factory specification. A reputable aftermarket part can match that specification, solve a known weakness, or cost less. The right choice depends on the component, the vehicle, and the consequences of doing the repair twice.',
      'A useful comparison goes beyond the price printed on the listing. Fitment confidence, included hardware, warranty labor, return shipping, expected service life, and the difficulty of installation all affect value.',
    ],
    takeaways: [
      'OEM usually offers the clearest specification match, but it may not be the best value for every repair.',
      'Aftermarket quality varies widely, so evaluate the manufacturer and exact product line.',
      'Use extra caution with safety, emissions, calibration, and labor-intensive components.',
      'Keep written warranty terms and proof of maintenance or installation.',
    ],
    sections: [
      {
        heading: 'What OEM actually means',
        paragraphs: [
          'An OEM-branded service part is sold through the vehicle manufacturer’s parts channel. It is intended to meet the manufacturer’s specification for a particular application. The company that physically produced the original factory part may also sell a similar part under its own brand, but the packaging, revision, included hardware, and warranty can differ.',
          'OEM is attractive when a catalog has complicated option splits, the vehicle is under a manufacturer warranty, or the component needs factory calibration. It can also reduce uncertainty when a repair is difficult to access and the cost of repeating the labor is high.',
        ],
      },
      {
        heading: 'What aftermarket includes',
        paragraphs: [
          'Aftermarket covers a broad range: established suppliers that design to original specifications, performance specialists, economy lines, private-label products, and unbranded parts. Treating all of them as one quality level is misleading. Compare the exact manufacturer, product line, certification where relevant, warranty administrator, and seller.',
          'Some aftermarket products intentionally differ from the factory design. A suspension component may use a firmer bushing, a replacement manifold may address a cracking pattern, or a brake pad may trade dust for noise or cold response. A design change can be useful, but it should match the driver’s priorities and the rest of the system.',
        ],
      },
      {
        heading: 'When OEM is often worth considering',
        paragraphs: [
          'Electronic modules, networked sensors, camera and radar hardware, restraint components, emissions devices, and parts requiring software setup are strong candidates for manufacturer guidance. The same applies when a technical service bulletin specifies a revised part number or a repair depends on an exact calibration.',
          'OEM can also make sense for molded trim, weather seals, interior switches, and brackets where small dimensional differences are visible or cause noise. The value is not only durability; it is avoiding hours spent modifying a part that was supposed to fit directly.',
        ],
      },
      {
        heading: 'When aftermarket can be the better value',
        paragraphs: [
          'Common service items such as filters, belts, lighting, brake friction, chassis parts, and rotating electrical components often have several credible aftermarket choices. Established manufacturers may supply clear application data, technical support, and warranties that compete well with the vehicle brand.',
          'Compare product tiers within a brand. An economy line built for an older commuter is not the same proposition as that company’s premium or severe-duty line. Choose for the expected ownership period, annual mileage, climate, load, and installation cost instead of buying by brand name alone.',
        ],
      },
      {
        heading: 'Warranty and recordkeeping',
        paragraphs: [
          'Read what the warranty actually pays. Many replacement-part warranties cover the component but not diagnosis, labor, towing, fluids, programming, or damage to other parts. Confirm who handles a claim and whether you must ship the failed item back before receiving a replacement.',
          'The FTC explains that a vehicle manufacturer generally cannot require a specific brand of paid part or service merely to keep warranty coverage. A manufacturer may deny coverage for damage it can show was caused by a defective part or improper installation. Keep receipts, catalog screenshots, maintenance records, and installation documentation.',
        ],
      },
    ],
    checklist: [
      'Compare exact product lines, not only OEM versus aftermarket labels.',
      'Price the included seals, bolts, clips, fluids, and programming.',
      'Consider the labor cost and risk of repeating the repair.',
      'Read exclusions and the claims process before purchasing.',
      'Keep the receipt, warranty, fitment evidence, and installation record.',
    ],
    sources: [ftcWarranties, ftcAutoWarranties],
  },
  {
    slug: 'brake-pad-buying-guide',
    category: 'Brake system',
    title: 'Brake Pad Buying Guide: Fit, Material, and Total Cost',
    description: 'Choose replacement brake pads by axle, caliper package, friction material, hardware, driving conditions, and rotor condition.',
    intro: [
      'Brake pads are sold for a specific axle and caliper design. The same vehicle can use different front or rear packages based on trim, wheel size, towing equipment, production date, or performance options. Before comparing compounds or prices, establish which brake package is actually installed.',
      'Brakes are safety-critical. This guide supports product comparison, not diagnosis or installation. Unusual pedal feel, fluid loss, pulling, grinding, warning lights, or severe vibration should be evaluated before parts are ordered, and repair work should follow the vehicle service information.',
    ],
    takeaways: [
      'Confirm front or rear axle, rotor diameter, caliper type, and production split.',
      'Choose friction material for the vehicle’s use, not by a single “best” label.',
      'Include hardware, sensors, rotor condition, and break-in requirements in the plan.',
      'Avoid mixing friction formulations across the same axle.',
    ],
    sections: [
      {
        heading: 'Identify the brake package first',
        paragraphs: [
          'Use the VIN, build date, option codes, and existing rotor diameter to resolve catalog choices. Count wear sensors and note whether they are built into the pad or sold separately. Compare the outline and retaining features of the old pad with the listing image, but do not rely on shape alone when multiple compounds share the same backing plate.',
          'A pad set normally services both wheels on one axle. Front and rear sets are separate products. If a listing photo shows four friction pieces, that does not mean it covers all four wheels. Read the position and quantity fields carefully.',
        ],
      },
      {
        heading: 'Understand common friction materials',
        paragraphs: [
          'Ceramic formulations are often selected for controlled noise and lighter-colored dust in normal street use. Semi-metallic formulations can offer strong heat tolerance and pedal response, but may create more visible dust or noise depending on the design. Organic and low-metallic formulations have their own tradeoffs. The label alone does not predict performance because each manufacturer tunes the complete formulation.',
          'Match the product line to the vehicle weight, towing, hills, temperature range, and driving pattern. A commuter pad may not be suitable for repeated heavy loads. A track-oriented compound can perform poorly when cold and may be noisy on the street. Follow the pad manufacturer’s stated use rather than assuming a higher temperature rating is always better.',
        ],
      },
      {
        heading: 'Hardware and wear sensors matter',
        paragraphs: [
          'Confirm whether the set includes abutment clips, shims, retaining springs, lubricant, and electronic wear sensors. Reusing corroded or distorted hardware can prevent smooth pad movement and create noise. Some vehicles require one sensor per axle while others use more than one, and a triggered sensor may not be reusable.',
          'Look for application-specific instructions. Directional pads, inside and outside positions, adhesive shims, and electronic parking brakes can change the procedure. A complete box is valuable only when the included hardware matches the installed caliper.',
        ],
      },
      {
        heading: 'Evaluate the rotors and calipers',
        paragraphs: [
          'New pads cannot correct a sticking caliper, damaged hose, loose wheel bearing, or rotor outside its service specification. Rotor thickness, runout, surface condition, heat checking, and corrosion should be inspected against service limits. Replacing pads against an unsuitable rotor can produce noise, vibration, uneven wear, or reduced performance.',
          'When comparing a pad-only purchase with a pad-and-rotor kit, include the condition of the existing parts and the cost of repeat labor. A bundle is not automatically a better value if the components are an unknown product line or the kit omits required sensors and hardware.',
        ],
      },
      {
        heading: 'Compare the complete purchase',
        paragraphs: [
          'Check axle position, quantity, warranty, shipping date, return rules, and whether opened or installed brake parts can be returned. Add hardware, sensors, rotors, cleaner, approved lubricant, and any single-use fasteners specified by the service procedure.',
          'After installation, the friction manufacturer may specify a bedding or burnishing sequence. Follow the product and vehicle instructions in a safe location. If the pedal is not firm or the vehicle does not stop normally, do not continue driving.',
        ],
      },
    ],
    checklist: [
      'Confirm axle position, caliper package, rotor size, and build date.',
      'Choose a friction line intended for the vehicle’s actual use.',
      'Check included shims, clips, springs, and wear sensors.',
      'Inspect rotor and caliper condition before finalizing the order.',
      'Follow the manufacturer’s installation and bedding information.',
    ],
    sources: [nhtsaRecalls, ftcRepair],
  },
  {
    slug: 'alternator-buying-guide',
    category: 'Starting and charging',
    title: 'Alternator Buying Guide: Output, Fitment, and Core Charges',
    description: 'Compare alternators by rated output, connector, pulley, mounting, remanufacturing quality, warranty, and core-return cost.',
    intro: [
      'An alternator listing can look correct while using a different electrical connector, pulley, mounting ear, regulator strategy, or output rating. Modern charging systems may vary voltage under computer control, so a low dashboard reading is not proof by itself that the alternator has failed.',
      'Confirm the diagnosis and the exact unit before ordering. Battery condition, cable voltage drop, belt tension, a damaged pulley, blown fuse, poor ground, or control-system fault can imitate an alternator problem.',
    ],
    takeaways: [
      'Match the original number, connector, mounting, pulley, and rated output.',
      'Test the battery, cables, belt drive, fuses, and control system first.',
      'Compare new and remanufactured units by process and warranty, not label alone.',
      'Include the refundable core deposit and return shipping in the total cost.',
    ],
    sections: [
      {
        heading: 'Confirm the electrical specification',
        paragraphs: [
          'Catalogs may list several amperage ratings for the same engine. Vehicles with heated accessories, premium audio, towing packages, stop-start systems, or fleet equipment can use a higher-output unit. Match the label or original equipment number whenever possible. Installing a lower-output alternator can leave the battery undercharged during high electrical demand.',
          'More advertised amperage is not automatically an upgrade. The regulator communication, wiring capacity, fuse protection, belt drive, and computer calibration must support the unit. Treat a high-output conversion as a system modification, not a routine replacement.',
        ],
      },
      {
        heading: 'Match the physical details',
        paragraphs: [
          'Compare mounting ears, case clocking, connector shape, terminal location, pulley diameter, groove count, and pulley type. Some vehicles use an overrunning alternator pulley that changes belt behavior. Replacing it with the wrong solid or clutch design can create belt noise, tensioner movement, or charging concerns.',
          'Check what is included. A listing may show a pulley but exclude a terminal nut, protective cap, or mounting hardware. Never assume a generic product photo proves the connector orientation.',
        ],
      },
      {
        heading: 'New versus remanufactured',
        paragraphs: [
          'A new alternator is built from new components, though the manufacturing source and quality controls vary. A remanufactured unit begins with a used core that is disassembled, cleaned, inspected, and rebuilt. The meaningful question is which wear items are replaced, how the rotor and stator are tested, whether the regulator and rectifier are load-tested, and how the final assembly is validated.',
          'A low-cost remanufactured unit can be reasonable for an older vehicle with easy access. A stronger warranty or new unit may be worth more when replacement requires major disassembly. Read whether the warranty covers only the part and who pays return shipping.',
        ],
      },
      {
        heading: 'Understand the core charge',
        paragraphs: [
          'Many rotating electrical parts carry a core deposit. You pay the deposit at purchase and receive it back after returning the original unit in acceptable condition within the stated deadline. The seller may reject a core with a broken case, missing major pieces, or a mismatched application.',
          'For an online order, calculate outbound shipping, core deposit, return label cost, packaging, and the time before the refund. Do not discard the shipping box until the vehicle is repaired and the return instructions are confirmed.',
        ],
      },
      {
        heading: 'Protect the replacement',
        paragraphs: [
          'A weak or internally damaged battery can overload a replacement alternator. Cable resistance, oil or coolant contamination, belt problems, and incorrect jump-starting can also shorten its life. Correct the cause of the failure and charge or replace the battery as required before relying on the new unit to recover it.',
          'Some vehicles require battery monitoring reset, charging-system testing through a scan tool, or relearn procedures. Use service information for the specific vehicle, and have a qualified technician handle high-current connections if you are not equipped for the work.',
        ],
      },
    ],
    checklist: [
      'Confirm diagnosis before removing the original unit.',
      'Match output rating, connector, mounting, and pulley design.',
      'Read the new or remanufactured testing and warranty details.',
      'Calculate the core deposit and return-shipping process.',
      'Test the battery and correct cable or belt problems.',
    ],
    sources: [ftcWarranties, ftcRepair],
  },
  {
    slug: 'starter-motor-buying-guide',
    category: 'Starting and charging',
    title: 'Starter Motor Buying Guide: Diagnose First, Then Match',
    description: 'Select a starter by engine, transmission, tooth count, rotation, mounting, electrical terminals, warranty, and core policy.',
    intro: [
      'A click or no-crank condition does not automatically mean the starter motor is bad. A discharged battery, corroded connection, damaged cable, neutral-safety circuit, immobilizer, relay, engine mechanical problem, or poor ground can produce similar symptoms. Testing first avoids replacing a heavy, difficult part unnecessarily.',
      'Once the starter is confirmed, match the exact application. Units that appear almost identical can differ in pinion depth, tooth count, rotation, nose housing, mounting flange, solenoid position, and electrical terminals.',
    ],
    takeaways: [
      'Confirm battery state and voltage drop before condemning the starter.',
      'Match engine, transmission, mounting, pinion, rotation, and terminal layout.',
      'Evaluate remanufactured products by testing process and warranty support.',
      'Plan the core return before discarding packaging or the original unit.',
    ],
    sections: [
      {
        heading: 'Separate a starter fault from the circuit',
        paragraphs: [
          'Begin with the battery state of charge and terminal condition. Headlights that work are not a complete battery load test. The starter draws far more current than lighting. Measure voltage at the battery and voltage drop across the positive and ground paths during a crank request using an appropriate procedure.',
          'Listen to the symptom, but do not diagnose by sound alone. A rapid series of clicks often points toward low available voltage. One solid click can involve the starter, cables, solenoid, or a mechanically locked engine. No sound may involve the control circuit. Modern vehicles can also inhibit cranking for security or network faults.',
        ],
      },
      {
        heading: 'Resolve application differences',
        paragraphs: [
          'The engine is usually the most important catalog qualifier, but transmission type, drivetrain, model subseries, and production date may also matter. Compare the old unit number and housing. Verify bolt pattern, register diameter, nose length, pinion teeth, rotation, solenoid clocking, battery terminal, and trigger-terminal style.',
          'Some replacement units use a compact gear-reduction design that looks different from the original while being a valid interchange. In that case, rely on a reputable manufacturer catalog and application notes, not visual similarity alone. Confirm any included spacer, shim, adapter lead, or installation bulletin.',
        ],
      },
      {
        heading: 'Compare new and remanufactured starters',
        paragraphs: [
          'A quality remanufacturing process should address wear parts and test the complete unit under load. Useful product information identifies inspection of the armature, commutator, bushings or bearings, brushes, drive assembly, solenoid contacts, and insulation. A vague “tested” label gives less confidence than a documented process and accessible warranty support.',
          'Consider installation difficulty. On some vehicles the starter is exposed and quick to replace. On others it sits under an intake manifold or near exhaust and drivetrain components. When labor is high, consistent quality and a straightforward warranty can matter more than the lowest purchase price.',
        ],
      },
      {
        heading: 'Account for the core and shipping',
        paragraphs: [
          'Core charges are common because the old housing and internal components can be rebuilt. Confirm the return deadline, acceptable condition, required paperwork, and whether the seller supplies a prepaid label. Keep drainable fluids and contamination away from the packaging, and protect terminals and castings during shipment.',
          'A marketplace listing with free outbound shipping may still require the buyer to pay for a heavy return. Compare the delivered price after tax, core deposit, and potential return cost. Also check whether a warranty replacement triggers a second core deposit.',
        ],
      },
      {
        heading: 'Check the system after replacement',
        paragraphs: [
          'Clean and tighten the connections according to service information, secure cable routing away from heat and moving parts, and confirm the battery is healthy. Repeated long crank times can overheat a new starter, so correct fuel, ignition, compression, or control faults that make the engine slow to start.',
          'Starter circuits carry high current. Disconnect and reconnect power using the vehicle procedure, and do not work beneath an unsupported vehicle. If access, testing, or safe lifting is uncertain, use a qualified repair facility.',
        ],
      },
    ],
    checklist: [
      'Load-test the battery and inspect both high-current cable paths.',
      'Record the original starter number and all catalog qualifiers.',
      'Compare mounting, pinion, rotation, solenoid, and terminals.',
      'Review warranty labor exclusions and the core-return deadline.',
      'Correct slow-start or electrical causes that could damage the replacement.',
    ],
    sources: [ftcWarranties, ftcRepair],
  },
  {
    slug: 'oxygen-sensor-buying-guide',
    category: 'Engine management',
    title: 'Oxygen Sensor Buying Guide: Bank, Position, and Connector',
    description: 'Identify the correct upstream or downstream oxygen sensor by bank, sensor number, emissions package, connector, and original part number.',
    intro: [
      'An oxygen-sensor fault code identifies a circuit or operating condition that the engine computer detected. It does not prove that the sensor itself is the only possible cause. Wiring damage, exhaust leaks, fuel-control problems, contamination, heater power, or a failing catalytic converter can produce related codes.',
      'After diagnosis confirms the sensor, position is critical. A vehicle may use two, four, or more oxygen or air-fuel-ratio sensors, and each location can have a different connector, wire length, heater specification, or calibration.',
    ],
    takeaways: [
      'Translate bank and sensor number into a physical location before ordering.',
      'Match emissions package, connector, wire length, and original number.',
      'Prefer a direct-fit sensor when the vehicle uses an application-specific connector.',
      'Diagnose wiring, leaks, mixture faults, and catalyst concerns before replacement.',
    ],
    sections: [
      {
        heading: 'Understand bank and sensor numbering',
        paragraphs: [
          'Bank 1 is the side of the engine containing cylinder 1. Bank 2 is the opposite side on engines with two cylinder banks. Sensor 1 generally refers to the sensor ahead of the catalytic converter for that bank, while Sensor 2 is farther downstream. Inline engines have only one bank, but they can still use multiple sensors along the exhaust.',
          'Do not guess bank location from the driver or passenger side. Cylinder numbering differs by engine family and installation orientation. Use service information or a reliable firing-order reference for the exact engine.',
        ],
      },
      {
        heading: 'Oxygen sensor versus air-fuel-ratio sensor',
        paragraphs: [
          'Many modern vehicles use a wide-range air-fuel-ratio sensor in the upstream position and a conventional oxygen sensor downstream. They may look similar, but the signal strategy and internal design differ. Catalogs sometimes group both under the broad phrase “oxygen sensor,” so the application and part number are more important than the marketing label.',
          'Match federal or California emissions configuration when the catalog asks. The emissions label under the hood can identify the certification family, and different exhaust layouts may use different sensors even within the same model year.',
        ],
      },
      {
        heading: 'Direct-fit versus universal',
        paragraphs: [
          'A direct-fit sensor includes the application-specific connector, wire length, protective sleeve, clips, and grommets. A universal sensor may require joining wires to the original connector. Wire colors are not standardized across every sensor type, and some circuits depend on materials or connection methods that should not be treated like ordinary household wiring.',
          'For most shoppers, direct-fit reduces installation uncertainty and preserves routing away from hot exhaust parts. If a universal product is considered, follow its manufacturer instructions exactly and confirm that it supports the specific sensor technology.',
        ],
      },
      {
        heading: 'Diagnose the surrounding system',
        paragraphs: [
          'Inspect the harness for melting, impact, oil saturation, loose terminals, and corrosion. Verify heater power and ground using the correct wiring diagram. Check for exhaust leaks near the sensor and address engine misfires, fuel-pressure problems, vacuum leaks, oil burning, or coolant contamination that can distort readings or damage a replacement.',
          'A downstream efficiency code may involve catalyst performance rather than a failed downstream sensor. Replacing sensors repeatedly without reviewing data and the rest of the system can hide the symptom temporarily without repairing the cause.',
        ],
      },
      {
        heading: 'Compare the listing carefully',
        paragraphs: [
          'Confirm bank, position, connector image, number of pins, wire length, thread size, included sealing washer, and interchange number. Be cautious with listings that claim one sensor fits every position. A vehicle may use the same thread but different calibration or lead length at each location.',
          'Check whether the warranty excludes contamination or installation damage. Route the harness exactly as designed and use the specified tightening procedure. Exhaust components become extremely hot, so allow the vehicle to cool and use appropriate support and protective equipment.',
        ],
      },
    ],
    checklist: [
      'Confirm the code and diagnosis, not only the part name.',
      'Identify Bank 1 or Bank 2 and Sensor 1 or Sensor 2 correctly.',
      'Match the emissions family, connector, wire length, and original number.',
      'Inspect wiring and correct exhaust or mixture faults.',
      'Use service information for routing and tightening.',
    ],
    sources: [nhtsaVin, ftcRepair],
  },
  {
    slug: 'shocks-vs-struts-buying-guide',
    category: 'Suspension',
    title: 'Shocks vs. Struts: What to Check Before Ordering',
    description: 'Understand shock and strut applications, complete assemblies, electronic suspension options, axle pairing, and alignment costs.',
    intro: [
      'Shocks and struts both control suspension movement, but they are not interchangeable terms. A strut is a structural part of the suspension and often carries the spring and steering knuckle relationship. A shock absorber usually controls motion without serving as the main structural link. Some vehicles use struts at one axle and shocks at the other.',
      'The catalog decision begins with location and suspension package. Electronic damping, self-leveling systems, air suspension, sport packages, wheelbase, drivetrain, and production date can all change the correct component.',
    ],
    takeaways: [
      'Identify front or rear, left or right, and the exact suspension package.',
      'Complete strut assemblies trade higher parts cost for less spring-transfer work.',
      'Electronic or air suspension requires application-specific parts or a documented conversion.',
      'Plan for related mounts, bump stops, fasteners, and wheel alignment.',
    ],
    sections: [
      {
        heading: 'Identify what the vehicle uses',
        paragraphs: [
          'Look behind the wheel or use a manufacturer catalog to determine the design. A strut typically bolts to the steering knuckle and extends upward into a body mount, with the coil spring surrounding it. A shock is usually separate from the spring. Rear struts and shocks can look different from the front arrangement, and left and right struts may have unique brackets.',
          'Record drivetrain, body style, wheelbase, payload or towing package, and suspension option codes. A visual match is not enough when an electronically controlled damper shares dimensions with a passive unit.',
        ],
      },
      {
        heading: 'Bare strut versus complete assembly',
        paragraphs: [
          'A bare strut reuses the existing spring, upper mount, bearing, isolators, dust boot, and bump stop if they remain serviceable. This can preserve the original spring specification and allow selection of a preferred damper. It also requires safe spring compression and careful inspection of every transferred component.',
          'A complete or “quick” strut assembly arrives with the spring and related mounting parts installed. It can reduce labor and avoid handling a compressed spring, but quality depends on the damper, spring rate, mount, bearing, and assembly control. Compare the complete product line, not only the convenience of the bundle.',
        ],
      },
      {
        heading: 'Electronic, air, and self-leveling systems',
        paragraphs: [
          'Vehicles with adaptive damping may have an electrical connector at each damper and a control module that monitors the circuit. Air suspension can combine a damper with an air spring or use separate components. Self-leveling designs can look like ordinary shocks while providing additional load control.',
          'A passive conversion kit changes how the system operates and may require module programming or electronic bypass hardware. Review the kit maker’s complete instructions, expected ride change, warning-light strategy, and legal or inspection implications before replacing an active system.',
        ],
      },
      {
        heading: 'Replace in balanced pairs',
        paragraphs: [
          'Damping differences across the same axle can affect body control and tire contact. Manufacturers commonly sell shocks and struts individually, but replacement is often planned in axle pairs so both sides have similar wear and response. Inspect springs, mounts, control-arm bushings, ball joints, sway-bar links, and tires at the same time.',
          'A leaking damper is evidence of a problem, but not every light film is the same as active leakage. Ride complaints can also come from tires, worn bushings, broken springs, loose steering parts, or alignment. Diagnose the system before ordering the most visible component.',
        ],
      },
      {
        heading: 'Include alignment and hardware',
        paragraphs: [
          'Strut removal can change camber or toe, and some designs use slotted holes or eccentric bolts. Budget for a wheel alignment after the repair when service information calls for it. Confirm whether upper mounts, bearings, boots, bump stops, spring seats, nuts, and single-use fasteners are included.',
          'Suspension springs store substantial energy, and lifting work requires correctly rated equipment and support points. Use a qualified technician if the job involves spring compression, electronic calibration, air-system pressure, or structural fasteners outside your experience.',
        ],
      },
    ],
    checklist: [
      'Confirm axle, side, suspension package, and electronic connector.',
      'Choose bare or complete struts based on component condition and safe labor.',
      'Plan replacement in balanced axle pairs when appropriate.',
      'Inspect mounts, springs, boots, stops, links, and tires.',
      'Include alignment and any required calibration in the total cost.',
    ],
    sources: [nhtsaRecalls, ftcRepair],
  },
  {
    slug: 'compare-total-car-part-cost',
    category: 'Buying strategy',
    title: 'How to Compare the Real Cost of an Online Car Part',
    description: 'Calculate delivered price, shipping, tax, core deposits, hardware, programming, returns, downtime, and warranty risk.',
    intro: [
      'The lowest listing price is not always the lowest repair cost. Two sellers can offer the same apparent component while differing in shipping, delivery date, core deposit, included hardware, return freight, warranty support, and condition. A useful comparison puts every predictable cost on one line before checkout.',
      'CarPartsRadar ranks live listings by available price and shipping information, but shoppers should still inspect the complete offer. Marketplace data changes, and some costs only appear after selecting an address or reading the seller’s terms.',
    ],
    takeaways: [
      'Compare delivered price, not the headline item price.',
      'Separate refundable core deposits from nonrefundable return costs.',
      'Add required hardware, fluids, programming, alignment, and tools.',
      'Value return clarity and downtime when fitment or condition is uncertain.',
    ],
    sections: [
      {
        heading: 'Build a delivered-price baseline',
        paragraphs: [
          'Record item price, shipping, estimated tax, delivery date, and quantity. Confirm whether a listing is one piece, one axle set, one pair, or a complete kit. A low unit price can be misleading when the repair requires two sides or when a photo shows hardware that is not included.',
          'Check the seller location and service level. An inexpensive part that arrives after the vehicle has accumulated rental, rideshare, or missed-work costs may not be the practical bargain. Delivery estimates are not guarantees, but they are part of the decision.',
        ],
      },
      {
        heading: 'Treat the core deposit separately',
        paragraphs: [
          'A core charge is usually refundable if the correct old part is returned on time and in acceptable condition. It still increases the amount paid at checkout and may remain outstanding for weeks. Record the deposit, return deadline, label cost, packaging requirement, and refund method.',
          'The real core cost is the nonrefundable portion: return shipping, packing materials, travel to a store, or a rejected core. Keep the old part intact until the replacement is confirmed, but follow any fluid-draining and hazardous-material instructions from the carrier and seller.',
        ],
      },
      {
        heading: 'List everything needed to finish the repair',
        paragraphs: [
          'Add gaskets, seals, clips, bolts, sensors, fluids, cleaners, approved lubricants, specialty tools, programming, alignment, and disposal fees. Verify whether a kit uses one manufacturer and product line throughout or combines unknown components. A “complete” label is meaningful only when the included-parts list matches the service procedure.',
          'For an installed repair, request a written estimate separating diagnosis, parts, labor, shop supplies, tax, programming, and alignment. If you supply your own part, ask how that changes the shop’s labor warranty and responsibility for a defective component.',
        ],
      },
      {
        heading: 'Price the return risk',
        paragraphs: [
          'Read the return window, restocking fee, condition requirements, and who pays freight. Some electrical, emissions, opened, painted, programmed, or installed parts have restricted returns. Heavy parts can cost enough to ship back that a slightly higher local or seller-backed option becomes cheaper.',
          'Save the listing description, fitment notes, seller messages, photos, and package label. If the wrong part arrives, document the discrepancy before installation. Clear records help distinguish a seller error from a changed mind or an incorrect vehicle selection.',
        ],
      },
      {
        heading: 'Evaluate warranty value realistically',
        paragraphs: [
          'A long warranty is useful only if the company is reachable and the claim terms are workable. Check whether coverage is replacement, repair, or refund; whether labor is excluded; and whether you must return the failed part first. For a difficult repair, a part-only replacement may still leave most of the financial risk with the owner.',
          'Compare warranty value with expected ownership and installation effort. Keep the written warranty and receipt. The FTC advises consumers to review coverage, exclusions, claim procedures, and shipping or labor responsibilities before buying.',
        ],
      },
    ],
    checklist: [
      'Record item price, quantity, shipping, tax, and arrival estimate.',
      'Separate refundable core deposit from return expenses.',
      'Add hardware, fluids, tools, programming, and alignment.',
      'Review return restrictions before opening or installing the part.',
      'Compare warranty process and repeat-labor exposure.',
    ],
    sources: [ftcWarranties, ftcRepair],
  },
]

export const trustPages = {
  about: {
    title: 'About CarPartsRadar',
    description: 'How CarPartsRadar compares live automotive listings, evaluates fitment evidence, and keeps commercial relationships separate from editorial guidance.',
    eyebrow: 'Independent comparison service',
    lead: 'CarPartsRadar helps drivers narrow a noisy parts marketplace into listings that are relevant to a specific vehicle and easier to compare.',
    sections: [
      {
        heading: 'What we do',
        paragraphs: [
          'The search tool combines a driver’s year, make, model, optional trim, and part request with live marketplace data. We organize available price, shipping, condition, seller, and compatibility signals so shoppers can make a more informed shortlist. Purchases happen on the retailer’s website; CarPartsRadar does not sell, stock, or ship parts.',
          'Our product is built for comparison, not for replacing a manufacturer catalog, diagnosis, or professional repair advice. Every shopper should verify the final application and seller terms before purchasing.',
        ],
      },
      {
        heading: 'Why fitment comes first',
        paragraphs: [
          'Automotive catalogs are full of production splits. Engine, drivetrain, body style, trim, emissions package, brake option, build date, and other equipment can change the correct part. We favor listings with stronger compatibility evidence and label uncertainty instead of presenting every keyword match as confirmed.',
          'The vehicle selector uses public NHTSA reference data. Marketplace compatibility and seller-provided details remain subject to change, which is why our guides teach shoppers how to verify part numbers and physical details independently.',
        ],
      },
      {
        heading: 'How the service is funded',
        paragraphs: [
          'CarPartsRadar may earn a commission when a shopper follows certain outbound links and completes a qualifying purchase. This does not increase the shopper’s price. Commercial relationships do not guarantee placement, fitment status, or a favorable editorial conclusion.',
          'Our affiliate disclosure identifies current relationships and explains how tracking links work. We do not claim that every retailer or listing is an affiliate partner.',
        ],
      },
      {
        heading: 'Corrections and questions',
        paragraphs: [
          `Product data changes quickly. If you find an incorrect guide statement, broken link, or recurring fitment issue, contact ${site.email} with the page address and supporting information. We review corrections and update dated content when the evidence supports a change.`,
        ],
      },
    ],
  },
  methodology: {
    title: 'How CarPartsRadar Evaluates Listings',
    description: 'Our methodology for vehicle identification, fitment labels, price comparisons, ranking, editorial review, and corrections.',
    eyebrow: 'Methodology',
    lead: 'We separate three questions that are often mixed together: does the listing describe the requested part, is there evidence it fits the selected vehicle, and what will the purchase actually cost?',
    sections: [
      {
        heading: 'Vehicle and query inputs',
        paragraphs: [
          'Drivers select a model year, make, model, and optional trim or decode a VIN. The selected vehicle and part name form the search context. VIN decoding uses NHTSA data reported by vehicle manufacturers. A VIN can clarify vehicle attributes, but it is not treated as a complete manufacturer parts catalog.',
        ],
      },
      {
        heading: 'Fitment evidence',
        paragraphs: [
          'We distinguish marketplace compatibility evidence from ordinary title keywords. A listing may be labeled verified when the marketplace compatibility response matches the selected vehicle. Listings without that evidence may still be relevant, but they are labeled so the shopper knows to verify the application independently.',
          'We do not convert a seller title, product photo, or broad model-year range into a fitment guarantee. Final confirmation may require engine, drivetrain, body style, option code, build date, dimensions, connector, or original part number.',
        ],
      },
      {
        heading: 'Price and ranking',
        paragraphs: [
          'Where marketplace data provides it, we compare item price and shipping rather than item price alone. Taxes, core deposits, location-dependent freight, coupons, and checkout changes may not be available in the search response. The retailer page remains the final source for price and availability.',
          'Ranking is intended to help shoppers review relevant value, not to certify quality. Condition, seller history, warranty, return rules, delivery timing, and included hardware should be compared before purchase.',
        ],
      },
      {
        heading: 'Editorial process',
        paragraphs: [
          'Guides are written for practical shopping decisions and reviewed for clear scope, fitment qualifiers, total-cost factors, and safety cautions. We cite public primary sources when a guide relies on government consumer or vehicle information. Guides avoid diagnosing a specific vehicle and direct readers to service information or qualified technicians when a repair affects safety or requires specialized equipment.',
          `Each guide displays a review date. Correction requests can be sent to ${site.email}. Affiliate relationships do not determine guide conclusions or remove the requirement to disclose uncertainty.`,
        ],
      },
    ],
  },
  contact: {
    title: 'Contact CarPartsRadar',
    description: 'Contact CarPartsRadar about corrections, privacy, account data, retailer information, accessibility, or business inquiries.',
    eyebrow: 'Contact',
    lead: `Email ${site.email}. Include the page address and enough detail for us to reproduce or investigate the issue.`,
    sections: [
      {
        heading: 'Editorial corrections',
        paragraphs: [
          'For a guide correction, include the guide URL, the statement in question, and a manufacturer, government, or other primary source when available. We do not accept payment to suppress valid corrections or change a fitment label.',
        ],
      },
      {
        heading: 'Listing and retailer issues',
        paragraphs: [
          'For a stale price, incorrect image, unavailable listing, or problematic outbound destination, include the CarPartsRadar page, retailer listing URL, and time observed. Retailers control their own inventory, checkout, fulfillment, returns, and customer support.',
        ],
      },
      {
        heading: 'Privacy and accounts',
        paragraphs: [
          'The privacy policy explains data use and account deletion. Users can permanently delete an account inside the iOS app. Privacy questions or requests can also be sent from the email address associated with the account so ownership can be verified.',
        ],
      },
      {
        heading: 'Business inquiries',
        paragraphs: [
          'Affiliate networks, retailers, data providers, and press contacts should identify their organization and purpose. A commercial relationship does not purchase favorable editorial treatment or automatic placement.',
        ],
      },
    ],
  },
}

export const legalPages = {
  privacy: {
    title: 'Privacy Policy',
    description: 'How CarPartsRadar processes search, account, alert, analytics, VIN, and part-photo data across the website and iOS app.',
    eyebrow: 'Privacy',
    lead: 'CarPartsRadar does not require an account for core search features and does not sell personal data. This policy applies to carpartsradar.com and the CarPartsRadar iOS app.',
    sections: [
      {
        heading: 'Information processed for requested features',
        paragraphs: [
          'Search queries, including vehicle year, make, model, optional trim, and part name, are sent to our servers to request live marketplace listings and vehicle reference data. They are not intentionally attached to an account identity.',
          'If you create an account, we process your email address, optional display name, saved searches, and price-alert settings so those features can work across the website and iOS app. Account-linked information is retained while the account remains active.',
          'If you request part identification from a photo, the image is sent to our server and forwarded to Google Gemini for that request. CarPartsRadar does not intentionally retain the uploaded photo. VIN image recognition occurs on the device; the decoded VIN text may be sent to our server and NHTSA for vehicle identification.',
        ],
      },
      {
        heading: 'Website analytics and local storage',
        paragraphs: [
          'The website uses PostHog for aggregate product analytics, such as feature use and search-flow performance. The iOS app does not include an analytics or advertising SDK. Service providers may process technical information according to their own policies and our configuration.',
          'Garage vehicles, watchlist items, recent searches, and interface preferences are stored locally in the browser or app. Clearing browser storage, deleting the app, or using the audited account-deletion flow removes applicable local data.',
        ],
      },
      {
        heading: 'Email alerts',
        paragraphs: [
          'If you create a price alert, we store the email address, search criteria, target price, and alert status needed to provide the feature. Transactional alert messages may contain an unsubscribe or management method. We do not sell an alert address as a marketing list.',
        ],
      },
      {
        heading: 'Account deletion and retention',
        paragraphs: [
          'The iOS app provides permanent account deletion at Profile, Settings, Account, Delete Account. The confirmed flow removes the Supabase authentication user and known account-linked rows, including saved searches, price alerts, and matching email-only alerts. It is deletion, not temporary deactivation.',
          'Aggregate price observations are not linked to an account and may remain as non-personal product data. Users may also contact us with a privacy request from the email address associated with the account so ownership can be verified.',
        ],
      },
      {
        heading: 'Service providers and external sites',
        paragraphs: [
          'Supabase provides authentication and account-linked storage. eBay and other retailers provide listing data and handle purchases after an outbound click. NHTSA provides vehicle and recall reference data. Google Gemini processes requested part-photo identification. Wikipedia or Wikimedia may provide vehicle imagery. PostHog provides website analytics.',
          'External retailers and services operate under their own privacy policies. CarPartsRadar does not receive payment-card details entered on a retailer website.',
        ],
      },
      {
        heading: 'Contact and updates',
        paragraphs: [
          `Privacy questions and requests may be sent to ${site.email}. We may update this policy when services or legal requirements change. The current review date appears at the top of this page.`,
        ],
      },
    ],
  },
  terms: {
    title: 'Terms of Use',
    description: 'Terms governing use of CarPartsRadar search, comparison, editorial, account, alert, and outbound retailer features.',
    eyebrow: 'Terms',
    lead: 'By using CarPartsRadar, you agree to use the service lawfully and to verify product, repair, price, and seller information before acting on it.',
    sections: [
      {
        heading: 'Service description',
        paragraphs: [
          'CarPartsRadar is an independent search and comparison service. It organizes automotive listings and reference information to help users evaluate potential purchases. CarPartsRadar is not a retailer, dealer, repair facility, parts manufacturer, broker, or agent for a listed seller.',
          'A listing, compatibility label, guide, diagnostic suggestion, recall result, estimated delivery date, or price is informational. It is not a guarantee of fit, availability, condition, safety, legality, delivery, or repair outcome.',
        ],
      },
      {
        heading: 'Your responsibility before purchase or repair',
        paragraphs: [
          'You are responsible for confirming the vehicle configuration, part number, fitment, condition, quantity, included hardware, warranty, return policy, and final checkout price. Manufacturer service information and the retailer listing control over summaries displayed by CarPartsRadar.',
          'Automotive diagnosis and repair can involve stored energy, high current, hot surfaces, pressurized systems, hazardous materials, heavy components, lifting hazards, restraint systems, and high voltage. Use appropriate service information, equipment, and qualified assistance. Do not rely on CarPartsRadar as emergency, safety, or professional repair advice.',
        ],
      },
      {
        heading: 'Retailer transactions',
        paragraphs: [
          'When you follow an outbound link, the retailer controls the transaction, payment, tax, shipping, cancellation, returns, warranty, and customer support. Any dispute about an order is between you and that retailer, subject to the retailer’s terms and applicable law.',
          'Prices and inventory can change without notice. CarPartsRadar may receive a commission from qualifying outbound purchases as described in the affiliate disclosure.',
        ],
      },
      {
        heading: 'Accounts and acceptable use',
        paragraphs: [
          'You are responsible for maintaining the confidentiality of your account credentials and for activity performed through your account. Do not attempt to access another user’s data, interfere with security controls, overload the service, scrape protected endpoints, manipulate attribution, submit malicious content, or use the service unlawfully.',
          'We may restrict access when reasonably necessary to protect users, service availability, data providers, or legal compliance. Users may permanently delete their own accounts through the iOS app.',
        ],
      },
      {
        heading: 'Intellectual property and external content',
        paragraphs: [
          'CarPartsRadar branding, original guides, interface, and software are protected by applicable rights. Retailer names, listing images, product marks, and third-party data belong to their respective owners. Reference to a company or product does not imply endorsement or affiliation.',
          'You may link to public CarPartsRadar pages and quote brief portions of original guides with attribution. You may not republish substantial guide content, copy the service, or use protected material to misrepresent affiliation.',
        ],
      },
      {
        heading: 'Availability and limitation',
        paragraphs: [
          'The service is provided on an as-available basis. To the extent permitted by law, CarPartsRadar disclaims implied warranties regarding the service and is not liable for indirect, incidental, special, consequential, or punitive damages arising from use of the service or an external transaction.',
          'Nothing in these terms excludes a right or responsibility that cannot legally be excluded. If a provision is unenforceable, the remaining provisions continue to apply.',
        ],
      },
      {
        heading: 'Changes and contact',
        paragraphs: [
          `We may update these terms as the service changes. Continued use after an update means the revised terms apply from the stated review date. Questions may be sent to ${site.email}.`,
        ],
      },
    ],
  },
  disclosure: {
    title: 'Affiliate Disclosure',
    description: 'How CarPartsRadar earns commissions, labels commercial relationships, ranks listings, and protects editorial independence.',
    eyebrow: 'Commercial transparency',
    lead: 'Some outbound links are affiliate links. If you follow one and complete a qualifying purchase, CarPartsRadar may receive a commission at no additional cost to you.',
    sections: [
      {
        heading: 'Current relationships',
        paragraphs: [
          'CarPartsRadar participates in the eBay Partner Network and may use Commission Junction links for advertisers that have approved the applicable traffic source. As an Amazon Associate, CarPartsRadar earns from qualifying purchases where eligible Amazon links are used.',
          'An affiliate relationship applies only to the specific approved program and traffic source. We do not place one traffic source’s tracking links into another unapproved source, and we do not claim a commercial relationship with every retailer displayed.',
        ],
      },
      {
        heading: 'What a commission does not buy',
        paragraphs: [
          'A commission does not convert an uncertain listing into verified fitment, guarantee a ranking position, remove a safety warning, or purchase favorable editorial coverage. Search relevance, available fitment evidence, delivered-price signals, and user-selected filters remain separate from whether a purchase could generate revenue.',
          'Retailers do not review or approve CarPartsRadar editorial guides unless a clearly labeled sponsored arrangement says otherwise. There is currently no paid placement in the editorial guide library.',
        ],
      },
      {
        heading: 'Price and transaction responsibility',
        paragraphs: [
          'Affiliate tracking does not change the need to confirm the retailer’s final price, shipping, tax, return policy, warranty, condition, and compatibility information. Retailers control checkout and fulfillment. CarPartsRadar does not receive payment-card information entered on an external retailer website.',
        ],
      },
      {
        heading: 'Questions',
        paragraphs: [
          `Questions about a link or commercial relationship may be sent to ${site.email}. Include the page and retailer URL so the placement can be reviewed.`,
        ],
      },
    ],
  },
}
