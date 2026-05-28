// src/views/AdminView.jsx — miroir fidèle de AdminActivity.kt + AdminLoginActivity
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { db } from '../services/firebase'
import { collection, getDocs, deleteDoc, doc, writeBatch } from 'firebase/firestore'

const ADMIN_CODE = '1707'

// ── Collections réinitialisables (miroir de ResetTarget) ─────────────────
const RESET_TARGETS = [
  { id:'PRODUITS',      label:'Produits & Stock',          icon:'🏪', collections:['produits','stock'] },
  { id:'ACTIVITES',     label:'Activités',                 icon:'🎮', collections:['activites','compteurs_activites'] },
  { id:'LOTS',          label:'Lots de tombola',           icon:'🎁', collections:['lots_tombola'] },
  { id:'BENEVOLES',     label:'Bénévoles',                 icon:'👥', collections:['benevoles','consommations_benevoles','droits_benevoles'] },
  { id:'PLANNING',      label:'Planning',                  icon:'📅', collections:['planning'] },
  { id:'COLOR_RUN',     label:'Participants Color Run',    icon:'🏃', collections:['participants_colorrun'] },
  { id:'VENTES',        label:'Ventes',                    icon:'🧾', collections:['ventes'] },
  { id:'DONS',          label:'Dons',                      icon:'❤️', collections:['dons'] },
  { id:'OFFERTS',       label:'Offerts',                   icon:'🎀', collections:['offerts'] },
  { id:'GROUPES_CONSO', label:'Groupes conso',             icon:'📂', collections:['groupes_conso'] },
  { id:'TOUT',          label:'TOUT réinitialiser',        icon:'🗑️', collections:['produits','stock','activites','compteurs_activites','lots_tombola','benevoles','consommations_benevoles','droits_benevoles','planning','participants_colorrun','ventes','dons','offerts','groupes_conso'], danger:true },
]

// ── Navigation rapide (miroir de NavigationGrid) ──────────────────────────
const NAV_ITEMS = [
  { route:'/caisse',   label:'Caisse',      icon:'🛒', color:'#4CAF50' },
  { route:'/lots',     label:'Tombola',     icon:'🎁', color:'#FF9800' },
  { route:'/colorrun', label:'Color Run',   icon:'🏃', color:'#E91E63' },
  { route:'/stats',    label:'Statistiques',icon:'📊', color:'#9C27B0' },
  { route:'/benevole', label:'Bénévoles',   icon:'👥', color:'#2196F3' },
  { route:'/planning', label:'Planning',    icon:'📅', color:'#795548' },
]

// ── Écran PIN (miroir de AdminLoginActivity) ──────────────────────────────
function LoginScreen({ onSuccess }) {
  const [code, setCode] = useState('')
  const [err,  setErr]  = useState(false)
  const navigate = useNavigate()

  const valider = () => {
    if (code === ADMIN_CODE) onSuccess()
    else { setErr(true); setCode('') }
  }

  return (
    <div className="page page-scroll" style={{ justifyContent:"center", padding:"0 32px", background:"#F2F2F7" }}>
      <button onClick={() => navigate('/')} style={{
        position:'fixed', top:16, left:16,
        background:'var(--violet-surface)', border:'none', borderRadius:'50%',
        width:38, height:38, display:'flex', alignItems:'center', justifyContent:'center',
        color:'var(--violet)', fontSize:20, cursor:'pointer'
      }}>‹</button>

      <div style={{ textAlign:'center', marginBottom:32 }}>
        <div style={{ fontSize:56, marginBottom:16 }}>⚙️</div>
        <h1 style={{ fontFamily:'var(--font)', fontWeight:900, fontSize:28, margin:'0 0 8px' }}>
          Administration
        </h1>
        <p style={{ color:'var(--text-muted)', margin:0 }}>Accès réservé aux organisateurs</p>
      </div>

      <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
        <input type="password" inputMode="numeric" placeholder="Code PIN"
          value={code} onChange={e => { setCode(e.target.value); setErr(false) }}
          onKeyDown={e => e.key==='Enter' && valider()}
          style={{ borderColor: err?'#D32F2F':undefined, fontSize:20,
                   letterSpacing:8, textAlign:'center' }}
          autoFocus />
        {err && <p style={{ color:'#D32F2F', textAlign:'center', fontSize:13, margin:0 }}>
          Code incorrect
        </p>}
        <button className="btn btn-primary btn-full" onClick={valider} style={{ fontSize:16, height:52 }}>
          Accéder
        </button>
      </div>
    </div>
  )
}

// ── Vue principale admin ──────────────────────────────────────────────────
function AdminDashboard({ onLogout }) {
  const navigate  = useNavigate()
  const [stats,   setStats]   = useState({ activites:0, benevoles:0, lots:0, colorrun:0 })
  const [loading, setLoading] = useState(false)
  const [toast,   setToast]   = useState(null)
  const [resetDlg,setResetDlg]= useState(null)   // target en attente de confirmation
  const [section, setSection] = useState('nav')   // 'nav' | 'reset'

  const showToast = (msg, ms=3000) => { setToast(msg); setTimeout(()=>setToast(null), ms) }

  // Chargement stats (miroir de chargerStatistiques)
  useEffect(() => {
    Promise.all([
      getDocs(collection(db,'compteurs_activites')),
      getDocs(collection(db,'benevoles')),
      getDocs(collection(db,'lots_tombola')),
      getDocs(collection(db,'participants_colorrun')),
    ]).then(([a,b,l,c]) => setStats({
      activites: a.size, benevoles: b.size, lots: l.size, colorrun: c.size
    }))
  }, [])

  // ── Réinitialisation (miroir de resetCollections) ──────────────────────
  const resetCollections = async (target) => {
    setLoading(true); setResetDlg(null)
    try {
      for (const col of target.collections) {
        const snap = await getDocs(collection(db, col))
        if (snap.empty) continue
        const batch = writeBatch(db)
        snap.docs.forEach(d => batch.delete(d.ref))
        await batch.commit()
      }
      showToast(`✅ ${target.label} réinitialisé`)
      // Recharge stats
      const [a,b,l,c] = await Promise.all([
        getDocs(collection(db,'compteurs_activites')),
        getDocs(collection(db,'benevoles')),
        getDocs(collection(db,'lots_tombola')),
        getDocs(collection(db,'participants_colorrun')),
      ])
      setStats({ activites:a.size, benevoles:b.size, lots:l.size, colorrun:c.size })
    } catch(e) {
      showToast('❌ Erreur : ' + e.message)
    }
    setLoading(false)
  }

  // ── Consolidation produits (miroir de consoliderProduits) ───────────────
  const consoliderProduits = async () => {
    setLoading(true)
    try {
      const snap = await getDocs(collection(db, 'produits'))
      const grouped = {}
      snap.docs.forEach(d => {
        const key = (d.data().nom ?? '').trim().toLowerCase()
        if (!grouped[key]) grouped[key] = []
        grouped[key].push(d)
      })
      const batch = writeBatch(db)
      let nbDoublons = 0
      Object.values(grouped).forEach(docs => {
        if (docs.length <= 1) return
        nbDoublons += docs.length - 1
        const premier = docs[0]
        const stockTotal = docs.reduce((s,d) => s + (d.data().stock??0), 0)
        const prixMax    = Math.max(...docs.map(d => d.data().prix??0))
        const illimite   = docs.some(d => d.data().illimite)
        batch.update(premier.ref, { stock:stockTotal, prix:prixMax, illimite })
        docs.slice(1).forEach(d => batch.delete(d.ref))
      })
      if (nbDoublons > 0) { await batch.commit(); showToast(`✅ ${nbDoublons} doublons fusionnés`) }
      else showToast('Aucun doublon détecté ✓')
    } catch(e) { showToast('❌ ' + e.message) }
    setLoading(false)
  }

  // ── Export CSV (version simplifiée — remplace l'export Excel) ────────────
  const exporterCSV = async () => {
    setLoading(true)
    try {
      const ventesSnap = await getDocs(collection(db,'ventes'))
      const rows = ['Produit,Prix,Quantite,Total,Type,Timestamp']
      ventesSnap.docs.forEach(d => {
        const data = d.data()
        rows.push([
          `"${data.produit??''}"`,
          data.prix??0,
          data.quantite??1,
          ((data.prix??0)*(data.quantite??1)).toFixed(2),
          `"${data.type??''}"`,
          data.timestamp ? new Date(data.timestamp).toLocaleString('fr-FR') : ''
        ].join(','))
      })
      const blob = new Blob([rows.join('\n')], { type:'text/csv;charset=utf-8;' })
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href = url
      a.download = `kermesse_ventes_${new Date().toISOString().slice(0,10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
      showToast('✅ Export CSV téléchargé !')
    } catch(e) { showToast('❌ ' + e.message) }
    setLoading(false)
  }

  return (
    <div className="page page-scroll" style={{ background:'#1C1B1F' }}>

      {/* ── HEADER ── */}
      <div style={{
        background:'linear-gradient(135deg,#4A148C,#7B1FA2)',
        padding:'52px 20px 20px', position:'relative'
      }}>
        <button onClick={onLogout} style={{
          position:'absolute', top:16, left:16,
          background:'rgba(255,255,255,.15)', border:'none', borderRadius:'50%',
          width:38, height:38, color:'#fff', fontSize:20, cursor:'pointer',
          display:'flex', alignItems:'center', justifyContent:'center'
        }}>‹</button>

        <div style={{ position:'absolute', top:16, right:16 }}>
          <button onClick={onLogout} style={{
            background:'rgba(255,255,255,.15)', border:'none', borderRadius:10,
            padding:'6px 12px', color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer'
          }}>🔒 Déconnexion</button>
        </div>

        <h1 style={{ fontFamily:'var(--font)', fontWeight:900, fontSize:24, color:'#fff', margin:'0 0 4px' }}>
          Administration
        </h1>
        <p style={{ color:'rgba(255,255,255,.7)', fontSize:13, margin:'0 0 20px' }}>
          Gestion de la kermesse
        </p>

        {/* Stats rapides */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:8 }}>
          {[
            { label:'Activités',  val:stats.activites, color:'#4CAF50' },
            { label:'Bénévoles',  val:stats.benevoles, color:'#2196F3' },
            { label:'Lots',       val:stats.lots,      color:'#FF9800' },
            { label:'Color Run',  val:stats.colorrun,  color:'#E91E63' },
          ].map(s => (
            <div key={s.label} style={{
              background:`${s.color}22`, borderRadius:12, padding:'10px 6px', textAlign:'center'
            }}>
              <div style={{ fontFamily:'var(--font)', fontWeight:900, fontSize:20, color:s.color }}>{s.val}</div>
              <div style={{ fontSize:10, color:'rgba(255,255,255,.7)' }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── ONGLETS ── */}
      <div style={{ display:'flex', background:'#2B2930', borderBottom:'1px solid #3D3A45' }}>
        {[['nav','Navigation'],['outils','Outils'],['reset','⚠️ Réinit.']].map(([id,label]) => (
          <button key={id} onClick={() => setSection(id)} style={{
            flex:1, padding:'12px 4px', border:'none', background:'none',
            color: section===id ? '#BB86FC' : 'rgba(255,255,255,.5)',
            fontFamily:'var(--font)', fontWeight:700, fontSize:12,
            borderBottom: section===id ? '2px solid #BB86FC' : '2px solid transparent',
            cursor:'pointer'
          }}>{label}</button>
        ))}
      </div>

      <div style={{ padding:'16px 16px 32px',
                    display:'flex', flexDirection:'column', gap:12 }}>

        {/* ── SECTION NAVIGATION ── */}
        {section === 'nav' && (
          <>
            <p style={{ fontFamily:'var(--font)', fontWeight:700, fontSize:15,
                        color:'rgba(255,255,255,.6)', margin:'4px 0 8px' }}>
              Navigation rapide
            </p>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10 }}>
              {NAV_ITEMS.map(item => (
                <button key={item.route} onClick={() => navigate(item.route)} style={{
                  background:'#2B2930', border:'none', borderRadius:16, padding:'16px 8px',
                  cursor:'pointer', display:'flex', flexDirection:'column',
                  alignItems:'center', gap:8, WebkitTapHighlightColor:'transparent'
                }}>
                  <div style={{ width:44, height:44, borderRadius:'50%',
                                background:`${item.color}33`,
                                display:'flex', alignItems:'center', justifyContent:'center', fontSize:22 }}>
                    {item.icon}
                  </div>
                  <span style={{ fontFamily:'var(--font)', fontWeight:600, fontSize:11,
                                 color:'rgba(255,255,255,.8)', textAlign:'center' }}>
                    {item.label}
                  </span>
                </button>
              ))}
            </div>
          </>
        )}

        {/* ── SECTION OUTILS ── */}
        {section === 'outils' && (
          <>
            {/* Export CSV */}
            <button onClick={exporterCSV} style={{
              background:'#1A3A5C', border:'1px solid #1565C0', borderRadius:16,
              padding:20, cursor:'pointer', display:'flex', alignItems:'center', gap:16,
              width:'100%', textAlign:'left', WebkitTapHighlightColor:'transparent'
            }}>
              <div style={{ width:52, height:52, borderRadius:'50%', background:'rgba(21,101,192,.3)',
                            display:'flex', alignItems:'center', justifyContent:'center', fontSize:26, flexShrink:0 }}>
                📥
              </div>
              <div>
                <div style={{ fontFamily:'var(--font)', fontWeight:700, fontSize:15, color:'#90CAF9' }}>
                  Export Comptabilité CSV
                </div>
                <div style={{ fontSize:12, color:'rgba(144,202,249,.6)', marginTop:2 }}>
                  Télécharge toutes les ventes en CSV
                </div>
              </div>
            </button>

            {/* Consolidation produits */}
            <button onClick={consoliderProduits} style={{
              background:'#1A3A1F', border:'1px solid #2E7D32', borderRadius:16,
              padding:20, cursor:'pointer', display:'flex', alignItems:'center', gap:16,
              width:'100%', textAlign:'left', WebkitTapHighlightColor:'transparent'
            }}>
              <div style={{ width:52, height:52, borderRadius:'50%', background:'rgba(76,175,80,.2)',
                            display:'flex', alignItems:'center', justifyContent:'center', fontSize:26, flexShrink:0 }}>
                🔀
              </div>
              <div>
                <div style={{ fontFamily:'var(--font)', fontWeight:700, fontSize:15, color:'#A5D6A7' }}>
                  Consolider les produits
                </div>
                <div style={{ fontSize:12, color:'rgba(165,214,167,.6)', marginTop:2 }}>
                  Fusionne les doublons et additionne les stocks
                </div>
              </div>
            </button>

            {/* Note import Excel */}
            <div style={{ background:'#2B2930', borderRadius:16, padding:16,
                          border:'1px solid #3D3A45' }}>
              <div style={{ fontFamily:'var(--font)', fontWeight:700, fontSize:14,
                            color:'rgba(255,255,255,.7)', marginBottom:8 }}>📋 Import de données</div>
              <p style={{ fontSize:12, color:'rgba(255,255,255,.4)', margin:0, lineHeight:1.6 }}>
                L'import Excel (produits, lots, bénévoles, planning, color run) 
                se fait directement depuis <strong style={{color:'rgba(255,255,255,.6)'}}>la console Firebase</strong> 
                ou via l'app Android avec la fonction d'import .xlsx intégrée.
              </p>
            </div>
          </>
        )}

        {/* ── SECTION RÉINITIALISATIONS ── */}
        {section === 'reset' && (
          <>
            <div style={{ background:'#3B1A1A', border:'1px solid #D32F2F',
                          borderRadius:12, padding:'12px 14px', marginBottom:4 }}>
              <p style={{ color:'#EF9A9A', fontSize:13, fontWeight:600, margin:0 }}>
                ⚠️ Ces actions suppriment définitivement les données Firestore. Procédez avec précaution.
              </p>
            </div>

            {RESET_TARGETS.map(target => (
              <button key={target.id} onClick={() => setResetDlg(target)} style={{
                background: target.danger ? '#3B1A1A' : '#2B2930',
                border: `1px solid ${target.danger ? '#D32F2F' : '#3D3A45'}`,
                borderRadius:16, padding:'14px 16px', cursor:'pointer',
                display:'flex', alignItems:'center', gap:14,
                width:'100%', textAlign:'left', WebkitTapHighlightColor:'transparent'
              }}>
                <div style={{ width:40, height:40, borderRadius:'50%',
                              background: target.danger?'rgba(211,47,47,.2)':'rgba(211,47,47,.1)',
                              display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0 }}>
                  {target.icon}
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontFamily:'var(--font)', fontWeight: target.danger?900:600,
                                fontSize:14, color: target.danger?'#EF9A9A':'rgba(255,255,255,.8)' }}>
                    Réinitialiser {target.label}
                  </div>
                  <div style={{ fontSize:11, color:'rgba(255,255,255,.35)', marginTop:2 }}>
                    {target.collections.join(', ')}
                  </div>
                </div>
                <span style={{ color:'rgba(255,255,255,.2)', fontSize:18 }}>›</span>
              </button>
            ))}
          </>
        )}
      </div>

      {/* ── LOADING OVERLAY ── */}
      {loading && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.7)',
                      display:'flex', alignItems:'center', justifyContent:'center', zIndex:200 }}>
          <div style={{ background:'#2B2930', borderRadius:20, padding:32,
                        display:'flex', flexDirection:'column', alignItems:'center', gap:16 }}>
            <div className="spinner" style={{ borderColor:'#3D3A45', borderTopColor:'#BB86FC' }} />
            <span style={{ color:'#fff', fontFamily:'var(--font)', fontWeight:700 }}>
              Opération en cours…
            </span>
          </div>
        </div>
      )}

      {/* ── DIALOG CONFIRMATION RESET ── */}
      {resetDlg && (
        <div className="overlay" onClick={() => setResetDlg(null)}>
          <div className="dialog" style={{ background:'#2B2930' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ textAlign:'center', marginBottom:16 }}>
              <div style={{ fontSize:36, marginBottom:8 }}>⚠️</div>
              <h2 style={{ fontFamily:'var(--font)', fontWeight:900, margin:'0 0 6px', color:'#fff' }}>
                Réinitialiser {resetDlg.label}
              </h2>
              <p style={{ color:'rgba(255,255,255,.5)', fontSize:13, margin:0 }}>
                Cette action va supprimer toutes les données de :
              </p>
            </div>
            <div style={{ background:'#3B1A1A', borderRadius:12, padding:12, marginBottom:16 }}>
              {resetDlg.collections.map(c => (
                <div key={c} style={{ color:'#EF9A9A', fontSize:13, fontWeight:600 }}>• {c}</div>
              ))}
            </div>
            <p style={{ color:'#EF9A9A', fontSize:12, fontWeight:700,
                        textAlign:'center', marginBottom:16 }}>
              ⚠️ Action irréversible
            </p>
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              <button onClick={() => resetCollections(resetDlg)} style={{
                background:'#D32F2F', border:'none', borderRadius:12, padding:'14px',
                color:'#fff', fontFamily:'var(--font)', fontWeight:700, fontSize:14, cursor:'pointer'
              }}>
                🗑️ Confirmer la réinitialisation
              </button>
              <button className="btn btn-ghost btn-full" onClick={() => setResetDlg(null)}
                style={{ color:'rgba(255,255,255,.6)' }}>
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}

// ── Export principal avec gestion PIN ─────────────────────────────────────
export default function AdminView() {
  const [authed, setAuthed] = useState(false)
  if (!authed) return <LoginScreen onSuccess={() => setAuthed(true)} />
  return <AdminDashboard onLogout={() => setAuthed(false)} />
}
