# Verificación de VAPID Keys

Si estás recibiendo el error "Registration failed - push service error", sigue estos pasos:

## 1. Verificar que las Keys Coincidan

**IMPORTANTE:** La VAPID Public Key en el frontend (`feJaredGuevara-main/src/config.js`) DEBE ser exactamente la misma que la VAPID Public Key en el backend (archivo `.env`).

### Frontend (config.js):
```javascript
export const VAPID_PUBLIC_KEY = 'BIalmIZC3htI7bAXwZoKORgex0_KdJoA94w1Hg3ZdXP3E0emvWyyBMKDJjblyDeGlIS4elcjez1qPneYdpqgKls';
```

### Backend (.env):
```env
VAPID_PUBLIC_KEY=BIalmIZC3htI7bAXwZoKORgex0_KdJoA94w1Hg3ZdXP3E0emvWyyBMKDJjblyDeGlIS4elcjez1qPneYdpqgKls
```

## 2. Verificar el Formato de la Key

Una VAPID Public Key válida:
- Tiene aproximadamente 87 caracteres
- Está en formato base64 URL-safe (puede contener `-` y `_`)
- No debe tener espacios ni saltos de línea

## 3. Generar Nuevas Keys (si es necesario)

Si necesitas generar nuevas keys:

```bash
npm install -g web-push
web-push generate-vapid-keys
```

Esto generará algo como:
```
Public Key: BIalmIZC3htI7bAXwZoKORgex0_KdJoA94w1Hg3ZdXP3E0emvWyyBMKDJjblyDeGlIS4elcjez1qPneYdpqgKls
Private Key: xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**IMPORTANTE:** Copia EXACTAMENTE la Public Key (sin espacios) a ambos lugares:
1. `feJaredGuevara-main/src/config.js`
2. `BeJaredGuevara-main/.env` (como `VAPID_PUBLIC_KEY`)

Y la Private Key solo va en:
- `BeJaredGuevara-main/.env` (como `VAPID_PRIVATE_KEY`)

## 4. Verificar que el Backend Esté Configurado

Asegúrate de que tu archivo `.env` en `BeJaredGuevara-main` tenga:

```env
VAPID_PUBLIC_KEY=tu_public_key_aqui
VAPID_PRIVATE_KEY=tu_private_key_aqui
VAPID_EMAIL=mailto:tu-email@ejemplo.com
```

Y reinicia el servidor backend después de cambiar el `.env`.

## 5. Verificar en la Consola del Navegador

Abre la consola del navegador (F12) y busca:
- ✅ "VAPID key convertida exitosamente" - La key se procesó correctamente
- ❌ Cualquier error sobre la key - Indica un problema con el formato

## 6. Requisitos del Navegador

- Debe estar en HTTPS o localhost
- El navegador debe soportar Service Workers y Push API
- Debes haber otorgado permisos de notificación

## Solución Rápida

1. Verifica que ambas keys (frontend y backend) sean **exactamente iguales**
2. Reinicia el servidor backend
3. Recarga la página del frontend (Ctrl+F5 para limpiar cache)
4. Intenta suscribirte nuevamente

