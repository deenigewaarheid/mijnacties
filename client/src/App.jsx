import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { SearchProvider } from './context/SearchContext'
import { DarkModeProvider } from './context/DarkModeContext'
import PrivateRoute from './components/PrivateRoute'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Inbox from './pages/Inbox'
import Tasks from './pages/Tasks'
import Review from './pages/Review'
import Settings from './pages/Settings'
import Projecten from './pages/Projecten'
import Doelen from './pages/Doelen'
import Dagplanner from './pages/Dagplanner'
import Insights from './pages/Insights'
import Mailmaker from './pages/Mailmaker'

function Protected({ children }) {
  return (
    <PrivateRoute>
      <Layout>{children}</Layout>
    </PrivateRoute>
  )
}

export default function App() {
  return (
    <DarkModeProvider>
    <AuthProvider>
      <SearchProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login"     element={<Login />} />
            <Route path="/dashboard" element={<Protected><Dashboard /></Protected>} />
            <Route path="/inbox"     element={<Protected><Inbox /></Protected>} />
            <Route path="/mailmaker" element={<Protected><Mailmaker /></Protected>} />
            <Route path="/tasks"     element={<Protected><Tasks /></Protected>} />
            <Route path="/focus"     element={<Navigate to="/tasks" replace />} />
            <Route path="/wachten"   element={<Navigate to="/tasks" replace />} />
            <Route path="/ooit"      element={<Navigate to="/tasks" replace />} />
            <Route path="/review"    element={<Protected><Review /></Protected>} />
            <Route path="/settings"  element={<Protected><Settings /></Protected>} />
            <Route path="/projecten" element={<Protected><Projecten /></Protected>} />
            <Route path="/doelen"      element={<Protected><Doelen /></Protected>} />
            <Route path="/dagplanner" element={<Protected><Dagplanner /></Protected>} />
            <Route path="/insights"   element={<Protected><Insights /></Protected>} />
            <Route path="*"          element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
      </SearchProvider>
    </AuthProvider>
    </DarkModeProvider>
  )
}
