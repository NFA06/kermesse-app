// src/services/firebase.js
import { initializeApp, getApps, getApp } from 'firebase/app'
import {
  getFirestore,
  collection, getDocs, addDoc, deleteDoc,
  doc, onSnapshot, query, where, orderBy, updateDoc
} from 'firebase/firestore'

// ─── CONFIG ───────────────────────────────────────────────────────────────────
const firebaseConfig = {
  apiKey:            "AIzaSyCBE3QPPPv-byarETifN22VU-btcR7k6_0",
  authDomain:        "kermesseapp-xxxxx.firebaseapp.com",
  projectId:         "kermesseapp-xxxxx",
  storageBucket:     "kermesseapp-xxxxx.firebasestorage.app",
  messagingSenderId: "475581509044",
  appId:             "1:475581509044:web:d338209e8ecc362f4bd6e1"
}

// Guard anti-duplication (hot-reload Vite)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp()
export const db = getFirestore(app)

// ─── PRODUITS ─────────────────────────────────────────────────────────────────
export async function getProduits() {
  const [produitsSnap, stockSnap, activitesSnap] = await Promise.all([
    getDocs(collection(db, 'produits')),
    getDocs(collection(db, 'stock')),
    getDocs(collection(db, 'activites'))
  ])
  const stockMap = {}
  stockSnap.forEach(d => {
    const nom = d.data().nom?.trim().toLowerCase()
    if (nom) stockMap[nom] = d.data()
  })
  const merge = (snap, forcedType = '') => {
    const items = []
    snap.forEach(d => {
      const data = { id: d.id, ...d.data() }
      if (forcedType) data.type = forcedType
      const key = data.nom?.trim().toLowerCase()
      if (key && stockMap[key]) {
        data.stock    = stockMap[key].stock    ?? data.stock ?? 0
        data.illimite = stockMap[key].illimite ?? data.illimite ?? false
      }
      items.push(data)
    })
    return items
  }
  const all = [...merge(produitsSnap), ...merge(activitesSnap, 'activites')]
  const grouped = {}
  all.forEach(p => {
    const key = p.nom?.trim().toLowerCase()
    if (!key) return
    if (!grouped[key]) { grouped[key] = { ...p }; return }
    grouped[key].stock      = (grouped[key].stock ?? 0) + (p.stock ?? 0)
    grouped[key].illimite   = grouped[key].illimite || p.illimite
    grouped[key].prix       = Math.max(grouped[key].prix ?? 0, p.prix ?? 0)
    grouped[key].prix_achat = Math.max(grouped[key].prix_achat ?? 0, p.prix_achat ?? 0)
  })
  const consolidated = Object.values(grouped)
  consolidated.forEach(p => {
    if (p.stock_ref) {
      const parent = consolidated.find(x => x.nom?.toLowerCase() === p.stock_ref.toLowerCase())
      if (parent) { p.stock = parent.stock; p.illimite = parent.illimite }
    }
  })
  return consolidated
}

// ─── VENTES ───────────────────────────────────────────────────────────────────
export async function enregistrerVente(items) {
  const ts = Date.now()
  await Promise.all(items.map(item =>
    addDoc(collection(db, 'ventes'), {
      nom: item.nom, prix: item.prix,
      quantite: item.quantite ?? 1,
      total: (item.prix ?? 0) * (item.quantite ?? 1),
      type: item.type ?? '', timestamp: ts
    })
  ))
  const stockSnap = await getDocs(collection(db, 'stock'))
  for (const item of items) {
    const stockDoc = stockSnap.docs.find(
      d => d.data().nom?.toLowerCase() === item.nom?.toLowerCase()
    )
    if (stockDoc && !stockDoc.data().illimite) {
      const mult = item.multiplicateur ?? 1
      await updateDoc(doc(db, 'stock', stockDoc.id), {
        stock: Math.max(0, (stockDoc.data().stock ?? 0) - mult * (item.quantite ?? 1))
      })
    }
  }
}

// ─── CA TEMPS RÉEL ────────────────────────────────────────────────────────────
export function watchCA(callback) {
  return onSnapshot(collection(db, 'ventes'), snap => {
    let total = 0
    snap.forEach(d => { total += (d.data().prix ?? 0) * (d.data().quantite ?? 0) })
    callback(total)
  })
}

export function watchCAJour(callback) {
  const debut = new Date(); debut.setHours(0, 0, 0, 0)
  const q = query(collection(db, 'ventes'), where('timestamp', '>=', debut.getTime()))
  return onSnapshot(q, snap => {
    let total = 0, nb = 0
    snap.forEach(d => { total += (d.data().prix ?? 0) * (d.data().quantite ?? 0); nb++ })
    callback({ total, nb })
  })
}

// ─── DONS ─────────────────────────────────────────────────────────────────────
export async function enregistrerDon(montant) {
  await addDoc(collection(db, 'dons'), { montant: parseFloat(montant), timestamp: Date.now() })
}

// ─── COLOR RUN ────────────────────────────────────────────────────────────────
export function watchParticipants(callback) {
  return onSnapshot(collection(db, 'participants_colorrun'), snap => {
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    list.sort((a, b) => (a.nom ?? '').localeCompare(b.nom ?? ''))
    callback(list)
  })
}

export async function inscrireParticipant(data) {
  await addDoc(collection(db, 'participants_colorrun'), { ...data, timestamp: Date.now() })
}

export async function supprimerParticipant(id) {
  await deleteDoc(doc(db, 'participants_colorrun', id))
}

// ─── PLANNING ─────────────────────────────────────────────────────────────────
export function watchPlanning(callback) {
  return onSnapshot(collection(db, 'planning'), snap => {
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    items.sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0))
    callback(items)
  })
}

export async function updateStatutPlanning(id, statut) {
  await updateDoc(doc(db, 'planning', id), { statut })
}

// ─── LOTS TOMBOLA ─────────────────────────────────────────────────────────────
export function watchLots(callback) {
  return onSnapshot(
    collection(db, 'lots_tombola'),
    snap => {
      console.log('[Firebase] lots_tombola:', snap.docs.length, 'docs')
      const lots = snap.docs.map(d => {
        const data = d.data()
        return {
          id:          d.id,
          numero:      String(data.numero ?? data.numeroInt ?? d.id),
          designation: data.designation ?? '',
          gagne:       data.gagne === true,
          triKey:      Number(data.triKey ?? data.numeroInt ?? 0),
        }
      }).sort((a, b) => a.triKey - b.triKey)
      callback(lots)
    },
    err => console.error('[Firebase] lots_tombola erreur:', err.code, err.message)
  )
}

export async function toggleLot(id, currentGagne) {
  await updateDoc(doc(db, 'lots_tombola', id), { gagne: !currentGagne })
}

// ─── STATS ────────────────────────────────────────────────────────────────────
export async function getStatsVentes() {
  const snap = await getDocs(collection(db, 'ventes'))
  const parProduit = {}; let totalCA = 0
  snap.forEach(d => {
    const nom = d.data().nom ?? 'Inconnu'
    const montant = (d.data().prix ?? 0) * (d.data().quantite ?? 0)
    parProduit[nom] = (parProduit[nom] ?? 0) + montant
    totalCA += montant
  })
  return { parProduit, totalCA }
}

// ─── BÉNÉVOLES ────────────────────────────────────────────────────────────────
export async function getBenevoleParbadge(badge) {
  const snap = await getDocs(query(collection(db, 'benevoles'), where('badge', '==', badge)))
  if (snap.empty) return null
  const d = snap.docs[0]
  return { id: d.id, ...d.data() }
}

export function watchDroitsConso(benevoleId, callback) {
  const q = query(collection(db, 'groupes_conso'), where('benevoleId', '==', benevoleId))
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })))
  })
}

export async function consommer(droitId, consommeActuel) {
  await updateDoc(doc(db, 'groupes_conso', droitId), { consomme: consommeActuel + 1 })
}