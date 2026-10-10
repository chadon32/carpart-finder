import test from 'node:test'
import assert from 'node:assert/strict'
import { isPositionSensitivePart, listingPosition, positionChoices } from '../src/lib/listingPosition.js'

// Brake pads, rotors, and suspension parts are sold per axle. A listing for the
// rear axle must not be presented as the top pick for someone shopping for the
// front, so the page reads the axle from the title.
test('the axle is read from the title', () => {
  assert.equal(listingPosition('Front Ceramic Brake Pads for 2010 - 2020 Ford F-150'), 'front')
  assert.equal(listingPosition('For Ford F-150 F150 2012 2013 2014 2015-2020 D1602 Rear Ceramic Brake Disc Pads'), 'rear')
  assert.equal(listingPosition('Front Left &Right Ceramic Brake Pads For Ford F-150'), 'front')
  assert.equal(listingPosition('4pcs Rear Ceramic Brake Pads Set for Honda Civic'), 'rear')
})

test('front and rear together is a kit', () => {
  assert.equal(listingPosition('Front and Rear Ceramic Brake Pads Kit For 2012-2020 Ford F-150'), 'kit')
  assert.equal(listingPosition('Fit 2012 2013 2014 2015 2016 2017-2020 Ford F-150 Front +Rear Ceramic Brake Pads'), 'kit')
  assert.equal(listingPosition('Front/Rear Brake Pad Set'), 'kit')
  assert.equal(listingPosition('Front & Rear Ceramic Disc Brake Pads For Honda Civic'), 'kit')
})

test('a title that does not say is left unknown', () => {
  assert.equal(listingPosition('Disc Brake Pad Set-EX Bosch BE914H'), null)
  assert.equal(listingPosition(''), null)
  assert.equal(listingPosition(undefined), null)
})

test('only per-axle parts offer the choice', () => {
  for (const part of ['Brake Pads', 'Brake Rotors', 'brake pads', 'Shocks and Struts', 'Control Arm', 'Wheel Bearing', 'Coil Springs', 'CV Axle', 'Ball Joint']) {
    assert.equal(isPositionSensitivePart(part), true, part)
  }
  for (const part of ['Oil Filter', 'Battery', 'Spark Plugs', 'Cabin Air Filter', '26350-2T000', 'Windshield Wipers']) {
    assert.equal(isPositionSensitivePart(part), false, part)
  }
})

const front = { title: 'Front Brake Pads' }
const rear = { title: 'Rear Brake Pads' }
const kit = { title: 'Front and Rear Brake Pads Kit' }
const unknown = { title: 'Brake Pad Set' }

test('the choice is offered only when the results really mix axles', () => {
  assert.deepEqual(positionChoices([front, rear, kit, unknown], 'Brake Pads'), ['front', 'rear', 'kit'])
  assert.deepEqual(positionChoices([front, rear], 'Brake Rotors'), ['front', 'rear'])
  assert.deepEqual(positionChoices([front, front, unknown], 'Brake Pads'), [])
  assert.deepEqual(positionChoices([rear, kit], 'Oil Filter'), [])
  assert.deepEqual(positionChoices([], 'Brake Pads'), [])
})
