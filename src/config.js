// Configuración de VAPID Public Key para Web Push
// Reemplaza esta key con tu VAPID Public Key real
export const VAPID_PUBLIC_KEY = 'BH_V5YxpuHnf7086tFZA1ouJOl0JjcEcOVyWDmNxvOb2Z-NfcEXWhgxFAKUu6PWJXVCal6VVYXWSmv0ui0X_lU0';

// Función auxiliar para convertir VAPID key de base64 a Uint8Array
export function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

