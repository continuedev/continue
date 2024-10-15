import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import Inventory from '../pages/inventory.js'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Inventory />
  </StrictMode>,
)
