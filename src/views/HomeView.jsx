// src/views/HomeView.jsx
// Miroir de HomeActivity.kt + ModernHomeScreen
import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { watchCAJour } from '../services/firebase'

const MENU = [
  { id: 'caisse',   label: 'Caisse',        icon: '🛒', path: '/caisse',   color: '#FF9800', bg: '#FFF3E0' },
  { id: 'lots',     label: 'Lots Tombola',  icon: '🎁', path: '/lots',     color: '#E91E63', bg: '#FCE4EC' },
  { id: 'colorrun', label: 'Color Run',     icon: '🏃', path: '/colorrun', color: '#7C4DFF', bg: '#EDE7F6' },
  { id: 'planning', label: 'Planning',      icon: '📅', path: '/planning', color: '#6A43C7', bg: '#EDE7F6' },
  { id: 'stats',    label: 'Statistiques',  icon: '📊', path: '/stats',    color: '#009688', bg: '#E0F2F1' },
  { id: 'admin',    label: 'Administration',icon: '⚙️', path: '/admin',    color: '#5E35B1', bg: '#EDE7F6' },
]

export default function HomeView() {
  const navigate = useNavigate()
  const [stats, setStats]   = useState({ total: 0, nb: 0, loading: true })
  const [visible, setVisible] = useState(false)
  const unsubRef = useRef(null)

  useEffect(() => {
    // Animation d'entrée
    const t = setTimeout(() => setVisible(true), 50)

    // Écoute CA du jour (miroir de HomeViewModel.loadQuickStats)
    unsubRef.current = watchCAJour(({ total, nb }) => {
      setStats({ total, nb, loading: false })
    })

    return () => {
      clearTimeout(t)
      unsubRef.current?.()
    }
  }, [])

  return (
    <div className="page" style={{ background: 'var(--bg)' }}>
      {/* ── Fond décoratif ── */}
      <div style={{
        position: 'absolute', top: -80, left: -80,
        width: 300, height: 300,
        background: 'radial-gradient(circle, rgba(124,77,255,.08), transparent 70%)',
        borderRadius: '50%', pointerEvents: 'none'
      }} />

      <div style={{ padding: '0 20px 32px', flex: 1 }}>
        {/* ── Header ── */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 56, paddingBottom: 8 }}>
          {/* Logo pulsant */}
          <div
            className={visible ? 'anim-scalein' : ''}
            style={{
              width: 120, height: 120,
              borderRadius: '50%',
              background: '#fff',
              boxShadow: '0 8px 32px rgba(106,67,199,.18)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: 20,
              fontSize: 56,
              animation: visible ? 'pulse 3s ease-in-out infinite' : 'none'
            }}
          >
            🎪
          </div>
          <h1 style={{
            fontFamily: 'var(--font)',
            fontWeight: 900,
            fontSize: 36,
            letterSpacing: -1,
            color: 'var(--text)',
            margin: 0
          }}>Kermesse</h1>
          <p style={{ color: 'var(--text-muted)', fontWeight: 700, letterSpacing: 3, fontSize: 12, marginTop: 4 }}>APIEC</p>
        </div>

        {/* ── Quick Stats ── */}
        <div
          className={`card anim-fadeup delay-1`}
          style={{ margin: '24px 0', display: 'flex', justifyContent: 'space-around', alignItems: 'center', padding: '20px 16px' }}
        >
          {stats.loading ? (
            <div className="spinner" style={{ margin: '0 auto' }} />
          ) : (
            <>
              <div className="stat-pill">
                <span style={{ fontSize: 18 }}>💰</span>
                <span className="value">{stats.total.toFixed(2)} €</span>
                <span className="label">Aujourd'hui</span>
              </div>
              <div className="divider-v" />
              <div className="stat-pill">
                <span style={{ fontSize: 18 }}>🏷️</span>
                <span className="value">{stats.nb}</span>
                <span className="label">Ventes</span>
              </div>
              <div className="divider-v" />
              <div className="stat-pill">
                <span style={{ fontSize: 18 }}>✨</span>
                <span className="value">{MENU.length}</span>
                <span className="label">Activités</span>
              </div>
            </>
          )}
        </div>

        {/* ── Menu principal ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {MENU.map((item, i) => (
            <button
              key={item.id}
              className={`menu-card anim-fadeup delay-${Math.min(i + 2, 6)}`}
              onClick={() => navigate(item.path)}
            >
              <div className="menu-icon" style={{ background: item.bg }}>
                {item.icon}
              </div>
              <span style={{
                fontFamily: 'var(--font)',
                fontWeight: 800,
                fontSize: 17,
                color: 'var(--text)'
              }}>{item.label}</span>
              <span className="chevron">›</span>
            </button>
          ))}
        </div>

        {/* ── Footer ── */}
        <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 12, marginTop: 32 }}>
          Kermesse APIEC — v1.0
        </p>
      </div>

      <style>{`
        @keyframes pulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.04)} }
      `}</style>
    </div>
  )
}
