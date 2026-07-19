import { Routes, Route, type Location } from 'react-router-dom'
import { DashboardPage } from '../pages/DashboardPage'
import { MembersPage } from '../pages/MembersPage'
import { MemberProfilePage } from '../pages/MemberProfilePage'
import { ActivityPage } from '../pages/ActivityPage'
import { AdminPage } from '../pages/AdminPage'

/**
 * Renders the full app route tree for a GIVEN location.
 *
 * Splitting this out of App.tsx lets the tab transition render two
 * independent copies of the route tree simultaneously — one frozen on the
 * outgoing location (fading out) and one on the incoming location (sliding
 * in) — without either copy re-reading the live router location.
 */
export function TabRoutes({ location }: { location: Location }) {
  return (
    <Routes location={location}>
      <Route path="/" element={<DashboardPage />} />
      <Route path="/members" element={<MembersPage />} />
      <Route path="/members/:id" element={<MemberProfilePage />} />
      <Route path="/activity" element={<ActivityPage />} />
      <Route path="/admin" element={<AdminPage />} />
    </Routes>
  )
}
