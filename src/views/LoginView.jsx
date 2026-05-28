// src/views/LoginView.jsx — Écran de connexion global PWA
import { useState } from 'react'

// ⚠️ Changez ce mot de passe avant la mise en ligne
const APP_PASSWORD = 'apiec'

export default function LoginView({ onSuccess }) {
  const [pwd,     setPwd]     = useState('')
  const [err,     setErr]     = useState(false)
  const [visible, setVisible] = useState(false)
  const [shake,   setShake]   = useState(false)

  const valider = () => {
    if (pwd === APP_PASSWORD) {
      // Mémoriser la session (survive au rechargement)
      sessionStorage.setItem('kermesse_auth', '1')
      onSuccess()
    } else {
      setErr(true)
      setPwd('')
      setShake(true)
      setTimeout(() => setShake(false), 500)
    }
  }

  return (
    <div style={{
      minHeight: '100dvh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #5E35B1 0%, #7C4DFF 50%, #E91E63 100%)',
      padding: '32px 28px',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Cercles décoratifs */}
      <div style={{
        position: 'absolute', top: -100, left: -100,
        width: 300, height: 300, borderRadius: '50%',
        background: 'rgba(255,255,255,.06)', pointerEvents: 'none'
      }} />
      <div style={{
        position: 'absolute', bottom: -80, right: -80,
        width: 250, height: 250, borderRadius: '50%',
        background: 'rgba(255,255,255,.06)', pointerEvents: 'none'
      }} />
      <div style={{
        position: 'absolute', top: '40%', right: -60,
        width: 180, height: 180, borderRadius: '50%',
        background: 'rgba(233,30,99,.15)', pointerEvents: 'none'
      }} />

      {/* Logo + titre */}
      <div style={{
        animation: 'fadeDown .6s ease both',
        textAlign: 'center',
        marginBottom: 48
      }}>
        <div style={{
          width: 110, height: 110,
          borderRadius: '50%',
          background: 'rgba(255,255,255,.15)',
          backdropFilter: 'blur(10px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 52,
          margin: '0 auto 24px',
          boxShadow: '0 8px 32px rgba(0,0,0,.2)'
        }}>🎪</div>

        <h1 style={{
          fontFamily: 'var(--font)',
          fontWeight: 900,
          fontSize: 36,
          color: '#fff',
          margin: '0 0 6px',
          letterSpacing: -1
        }}>Kermesse</h1>

        <p style={{
          color: 'rgba(255,255,255,.7)',
          fontSize: 15,
          fontWeight: 600,
          letterSpacing: 4,
          margin: 0
        }}>APIEC</p>
      </div>

      {/* Formulaire */}
      <div style={{
        width: '100%',
        maxWidth: 360,
        animation: `${shake ? 'shake' : 'fadeUp'} .5s ease both`,
      }}>
        <div style={{
          background: 'rgba(255,255,255,.12)',
          backdropFilter: 'blur(20px)',
          borderRadius: 24,
          padding: '32px 24px',
          border: '1px solid rgba(255,255,255,.2)',
          boxShadow: '0 8px 32px rgba(0,0,0,.15)'
        }}>
          <div style={{
            fontFamily: 'var(--font)',
            fontWeight: 800,
            fontSize: 20,
            color: '#fff',
            textAlign: 'center',
            marginBottom: 24
          }}>🔐 Accès sécurisé</div>

          {/* Champ mot de passe */}
          <div style={{ position: 'relative', marginBottom: 8 }}>
            <input
              type={visible ? 'text' : 'password'}
              placeholder="Mot de passe"
              value={pwd}
              onChange={e => { setPwd(e.target.value); setErr(false) }}
              onKeyDown={e => e.key === 'Enter' && valider()}
              autoFocus
              style={{
                width: '100%',
                background: 'rgba(255,255,255,.9)',
                border: `2px solid ${err ? '#FF6B6B' : 'transparent'}`,
                borderRadius: 14,
                padding: '14px 48px 14px 16px',
                fontSize: 16,
                fontFamily: 'var(--font-body)',
                color: '#1A1A2E',
                outline: 'none',
                boxSizing: 'border-box',
                transition: 'border-color .2s'
              }}
            />
            <button
              onClick={() => setVisible(v => !v)}
              style={{
                position: 'absolute', right: 12, top: '50%',
                transform: 'translateY(-50%)',
                background: 'none', border: 'none',
                cursor: 'pointer', fontSize: 18, opacity: .6
              }}
            >{visible ? '🙈' : '👁️'}</button>
          </div>

          {err && (
            <p style={{
              color: '#FF6B6B',
              fontSize: 13,
              fontWeight: 600,
              textAlign: 'center',
              margin: '0 0 12px',
              animation: 'fadeUp .3s ease'
            }}>
              ❌ Mot de passe incorrect
            </p>
          )}

          <button
            onClick={valider}
            style={{
              width: '100%',
              marginTop: 8,
              height: 52,
              borderRadius: 14,
              border: 'none',
              background: 'linear-gradient(90deg, #fff 0%, rgba(255,255,255,.9) 100%)',
              color: '#5E35B1',
              fontFamily: 'var(--font)',
              fontWeight: 900,
              fontSize: 16,
              cursor: 'pointer',
              boxShadow: '0 4px 16px rgba(0,0,0,.15)',
              transition: 'transform .12s, opacity .12s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8
            }}
            onMouseDown={e => e.currentTarget.style.transform = 'scale(.97)'}
            onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
          >
            <span>Entrer</span>
            <span style={{ fontSize: 18 }}>→</span>
          </button>
        </div>

        <p style={{
          color: 'rgba(255,255,255,.4)',
          fontSize: 12,
          textAlign: 'center',
          marginTop: 20
        }}>
          Application réservée aux organisateurs
        </p>
      </div>

      <style>{`
        @keyframes fadeDown {
          from { opacity:0; transform:translateY(-20px); }
          to   { opacity:1; transform:translateY(0); }
        }
        @keyframes fadeUp {
          from { opacity:0; transform:translateY(20px); }
          to   { opacity:1; transform:translateY(0); }
        }
        @keyframes shake {
          0%,100% { transform:translateX(0); }
          20%      { transform:translateX(-10px); }
          40%      { transform:translateX(10px); }
          60%      { transform:translateX(-8px); }
          80%      { transform:translateX(8px); }
        }
      `}</style>
    </div>
  )
}
