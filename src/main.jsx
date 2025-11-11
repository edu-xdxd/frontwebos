import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import apiService from './apiService.js'

// Registrar Service Worker
navigator.serviceWorker.register('/sw.js').then(registration => {
  console.log('Service Worker registrado:', registration);
  
  // Escuchar mensajes del Service Worker
  navigator.serviceWorker.addEventListener('message', async event => {
    console.log('Mensaje del Service Worker:', event.data);
    
    if (event.data && event.data.type === 'REQUEST_NOTIFICATION_PERMISSION') {
      // El SW solicita permisos
      console.log('Service Worker solicita permisos de notificación');
      
      // Solo solicitar si el usuario está autenticado
      if (apiService.isAuthenticated()) {
        try {
          // Verificar si ya tiene permisos o suscripción
          const status = await apiService.getPushSubscriptionStatus();
          
          if (status.permission === 'default') {
            // Solicitar permisos automáticamente
            await apiService.requestNotificationPermission();
          } else if (status.permission === 'granted' && !status.subscribed) {
            // Ya tiene permisos pero no está suscrito
            await apiService.subscribeToPush();
          }
        } catch (error) {
          console.error('Error manejando solicitud de permisos:', error);
        }
      }
    }
  });
}).catch(error => {
  console.error('Error registrando Service Worker:', error);
});

// Detectar si la PWA es instalable
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
  console.log('PWA instalable detectada');
  e.preventDefault();
  deferredPrompt = e;
  
  // Mostrar botón de instalación
  const installButton = document.createElement('button');
  installButton.textContent = '📱 Instalar PWA';
  installButton.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 1000;
    background: #2196F3;
    color: white;
    border: none;
    padding: 10px 20px;
    border-radius: 25px;
    font-size: 14px;
    cursor: pointer;
    box-shadow: 0 4px 8px rgba(0,0,0,0.2);
  `;
  
  installButton.addEventListener('click', async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      console.log(`Instalación: ${outcome}`);
      deferredPrompt = null;
      installButton.remove();
    }
  });
  
  document.body.appendChild(installButton);
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
