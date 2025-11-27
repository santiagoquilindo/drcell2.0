import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './routes/App'
import './index.css'

if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/admin')) {
  window.history.replaceState(null, '', '/admin')
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
)
