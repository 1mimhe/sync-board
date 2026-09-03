import { useEffect, useState } from 'react'
import { healthApi } from '../api/endpoints'
import { IconActivity, IconCheck } from '../components/common/Icons'

export function HealthPage() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [lastChecked, setLastChecked] = useState<string>('')

  const checkHealth = async () => {
    setLoading(true)
    const res = await healthApi.getHealth()
    setData(res.data || res)
    setLastChecked(new Date().toLocaleTimeString())
    setLoading(false)
  }

  useEffect(() => {
    checkHealth()
  }, [])

  const isOk = data?.status === 'ok'
  const details = data?.info || data?.details || {}

  return (
    <div style={{ display: 'grid', gap: 20, maxWidth: 900, margin: '0 auto', width: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 900, display: 'flex', alignItems: 'center', gap: 10 }}>
            <IconActivity size={22} style={{ color: isOk ? 'var(--emerald)' : 'var(--amber)' }} /> System Health & Diagnostics
          </h1>
          <p style={{ color: 'var(--muted)', fontSize: 13.5, marginTop: 4 }}>
            Live status indicators for PostgreSQL database, Redis distributed pub/sub, and API gateway.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {lastChecked && (
            <span style={{ fontSize: 12, color: 'var(--muted2)' }}>
              Checked @ {lastChecked}
            </span>
          )}
          <button className="btn btn-primary btn-sm" onClick={checkHealth} disabled={loading}>
            {loading ? 'Running Diagnostics…' : 'Re-check Diagnostics'}
          </button>
        </div>
      </div>

      {/* Overview Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
        {/* API Gateway Card */}
        <div className="card" style={{ padding: 20, display: 'grid', gap: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--muted)' }}>API Microservice</span>
            <span
              className="badge"
              style={{
                background: isOk ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                color: isOk ? '#6ee7b7' : '#fca5a5',
                borderColor: isOk ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)',
                fontWeight: 800,
              }}
            >
              {isOk ? 'HEALTHY' : 'DEGRADED'}
            </span>
          </div>
          <div style={{ fontSize: 20, fontWeight: 900, color: '#fff' }}>
            SyncBoard Engine
          </div>
          <div style={{ fontSize: 12, color: 'var(--muted2)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <IconCheck size={14} style={{ color: 'var(--emerald)' }} /> HTTP 200 • WebSocket Hub Active
          </div>
        </div>

        {/* Database Card */}
        <div className="card" style={{ padding: 20, display: 'grid', gap: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--muted)' }}>PostgreSQL Database</span>
            <span
              className="badge"
              style={{
                background: details?.database?.status === 'up' || isOk ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                color: details?.database?.status === 'up' || isOk ? '#6ee7b7' : '#fca5a5',
                borderColor: details?.database?.status === 'up' || isOk ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)',
                fontWeight: 800,
              }}
            >
              {details?.database?.status === 'up' || isOk ? 'ONLINE' : 'DOWN'}
            </span>
          </div>
          <div style={{ fontSize: 20, fontWeight: 900, color: '#fff' }}>
            Prisma ORM
          </div>
          <div style={{ fontSize: 12, color: 'var(--muted2)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <IconCheck size={14} style={{ color: 'var(--emerald)' }} /> Primary Connection Pool
          </div>
        </div>

        {/* Redis Cache & Socket Adapter Card */}
        <div className="card" style={{ padding: 20, display: 'grid', gap: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--muted)' }}>Redis Distributed Cache</span>
            <span
              className="badge"
              style={{
                background: details?.redis?.status === 'up' || isOk ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                color: details?.redis?.status === 'up' || isOk ? '#6ee7b7' : '#fca5a5',
                borderColor: details?.redis?.status === 'up' || isOk ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)',
                fontWeight: 800,
              }}
            >
              {details?.redis?.status === 'up' || isOk ? 'ONLINE' : 'DOWN'}
            </span>
          </div>
          <div style={{ fontSize: 20, fontWeight: 900, color: '#fff' }}>
            Redis 7.x
          </div>
          <div style={{ fontSize: 12, color: 'var(--muted2)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <IconCheck size={14} style={{ color: 'var(--emerald)' }} /> Dual-Key Presence & Socket Relay
          </div>
        </div>
      </div>

      {/* Raw Diagnostic JSON */}
      <div className="card" style={{ padding: 20, display: 'grid', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 800, fontSize: 14 }}>Raw NestJS Terminus Diagnostic Payload</span>
          <span style={{ fontSize: 11, color: 'var(--muted)' }}>GET /api/health</span>
        </div>

        <pre
          style={{
            background: 'var(--bg)',
            padding: 16,
            borderRadius: 12,
            border: '1px solid var(--border)',
            fontSize: 12.5,
            fontFamily: 'Consolas, Monaco, monospace',
            color: '#c4b5fd',
            overflow: 'auto',
            maxHeight: 300,
            lineHeight: 1.5,
          }}
        >
          {JSON.stringify(data, null, 2)}
        </pre>
      </div>
    </div>
  )
}
