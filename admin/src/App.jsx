import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from './assets/vite.svg'
import heroImg from './assets/hero.png'
import Dashboard from './page/Dashboard'

function App() {
  const [count, setCount] = useState(0)

  return (
    <main className="main-layout--admin-dashboard">
      <Dashboard />
    </main>
  )
}

export default App
