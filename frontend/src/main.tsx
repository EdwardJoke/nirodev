import { createRoot } from 'react-dom/client'

import './styles/fonts.css'
import './index.css'

import App from './App.tsx'
import { markViewTransitionSupport } from './lib/viewTransition'

// Lets CSS suppress the CSS-only page-enter animation where the browser can
// run real View Transitions instead — the two must never run together.
markViewTransitionSupport()

createRoot(document.getElementById('root')!).render(<App />)
