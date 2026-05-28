// src/views/CaisseView.jsx — miroir fidèle de MainScreen.kt
import { useEffect, useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { db, getProduits, enregistrerDon, watchCA } from '../services/firebase'
import {
  collection, addDoc, getDocs, query, where,
  runTransaction, doc, updateDoc
} from 'firebase/firestore'

const CATEGORIES = [
  { id: 'boisson',   label: '🥤 Boissons' },
  { id: 'snack',     label: '🍟 Snacks'   },
  { id: 'activites', label: '🎯 Activités'},
]

// ── Helpers stock ────────────────────────────────────────────────────────────
async function majStockFirebase(nomProduit, quantite, produits, setProduits) {
  const produit      = produits.find(p => p.nom === nomProduit)
  const multiplicateur = produit?.multiplicateur ?? 1
  const quantiteReelle = quantite * multiplicateur
  const nomStock     = produit?.stock_ref || nomProduit

  const snap = await getDocs(query(collection(db, 'stock'), where('nom', '==', nomStock)))
  for (const stockDoc of snap.docs) {
    const stockActuel  = stockDoc.data().stock ?? 0
    const nouveauStock = Math.max(0, stockActuel - quantiteReelle)
    await updateDoc(doc(db, 'stock', stockDoc.id), { stock: nouveauStock })
    setProduits(prev => prev.map(p =>
      p.nom?.toLowerCase() === nomStock.toLowerCase() ||
      p.stock_ref?.toLowerCase() === nomStock.toLowerCase()
        ? { ...p, stock: nouveauStock }
        : p
    ))
  }
}

// ── Validation panier avec transaction sécurisée (miroir de validerPanier) ──
async function validerPanierFirebase(panier, produits, setProduits) {
  const commandeId = Date.now().toString()

  // Regrouper par nom
  const grouped = {}
  panier.forEach(p => {
    if (!grouped[p.nom]) grouped[p.nom] = { ...p, quantite: 0 }
    grouped[p.nom].quantite++
  })

  for (const article of Object.values(grouped)) {
    const quantite = article.quantite

    if (article.illimite) {
      await addDoc(collection(db, 'ventes'), venteMap(commandeId, article, quantite))
      continue
    }

    const multiplicateur = article.multiplicateur ?? 1
    const quantiteReelle = quantite * multiplicateur
    const nomStock       = article.stock_ref || article.nom

    const snap = await getDocs(query(collection(db, 'stock'), where('nom', '==', nomStock)))
    for (const stockDoc of snap.docs) {
      const stockRef = doc(db, 'stock', stockDoc.id)
      try {
        const nouveauStock = await runTransaction(db, async tx => {
          const snapshot    = await tx.get(stockRef)
          const stockActuel = snapshot.data().stock ?? 0
          if (stockActuel < quantiteReelle) throw new Error('Stock insuffisant')
          const ns = stockActuel - quantiteReelle
          tx.update(stockRef, { stock: ns })
          return ns
        })
        await addDoc(collection(db, 'ventes'), venteMap(commandeId, article, quantite))
        setProduits(prev => prev.map(p =>
          p.nom?.toLowerCase() === nomStock.toLowerCase() ||
          p.stock_ref?.toLowerCase() === nomStock.toLowerCase()
            ? { ...p, stock: nouveauStock }
            : p
        ))
      } catch(e) {
        // Resync stock depuis Firebase en cas d'échec
        const fresh = await getDocs(query(collection(db, 'stock'), where('nom', '==', nomStock)))
        fresh.forEach(d => {
          const s = d.data().stock ?? 0
          setProduits(prev => prev.map(p =>
            p.nom?.toLowerCase() === nomStock.toLowerCase() ||
            p.stock_ref?.toLowerCase() === nomStock.toLowerCase()
              ? { ...p, stock: s } : p
          ))
        })
        throw e
      }
    }
  }
}

function venteMap(commandeId, article, quantite) {
  return {
    commande_id:    commandeId,
    produit:        article.nom,
    prix:           article.prix,
    prix_achat:     article.prix_achat ?? 0,
    quantite:       quantite,
    multiplicateur: article.multiplicateur ?? 1,
    unites_stock:   quantite * (article.multiplicateur ?? 1),
    stock_ref:      article.stock_ref || article.nom,
    type:           article.type ?? '',
    timestamp:      Date.now()
  }
}

// ── Composant carte produit (miroir de ProduitCard) ─────────────────────────
function ProduitCard({ produit, onClick }) {
  const mult      = produit.multiplicateur ?? 1
  const stockDispo = mult > 1 ? Math.floor((produit.stock ?? 0) / mult) : (produit.stock ?? 0)
  const enRupture = !produit.illimite && stockDispo <= 0

  const bg = enRupture ? '#E0E0E0' : produit.illimite ? '#DDE7FF' : '#DDEBDD'

  return (
    <button onClick={onClick} disabled={enRupture} style={{
      width: 138, minHeight: 90, borderRadius: 16, border: 'none',
      background: bg, padding: '8px 10px', cursor: enRupture ? 'not-allowed' : 'pointer',
      display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
      textAlign: 'left', opacity: enRupture ? .6 : 1,
      boxShadow: enRupture ? 'none' : '0 2px 8px rgba(0,0,0,.08)',
      transition: 'transform .12s', WebkitTapHighlightColor: 'transparent',
      flexShrink: 0
    }}>
      <span style={{ fontFamily:'var(--font)', fontWeight:700, fontSize:13,
                     color: enRupture?'#888':'#1C1C1E',
                     display:'-webkit-box', WebkitLineClamp:2,
                     WebkitBoxOrient:'vertical', overflow:'hidden' }}>
        {produit.nom}
      </span>
      <div>
        <div style={{ fontFamily:'var(--font)', fontWeight:700, fontSize:13,
                      color: enRupture?'#888':'#5E35B1' }}>
          {(produit.prix ?? 0).toFixed(2)} €
        </div>
        <div style={{ fontSize:10, color: enRupture?'#aaa':'#2E7D32', marginTop:2 }}>
          {produit.illimite ? '♾️ Illimité'
            : enRupture     ? '🔴 Rupture'
            : mult > 1      ? `🟢 ${produit.stock} (x${mult}/vente)`
            :                 `🟢 ${stockDispo} en stock`}
        </div>
      </div>
    </button>
  )
}

// ── Vue principale ───────────────────────────────────────────────────────────
export default function CaisseView() {
  const navigate = useNavigate()

  const [produits,    setProduits]    = useState([])
  const [panier,      setPanier]      = useState([])   // liste plate comme Android
  const [categorie,   setCategorie]   = useState('boisson')
  const [totalCA,     setTotalCA]     = useState(0)
  const [loading,     setLoading]     = useState(true)
  const [toast,       setToast]       = useState(null)

  // Dialogs
  const [qteDialog,   setQteDialog]   = useState(null)  // produit sélectionné
  const [qteTexte,    setQteTexte]    = useState('')
  const [donDialog,   setDonDialog]   = useState(false)
  const [montantDon,  setMontantDon]  = useState('')
  const [confirmDlg,  setConfirmDlg]  = useState(false)
  const [apiecDlg,    setApiecDlg]    = useState(false)

  const unsubCA      = useRef(null)
  const scrollRef     = useRef(null)
  const isDragging    = useRef(false)
  const dragStartX    = useRef(0)
  const scrollStartX  = useRef(0)

  const onMouseDown = (e) => {
    isDragging.current   = true
    dragStartX.current   = e.pageX
    scrollStartX.current = scrollRef.current?.scrollLeft ?? 0
  }
  const onMouseMove = (e) => {
    if (!isDragging.current || !scrollRef.current) return
    e.preventDefault()
    scrollRef.current.scrollLeft = scrollStartX.current - (e.pageX - dragStartX.current)
  }
  const onMouseUp = () => { isDragging.current = false }

  useEffect(() => {
    getProduits().then(p => { setProduits(p); setLoading(false) })
    unsubCA.current = watchCA(setTotalCA)
    return () => unsubCA.current?.()
  }, [])

  const showToast = useCallback((msg, ms = 2500) => {
    setToast(msg); setTimeout(() => setToast(null), ms)
  }, [])

  // ── Panier (liste plate comme Kotlin MutableStateListOf) ────────────────
  const ajouterAuPanier = (produit) => {
    const mult      = produit.multiplicateur ?? 1
    const stockDispo = mult > 1 ? Math.floor((produit.stock ?? 0) / mult) : (produit.stock ?? 0)
    if (!produit.illimite && stockDispo <= 0) { showToast('⚠️ Stock épuisé'); return }
    setPanier(prev => [...prev, produit])
  }

  const ouvrirDialogQuantite = (produit) => {
    setQteDialog(produit)
    setQteTexte('')
  }

  const confirmerQuantite = () => {
    const q = parseInt(qteTexte) || 0
    if (q <= 0) { showToast('Quantité invalide'); return }
    const items = Array(q).fill(qteDialog)
    setPanier(prev => [...prev, ...items])
    setQteDialog(null)
  }

  // Regroupement panier pour affichage (comme groupBy { it.nom })
  const panierGroupe = Object.values(
    panier.reduce((acc, p) => {
      if (!acc[p.nom]) acc[p.nom] = { ...p, quantite: 0 }
      acc[p.nom].quantite++
      return acc
    }, {})
  )

  const totalPanier = panier.reduce((s, p) => s + (p.prix ?? 0), 0)

  // ── Valider commande ─────────────────────────────────────────────────────
  const validerCommande = async () => {
    if (panier.length === 0) return
    try {
      await validerPanierFirebase(panier, produits, setProduits)
      setPanier([])
      setConfirmDlg(false)
      showToast('✅ Commande enregistrée !')
    } catch(e) {
      showToast('❌ ' + e.message)
    }
  }

  // ── Bouton APIEC (offerts — miroir du bouton 👥 APIEC) ──────────────────
  const validerApiec = async () => {
    if (panier.length === 0) { setApiecDlg(false); return }
    const commandeId = Date.now().toString()
    const grouped = {}
    panier.forEach(p => { if (!grouped[p.nom]) grouped[p.nom] = {...p, quantite:0}; grouped[p.nom].quantite++ })
    for (const article of Object.values(grouped)) {
      await addDoc(collection(db, 'offerts'), {
        commande_id: commandeId,
        produit:     article.nom,
        prix:        0,
        prix_achat:  article.prix_achat ?? 0,
        quantite:    article.quantite,
        type:        article.type ?? '',
        timestamp:   Date.now()
      })
      if (!article.illimite) {
        await majStockFirebase(article.nom, article.quantite, produits, setProduits)
      }
    }
    setPanier([])
    setApiecDlg(false)
    showToast('👥 Offert par APIEC enregistré !')
  }

  // ── Don ──────────────────────────────────────────────────────────────────
  const validerDon = async () => {
    const montant = parseFloat(montantDon)
    if (isNaN(montant) || montant <= 0) { showToast('Montant invalide'); return }
    await enregistrerDon(montant)
    setMontantDon(''); setDonDialog(false)
    showToast(`❤️ Don de ${montant.toFixed(2)} € enregistré !`)
  }

  // ── Filtrage produits ────────────────────────────────────────────────────
  const produitsFiltres = produits.filter(p => (p.type ?? '') === categorie)

  return (
    <div className="page" style={{ background:'#F2F2F7' }}>

      {/* ── HEADER ── */}
      <div style={{
        background:'linear-gradient(90deg,#5E35B1,#7C4DFF)',
        borderRadius:'0 0 28px 28px',
        padding:'48px 22px 22px', position:'relative'
      }}>
        <button className="back-btn" onClick={() => navigate('/')}>‹</button>

        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
          <div>
            <h1 style={{ fontFamily:'var(--font)', fontWeight:900, fontSize:26,
                         color:'#fff', margin:'0 0 10px', letterSpacing:.3 }}>Caisse</h1>
            {/* Badge CA total */}
            <div style={{ background:'rgba(255,255,255,.95)', borderRadius:18,
                          padding:'8px 14px', display:'inline-flex', alignItems:'center', gap:8 }}>
              <span style={{ fontSize:16 }}>💰</span>
              <span style={{ color:'#888', fontSize:12, fontWeight:600 }}>Total</span>
              <span style={{ fontFamily:'var(--font)', fontWeight:900, fontSize:19, color:'#5E35B1' }}>
                {totalCA.toFixed(2)} €
              </span>
            </div>
          </div>
          {/* Badge panier */}
          {panier.length > 0 && (
            <button onClick={() => setConfirmDlg(true)} style={{
              background:'rgba(255,255,255,.2)', border:'none', borderRadius:12,
              padding:'8px 14px', color:'#fff', fontFamily:'var(--font)',
              fontWeight:800, fontSize:14, cursor:'pointer',
              display:'flex', alignItems:'center', gap:6
            }}>
              🛒 {panier.length}
              <span style={{ background:'#E91E63', borderRadius:99, padding:'2px 8px', fontSize:13 }}>
                {totalPanier.toFixed(2)} €
              </span>
            </button>
          )}
        </div>
      </div>

      {/* ── ACTIONS : APIEC / DON / BÉNÉVOLES ── */}
      <div style={{ display:'flex', gap:8, padding:'14px 16px 0' }}>
        {[
          { label:'👥 APIEC',     color:'#FF9800', onClick: () => panier.length>0 ? setApiecDlg(true) : showToast('Panier vide') },
          { label:'❤️ DON',       color:'#E91E63', onClick: () => setDonDialog(true) },
          { label:'🤝 Bénévoles', color:'#009688', onClick: () => navigate('/benevole') },
        ].map(a => (
          <button key={a.label} onClick={a.onClick} style={{
            flex:1, height:52, borderRadius:14, border:'none',
            background:a.color, color:'#fff', fontFamily:'var(--font)',
            fontWeight:700, fontSize:11, cursor:'pointer',
            WebkitTapHighlightColor:'transparent'
          }}>{a.label}</button>
        ))}
      </div>

      {/* ── CATÉGORIES ── */}
      <div style={{ display:'flex', gap:8, padding:'14px 16px 0' }}>
        {CATEGORIES.map(cat => (
          <button key={cat.id} onClick={() => setCategorie(cat.id)} style={{
            flex:1, height:48, borderRadius:14, border:'none',
            background: categorie===cat.id ? '#6A43C7' : '#D1C4E9',
            color:      categorie===cat.id ? '#fff' : '#5E35B1',
            fontFamily:'var(--font)', fontWeight: categorie===cat.id ? 700 : 500,
            fontSize:11, cursor:'pointer',
            boxShadow:  categorie===cat.id ? '0 2px 8px rgba(106,67,199,.3)' : 'none',
            transition:'all .15s', WebkitTapHighlightColor:'transparent'
          }}>{cat.label}</button>
        ))}
      </div>

      {/* ── PRODUITS ── */}
      <div style={{ paddingTop:14 }}>
        <p style={{ fontFamily:'var(--font)', fontWeight:700, fontSize:17,
                    color:'#1C1C1E', margin:'0 0 10px', paddingLeft:16 }}>📦 Produits</p>
        {loading ? (
          <div className="spinner" />
        ) : produitsFiltres.length === 0 ? (
          <div style={{ height:90, display:'flex', alignItems:'center',
                        paddingLeft:16, color:'#888', fontSize:13 }}>
            Aucun produit dans cette catégorie
          </div>
        ) : (
          <div
            className="produits-scroll"
            ref={scrollRef}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
          >
            {produitsFiltres.map(produit => (
              <ProduitCard key={produit.id ?? produit.nom} produit={produit}
                onClick={() => ouvrirDialogQuantite(produit)} />
            ))}
          </div>
        )}
      </div>

      {/* ── PANIER ── */}
      <div style={{ padding:'22px 16px 0' }}>
        <p style={{ fontFamily:'var(--font)', fontWeight:700, fontSize:17,
                    color:'#1C1C1E', margin:'0 0 10px' }}>🛒 Panier</p>
        <div className="card" style={{ padding:14 }}>
          {panierGroupe.length === 0 ? (
            <div style={{ height:56, display:'flex', alignItems:'center',
                          justifyContent:'center', color:'#ccc', fontSize:13 }}>
              Le panier est vide
            </div>
          ) : (
            <>
              {panierGroupe.map((article, i) => (
                <div key={article.nom}>
                  <div style={{ display:'flex', justifyContent:'space-between',
                                alignItems:'center', padding:'4px 0' }}>
                    <div style={{ flex:1 }}>
                      <div style={{ fontWeight:600, fontSize:13 }}>
                        {article.nom} ×{article.quantite}
                      </div>
                      <div style={{ fontSize:11, color:'#888' }}>
                        {(article.prix??0).toFixed(2)} € / unité
                      </div>
                    </div>
                    <span style={{ fontWeight:700, fontSize:13 }}>
                      {((article.prix??0)*article.quantite).toFixed(2)} €
                    </span>
                    <button onClick={() => {
                        setPanier(prev => {
                          const idx = prev.findLastIndex(p => p.nom === article.nom)
                          if (idx === -1) return prev
                          // Retire toutes les occurrences comme Android (IconButton 🗑️)
                          return prev.filter(p => p.nom !== article.nom)
                        })
                      }}
                      style={{ background:'none', border:'none', cursor:'pointer',
                               fontSize:15, marginLeft:4 }}>🗑️</button>
                  </div>
                  {i < panierGroupe.length-1 && (
                    <div style={{ height:1, background:'#EEE', margin:'2px 0' }} />
                  )}
                </div>
              ))}
            </>
          )}

          {/* Total + Valider */}
          <div style={{ display:'flex', gap:12, marginTop:14, alignItems:'center' }}>
            <div style={{ width:116, height:52, borderRadius:16,
                          background:'#EDE7F6', display:'flex',
                          flexDirection:'column', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <span style={{ fontSize:10, color:'#888' }}>Total</span>
              <span style={{ fontFamily:'var(--font)', fontWeight:900,
                             fontSize:19, color:'#5E35B1' }}>
                {totalPanier.toFixed(2)} €
              </span>
            </div>
            <button onClick={() => panier.length>0 && setConfirmDlg(true)}
              style={{
                flex:1, height:52, borderRadius:16, border:'none',
                background: panier.length>0 ? '#6A43C7' : '#ccc',
                color:'#fff', fontFamily:'var(--font)', fontWeight:700,
                fontSize:13, cursor: panier.length>0 ? 'pointer':'not-allowed'
              }}>
              ✅ Valider la commande
            </button>
          </div>
        </div>
      </div>

      <div style={{ height:40 }} />

      {/* ── DIALOG QUANTITÉ ── */}
      {qteDialog && (
        <div className="overlay" onClick={() => setQteDialog(null)}>
          <div className="dialog" onClick={e => e.stopPropagation()}>
            <h2 style={{ fontFamily:'var(--font)', fontWeight:900, margin:'0 0 4px' }}>
              Ajouter au panier
            </h2>
            <p style={{ fontWeight:600, marginBottom:16, color:'var(--text-muted)' }}>
              {qteDialog.nom}
            </p>
            <input type="number" placeholder="Quantité" value={qteTexte}
              onChange={e => setQteTexte(e.target.value)}
              autoFocus min={1}
              onKeyDown={e => e.key==='Enter' && confirmerQuantite()}
              style={{ marginBottom:16 }} />
            <div style={{ display:'flex', gap:10 }}>
              <button className="btn btn-ghost btn-full" onClick={() => setQteDialog(null)}>Annuler</button>
              <button className="btn btn-primary btn-full" onClick={confirmerQuantite}>Valider</button>
            </div>
          </div>
        </div>
      )}

      {/* ── DIALOG CONFIRMATION VENTE ── */}
      {confirmDlg && (
        <div className="overlay" onClick={() => setConfirmDlg(false)}>
          <div className="dialog" onClick={e => e.stopPropagation()}>
            <h2 style={{ fontFamily:'var(--font)', fontWeight:900, margin:'0 0 16px' }}>
              Confirmer la vente
            </h2>
            {panierGroupe.map(item => (
              <div key={item.nom} style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
                <span>{item.nom} × {item.quantite}</span>
                <span style={{ fontWeight:700 }}>
                  {((item.prix??0)*item.quantite).toFixed(2)} €
                </span>
              </div>
            ))}
            <div style={{ borderTop:'1px solid #EEE', paddingTop:12, marginTop:8, marginBottom:20,
                          display:'flex', justifyContent:'space-between',
                          fontFamily:'var(--font)', fontWeight:900, fontSize:20 }}>
              <span>Total</span>
              <span style={{ color:'#6A43C7' }}>{totalPanier.toFixed(2)} €</span>
            </div>
            <div style={{ display:'flex', gap:10 }}>
              <button className="btn btn-ghost btn-full" onClick={() => setConfirmDlg(false)}>Annuler</button>
              <button className="btn btn-primary btn-full" onClick={validerCommande}>✅ Valider</button>
            </div>
          </div>
        </div>
      )}

      {/* ── DIALOG APIEC ── */}
      {apiecDlg && (
        <div className="overlay" onClick={() => setApiecDlg(false)}>
          <div className="dialog" onClick={e => e.stopPropagation()}>
            <h2 style={{ fontFamily:'var(--font)', fontWeight:900, margin:'0 0 16px' }}>
              👥 Offert par APIEC
            </h2>
            <p style={{ color:'var(--text-muted)', marginBottom:16, fontSize:14 }}>
              Ces articles seront enregistrés comme offerts (prix 0 €) et le stock sera déduit.
            </p>
            {panierGroupe.map(item => (
              <div key={item.nom} style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
                <span>{item.nom} × {item.quantite}</span>
                <span style={{ fontWeight:700, color:'#FF9800' }}>Offert</span>
              </div>
            ))}
            <div style={{ display:'flex', gap:10, marginTop:20 }}>
              <button className="btn btn-ghost btn-full" onClick={() => setApiecDlg(false)}>Annuler</button>
              <button className="btn btn-full btn-orange" onClick={validerApiec}>✅ Confirmer</button>
            </div>
          </div>
        </div>
      )}

      {/* ── DIALOG DON ── */}
      {donDialog && (
        <div className="overlay" onClick={() => setDonDialog(false)}>
          <div className="dialog" onClick={e => e.stopPropagation()}>
            <h2 style={{ fontFamily:'var(--font)', fontWeight:900, margin:'0 0 16px' }}>
              ❤️ Nouveau don
            </h2>
            <input type="number" placeholder="Montant (€)" value={montantDon}
              onChange={e => setMontantDon(e.target.value)}
              autoFocus style={{ marginBottom:16 }}
              onKeyDown={e => e.key==='Enter' && validerDon()} />
            <div style={{ display:'flex', gap:10 }}>
              <button className="btn btn-ghost btn-full" onClick={() => setDonDialog(false)}>Annuler</button>
              <button className="btn btn-pink btn-full" onClick={validerDon}>Valider</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}

function chunkArray(arr, size) {
  const chunks = []
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i+size))
  return chunks
}
