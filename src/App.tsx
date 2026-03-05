import { UserProvider } from './context/UserContext'
import AppShell from './components/AppShell'
import AmortPage from './pages/AmortPage'

export default function App() {
  return (
    <UserProvider>
      <AppShell>
        <AmortPage />
      </AppShell>
    </UserProvider>
  )
}