// src/views/BenevoleView.jsx — miroir fidèle de BenevoleActivity.kt
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { db } from '../services/firebase'
import {
  collection, getDocs, doc, getDoc, updateDoc, addDoc
} from 'firebase/firestore'

// ── Normalisation (miroir de String.normalise()) ──────────────────────────
function normalise(str) {
  return (str ?? '')
    .trim().toLowerCase()
    .replace(/é|è|ê/g, 'e')
    .replace(/à/g, 'a')
    .replace(/ù|û/g, 'u')
    .replace(/ô/g, 'o')
    .replace(/î/g, 'i')
    .replace(/ç/g, 'c')
    .replace(/_/g, ' ')
    .replace(/-/g, ' ')
}

// ── Enregistrement consommation (miroir de enregistrerConsommation) ───────
async function enregistrerConsommation(benevole, produit, droit, groupe, setDroits) {
  const ts = Date.now()

  // Historique consommations
  await addDoc(collection(db, 'consommations_benevoles'), {
    benevole:  benevole.nom,
    badge:     benevole.badge,
    produit:   produit.nom,
    timestamp: ts
  })

  // Offerts
  await addDoc(collection(db, 'offerts'), {
    produit:   produit.nom,
    prix:      0,
    quantite:  1,
    type:      'benevole',
    timestamp: ts
  })

  // Stock
  const stockDoc = await getDoc(doc(db, 'stock', produit.id))
  if (stockDoc.exists()) {
    const stockActuel = stockDoc.data().stock ?? 0
    const illimite    = stockDoc.data().illimite ?? false
    if (!illimite && stockActuel > 0) {
      await updateDoc(doc(db, 'stock', produit.id), { stock: stockActuel - 1 })
    }
  }

  // Mise à jour consommes dans benevoles/{badge}
  const benevoleDoc = await getDoc(doc(db, 'benevoles', benevole.badge))
  const consommes   = benevoleDoc.data()?.consommes ?? {}
  const actuel      = Number(consommes[groupe] ?? 0)
  await updateDoc(doc(db, 'benevoles', benevole.badge), {
    [`consommes.${groupe}`]: actuel + 1
  })

  // Mise à jour UI locale
  setDroits(prev => prev.map(d =>
    d.groupe === groupe ? { ...d, consomme: d.consomme + 1 } : d
  ))
}

// ── Composant carte bénévole ──────────────────────────────────────────────
function BenevoleCard({ benevole, onClick }) {
  return (
    <button onClick={onClick} style={{
      width:'100%', textAlign:'left', background:'#fff',
      border:'none', borderRadius:20, padding:18,
      boxShadow:'0 2px 8px rgba(0,0,0,.06)',
      cursor:'pointer', WebkitTapHighlightColor:'transparent',
      display:'flex', justifyContent:'space-between', alignItems:'center'
    }}>
      <div>
        <div style={{ fontFamily:'var(--font)', fontWeight:700, fontSize:16, color:'#1C1C1E' }}>
          {benevole.nom}
        </div>
        <div style={{ fontSize:12, color:'#888', marginTop:2 }}>
          Badge : {benevole.badge}
        </div>
      </div>
      <span style={{ color:'#ccc', fontSize:20 }}>›</span>
    </button>
  )
}

// ── Vue principale ────────────────────────────────────────────────────────
export default function BenevoleView() {
  const navigate = useNavigate()

  const [benevoles,   setBenevoles]   = useState([])
  const [produits,    setProduits]    = useState([])
  const [droits,      setDroits]      = useState([])
  const [recherche,   setRecherche]   = useState('')
  const [selected,    setSelected]    = useState(null)  // bénévole sélectionné
  const [loading,     setLoading]     = useState(true)
  const [loadingDroits, setLoadingDroits] = useState(false)
  const [toast,       setToast]       = useState(null)

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2500) }

  // ── Chargement initial ────────────────────────────────────────────────
  useEffect(() => {
    Promise.all([
      getDocs(collection(db, 'benevoles')),
      getDocs(collection(db, 'produits'))
    ]).then(([benSnap, prodSnap]) => {
      setBenevoles(benSnap.docs.map(d => ({ badge: d.id, ...d.data() })))
      setProduits(prodSnap.docs.map(d => ({ id: d.id, ...d.data() })))
      setLoading(false)
    })
  }, [])

  // ── Chargement droits bénévole (miroir de chargerDroits) ─────────────
  const chargerDroits = async (benevole) => {
    setLoadingDroits(true)
    setDroits([])
    const snap = await getDoc(doc(db, 'benevoles', benevole.badge))
    const data = snap.data() ?? {}

    const droitsMap    = data.droits    ?? {}
    const consommesMap = data.consommes ?? {}

    const liste = Object.entries(droitsMap).map(([nom, valeur]) => ({
      benevoleId: benevole.badge,
      groupe:     nom,
      max:        Number(valeur) || 0,
      consomme:   Number(consommesMap[nom] ?? 0)
    }))

    setDroits(liste)
    setLoadingDroits(false)
  }

  const selectionnerBenevole = (benevole) => {
    setSelected(benevole)
    chargerDroits(benevole)
  }

  const retour = () => {
    if (selected) { setSelected(null); setDroits([]) }
    else navigate(-1)
  }

  // ── Filtrage liste bénévoles ──────────────────────────────────────────
  const benevolesFiltres = benevoles.filter(b =>
    b.nom?.toLowerCase().includes(recherche.toLowerCase())
  )

  // ── ÉCRAN LISTE ───────────────────────────────────────────────────────
  if (!selected) return (
    <div className="page" style={{ background:'#F2F2F7' }}>
      {/* Header */}
      <div style={{
        background:'linear-gradient(90deg,#5E35B1,#7C4DFF)',
        borderRadius:'0 0 28px 28px',
        padding:'52px 20px 20px', position:'relative'
      }}>
        <button className="back-btn" onClick={retour}>‹</button>
        <h1 style={{ fontFamily:'var(--font)', fontWeight:900, fontSize:22,
                     color:'#fff', margin:'0 0 4px' }}>👥 Espace Bénévoles</h1>
        <p style={{ color:'rgba(255,255,255,.8)', fontSize:13, margin:0 }}>
          Distribution repas & goûters
        </p>
      </div>

      <div style={{ padding:'16px 16px 0' }}>
        <input type="text" placeholder="🔍 Rechercher un bénévole…"
          value={recherche} onChange={e => setRecherche(e.target.value)} />
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:'12px 16px 32px',
                    display:'flex', flexDirection:'column', gap:10 }}>
        {loading ? (
          <div className="spinner" />
        ) : benevolesFiltres.length === 0 ? (
          <p style={{ textAlign:'center', color:'#888', marginTop:40 }}>
            Aucun bénévole trouvé
          </p>
        ) : benevolesFiltres.map(b => (
          <BenevoleCard key={b.badge} benevole={b}
            onClick={() => selectionnerBenevole(b)} />
        ))}
      </div>
    </div>
  )

  // ── ÉCRAN DÉTAIL BÉNÉVOLE ─────────────────────────────────────────────
  const totalConsomme = droits.reduce((s, d) => s + d.consomme, 0)
  const totalMax      = droits.reduce((s, d) => s + d.max, 0)

  return (
    <div className="page" style={{ background:'#F2F2F7' }}>
      {/* Header */}
      <div style={{
        background:'linear-gradient(90deg,#5E35B1,#7C4DFF)',
        borderRadius:'0 0 28px 28px',
        padding:'52px 20px 20px', position:'relative'
      }}>
        <button className="back-btn" onClick={retour}>‹</button>
        <h1 style={{ fontFamily:'var(--font)', fontWeight:900, fontSize:22,
                     color:'#fff', margin:'0 0 2px' }}>Bénévoles</h1>
        <p style={{ color:'rgba(255,255,255,.8)', fontSize:13, margin:0 }}>
          {selected.nom}
        </p>
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:'16px 16px 32px',
                    display:'flex', flexDirection:'column', gap:14 }}>

        {/* Carte résumé bénévole */}
        <div style={{
          background:'#D1F2EB', borderRadius:20, padding:18,
          display:'flex', justifyContent:'space-between', alignItems:'center'
        }}>
          <div>
            <div style={{ fontFamily:'var(--font)', fontWeight:700,
                          fontSize:20, color:'#00695C' }}>{selected.nom}</div>
            <div style={{ color:'#888', fontSize:13, marginTop:2 }}>
              Badge : {selected.badge}
            </div>
          </div>
          <div style={{ textAlign:'center' }}>
            <div style={{
              fontFamily:'var(--font)', fontWeight:900, fontSize:22,
              color: totalConsomme >= totalMax ? '#C62828' : '#00695C'
            }}>
              {totalConsomme}/{totalMax}
            </div>
            <div style={{ fontSize:11, color:'#888' }}>consommé</div>
          </div>
        </div>

        {/* Droits par groupe */}
        {loadingDroits ? (
          <div className="spinner" style={{ borderTopColor:'#009688', borderColor:'#D1F2EB' }} />
        ) : droits.length === 0 ? (
          <p style={{ textAlign:'center', color:'#888' }}>Aucun droit associé</p>
        ) : droits.map(droit => {
          const epuise = droit.consomme >= droit.max
          const pct    = droit.max > 0 ? Math.min(1, droit.consomme / droit.max) : 0

          // Produits associés à ce groupe (miroir de produitsGroupe)
          const droitNormalise = normalise(droit.groupe.replace('groupe_', ''))
          const produitsGroupe = produits.filter(p =>
            (p.groupes ?? []).some(g =>
              normalise(g.replace('groupe_', '')) === droitNormalise
            )
          )

          // Nom affiché (miroir du replaceFirstChar)
          const nomAffiche = droit.groupe
            .replace('groupe_', '')
            .replace(/_/g, ' ')
            .replace(/^\w/, c => c.toUpperCase())

          return (
            <div key={droit.groupe} style={{
              background: epuise ? '#FFEBEE' : '#fff',
              borderRadius:20, padding:18,
              boxShadow:'0 2px 8px rgba(0,0,0,.06)'
            }}>
              {/* Titre + compteur */}
              <div style={{ display:'flex', justifyContent:'space-between',
                            alignItems:'flex-start', marginBottom:4 }}>
                <div style={{ fontFamily:'var(--font)', fontWeight:700, fontSize:18 }}>
                  {nomAffiche}
                </div>
                <span style={{
                  fontFamily:'var(--font)', fontWeight:900, fontSize:16,
                  color: epuise ? '#C62828' : '#00695C'
                }}>
                  {droit.consomme}/{droit.max}
                </span>
              </div>

              {/* Barre de progression */}
              <div style={{ height:6, borderRadius:99, background:'#EEE', marginBottom:14 }}>
                <div style={{
                  height:'100%', borderRadius:99,
                  background: epuise ? '#C62828' : '#009688',
                  width:`${Math.round(pct*100)}%`, transition:'width .4s'
                }} />
              </div>

              {/* Boutons produits en grille 2 colonnes */}
              {produitsGroupe.length === 0 ? (
                <p style={{ fontSize:13, color:'#aaa', textAlign:'center' }}>
                  Aucun produit associé
                </p>
              ) : (
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                  {produitsGroupe.map(produit => (
                    <button key={produit.id} onClick={async () => {
                      if (epuise) return
                      try {
                        await enregistrerConsommation(
                          selected, produit, droit, droit.groupe, setDroits
                        )
                        showToast(`✅ ${produit.nom} enregistré !`)
                      } catch(e) {
                        showToast('❌ ' + e.message)
                      }
                    }} style={{
                      height:48, borderRadius:12, border:'none',
                      background: epuise ? '#9E9E9E' : '#009688',
                      color:'#fff', fontFamily:'var(--font)', fontWeight:700,
                      fontSize:12, cursor: epuise ? 'not-allowed' : 'pointer',
                      textAlign:'center', padding:'0 8px',
                      WebkitTapHighlightColor:'transparent',
                      opacity: epuise ? .7 : 1
                    }}>
                      {produit.nom}
                    </button>
                  ))}
                </div>
              )}

              {epuise && (
                <div style={{ marginTop:10, background:'#FFCDD2', borderRadius:10,
                              padding:'8px 12px', fontSize:13, color:'#C62828',
                              textAlign:'center', fontWeight:600 }}>
                  ⛔ Quota épuisé
                </div>
              )}
            </div>
          )
        })}
      </div>

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
