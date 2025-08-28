import React, { useEffect, useMemo, useState } from 'react'

const days = [
  { id: 1, name: 'Monday' },
  { id: 2, name: 'Tuesday' },
  { id: 3, name: 'Wednesday' },
  { id: 4, name: 'Thursday' },
  { id: 5, name: 'Friday' },
  { id: 6, name: 'Saturday' },
  { id: 7, name: 'Sunday' },
]

export default function App() {
  // Prefer explicit VITE_API_BASE; fall back to '' in dev (use Vite proxy),
  // and http://localhost:5000 in non-dev (e.g., vite preview or static hosting)
  const API_BASE = (
    import.meta.env.VITE_API_BASE ?? (import.meta.env.DEV ? '' : 'http://localhost:8080')
  ).replace(/\/$/, '')
  const [airports, setAirports] = useState([])
  const [loadingAirports, setLoadingAirports] = useState(true)
  const [airportId, setAirportId] = useState('')
  const [dayId, setDayId] = useState('')
  const [predicting, setPredicting] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  // simple in-memory cache for predictions by key "day-airport"
  const cache = useMemo(() => new Map(), [])
  console.log('Fetched airports', API_BASE)

  useEffect(() => {
    let canceled = false
  async function loadAirports() {
      try {
        setLoadingAirports(true)
    const res = await fetch(`${API_BASE}/airports`)
        if (!res.ok) throw new Error(`Failed to load airports: ${res.status}`)
        const data = await res.json()
        if (!canceled) {
          setAirports(data)
          // preselect first airport and Monday for convenience
          if (data.length && !airportId) setAirportId(String(data[0].AirportID ?? data[0].airport_id ?? data[0].id))
          if (!dayId) setDayId('1')
        }
      } catch (e) {
        if (!canceled) setError(String(e.message || e))
      } finally {
        if (!canceled) setLoadingAirports(false)
      }
    }
    loadAirports()
    return () => { canceled = true }
  }, [])

  async function onPredict(e) {
    e.preventDefault()
    setError('')
    setResult(null)
    const day = Number(dayId)
    const airport = Number(airportId)
    if (!day || !airport) {
      setError('Please select a day and an airport.')
      return
    }
    const key = `${day}-${airport}`
    if (cache.has(key)) {
      setResult(cache.get(key))
      return
    }
    try {
      setPredicting(true)
      const res = await fetch(`${API_BASE}/predict?day_of_week=${day}&airport_id=${airport}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Prediction failed')
      cache.set(key, data)
      setResult(data)
    } catch (e) {
      setError(String(e.message || e))
    } finally {
      setPredicting(false)
    }
  }

  const percent = (v) => `${Math.round(Number(v) * 100)}%`

  return (
    <div className="container">
      <div className="panel">
        <h1>Flight Delay Predictor</h1>
        <p className="muted">Pick a day of the week and a destination airport to see the chance of delay.</p>

        <form onSubmit={onPredict}>
          <div className="grid">
            <div>
              <label htmlFor="day">Day of week</label>
              <select id="day" value={dayId} onChange={(e) => setDayId(e.target.value)}>
                <option value="" disabled>Select day</option>
                {days.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="airport">Airport</label>
              <select id="airport" value={airportId} onChange={(e) => setAirportId(e.target.value)} disabled={loadingAirports}>
                <option value="" disabled>{loadingAirports ? 'Loading…' : 'Select airport'}</option>
                {airports.map((a) => {
                  const id = a.AirportID ?? a.airport_id ?? a.id
                  const name = a.AirportName ?? a.name ?? a.AIRPORT ?? `Airport ${id}`
                  return <option key={id} value={id}>{name}</option>
                })}
              </select>
            </div>
          </div>

          <div className="row" style={{ marginTop: 16 }}>
            <button type="submit" disabled={predicting || !dayId || !airportId}>
              {predicting ? 'Predicting…' : 'Predict'}
            </button>
          </div>
        </form>

        {error && <div className="result error">{error}</div>}
        {result && !error && (
          <div className="result">
            <div>
              Chance of delay: <strong>{percent(result.delay_probability)}</strong>
            </div>
            {'confidence' in result && (
              <div className="muted">Model confidence: {percent(result.confidence)}</div>
            )}
            {result.input && (
              <div className="muted" style={{ marginTop: 6 }}>
                For day {result.input.day_of_week}, airport {result.input.airport_id}
              </div>
            )}
          </div>
        )}

        <div className="footer">Backend API expected at <code>http://localhost:5000</code>. During dev, requests are proxied.</div>
      </div>
    </div>
  )
}
