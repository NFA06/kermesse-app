// src/views/PlanningView.jsx — miroir fidèle de PlanningActivity.kt
import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { db } from '../services/firebase'
import { collection, onSnapshot, doc, updateDoc, query, orderBy } from 'firebase/firestore'

const VIOLET   = '#6A43C7'
const V_LIGHT  = '#7C4DFF'
const V_DARK   = '#5E35B1'
const BG       = '#F2F2F7'

const S_AVENIR  = { color:'#2196F3', light:'#E3F2FD', label:'À venir',  icon:'🕐' }
const S_ENCOURS = { color:'#FF9800', light:'#FFF3E0', label:'En cours', icon:'▶️' }
const S_TERMINE = { color:'#4CAF50', light:'#E8F5E9', label:'Terminé',  icon:'✅' }

function statutMeta(statut) {
  if (statut === 'en cours') return S_ENCOURS
  if (statut === 'terminé')  return S_TERMINE
  return S_AVENIR
}

// ── Dialog PIN ────────────────────────────────────────────────────────────
function PinDialog({ onSuccess, onDismiss }) {
  const [code, setCode] = useState('')
  const [err,  setErr]  = useState(false)
  const valider = () => {
    if (code === '1707') { onSuccess(); onDismiss() }
    else { setErr(true); setCode('') }
  }
  return (
    <div className="overlay" onClick={onDismiss}>
      <div className="dialog" onClick={e => e.stopPropagation()}>
        <div style={{ textAlign:'center', marginBottom:16 }}>
          <div style={{ fontSize:36, marginBottom:8 }}>🔒</div>
          <h2 style={{ fontFamily:'var(--font)', fontWeight:900, margin:'0 0 6px' }}>
            Code PIN requis
          </h2>
          <p style={{ color:'var(--text-muted)', fontSize:14, margin:0 }}>
            Entrez le code pour modifier le planning
          </p>
        </div>
        <input type="password" inputMode="numeric" placeholder="Code PIN"
          value={code} onChange={e => setCode(e.target.value)}
          onKeyDown={e => e.key==='Enter' && valider()}
          style={{ marginBottom:8, borderColor: err?'#D32F2F':undefined }}
          autoFocus />
        {err && <p style={{ color:'#D32F2F', fontSize:13, textAlign:'center', margin:'0 0 12px' }}>
          ⚠️ Code incorrect
        </p>}
        <div style={{ display:'flex', gap:10, marginTop:8 }}>
          <button className="btn btn-ghost btn-full" onClick={onDismiss}>Annuler</button>
          <button className="btn btn-primary btn-full" onClick={valider}>Valider</button>
        </div>
      </div>
    </div>
  )
}

// ── Dialog édition (miroir de EditPlanningDialog) ─────────────────────────
function EditDialog({ item, onConfirm, onDismiss }) {
  const [form, setForm] = useState({
    heureDebut:  item.heureDebut  ?? '',
    heureFin:    item.heureFin    ?? '',
    activite:    item.activite    ?? '',
    responsable: item.responsable ?? '',
    lieu:        item.lieu        ?? '',
    description: item.description ?? '',
  })
  const f = (k) => e => setForm(p => ({ ...p, [k]: e.target.value }))
  return (
    <div className="overlay" onClick={onDismiss}>
      <div className="dialog" style={{ maxHeight:'90dvh', overflowY:'auto' }}
        onClick={e => e.stopPropagation()}>
        <h2 style={{ fontFamily:'var(--font)', fontWeight:900, margin:'0 0 16px' }}>
          ✏️ Modifier l'activité
        </h2>
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          <div style={{ display:'flex', gap:10 }}>
            <input type="text" placeholder="Heure début" value={form.heureDebut}
              onChange={f('heureDebut')} style={{ flex:1 }} />
            <input type="text" placeholder="Heure fin" value={form.heureFin}
              onChange={f('heureFin')} style={{ flex:1 }} />
          </div>
          <input type="text" placeholder="Activité" value={form.activite} onChange={f('activite')} />
          <input type="text" placeholder="Responsable" value={form.responsable} onChange={f('responsable')} />
          <input type="text" placeholder="Lieu" value={form.lieu} onChange={f('lieu')} />
          <textarea placeholder="Description" value={form.description} onChange={f('description')}
            rows={3} style={{ resize:'vertical' }} />
        </div>
        <div style={{ display:'flex', gap:10, marginTop:16 }}>
          <button className="btn btn-ghost btn-full" onClick={onDismiss}>Annuler</button>
          <button className="btn btn-primary btn-full" onClick={() => onConfirm(form)}>
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Carte planning (vue cartes) ───────────────────────────────────────────
function PlanningCard({ item, accesModif, onStatusChange, onEdit }) {
  const meta = statutMeta(item.statut)
  return (
    <div style={{
      background: meta.light, borderRadius:20,
      border:`1.5px solid ${meta.color}22`,
      boxShadow:'0 2px 8px rgba(0,0,0,.06)', padding:16,
      display:'flex', flexDirection:'column', gap:12
    }}>
      {/* Heure + statut + bouton edit */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ width:48, height:48, borderRadius:14,
                        background:`${meta.color}22`,
                        display:'flex', alignItems:'center', justifyContent:'center', fontSize:22 }}>
            {meta.icon}
          </div>
          <div>
            <div style={{ fontFamily:'var(--font)', fontWeight:700, fontSize:16, color:meta.color }}>
              {item.heureDebut} - {item.heureFin}
            </div>
            <div style={{ fontSize:11, color:meta.color, opacity:.8, fontWeight:600 }}>
              {item.statut?.toUpperCase()}
            </div>
          </div>
        </div>
        {accesModif && (
          <button onClick={onEdit} style={{ background:`${VIOLET}15`, border:'none',
                                            borderRadius:10, width:36, height:36,
                                            cursor:'pointer', fontSize:16 }}>✏️</button>
        )}
      </div>

      {/* Titre activité */}
      <div style={{ fontFamily:'var(--font)', fontWeight:800, fontSize:18, color:'#1C1C1E' }}>
        {item.activite}
      </div>

      {/* Infos */}
      <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
        {item.responsable && (
          <div style={{ fontSize:13, color:'#666', display:'flex', gap:6 }}>
            <span>👤</span>
            <div><div style={{ fontSize:11, color:'#aaa' }}>Responsable</div>{item.responsable}</div>
          </div>
        )}
        {item.lieu && (
          <div style={{ fontSize:13, color:'#666', display:'flex', gap:6 }}>
            <span>📍</span>
            <div><div style={{ fontSize:11, color:'#aaa' }}>Lieu</div>{item.lieu}</div>
          </div>
        )}
        {item.description && (
          <div style={{ fontSize:13, color:'#666', display:'flex', gap:6 }}>
            <span>📝</span>
            <div><div style={{ fontSize:11, color:'#aaa' }}>Description</div>{item.description}</div>
          </div>
        )}
      </div>

      {/* Boutons action (si accès modif) */}
      {accesModif && item.statut !== 'terminé' && (
        <>
          <div style={{ height:1, background:'#EEE' }} />
          <div style={{ display:'flex', gap:8 }}>
            {item.statut === 'à venir' && (
              <button onClick={() => onStatusChange('en cours')}
                style={{ flex:1, height:44, borderRadius:12, border:'none',
                         background:S_ENCOURS.color, color:'#fff',
                         fontFamily:'var(--font)', fontWeight:700, fontSize:13, cursor:'pointer' }}>
                ▶️ Démarrer
              </button>
            )}
            {item.statut === 'en cours' && (
              <button onClick={() => onStatusChange('terminé')}
                style={{ flex:1, height:44, borderRadius:12, border:'none',
                         background:S_TERMINE.color, color:'#fff',
                         fontFamily:'var(--font)', fontWeight:700, fontSize:13, cursor:'pointer' }}>
                ✅ Terminer
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}

// ── Vue tableau (miroir de PlanningTableauView) ───────────────────────────
function PlanningTableau({ items, accesModif, onStatusChange, onEdit }) {
  const COL = { color:S_AVENIR.color, s:'À VENIR' }
  return (
    <div style={{ background:'#fff', borderRadius:16,
                  boxShadow:'0 2px 8px rgba(0,0,0,.06)', overflow:'hidden' }}>
      <div style={{ overflowX:'auto', WebkitOverflowScrolling:'touch' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', minWidth:600 }}>
          <thead>
            <tr style={{ background:VIOLET }}>
              {['Horaire','Activité','Responsable','Lieu','Statut',
                ...(accesModif?['Actions']:[])].map(h => (
                <th key={h} style={{ padding:'10px 12px', color:'#fff',
                                     fontSize:11, fontWeight:700,
                                     textAlign:'left', whiteSpace:'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => {
              const meta = statutMeta(item.statut)
              return (
                <tr key={item.id}
                  style={{ background: item.statut==='en cours' ? '#FFF8F0'
                                      : item.statut==='terminé'  ? '#F1F8F2'
                                      : i%2===0 ? '#F8F9FA' : '#fff',
                           borderBottom:'1px solid #EEE', cursor: accesModif?'pointer':'default' }}
                  onClick={() => accesModif && onEdit(item)}>
                  <td style={{ padding:'10px 12px', fontSize:12, whiteSpace:'nowrap' }}>
                    {item.heureDebut}<br/><span style={{ color:'#aaa' }}>{item.heureFin}</span>
                  </td>
                  <td style={{ padding:'10px 12px', fontSize:12, maxWidth:160,
                               overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    {item.activite}
                  </td>
                  <td style={{ padding:'10px 12px', fontSize:12 }}>{item.responsable}</td>
                  <td style={{ padding:'10px 12px', fontSize:12 }}>{item.lieu}</td>
                  <td style={{ padding:'10px 12px' }}>
                    <span style={{ background:`${meta.color}22`, color:meta.color,
                                   borderRadius:8, padding:'3px 8px',
                                   fontSize:10, fontWeight:700 }}>
                      {item.statut?.toUpperCase()}
                    </span>
                  </td>
                  {accesModif && (
                    <td style={{ padding:'8px 12px' }}>
                      <div style={{ display:'flex', gap:6 }} onClick={e => e.stopPropagation()}>
                        {item.statut==='à venir' && (
                          <button onClick={() => onStatusChange(item, 'en cours')}
                            style={{ background:`${S_ENCOURS.color}22`, border:'none',
                                     borderRadius:6, width:28, height:28, cursor:'pointer', fontSize:12 }}>▶</button>
                        )}
                        {item.statut==='en cours' && (
                          <button onClick={() => onStatusChange(item, 'terminé')}
                            style={{ background:`${S_TERMINE.color}22`, border:'none',
                                     borderRadius:6, width:28, height:28, cursor:'pointer', fontSize:12 }}>✓</button>
                        )}
                        <button onClick={() => onEdit(item)}
                          style={{ background:`${VIOLET}22`, border:'none',
                                   borderRadius:6, width:28, height:28, cursor:'pointer', fontSize:12 }}>✏️</button>
                      </div>
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Vue principale ────────────────────────────────────────────────────────
export default function PlanningView() {
  const navigate   = useNavigate()
  const [planning,   setPlanning]   = useState([])
  const [filtre,     setFiltre]     = useState('tous')
  const [mode,       setMode]       = useState('cartes')  // 'cartes' | 'tableau'
  const [accesModif, setAccesModif] = useState(false)
  const [pinDialog,  setPinDialog]  = useState(false)
  const [editItem,   setEditItem]   = useState(null)
  const [toast,      setToast]      = useState(null)
  const unsubRef = useRef(null)

  const showToast = msg => { setToast(msg); setTimeout(() => setToast(null), 2500) }

  useEffect(() => {
    // orderBy 'ordre' — fallback sans orderBy si index manquant
    const q = query(collection(db, 'planning'), orderBy('ordre'))
    unsubRef.current = onSnapshot(q,
      snap => setPlanning(snap.docs.map(d => ({ id:d.id, ...d.data() }))),
      () => {
        // fallback sans tri
        unsubRef.current = onSnapshot(collection(db, 'planning'),
          snap => {
            const items = snap.docs.map(d => ({ id:d.id, ...d.data() }))
            items.sort((a,b) => (a.ordre??0)-(b.ordre??0))
            setPlanning(items)
          }
        )
      }
    )
    return () => unsubRef.current?.()
  }, [])

  const updateStatut = async (item, statut) => {
    await updateDoc(doc(db, 'planning', item.id), { statut })
    showToast('✅ Statut mis à jour')
  }

  const updateItem = async (form) => {
    await updateDoc(doc(db, 'planning', editItem.id), form)
    setEditItem(null)
    showToast('✅ Planning mis à jour')
  }

  const nbAVenir  = planning.filter(p => p.statut === 'à venir').length
  const nbEnCours = planning.filter(p => p.statut === 'en cours').length
  const nbTermine = planning.filter(p => p.statut === 'terminé').length
  const nbTotal   = planning.length
  const pct       = nbTotal > 0 ? nbTermine / nbTotal : 0

  const planningFiltre = planning.filter(p =>
    filtre === 'tous' ? true : p.statut === filtre
  )

  const FILTRES = [
    { id:'tous',      label:'Tous',     count:nbTotal,   color:VIOLET },
    { id:'à venir',   label:'À venir',  count:nbAVenir,  color:S_AVENIR.color },
    { id:'en cours',  label:'En cours', count:nbEnCours, color:S_ENCOURS.color },
    { id:'terminé',   label:'Terminés', count:nbTermine, color:S_TERMINE.color },
  ]

  return (
    <div className="page" style={{ background:BG }}>

      {/* ── HEADER ── */}
      <div style={{
        background:`linear-gradient(135deg,${V_DARK},${V_LIGHT})`,
        borderRadius:'0 0 28px 28px', padding:'52px 20px 20px', position:'relative'
      }}>
        <button className="back-btn" onClick={() => navigate('/')}>‹</button>

        {/* Boutons header droite */}
        <div style={{ position:'absolute', top:16, right:16, display:'flex', gap:8 }}>
          {/* Changer vue cartes/tableau */}
          <button onClick={() => setMode(m => m==='cartes'?'tableau':'cartes')}
            style={{ background:'rgba(255,255,255,.2)', border:'none', borderRadius:10,
                     width:38, height:38, color:'#fff', cursor:'pointer', fontSize:16 }}>
            {mode==='cartes' ? '⊞' : '▤'}
          </button>
          {/* Verrouillage */}
          <button onClick={() => accesModif ? (setAccesModif(false), showToast('🔒 Verrouillé')) : setPinDialog(true)}
            style={{ background:'rgba(255,255,255,.2)', border:'none', borderRadius:10,
                     width:38, height:38, color:'#fff', cursor:'pointer', fontSize:16 }}>
            {accesModif ? '🔓' : '🔒'}
          </button>
        </div>

        {/* Hero card */}
        <div style={{ background:`linear-gradient(135deg,${VIOLET},${V_DARK})`,
                      borderRadius:24, padding:20, marginBottom:0 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:16 }}>
            <div>
              <div style={{ fontFamily:'var(--font)', fontWeight:900, fontSize:22, color:'#fff' }}>
                📅 Planning Journée
              </div>
              <div style={{ color:'rgba(255,255,255,.8)', fontSize:13 }}>
                Suivi en temps réel
              </div>
            </div>
            <div style={{ width:56, height:56, borderRadius:'50%',
                          background:'rgba(255,255,255,.18)',
                          display:'flex', alignItems:'center', justifyContent:'center', fontSize:24 }}>
              {accesModif ? '🔓' : '🔒'}
            </div>
          </div>

          {/* Stats pills */}
          <div style={{ display:'flex', gap:10, marginBottom:16 }}>
            {[[nbAVenir,'À venir',S_AVENIR.color],[nbEnCours,'En cours',S_ENCOURS.color],[nbTermine,'Terminé',S_TERMINE.color]].map(([v,l,c]) => (
              <div key={l} style={{ flex:1, borderRadius:14, background:`${c}44`,
                                    padding:'10px 6px', textAlign:'center' }}>
                <div style={{ fontFamily:'var(--font)', fontWeight:900, fontSize:22, color:'#fff' }}>{v}</div>
                <div style={{ fontSize:11, color:'rgba(255,255,255,.85)' }}>{l}</div>
              </div>
            ))}
          </div>

          {/* Barre progression */}
          <div style={{ height:8, borderRadius:99, background:'rgba(255,255,255,.25)' }}>
            <div style={{ height:'100%', borderRadius:99, background:S_TERMINE.color,
                          width:`${Math.round(pct*100)}%`, transition:'width .8s ease' }} />
          </div>
          <div style={{ fontSize:12, color:'rgba(255,255,255,.8)', marginTop:6 }}>
            {Math.round(pct*100)}% des activités terminées
          </div>
        </div>
      </div>

      {/* ── FILTRES ── */}
      <div style={{ display:'flex', gap:8, padding:'14px 16px 0', overflowX:'auto', scrollbarWidth:'none' }}>
        {FILTRES.map(f => {
          const sel = filtre===f.id
          return (
            <button key={f.id} onClick={() => setFiltre(f.id)} style={{
              flexShrink:0, padding:'8px 14px', borderRadius:99,
              border: sel?'none':'2px solid #E5E7EB',
              background: sel ? f.color : '#fff',
              color: sel ? '#fff' : 'var(--text-muted)',
              fontFamily:'var(--font)', fontWeight:700, fontSize:12,
              cursor:'pointer', transition:'all .15s'
            }}>
              {f.label} ({f.count})
            </button>
          )
        })}
      </div>

      {/* Compteur */}
      <div style={{ padding:'8px 20px 2px' }}>
        <span style={{ fontSize:13, color:'var(--text-muted)', fontWeight:600 }}>
          {planningFiltre.length} activité{planningFiltre.length>1?'s':''}
        </span>
      </div>

      {/* ── CONTENU ── */}
      <div style={{ flex:1, overflowY:'auto', padding:'8px 16px 32px',
                    display:'flex', flexDirection:'column', gap:12 }}>
        {planning.length === 0 ? (
          <div style={{ textAlign:'center', padding:'48px 0' }}>
            <div style={{ fontSize:56, marginBottom:12 }}>📅</div>
            <p style={{ fontFamily:'var(--font)', fontWeight:800, fontSize:18,
                        color:'var(--text-muted)', margin:'0 0 6px' }}>
              Aucune activité planifiée
            </p>
            <p style={{ fontSize:14, color:'var(--text-muted)' }}>
              Importez un planning depuis l'administration
            </p>
          </div>
        ) : planningFiltre.length === 0 ? (
          <p style={{ textAlign:'center', color:'var(--text-muted)', marginTop:40 }}>
            Aucune activité dans ce filtre
          </p>
        ) : mode === 'tableau' ? (
          <PlanningTableau
            items={planningFiltre}
            accesModif={accesModif}
            onStatusChange={(item, statut) => updateStatut(item, statut)}
            onEdit={setEditItem}
          />
        ) : (
          planningFiltre.map(item => (
            <PlanningCard key={item.id} item={item}
              accesModif={accesModif}
              onStatusChange={statut => updateStatut(item, statut)}
              onEdit={() => setEditItem(item)}
            />
          ))
        )}
      </div>

      {/* Dialogs */}
      {pinDialog  && <PinDialog onSuccess={() => setAccesModif(true)} onDismiss={() => setPinDialog(false)} />}
      {editItem   && <EditDialog item={editItem} onConfirm={updateItem} onDismiss={() => setEditItem(null)} />}
      {toast      && <div className="toast">{toast}</div>}
    </div>
  )
}
