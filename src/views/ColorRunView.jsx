// src/views/ColorRunView.jsx
// Miroir fidèle de ColorRunActivity.kt
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { db } from '../services/firebase'
import { collection, onSnapshot, doc, updateDoc, addDoc } from 'firebase/firestore'

const AVATAR_COLORS = ['#E91E63','#FF6F00','#7C4DFF','#0288D1','#00BFA5']

function getAvatarColor(nom) {
  return AVATAR_COLORS[(nom?.charCodeAt(0) ?? 0) % AVATAR_COLORS.length]
}

export default function ColorRunView() {
  const navigate = useNavigate()
  const [participants, setParticipants] = useState([])
  const [recherche,    setRecherche]    = useState('')
  const [filtre,       setFiltre]       = useState('tous')
  const [dialog,       setDialog]       = useState(false)
  const [form,         setForm]         = useState({ nom:'', prenom:'', type:'', age:'', accompagnateur:'', option:'' })
  const [toast,        setToast]        = useState(null)

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'participants_colorrun'), snap => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      list.sort((a,b) => (a.nom??'').localeCompare(b.nom??''))
      setParticipants(list)
    })
    return unsub
  }, [])

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2500) }

  const togglePresence = async (participant) => {
    await updateDoc(doc(db, 'participants_colorrun', participant.id), {
      present: !participant.present
    })
  }

  const inscrire = async () => {
    if (!form.nom || !form.prenom) { showToast('Nom et prénom requis'); return }
    await addDoc(collection(db, 'participants_colorrun'), {
      ...form,
      age: parseInt(form.age) || 0,
      present: false
    })
    setDialog(false)
    setForm({ nom:'', prenom:'', type:'', age:'', accompagnateur:'', option:'' })
    showToast('✅ Participant inscrit !')
  }

  // Filtrage
  const filtres = participants.filter(p => {
    if (filtre === 'presents' && !p.present)  return false
    if (filtre === 'absents'  &&  p.present)  return false
    if (recherche.trim()) {
      const t = recherche.toLowerCase()
      if (!`${p.nom} ${p.prenom} ${p.accompagnateur??''}`.toLowerCase().includes(t)) return false
    }
    return true
  })

  const nbPresents = participants.filter(p => p.present).length
  const nbTotal    = participants.length
  const progress   = nbTotal > 0 ? nbPresents / nbTotal : 0

  const FILTRES = [
    { id:'tous',     label:'Tous',     count: nbTotal },
    { id:'presents', label:'Présents', count: nbPresents },
    { id:'absents',  label:'Absents',  count: nbTotal - nbPresents },
  ]

  return (
    <div className="page">
      {/* ── HEADER ── */}
      <div style={{
        background: 'linear-gradient(135deg, #E91E63, #AD1457)',
        borderRadius: '0 0 24px 24px',
        color: '#fff',
        padding: '52px 20px 20px',
        position: 'relative'
      }}>
        <button className="back-btn" onClick={() => navigate('/')}>‹</button>

        {/* Titre */}
        <div style={{ marginBottom: 16 }}>
          <h1 style={{ fontFamily:'var(--font)', fontWeight:900, fontSize:26, margin:'0 0 2px' }}>🏃 Color Run</h1>
          <p style={{ opacity:.85, fontSize:13 }}>{nbPresents} présents sur {nbTotal}</p>
        </div>

        {/* Stats pills */}
        <div style={{ display:'flex', gap:10, marginBottom:16 }}>
          {[
            { label:'Présents', val:nbPresents,          bg:'rgba(0,191,165,.3)' },
            { label:'Absents',  val:nbTotal-nbPresents,  bg:'rgba(255,255,255,.15)' },
            { label:'Total',    val:nbTotal,              bg:'rgba(255,255,255,.15)' },
          ].map(s => (
            <div key={s.label} style={{
              flex:1, textAlign:'center',
              background: s.bg,
              borderRadius: 14, padding:'10px 6px'
            }}>
              <div style={{ fontFamily:'var(--font)', fontWeight:900, fontSize:22 }}>{s.val}</div>
              <div style={{ fontSize:11, opacity:.85 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Barre de progression */}
        <div style={{ height:8, borderRadius:99, background:'rgba(255,255,255,.25)' }}>
          <div style={{
            height:'100%', borderRadius:99,
            background:'#00BFA5',
            width:`${Math.round(progress*100)}%`,
            transition:'width .6s ease'
          }} />
        </div>

        {/* Pastilles colorées */}
        <div style={{ display:'flex', gap:6, marginTop:12, justifyContent:'center' }}>
          {['#E91E63','#FF6F00','#FFD600','#00BFA5','#0288D1','#7C4DFF'].map(c => (
            <div key={c} style={{ width:10, height:10, borderRadius:'50%', background:c }} />
          ))}
        </div>
      </div>

      {/* ── RECHERCHE ── */}
      <div style={{ padding:'14px 16px 0' }}>
        <input
          type="text"
          placeholder="🔍 Nom, prénom, accompagnateur..."
          value={recherche}
          onChange={e => setRecherche(e.target.value)}
        />
      </div>

      {/* ── FILTRES ── */}
      <div style={{ padding:'10px 16px 0', display:'flex', gap:8 }}>
        {FILTRES.map(f => (
          <button
            key={f.id}
            onClick={() => setFiltre(f.id)}
            style={{
              flex:1,
              padding:'8px 4px',
              borderRadius:99,
              border: filtre===f.id ? 'none' : '2px solid #E5E7EB',
              background: filtre===f.id
                ? (f.id==='presents' ? '#00BFA5' : f.id==='absents' ? '#E91E63' : '#7C4DFF')
                : '#fff',
              color: filtre===f.id ? '#fff' : 'var(--text-muted)',
              fontFamily:'var(--font)',
              fontWeight:700,
              fontSize:12,
              cursor:'pointer',
              transition:'all .15s'
            }}
          >
            {f.label} ({f.count})
          </button>
        ))}
      </div>

      {/* ── Compteur résultats ── */}
      <div style={{ padding:'10px 20px 2px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <span style={{ fontSize:13, color:'var(--text-muted)', fontWeight:600 }}>
          {filtres.length} participant{filtres.length>1?'s':''}
        </span>
        {(filtre !== 'tous' || recherche) && (
          <button onClick={() => { setFiltre('tous'); setRecherche('') }}
            style={{ background:'none', border:'none', color:'#E91E63', fontWeight:700, fontSize:13, cursor:'pointer' }}>
            Tout afficher
          </button>
        )}
      </div>

      {/* ── LISTE ── */}
      <div style={{ flex:1, overflowY:'auto', padding:'8px 16px 100px', display:'flex', flexDirection:'column', gap:10 }}>
        {filtres.length === 0 ? (
          <div style={{ textAlign:'center', padding:'48px 0' }}>
            <div style={{ fontSize:56 }}>🏃</div>
            <p style={{ fontFamily:'var(--font)', fontWeight:800, fontSize:18, color:'var(--text-muted)', marginTop:12 }}>
              Aucun participant trouvé
            </p>
            <p style={{ fontSize:14, color:'var(--text-muted)', opacity:.7 }}>
              Modifiez votre recherche ou vos filtres
            </p>
          </div>
        ) : filtres.map(p => {
          const initiales = `${p.prenom?.charAt(0)??''}${p.nom?.charAt(0)??''}`.toUpperCase()
          const avatarColor = getAvatarColor(p.nom)
          return (
            <div key={p.id} style={{
              background: p.present ? '#E0F7F4' : '#fff',
              borderRadius: 20,
              border: p.present ? '1.5px solid rgba(0,191,165,.4)' : '1.5px solid transparent',
              boxShadow: 'var(--card-shadow)',
              padding: '16px',
              display:'flex', alignItems:'center', gap:14
            }}>
              {/* Avatar */}
              <div style={{
                width:52, height:52, borderRadius:'50%', flexShrink:0,
                background: p.present ? 'rgba(0,191,165,.2)' : `${avatarColor}22`,
                display:'flex', alignItems:'center', justifyContent:'center',
                fontFamily:'var(--font)', fontWeight:800, fontSize:16,
                color: p.present ? '#00BFA5' : avatarColor
              }}>
                {initiales || '?'}
              </div>

              {/* Infos */}
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontFamily:'var(--font)', fontWeight:800, fontSize:16,
                              color:'var(--text)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                  {p.prenom} {p.nom}
                </div>
                <div style={{ display:'flex', gap:6, marginTop:5, flexWrap:'wrap' }}>
                  {p.type && (
                    <span style={{ background:'rgba(124,77,255,.12)', color:'#7C4DFF',
                                   borderRadius:8, padding:'2px 8px', fontSize:11, fontWeight:700 }}>
                      {p.type}
                    </span>
                  )}
                  {p.age > 0 && (
                    <span style={{ background:'rgba(255,111,0,.12)', color:'#FF6F00',
                                   borderRadius:8, padding:'2px 8px', fontSize:11, fontWeight:700 }}>
                      {p.age} ans
                    </span>
                  )}
                </div>
                {p.accompagnateur && (
                  <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:5 }}>
                    👤 {p.accompagnateur}
                  </div>
                )}
                {p.option && (
                  <div style={{ fontSize:12, color:'#E91E63', marginTop:3 }}>
                    🎯 {p.option}
                  </div>
                )}
              </div>

              {/* Bouton présence */}
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:3 }}>
                <button
                  onClick={() => togglePresence(p)}
                  style={{
                    width:48, height:48, borderRadius:'50%', border:'none', cursor:'pointer',
                    background: p.present ? 'rgba(0,191,165,.15)' : 'rgba(233,30,99,.10)',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    fontSize:26, transition:'all .2s',
                    WebkitTapHighlightColor:'transparent'
                  }}
                >
                  {p.present ? '✅' : '⭕'}
                </button>
                <span style={{ fontSize:10, fontWeight:700,
                               color: p.present ? '#00BFA5' : 'var(--text-muted)' }}>
                  {p.present ? 'Présent' : 'Absent'}
                </span>
              </div>
            </div>
          )
        })}
      </div>

      {/* ── FAB ── */}
      <button
        onClick={() => setDialog(true)}
        style={{
          position:'fixed', bottom:'calc(24px + var(--safe-bottom))', right:20,
          width:56, height:56, borderRadius:'50%', border:'none',
          background:'#E91E63', color:'#fff', fontSize:24,
          boxShadow:'0 4px 16px rgba(233,30,99,.4)',
          cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center',
          zIndex:50
        }}
      >+</button>

      {/* ── DIALOG INSCRIPTION ── */}
      {dialog && (
        <div className="overlay" onClick={() => setDialog(false)}>
          <div className="dialog" onClick={e => e.stopPropagation()}>
            <h2 style={{ fontFamily:'var(--font)', fontWeight:900, marginBottom:16 }}>
              🏃 Inscrire un participant
            </h2>
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              <div style={{ display:'flex', gap:10 }}>
                <input type="text" placeholder="Prénom *" value={form.prenom}
                  onChange={e => setForm(f=>({...f,prenom:e.target.value}))} style={{ flex:1 }} />
                <input type="text" placeholder="Nom *" value={form.nom}
                  onChange={e => setForm(f=>({...f,nom:e.target.value}))} style={{ flex:1 }} />
              </div>
              <div style={{ display:'flex', gap:10 }}>
                <input type="text" placeholder="Type (élève, adulte...)" value={form.type}
                  onChange={e => setForm(f=>({...f,type:e.target.value}))} style={{ flex:1 }} />
                <input type="number" placeholder="Âge" value={form.age}
                  onChange={e => setForm(f=>({...f,age:e.target.value}))} style={{ flex:1 }} />
              </div>
              <input type="text" placeholder="Accompagnateur" value={form.accompagnateur}
                onChange={e => setForm(f=>({...f,accompagnateur:e.target.value}))} />
              <input type="text" placeholder="Option / remarque" value={form.option}
                onChange={e => setForm(f=>({...f,option:e.target.value}))} />
            </div>
            <div style={{ display:'flex', gap:10, marginTop:20 }}>
              <button className="btn btn-ghost btn-full" onClick={() => setDialog(false)}>Annuler</button>
              <button className="btn btn-full" style={{ background:'#E91E63', color:'#fff' }} onClick={inscrire}>
                Inscrire
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
