// src/views/StatsView.jsx — miroir fidèle de StatsActivity.kt
import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { db } from '../services/firebase'
import { collection, getDocs } from 'firebase/firestore'

const VIOLET      = '#6A43C7'
const VIOLET_DARK = '#5E35B1'
const VIOLET_SURF = '#EDE7F6'
const GREEN       = '#4CAF50'
const PINK        = '#E91E63'
const TEAL        = '#009688'
const ORANGE      = '#FF9800'
const RED         = '#F44336'
const BG          = '#F2F2F7'

// ── Utilitaires (miroir des fonctions Kotlin) ─────────────────────────────
function getTrendText(hourlyData) {
  if (hourlyData.length < 2) return '➡️ En attente de données'
  const recent   = hourlyData.slice(-3).reduce((s,h) => s+h.ca, 0) / 3
  const previous = hourlyData.slice(-6,-3).reduce((s,h) => s+h.ca, 0) / 3
  if (recent > previous * 1.2) return '📈 Forte hausse'
  if (recent > previous)       return '↗️ En hausse'
  if (recent < previous * 0.8) return '📉 En baisse'
  return '➡️ Stable'
}

function calculateProjectedCA(currentCA, hourlyData) {
  if (hourlyData.length === 0) return currentCA * 2
  const avgPerHour = currentCA / hourlyData.length
  const hoursRemaining = Math.max(0, 18 - new Date().getHours())
  return currentCA + avgPerHour * hoursRemaining
}

function calculateAvailabilityRate(stockAlerts) {
  if (stockAlerts.length === 0) return 100
  const available = stockAlerts.filter(a => a.stockRestant > 0).length
  return Math.round((available / stockAlerts.length) * 100)
}

// ── Chargement données (miroir de loadAllStats) ───────────────────────────
async function loadAllStats() {
  const [ventesSnap, donsSnap, stockSnap] = await Promise.all([
    getDocs(collection(db, 'ventes')),
    getDocs(collection(db, 'dons')),
    getDocs(collection(db, 'stock')),
  ])

  // ── KPIs + top produits + catégories + horaire ────────────────────────
  let totalCA = 0, totalBenef = 0, totalQte = 0
  const commandeIds = new Set()
  const produitsVentes = {}, produitsCA = {}, produitsMarge = {}
  const catStats = {}, hourlyMap = {}

  ventesSnap.forEach(d => {
    const data   = d.data()
    const prix   = data.prix ?? 0
    const achat  = data.prix_achat ?? 0
    const qte    = data.quantite ?? 1
    const nom    = data.produit ?? 'Inconnu'
    const type   = data.type ?? 'autre'
    const ts     = data.timestamp ?? 0
    const ca     = prix * qte
    const benef  = (prix - achat) * qte
    const hour   = new Date(ts).getHours()
    const cmdId  = data.commande_id ?? String(ts)

    commandeIds.add(cmdId)
    totalCA    += ca
    totalBenef += benef
    totalQte   += qte

    produitsVentes[nom]  = (produitsVentes[nom]  ?? 0) + qte
    produitsCA[nom]      = (produitsCA[nom]       ?? 0) + ca
    if (prix > 0) produitsMarge[nom] = ((prix - achat) / prix) * 100

    // Catégories
    if (!catStats[type]) catStats[type] = { ca:0, qte:0, marge:0 }
    catStats[type].ca   += ca
    catStats[type].qte  += qte
    catStats[type].marge = prix > 0 ? ((prix-achat)/prix)*100 : 0

    // Horaire
    if (!hourlyMap[hour]) hourlyMap[hour] = { ca:0, ventes:0 }
    hourlyMap[hour].ca     += ca
    hourlyMap[hour].ventes += qte
  })

  const nbTransactions = commandeIds.size
  const panierMoyen    = nbTransactions > 0 ? totalCA / nbTransactions : 0
  const margeMoyenne   = totalCA > 0 ? (totalBenef / totalCA) * 100 : 0
  const produitStar    = Object.entries(produitsVentes).sort((a,b)=>b[1]-a[1])[0]?.[0] ?? 'Aucun'

  // ── Dons ─────────────────────────────────────────────────────────────
  let totalDons = 0, donMax = 0
  donsSnap.forEach(d => {
    const m = d.data().montant ?? 0
    totalDons += m
    if (m > donMax) donMax = m
  })
  const nbDonateurs = donsSnap.size
  const donMoyen    = nbDonateurs > 0 ? totalDons / nbDonateurs : 0

  // ── Top produits ─────────────────────────────────────────────────────
  const topProduits = Object.entries(produitsVentes)
    .sort((a,b) => b[1]-a[1])
    .map(([nom, qte]) => ({
      nom, qte,
      ca:    produitsCA[nom]    ?? 0,
      marge: produitsMarge[nom] ?? 0,
      tauxRotation: qte,
    }))

  // ── Catégories ───────────────────────────────────────────────────────
  const categoryStats = Object.entries(catStats)
    .map(([nom, s]) => ({
      nom: nom.charAt(0).toUpperCase() + nom.slice(1),
      ca: s.ca, quantite: s.qte, marge: s.marge
    }))
    .sort((a,b) => b.ca - a.ca)

  // ── Données horaires ─────────────────────────────────────────────────
  const hourlyData = Object.entries(hourlyMap)
    .map(([h, d]) => ({ heure: parseInt(h), ca: d.ca, ventes: d.ventes }))
    .sort((a,b) => a.heure - b.heure)

  // ── Alertes stock ────────────────────────────────────────────────────
  const stockAlerts = []
  stockSnap.forEach(d => {
    const data = d.data()
    if (data.illimite) return
    const stockActuel  = data.stock ?? 0
    const stockInitial = data.stock_initial ?? Math.max(stockActuel, 100)
    const pctEpuise    = stockInitial > 0 ? Math.round(((stockInitial-stockActuel)/stockInitial)*100) : 0
    const severity     = stockActuel === 0 ? 'critical'
                       : stockActuel < 10 || pctEpuise > 80 ? 'warning' : 'ok'
    stockAlerts.push({ nom: data.nom ?? '?', stockRestant: stockActuel, pourcentageEpuise: pctEpuise, severity })
  })
  stockAlerts.sort((a,b) => (a.severity==='critical'?0:a.severity==='warning'?1:2) - (b.severity==='critical'?0:b.severity==='warning'?1:2))

  return {
    kpi: { totalCA, benefice:totalBenef, totalDons, nbVentes:totalQte, nbTransactions, panierMoyen, margeMoyenne, produitStar },
    donStats: { total:totalDons, nbDonateurs, donMoyen, donMax },
    topProduits, categoryStats, hourlyData, stockAlerts
  }
}

// ── Composants ────────────────────────────────────────────────────────────
function KPICard({ label, value, color }) {
  return (
    <div style={{ background:'#fff', borderRadius:20, padding:16,
                  boxShadow:'0 2px 8px rgba(0,0,0,.06)',
                  background:`linear-gradient(180deg,${color}18 0%,#fff 100%)` }}>
      <div style={{ fontSize:13, color:'#888', marginBottom:8 }}>{label}</div>
      <div style={{ fontFamily:'var(--font)', fontWeight:900, fontSize:24, color }}>{value}</div>
    </div>
  )
}

function SectionCard({ title, children }) {
  return (
    <div style={{ background:'#fff', borderRadius:20, padding:20,
                  boxShadow:'0 2px 8px rgba(0,0,0,.06)' }}>
      <div style={{ fontFamily:'var(--font)', fontWeight:800, fontSize:18,
                    color:VIOLET_DARK, marginBottom:16 }}>{title}</div>
      {children}
    </div>
  )
}

function InfoRow({ label, value }) {
  return (
    <div style={{ display:'flex', justifyContent:'space-between',
                  alignItems:'center', padding:'4px 0' }}>
      <span style={{ color:'#888', fontSize:14 }}>{label}</span>
      <span style={{ fontFamily:'var(--font)', fontWeight:700,
                     fontSize:14, color:VIOLET_DARK }}>{value}</span>
    </div>
  )
}

function BarRow({ label, value, max, color }) {
  const pct = max > 0 ? Math.min(100, (value/max)*100) : 0
  return (
    <div style={{ marginBottom:8 }}>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
        <span style={{ fontSize:13, fontWeight:600 }}>{label}</span>
        <span style={{ fontSize:13, fontWeight:700, color }}>{value.toFixed(2)} €</span>
      </div>
      <div style={{ height:6, borderRadius:99, background:'#EEE' }}>
        <div style={{ height:'100%', borderRadius:99, background:color,
                      width:`${pct}%`, transition:'width .6s ease' }} />
      </div>
    </div>
  )
}

function StockRow({ alert }) {
  const color = alert.severity==='critical' ? RED : alert.severity==='warning' ? ORANGE : GREEN
  const bg    = alert.severity==='critical' ? '#FFEBEE' : alert.severity==='warning' ? '#FFF3E0' : '#E8F5E9'
  const icon  = alert.severity==='critical' ? '🔴' : alert.severity==='warning' ? '🟡' : '🟢'
  return (
    <div style={{ background:bg, borderRadius:12, padding:12,
                  display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
        <span style={{ fontSize:16 }}>{icon}</span>
        <div>
          <div style={{ fontWeight:600, fontSize:14 }}>{alert.nom}</div>
          <div style={{ fontSize:11, color:'#888' }}>Restant : {alert.stockRestant}</div>
        </div>
      </div>
      <span style={{ fontFamily:'var(--font)', fontWeight:900, fontSize:14, color }}>
        {alert.pourcentageEpuise}%
      </span>
    </div>
  )
}

// ── Onglet Vue d'ensemble ─────────────────────────────────────────────────
function VueEnsembleTab({ kpi, categoryStats, donStats }) {
  const maxCA = categoryStats[0]?.ca ?? 1
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      <SectionCard title="🎯 Métriques clés">
        <div style={{ display:'flex', justifyContent:'space-around', textAlign:'center' }}>
          {[
            ['Panier moyen', `${kpi.panierMoyen.toFixed(2)} €`],
            ['Marge moy.', `${Math.round(kpi.margeMoyenne)}%`],
            ['Transactions', String(kpi.nbTransactions)],
          ].map(([l,v]) => (
            <div key={l}>
              <div style={{ fontFamily:'var(--font)', fontWeight:900, fontSize:20, color:VIOLET_DARK }}>{v}</div>
              <div style={{ fontSize:11, color:'#888' }}>{l}</div>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="📊 Répartition par catégories">
        {categoryStats.map(cat => (
          <div key={cat.nom} style={{ marginBottom:14 }}>
            <BarRow label={cat.nom} value={cat.ca} max={maxCA} color={VIOLET} />
            <div style={{ fontSize:11, color:'#888', marginTop:-4 }}>
              {cat.quantite} ventes · Marge {Math.round(cat.marge)}%
            </div>
          </div>
        ))}
      </SectionCard>

      <SectionCard title="⭐ Produit star">
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <span style={{ fontFamily:'var(--font)', fontWeight:900, fontSize:20, color:VIOLET_DARK }}>
            {kpi.produitStar}
          </span>
          <span style={{ fontSize:32 }}>🏆</span>
        </div>
      </SectionCard>

      {donStats && (
        <SectionCard title="❤️ Analyse des dons">
          <InfoRow label="Nombre de donateurs" value={String(donStats.nbDonateurs)} />
          <InfoRow label="Don moyen" value={`${donStats.donMoyen.toFixed(2)} €`} />
          <InfoRow label="Don le plus élevé" value={`${donStats.donMax.toFixed(2)} €`} />
          <div style={{ marginTop:12 }}>
            <div style={{ fontSize:12, color:'#888', marginBottom:6 }}>Objectif : 500 €</div>
            <div style={{ height:12, borderRadius:99, background:'#FFE4E9' }}>
              <div style={{ height:'100%', borderRadius:99, background:PINK,
                            width:`${Math.min(100,(donStats.total/500)*100)}%`,
                            transition:'width .6s' }} />
            </div>
            <div style={{ fontSize:12, fontWeight:700, color:PINK, marginTop:4 }}>
              {Math.round(Math.min(100,(donStats.total/500)*100))}% atteint
            </div>
          </div>
        </SectionCard>
      )}
    </div>
  )
}

// ── Onglet Produits ───────────────────────────────────────────────────────
function ProduitsTab({ topProduits }) {
  const top10 = topProduits.slice(0,10)
  const maxCA = top10[0]?.ca ?? 1

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      <SectionCard title="🏆 Top 10 produits">
        {top10.map((p, i) => (
          <div key={p.nom}>
            <div style={{ display:'flex', justifyContent:'space-between',
                          alignItems:'center', padding:'8px 0' }}>
              <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                <div style={{
                  width:32, height:32, borderRadius:'50%', flexShrink:0,
                  background: i===0?'#FFD700':i===1?'#C0C0C0':i===2?'#CD7F32':VIOLET_SURF,
                  display:'flex', alignItems:'center', justifyContent:'center',
                  fontFamily:'var(--font)', fontWeight:900, fontSize:12,
                  color: i<3?'#fff':VIOLET_DARK
                }}>#{i+1}</div>
                <div>
                  <div style={{ fontWeight:600, fontSize:14 }}>{p.nom}</div>
                  <div style={{ fontSize:11, color:'#888' }}>{p.qte} vendus</div>
                </div>
              </div>
              <span style={{ fontFamily:'var(--font)', fontWeight:900,
                             fontSize:14, color:VIOLET_DARK }}>{p.ca.toFixed(2)} €</span>
            </div>
            {i < top10.length-1 && <div style={{ height:1, background:'#EEE' }} />}
          </div>
        ))}
      </SectionCard>

      <SectionCard title="💹 Analyse rentabilité">
        <div style={{ fontSize:14, color:'#888', marginBottom:12 }}>
          Produits les plus rentables
        </div>
        {[...topProduits].sort((a,b)=>b.marge-a.marge).slice(0,5).map(p => (
          <div key={p.nom} style={{ display:'flex', justifyContent:'space-between',
                                    alignItems:'center', marginBottom:10 }}>
            <span style={{ fontSize:13 }}>{p.nom}</span>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <span style={{ fontWeight:700, fontSize:13, color:GREEN }}>
                {Math.round(p.marge)}%
              </span>
              <div style={{ width:60, height:6, borderRadius:99, background:'#EEE' }}>
                <div style={{ height:'100%', borderRadius:99, background:GREEN,
                              width:`${Math.min(100,p.marge)}%` }} />
              </div>
            </div>
          </div>
        ))}
      </SectionCard>

      <SectionCard title="🔄 Taux de rotation">
        <div style={{ fontSize:14, color:'#888', marginBottom:12 }}>
          Produits qui se vendent le plus vite
        </div>
        {[...topProduits].sort((a,b)=>b.tauxRotation-a.tauxRotation).slice(0,5).map(p => (
          <div key={p.nom} style={{ display:'flex', justifyContent:'space-between',
                                    marginBottom:8 }}>
            <span style={{ fontSize:13 }}>{p.nom}</span>
            <span style={{ fontWeight:700, fontSize:13, color:TEAL }}>
              ×{Math.round(p.tauxRotation)}
            </span>
          </div>
        ))}
      </SectionCard>
    </div>
  )
}

// ── Onglet Temps réel ─────────────────────────────────────────────────────
function TempsReelTab({ hourlyData, kpi }) {
  const maxCA      = Math.max(...hourlyData.map(h=>h.ca), 1)
  const projCA     = calculateProjectedCA(kpi.totalCA, hourlyData)
  const avgPerHour = hourlyData.length > 0
    ? Math.round(hourlyData.reduce((s,h)=>s+h.ventes,0) / hourlyData.length)
    : 0
  const rushHours  = [...hourlyData].sort((a,b)=>b.ventes-a.ventes).slice(0,3)

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      <SectionCard title="⏰ CA par heure">
        {hourlyData.length === 0 ? (
          <p style={{ color:'#888', textAlign:'center', padding:32 }}>
            Données en cours de collecte…
          </p>
        ) : (
          <div>
            {/* Mini bar chart */}
            <div style={{ display:'flex', alignItems:'flex-end', gap:4, height:120, marginBottom:8 }}>
              {hourlyData.map(h => (
                <div key={h.heure} style={{ flex:1, display:'flex', flexDirection:'column',
                                            alignItems:'center', gap:2 }}>
                  <div style={{ width:'100%', background:VIOLET, borderRadius:'4px 4px 0 0',
                                height:`${Math.round((h.ca/maxCA)*100)}px`,
                                minHeight:2, transition:'height .4s' }} />
                  <span style={{ fontSize:9, color:'#888' }}>{h.heure}h</span>
                </div>
              ))}
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:4, marginTop:8 }}>
              {hourlyData.map(h => (
                <div key={h.heure} style={{ display:'flex', justifyContent:'space-between', fontSize:12 }}>
                  <span style={{ color:'#888' }}>{h.heure}h – {h.heure+1}h</span>
                  <span style={{ fontWeight:600 }}>{h.ca.toFixed(2)} € · {h.ventes} ventes</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </SectionCard>

      <SectionCard title="🔥 Heures de pointe">
        {rushHours.length === 0 ? (
          <p style={{ color:'#888' }}>Pas encore de données</p>
        ) : rushHours.map((h,i) => (
          <div key={h.heure} style={{
            background:VIOLET_SURF, borderRadius:12, padding:12, marginBottom:8,
            display:'flex', justifyContent:'space-between', alignItems:'center'
          }}>
            <div style={{ display:'flex', alignItems:'center', gap:12 }}>
              <span style={{ fontSize:20 }}>{i===0?'🥇':i===1?'🥈':'🥉'}</span>
              <div>
                <div style={{ fontWeight:700, fontSize:14 }}>{h.heure}h – {h.heure+1}h</div>
                <div style={{ fontSize:12, color:'#888' }}>{h.ventes} ventes</div>
              </div>
            </div>
            <span style={{ fontFamily:'var(--font)', fontWeight:900,
                           fontSize:14, color:VIOLET_DARK }}>{h.ca.toFixed(2)} €</span>
          </div>
        ))}
      </SectionCard>

      <SectionCard title="📡 Statistiques en direct">
        <InfoRow label="Moyenne ventes/heure" value={String(avgPerHour)} />
        <InfoRow label="Tendance actuelle"    value={getTrendText(hourlyData)} />
      </SectionCard>

      <SectionCard title="🎯 Projection fin de journée">
        <div style={{ fontSize:12, color:'#888', marginBottom:6 }}>
          Basé sur la tendance actuelle
        </div>
        <div style={{ fontFamily:'var(--font)', fontWeight:900, fontSize:32,
                      color:VIOLET_DARK, marginBottom:12 }}>
          {projCA.toFixed(2)} €
        </div>
        <div style={{ height:8, borderRadius:99, background:'#E0F7F4' }}>
          <div style={{ height:'100%', borderRadius:99, background:TEAL,
                        width:`${Math.min(100,(kpi.totalCA/projCA)*100)}%`,
                        transition:'width .6s' }} />
        </div>
      </SectionCard>
    </div>
  )
}

// ── Onglet Stock ──────────────────────────────────────────────────────────
function StockTab({ stockAlerts }) {
  const critiques     = stockAlerts.filter(a => a.severity==='critical')
  const avertissements= stockAlerts.filter(a => a.severity==='warning')
  const ok            = stockAlerts.filter(a => a.severity==='ok')
  const dispoRate     = calculateAvailabilityRate(stockAlerts)

  const copierInventaire = () => {
    const lines = [
      '=== INVENTAIRE STOCK ===',
      `Édité le ${new Date().toLocaleString('fr-FR')}`,
      '',
      '--- RUPTURE ---',
      ...critiques.map(a => `${a.nom} : ${a.stockRestant}`),
      '',
      '--- STOCK BAS ---',
      ...avertissements.map(a => `${a.nom} : ${a.stockRestant}`),
      '',
      '--- STOCK OK ---',
      ...ok.map(a => `${a.nom} : ${a.stockRestant}`),
      '',
      `Total : ${stockAlerts.length} | Rupture : ${critiques.length} | Bas : ${avertissements.length} | OK : ${ok.length}`,
    ].join('\n')
    navigator.clipboard?.writeText(lines)
      .then(() => alert('📋 Inventaire copié !'))
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      <button onClick={copierInventaire} style={{
        background:'#1565C0', border:'none', borderRadius:16, padding:'14px 20px',
        color:'#fff', fontFamily:'var(--font)', fontWeight:700, fontSize:14,
        cursor:'pointer', display:'flex', alignItems:'center', gap:8, justifyContent:'center'
      }}>
        📋 Copier l'inventaire stock
      </button>

      {critiques.length > 0 && (
        <SectionCard title="🚨 Alertes critiques">
          {critiques.map(a => <StockRow key={a.nom} alert={a} />)}
        </SectionCard>
      )}

      {avertissements.length > 0 && (
        <SectionCard title="⚠️ Avertissements">
          {avertissements.map(a => <StockRow key={a.nom} alert={a} />)}
        </SectionCard>
      )}

      <SectionCard title="📦 Vue d'ensemble">
        <InfoRow label="Produits en rupture"        value={String(critiques.length)} />
        <InfoRow label="À réapprovisionner"         value={String(critiques.length+avertissements.length)} />
        <InfoRow label="Taux de disponibilité"      value={`${dispoRate}%`} />
      </SectionCard>

      <SectionCard title="📋 Stock complet">
        {stockAlerts.map(a => (
          <div key={a.nom} style={{ display:'flex', justifyContent:'space-between',
                                    alignItems:'center', marginBottom:10 }}>
            <span style={{ fontSize:13 }}>{a.nom}</span>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <span style={{ fontWeight:700, fontSize:13,
                             color: a.severity==='critical'?RED:a.severity==='warning'?ORANGE:GREEN }}>
                {a.stockRestant}
              </span>
              <div style={{ width:60, height:6, borderRadius:99, background:'#EEE' }}>
                <div style={{ height:'100%', borderRadius:99,
                              background: a.severity==='critical'?RED:a.severity==='warning'?ORANGE:GREEN,
                              width:`${Math.max(0,100-a.pourcentageEpuise)}%` }} />
              </div>
            </div>
          </div>
        ))}
      </SectionCard>
    </div>
  )
}

// ── Vue principale ────────────────────────────────────────────────────────
export default function StatsView() {
  const navigate = useNavigate()
  const [tab,     setTab]     = useState(0)
  const [loading, setLoading] = useState(true)
  const [data,    setData]    = useState(null)

  useEffect(() => {
    loadAllStats().then(d => { setData(d); setLoading(false) })
  }, [])

  const TABS = ['📊 Vue d\'ensemble','📦 Produits','⏰ Temps réel','📍 Stock']

  const exportCSV = () => {
    if (!data) return
    const rows = ['Produit,Quantité,CA,Marge%']
    data.topProduits.forEach(p => {
      rows.push(`"${p.nom}",${p.qte},${p.ca.toFixed(2)},${Math.round(p.marge)}`)
    })
    const blob = new Blob([rows.join('\n')], { type:'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url
    a.download = `stats_kermesse_${new Date().toISOString().slice(0,10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="page" style={{ background:BG }}>

      {/* ── HEADER ── */}
      <div style={{ background:'#fff', borderBottom:'1px solid #EEE',
                    padding:'52px 16px 12px', position:'relative', flexShrink:0 }}>
        <button className="back-btn" style={{ background:'var(--violet-surface)',
          color:'var(--violet)' }} onClick={() => navigate('/')}>‹</button>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
          <div>
            <h1 style={{ fontFamily:'var(--font)', fontWeight:900, fontSize:22,
                         color:'#1C1C1E', margin:'0 0 2px' }}>📊 Tableau de bord</h1>
            <p style={{ color:'#888', fontSize:12, margin:0 }}>
              Kermesse · {new Date().toLocaleDateString('fr-FR')}
            </p>
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={() => { setLoading(true); loadAllStats().then(d=>{ setData(d); setLoading(false) }) }}
              style={{ background:'var(--violet-surface)', border:'none', borderRadius:10,
                       width:38, height:38, cursor:'pointer', fontSize:18 }}>🔄</button>
            <button onClick={exportCSV}
              style={{ background:'var(--violet-surface)', border:'none', borderRadius:10,
                       width:38, height:38, cursor:'pointer', fontSize:18 }}>📥</button>
          </div>
        </div>
      </div>

      {/* ── KPI GRID ── */}
      {data && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12,
                      padding:'12px 16px 0', flexShrink:0 }}>
          <KPICard label="💰 CA Total"   value={`${data.kpi.totalCA.toFixed(2)} €`}   color={VIOLET} />
          <KPICard label="📈 Bénéfice"   value={`${data.kpi.benefice.toFixed(2)} €`}  color={GREEN} />
          <KPICard label="❤️ Dons"        value={`${data.kpi.totalDons.toFixed(2)} €`} color={PINK} />
          <KPICard label="🛒 Ventes"      value={String(data.kpi.nbVentes)}            color={TEAL} />
        </div>
      )}

      {/* ── TABS ── */}
      <div style={{ display:'flex', background:'#fff', borderBottom:'1px solid #EEE',
                    marginTop:12, flexShrink:0, overflowX:'auto', scrollbarWidth:'none' }}>
        {TABS.map((t,i) => (
          <button key={i} onClick={() => setTab(i)} style={{
            flex:1, minWidth:80, padding:'12px 4px', border:'none', background:'none',
            fontFamily:'var(--font)', fontWeight:700, fontSize:11, cursor:'pointer',
            color: tab===i ? VIOLET : '#888',
            borderBottom: tab===i ? `2px solid ${VIOLET}` : '2px solid transparent',
            whiteSpace:'nowrap'
          }}>{t}</button>
        ))}
      </div>

      {/* ── CONTENU ── */}
      <div style={{ flex:1, overflowY:'auto', padding:'16px 16px 32px' }}>
        {loading ? (
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center',
                        justifyContent:'center', height:200, gap:16 }}>
            <div className="spinner" />
            <p style={{ color:'#888', fontSize:14 }}>Chargement des statistiques…</p>
          </div>
        ) : !data ? null : (
          <>
            {tab===0 && <VueEnsembleTab kpi={data.kpi} categoryStats={data.categoryStats} donStats={data.donStats} />}
            {tab===1 && <ProduitsTab topProduits={data.topProduits} />}
            {tab===2 && <TempsReelTab hourlyData={data.hourlyData} kpi={data.kpi} />}
            {tab===3 && <StockTab stockAlerts={data.stockAlerts} />}
          </>
        )}
      </div>
    </div>
  )
}
