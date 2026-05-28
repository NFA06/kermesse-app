// src/App.jsx
import { useState } from 'react'
import { HashRouter, Routes, Route } from 'react-router-dom'
import LoginView    from './views/LoginView'
import HomeView     from './views/HomeView'
import CaisseView   from './views/CaisseView'
import ColorRunView from './views/ColorRunView'
import PlanningView from './views/PlanningView'
import LotsView     from './views/LotsView'
import StatsView    from './views/StatsView'
import BenevoleView from './views/BenevoleView'
import AdminView    from './views/AdminView'
import './index.css'

export default function App() {
  // Vérifie si déjà authentifié dans cette session
  const [authed, setAuthed] = useState(
    () => sessionStorage.getItem('kermesse_auth') === '1'
  )

  if (!authed) {
    return <LoginView onSuccess={() => setAuthed(true)} />
  }

  return (
    <HashRouter>
      <Routes>
        <Route path="/"          element={<HomeView />} />
        <Route path="/caisse"    element={<CaisseView />} />
        <Route path="/colorrun"  element={<ColorRunView />} />
        <Route path="/planning"  element={<PlanningView />} />
        <Route path="/lots"      element={<LotsView />} />
        <Route path="/stats"     element={<StatsView />} />
        <Route path="/benevole"  element={<BenevoleView />} />
        <Route path="/admin"     element={<AdminView />} />
      </Routes>
    </HashRouter>
  )
}
