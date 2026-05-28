// src/views/LotsView.jsx
import { useEffect, useState, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { watchLots, toggleLot } from '../services/firebase'

function detecterMode(q) {
  if (!q) return 'vide'
  if (/^[A-Z]\d*$/.test(q)) return 'serie'
  if (/^\d+$/.test(q))       return 'numero'
  return 'designation'
}
const MODE_META = {
  vide:        { label:'Numéro · A0012 · désignation', color:'#7A5C40', bg:'#FFF8F0', icon:'🔍' },
  numero:      { label:'Recherche par numéro',          color:'#FF6B00', bg:'#FFEDD5', icon:'🔢' },
  serie:       { label:'Série détectée',                color:'#26C641', bg:'#DCF8E3', icon:'🔤' },
  designation: { label:'Recherche par désignation',     color:'#FF3D3D', bg:'#FFEEEA', icon:'🏷️' },
}

// ── Écran PIN ──────────────────────────────────────────────────────────────
function PinScreen({ onSuccess }) {
  const [code, setCode]   = useState('')
  const [err,  setErr]    = useState(false)
  const ROWS = [['1','2','3'],['4','5','6'],['7','8','9'],['⌫','0','✓']]
  const valider = () => { if (code === '1987') onSuccess(); else { setErr(true); setCode('') } }

  return (
    <div style={{ minHeight:'100dvh', display:'flex', flexDirection:'column', alignItems:'center',
                  justifyContent:'center', background:'linear-gradient(180deg,#CC2200,#FF6B00)',
                  padding:'32px 24px', gap:32 }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ width:72, height:72, borderRadius:22, margin:'0 auto 16px',
                      background:'linear-gradient(135deg,#FF6B00,#FFB800)',
                      display:'flex', alignItems:'center', justifyContent:'center', fontSize:36 }}>🔒</div>
        <h1 style={{ fontFamily:'var(--font)', fontWeight:900, fontSize:32, color:'#fff', margin:'0 0 6px', letterSpacing:-1 }}>
          Tombola
        </h1>
        <p style={{ color:'rgba(255,255,255,.5)', fontSize:14, margin:0 }}>Entrez votre code d'accès</p>
      </div>

      <div style={{ display:'flex', gap:16 }}>
        {[0,1,2,3].map(i => (
          <div key={i} style={{ width:i<code.length?18:14, height:i<code.length?18:14, borderRadius:'50%',
                                 background:err?'#FF3D3D':i<code.length?'#FF6B00':'rgba(255,255,255,.25)',
                                 transition:'all .2s', alignSelf:'center' }} />
        ))}
      </div>

      <div style={{ display:'flex', flexDirection:'column', gap:10, width:'100%', maxWidth:280 }}>
        {ROWS.map((row, ri) => (
          <div key={ri} style={{ display:'flex', gap:10 }}>
            {row.map(key => (
              <button key={key} onClick={() => {
                if (key==='⌫')      { setCode(c=>c.slice(0,-1)); setErr(false) }
                else if (key==='✓') valider()
                else if (code.length<4) { setCode(c=>c+key); setErr(false) }
              }} style={{
                flex:1, aspectRatio:'1.7', borderRadius:16, border:'none', cursor:'pointer',
                background:key==='✓'?'#FF6B00':key==='⌫'?'rgba(255,255,255,.06)':'rgba(255,255,255,.12)',
                color:key==='⌫'?'#FF3D3D':'#fff', fontFamily:'var(--font)', fontWeight:900,
                fontSize:key==='⌫'||key==='✓'?20:24, WebkitTapHighlightColor:'transparent'
              }}>{key}</button>
            ))}
          </div>
        ))}
      </div>
      {err && <p style={{ color:'#FF3D3D', fontWeight:700, fontSize:14, margin:0 }}>❌ Code incorrect</p>}
    </div>
  )
}

// ── Écran principal ────────────────────────────────────────────────────────
export default function LotsView() {
  const navigate    = useNavigate()
  const [authed,    setAuthed]    = useState(false)
  const [lots,      setLots]      = useState([])
  const [loading,   setLoading]   = useState(true)
  const [recherche, setRecherche] = useState('')
  const [filtre,    setFiltre]    = useState('tous')
  const [printDlg,  setPrintDlg]  = useState(false)
  const [toast,     setToast]     = useState(null)
  const unsubRef = useRef(null)

  useEffect(() => {
    // Abonnement unique via firebase.js — watchLots normalise déjà les champs
    unsubRef.current = watchLots(list => {
      setLots(list)
      setLoading(false)
    })
    return () => unsubRef.current?.()
  }, [])

  const showToast = msg => { setToast(msg); setTimeout(() => setToast(null), 2500) }

  const handleToggle = async lot => {
    try {
      await toggleLot(lot.id, lot.gagne)
      showToast(lot.gagne ? `Lot ${lot.numero} remis en jeu` : `🎉 Lot ${lot.numero} gagné !`)
    } catch(e) {
      showToast('❌ ' + e.message)
    }
  }

  const mode     = detecterMode(recherche)
  const modeMeta = MODE_META[mode]

  const lotsFiltres = useMemo(() => lots
    .filter(l => filtre==='gagnes' ? l.gagne : filtre==='non_gagnes' ? !l.gagne : true)
    .filter(l => {
      if (!recherche) return true
      const q = recherche.toUpperCase()
      if (mode==='numero')      return String(l.numero).includes(q)
      if (mode==='serie')       return String(l.numero).startsWith(q)
      if (mode==='designation') return l.designation.toUpperCase().includes(q)
      return true
    }), [lots, filtre, recherche, mode])

  const nbGagnes  = lots.filter(l => l.gagne).length
  const nbTotal   = lots.length
  const nbRestant = nbTotal - nbGagnes
  const pct       = nbTotal > 0 ? nbGagnes / nbTotal : 0

  if (!authed) return <PinScreen onSuccess={() => setAuthed(true)} />

  return (
    <div className="page" style={{ background:'#FFF3E0' }}>

      {/* HEADER */}
      <div style={{ background:'linear-gradient(135deg,#E63000,#FF8C00)', padding:'52px 20px 20px', position:'relative' }}>
        <button className="back-btn" onClick={() => navigate('/')}>‹</button>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
          <div>
            <h1 style={{ fontFamily:'var(--font)', fontWeight:900, fontSize:26, color:'#fff', margin:'0 0 2px', letterSpacing:-0.5 }}>
              🎟️ Tombola
            </h1>
            <p style={{ color:'rgba(255,255,255,.55)', fontSize:13, margin:0 }}>{nbGagnes} / {nbTotal} lots gagnés</p>
          </div>
          <div style={{ position:'relative', width:72, height:72 }}>
            <svg width="72" height="72" style={{ transform:'rotate(-90deg)' }}>
              <circle cx="36" cy="36" r="30" fill="none" stroke="rgba(255,255,255,.15)" strokeWidth="6"/>
              <circle cx="36" cy="36" r="30" fill="none" stroke="#26C641" strokeWidth="6"
                strokeDasharray={`${Math.round(pct*188.5)} 188.5`} strokeLinecap="round"
                style={{ transition:'stroke-dasharray .8s ease' }}/>
            </svg>
            <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center',
                          fontFamily:'var(--font)', fontWeight:900, fontSize:15, color:'#fff' }}>
              {Math.round(pct*100)}%
            </div>
          </div>
        </div>
        <div style={{ height:6, borderRadius:99, background:'rgba(255,255,255,.2)', marginTop:14 }}>
          <div style={{ height:'100%', borderRadius:99, background:'#26C641',
                        width:`${Math.round(pct*100)}%`, transition:'width .8s ease' }} />
        </div>
      </div>

      {/* MINI STATS */}
      <div style={{ display:'flex', gap:10, padding:'14px 16px 0' }}>
        {[
          { label:'Gagnés',   val:nbGagnes,  icon:'✅', bg:'#DCF8E3' },
          { label:'Restants', val:nbRestant, icon:'⏳', bg:'#FFF3CC' },
          { label:'Total',    val:nbTotal,   icon:'📦', bg:'#FFEDD5' },
        ].map(s => (
          <div key={s.label} style={{ flex:1, background:'#fff', borderRadius:18,
                                       border:'1px solid #FFDDB3', padding:'14px 10px',
                                       display:'flex', flexDirection:'column', gap:6 }}>
            <div style={{ width:34, height:34, borderRadius:10, background:s.bg,
                          display:'flex', alignItems:'center', justifyContent:'center', fontSize:16 }}>{s.icon}</div>
            <div style={{ fontFamily:'var(--font)', fontWeight:900, fontSize:22, color:'#1A0A00' }}>{s.val}</div>
            <div style={{ fontSize:11, color:'#7A5C40' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* RECHERCHE */}
      <div style={{ padding:'12px 16px 0', display:'flex', flexDirection:'column', gap:8 }}>
        <div style={{ background:'#fff', borderRadius:18,
                      border:`${recherche?'1.5px':'1px'} solid ${recherche?modeMeta.color+'80':'#FFDDB3'}`,
                      display:'flex', alignItems:'center', padding:'12px 16px', gap:10 }}>
          <span style={{ fontSize:18 }}>🔍</span>
          <input type="text" placeholder="Numéro (123), A0012 ou désignation…"
            value={recherche} onChange={e => setRecherche(e.target.value.toUpperCase())}
            style={{ flex:1, border:'none', outline:'none', fontSize:15,
                     fontFamily:'var(--font-body)', background:'transparent', color:'#1A0A00' }} />
          {recherche && (
            <button onClick={() => setRecherche('')}
              style={{ background:'#FFF8F0', border:'none', borderRadius:'50%',
                       width:24, height:24, cursor:'pointer', fontSize:12,
                       display:'flex', alignItems:'center', justifyContent:'center' }}>✕</button>
          )}
        </div>
        <div style={{ display:'inline-flex', alignItems:'center', gap:6, background:modeMeta.bg,
                      borderRadius:99, padding:'5px 12px', alignSelf:'flex-start' }}>
          <span style={{ fontSize:12 }}>{modeMeta.icon}</span>
          <span style={{ fontSize:12, fontWeight:700, color:modeMeta.color }}>{modeMeta.label}</span>
        </div>
      </div>

      {/* FILTRES */}
      <div style={{ display:'flex', gap:8, padding:'10px 16px 0' }}>
        {[
          { id:'tous',       label:'Tous',       count:nbTotal },
          { id:'gagnes',     label:'Gagnés ✓',   count:nbGagnes },
          { id:'non_gagnes', label:'Non gagnés', count:nbRestant },
        ].map(f => {
          const sel = filtre===f.id
          const bg  = sel ? (f.id==='gagnes'?'#26C641':f.id==='non_gagnes'?'#FF3D3D':'#1A0A00') : '#fff'
          return (
            <button key={f.id} onClick={() => setFiltre(f.id)} style={{
              flex:1, padding:'10px 4px', borderRadius:14, border:sel?'none':'1px solid #FFDDB3',
              background:bg, color:sel?'#fff':'#7A5C40', fontFamily:'var(--font)', fontWeight:900,
              cursor:'pointer', WebkitTapHighlightColor:'transparent' }}>
              <div style={{ fontSize:18 }}>{f.count}</div>
              <div style={{ opacity:.85, fontSize:10 }}>{f.label}</div>
            </button>
          )
        })}
      </div>

      {/* Compteur */}
      <div style={{ padding:'8px 20px 2px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <span style={{ fontSize:13, color:'#7A5C40', fontWeight:600 }}>
          {loading ? 'Chargement…' : `${lotsFiltres.length} lot${lotsFiltres.length>1?'s':''}`}
        </span>
        {(filtre!=='tous'||recherche) && (
          <button onClick={() => { setFiltre('tous'); setRecherche('') }}
            style={{ background:'none', border:'none', color:'#FF6B00', fontWeight:700, fontSize:13, cursor:'pointer' }}>
            Tout afficher
          </button>
        )}
      </div>

      {/* LISTE */}
      <div style={{ flex:1, overflowY:'auto', padding:'8px 16px 100px', display:'flex', flexDirection:'column', gap:10 }}>
        {loading ? (
          <div className="spinner" style={{ borderTopColor:'#FF6B00', borderColor:'#FFDDB3' }} />
        ) : lotsFiltres.length === 0 ? (
          <div style={{ textAlign:'center', padding:'48px 0' }}>
            <div style={{ fontSize:48, marginBottom:12 }}>🎟️</div>
            <p style={{ fontFamily:'var(--font)', fontWeight:800, fontSize:17, color:'#1A0A00', margin:'0 0 6px' }}>
              Aucun lot trouvé
            </p>
            <p style={{ fontSize:14, color:'#7A5C40' }}>Modifiez votre recherche ou vos filtres</p>
          </div>
        ) : lotsFiltres.map(lot => (
          <button key={lot.id} onClick={() => handleToggle(lot)} style={{
            width:'100%', textAlign:'left',
            background:lot.gagne?'#DCF8E3':'#fff',
            border:lot.gagne?'1.5px solid rgba(38,198,65,.3)':'1px solid #FFDDB3',
            borderRadius:20, padding:'16px', cursor:'pointer',
            display:'flex', alignItems:'center', gap:14,
            boxShadow:'0 1px 6px rgba(0,0,0,.04)', WebkitTapHighlightColor:'transparent' }}>
            <div style={{
              width:54, height:54, borderRadius:16, flexShrink:0,
              background:lot.gagne?'rgba(38,198,65,.15)':'rgba(255,61,61,.08)',
              display:'flex', alignItems:'center', justifyContent:'center',
              fontFamily:'var(--font)', fontWeight:900,
              fontSize:String(lot.numero).length>5?11:String(lot.numero).length>3?14:18,
              color:lot.gagne?'#0E7A25':'#BB1A1A' }}>
              {lot.numero}
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontFamily:'var(--font)', fontWeight:700, fontSize:15, color:'#1A0A00' }}>
                Lot n°{lot.numero}
              </div>
              <div style={{ fontSize:13, color:'#7A5C40', marginTop:3,
                            whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                {lot.designation || 'Sans désignation'}
              </div>
              <span style={{
                display:'inline-block', marginTop:8, fontSize:10, fontWeight:700, letterSpacing:.5,
                background:lot.gagne?'rgba(38,198,65,.15)':'rgba(255,61,61,.08)',
                color:lot.gagne?'#0E7A25':'#BB1A1A', borderRadius:8, padding:'3px 8px' }}>
                {lot.gagne ? 'GAGNÉ' : 'EN JEU'}
              </span>
            </div>
            <span style={{ fontSize:28, flexShrink:0 }}>{lot.gagne?'✅':'⭕'}</span>
          </button>
        ))}
      </div>

      {/* FAB impression */}
      <button onClick={() => setPrintDlg(true)} style={{
        position:'fixed', bottom:'calc(24px + var(--safe-bottom))', right:20,
        width:56, height:56, borderRadius:'50%', border:'none',
        background:'#FF6B00', color:'#fff', fontSize:22,
        boxShadow:'0 4px 16px rgba(255,107,0,.4)',
        cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', zIndex:50 }}>
        🖨️
      </button>

      {/* DIALOG IMPRESSION */}
      {printDlg && (
        <div className="overlay" onClick={() => setPrintDlg(false)}>
          <div className="dialog" onClick={e => e.stopPropagation()}>
            <div style={{ textAlign:'center', marginBottom:16 }}>
              <div style={{ fontSize:36, marginBottom:8 }}>🖨️</div>
              <h2 style={{ fontFamily:'var(--font)', fontWeight:900, margin:0 }}>Lots gagnés</h2>
            </div>
            <div style={{ background:'#DCF8E3', borderRadius:14, padding:14,
                          display:'flex', alignItems:'center', gap:10, marginBottom:16 }}>
              <span style={{ fontSize:20 }}>🏆</span>
              <span style={{ fontFamily:'var(--font)', fontWeight:700, color:'#0E7A25' }}>
                {nbGagnes} lot{nbGagnes>1?'s':''} à imprimer
              </span>
            </div>
            <div style={{ maxHeight:220, overflowY:'auto', display:'flex', flexDirection:'column', gap:6, marginBottom:20 }}>
              {nbGagnes === 0
                ? <p style={{ textAlign:'center', color:'#7A5C40' }}>Aucun lot gagné pour l'instant.</p>
                : lots.filter(l=>l.gagne).map(lot => (
                    <div key={lot.id} style={{ background:'#FFF8F0', borderRadius:12, padding:12,
                                               display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                      <span style={{ fontFamily:'var(--font)', fontWeight:700, fontSize:14 }}>✅ N° {lot.numero}</span>
                      <span style={{ fontSize:13, color:'#7A5C40', maxWidth:140,
                                     whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                        {lot.designation}
                      </span>
                    </div>
                  ))
              }
            </div>
            <div style={{ display:'flex', gap:10 }}>
              <button className="btn btn-ghost btn-full" onClick={() => setPrintDlg(false)}>Fermer</button>
              <button className="btn btn-full" disabled={nbGagnes===0}
                style={{ background:nbGagnes>0?'#1A0A00':'#ccc', color:'#fff' }}
                onClick={() => {
                  const txt = lots.filter(l=>l.gagne).map(l=>`N°${l.numero} — ${l.designation}`).join('\n')
                  navigator.clipboard?.writeText(txt)
                  setPrintDlg(false); showToast('📋 Liste copiée !')
                }}>
                📋 Copier la liste
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
