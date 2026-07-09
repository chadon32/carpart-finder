import { useEffect, useState } from 'react'
import { router } from 'expo-router'
import { PickerList } from '@/components/PickerList'
import { fetchMakes, fetchModels, fetchTrims } from '@/api/client'
import { useGarage } from '@/stores/garage'

const YEARS = Array.from({ length: 2027 - 1990 }, (_, i) => String(2026 - i))

export default function VehiclePicker() {
  const addVehicle = useGarage((s) => s.addVehicle)
  const [year, setYear] = useState<string | null>(null)
  const [make, setMake] = useState<string | null>(null)
  const [model, setModel] = useState<string | null>(null)
  const [makes, setMakes] = useState<string[]>([])
  const [models, setModels] = useState<string[]>([])
  const [trims, setTrims] = useState<string[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!year || make) return
    setLoading(true)
    fetchMakes()
      .then((r) => setMakes(r.makes))
      .catch(() => setMakes([]))
      .finally(() => setLoading(false))
  }, [year, make])

  useEffect(() => {
    if (!year || !make || model) return
    setLoading(true)
    fetchModels(make, year)
      .then((r) => setModels(r.models))
      .catch(() => setModels([]))
      .finally(() => setLoading(false))
  }, [year, make, model])

  useEffect(() => {
    if (!year || !make || !model) return
    setLoading(true)
    fetchTrims(year, make, model)
      .then((r) => setTrims(r.trims))
      .catch(() => setTrims([]))
      .finally(() => setLoading(false))
  }, [year, make, model])

  const finish = (trim: string) => {
    const car = { year: year!, make: make!, model: model!, trim }
    addVehicle(car)
    router.replace({ pathname: '/part-picker', params: car })
  }

  return !year ? (
    <PickerList title="Year" options={YEARS} onSelect={setYear} />
  ) : !make ? (
    <PickerList title="Make" options={makes} loading={loading} searchable onSelect={setMake} />
  ) : !model ? (
    <PickerList title="Model" options={models} loading={loading} searchable onSelect={setModel} />
  ) : (
    <PickerList
      title="Trim (optional)"
      options={['Skip', ...trims]}
      loading={loading}
      onSelect={(t) => finish(t === 'Skip' ? '' : t)}
    />
  )
}
