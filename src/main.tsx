import { createRoot } from 'react-dom/client'
import { ImageKitProvider } from '@imagekit/react'
import App from './App.tsx'
import './index.css'

createRoot(document.getElementById("root")!).render(
  <ImageKitProvider urlEndpoint="https://ik.imagekit.io/asbc2hjdf">
    <App />
  </ImageKitProvider>
);
