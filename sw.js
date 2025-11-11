// Configuración de versiones de cache
const CACHE_VERSION = 'v1.1.0';
const APP_SHELL_CACHE = `appShell_${CACHE_VERSION}`;
const DYNAMIC_CACHE = `dynamic_${CACHE_VERSION}`;

// Rutas fijas del APP SHELL que se cachearán inmediatamente
const APP_SHELL_ROUTES = [
  '/',
  '/index.html',
  '/manifest.json',
  '/assets/index-B1Iv3R_X.js',
  '/assets/index-ydvwJqSB.css',
  '/assets/react-CHdo91hT.svg'
];

// Instalación del Service Worker
self.addEventListener('install', event => {
  console.log('Service Worker: Instalando...');
  
  event.waitUntil(
    caches.open(APP_SHELL_CACHE)
      .then(cache => {
        console.log('Service Worker: Cacheando APP SHELL...');
        return cache.addAll(APP_SHELL_ROUTES);
      })
      .then(() => {
        console.log('Service Worker: APP SHELL cacheado exitosamente');
        return self.skipWaiting();
      })
      .catch(error => {
        console.error('Service Worker: Error cacheando APP SHELL:', error);
        // No fallar la instalación por errores de cache
        return self.skipWaiting();
      })
  );
});

// Activación del Service Worker
self.addEventListener('activate', event => {
  console.log('Service Worker: Activando...');
  
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            // Eliminar caches viejas
            if (cacheName !== APP_SHELL_CACHE && cacheName !== DYNAMIC_CACHE) {
              console.log('Service Worker: Eliminando cache vieja:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('Service Worker: Activado y listo');
        // Enviar mensaje a los clientes para solicitar permisos
        return self.clients.matchAll().then(clients => {
          clients.forEach(client => {
            client.postMessage({
              type: 'REQUEST_NOTIFICATION_PERMISSION'
            });
          });
        }).then(() => self.clients.claim());
      })
  );
});


// Interceptar peticiones
self.addEventListener('fetch', event => {
  // Solo manejar peticiones GET
  if (event.request.method !== 'GET') {
    return;
  }

  // Estrategia simple: Network First
  event.respondWith(
    fetch(event.request)
      .catch(() => {
        // Si falla la red, intentar desde cache
        return caches.match(event.request);
      })
  );
});


// Manejar sincronización en segundo plano
self.addEventListener('sync', event => {
  console.log('Service Worker: Sincronización en segundo plano - Tag:', event.tag);
  
  if (event.tag === 'background-sync') {
    event.waitUntil(doBackgroundSync());
  }
});

async function doBackgroundSync() {
  console.log('Service Worker: Ejecutando sincronización en segundo plano');
  
  try {
    // Obtener datos pendientes de IndexedDB
    const pendingData = await getPendingDataFromIndexedDB();
    console.log(`Service Worker: Encontrados ${pendingData.length} elementos pendientes`);
    
    // Procesar cada elemento pendiente
    for (const item of pendingData) {
      try {
        await retryFailedRequest(item);
        console.log(`Service Worker: Sincronizado exitosamente item ${item.id}`);
      } catch (error) {
        console.error(`Service Worker: Error sincronizando item ${item.id}:`, error);
        await updateRetryCount(item.id, (item.retryCount || 0) + 1);
      }
    }
    
    console.log('Service Worker: Sincronización completada');
  } catch (error) {
    console.error('Service Worker: Error en sincronización:', error);
  }
}

// Obtener datos pendientes de IndexedDB
async function getPendingDataFromIndexedDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('PWA_Database', 1);
    
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(['pendingData'], 'readonly');
      const store = transaction.objectStore('pendingData');
      const getAllRequest = store.getAll();
      
      getAllRequest.onsuccess = () => {
        const allData = getAllRequest.result;
        const pendingData = allData.filter(item => 
          item.status === 'pending' && (item.retryCount || 0) < 3
        );
        resolve(pendingData);
      };
      
      getAllRequest.onerror = () => {
        reject(getAllRequest.error);
      };
    };
    
    request.onerror = () => {
      reject(request.error);
    };
  });
}

// Reintentar petición fallida
async function retryFailedRequest(requestData) {
  const { url, method, data } = requestData;
  
  const response = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data)
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const result = await response.json();
  
  // Eliminar de IndexedDB después de éxito
  await deleteFromIndexedDB(requestData.id);
  
  return result;
}

// Eliminar elemento de IndexedDB
async function deleteFromIndexedDB(id) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('PWA_Database', 1);
    
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(['pendingData'], 'readwrite');
      const store = transaction.objectStore('pendingData');
      const deleteRequest = store.delete(id);
      
      deleteRequest.onsuccess = () => {
        console.log(`Service Worker: Eliminado de IndexedDB: ${id}`);
        resolve();
      };
      
      deleteRequest.onerror = () => {
        reject(deleteRequest.error);
      };
    };
    
    request.onerror = () => {
      reject(request.error);
    };
  });
}

// Actualizar contador de reintentos
async function updateRetryCount(id, retryCount) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('PWA_Database', 1);
    
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(['pendingData'], 'readwrite');
      const store = transaction.objectStore('pendingData');
      const getRequest = store.get(id);
      
      getRequest.onsuccess = () => {
        const data = getRequest.result;
        if (data) {
          data.retryCount = retryCount;
          data.lastRetry = new Date().toISOString();
          
          if (retryCount >= 3) {
            data.status = 'failed';
            data.failedAt = new Date().toISOString();
          }
          
          const updateRequest = store.put(data);
          updateRequest.onsuccess = () => resolve();
          updateRequest.onerror = () => reject(updateRequest.error);
        } else {
          reject(new Error('Datos no encontrados'));
        }
      };
      
      getRequest.onerror = () => {
        reject(getRequest.error);
      };
    };
    
    request.onerror = () => {
      reject(request.error);
    };
  });
}

// Manejar notificaciones push
self.addEventListener('push', event => {
  console.log('Service Worker: Notificación push recibida');
  
  let notificationData = {
    title: 'PWA App',
    body: 'Nueva notificación',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-96x96.png',
    data: {
      url: '/'
    }
  };

  // Si hay datos en el evento, parsearlos
  if (event.data) {
    try {
      const payload = event.data.json();
      notificationData = {
        title: payload.title || 'PWA App',
        body: payload.body || 'Nueva notificación',
        icon: payload.icon || '/icons/icon-192x192.png',
        badge: payload.badge || '/icons/icon-96x96.png',
        data: payload.data || { url: '/' },
        vibrate: [100, 50, 100],
        requireInteraction: false
      };
      console.log('Service Worker: Payload recibido:', payload);
    } catch (error) {
      // Si no es JSON, intentar como texto
      const text = event.data.text();
      if (text) {
        notificationData.body = text;
      }
      console.log('Service Worker: Datos recibidos como texto:', text);
    }
  }

  const options = {
    body: notificationData.body,
    icon: notificationData.icon,
    badge: notificationData.badge,
    vibrate: notificationData.vibrate || [100, 50, 100],
    data: {
      ...notificationData.data,
      dateOfArrival: Date.now()
    },
    requireInteraction: notificationData.requireInteraction || false
  };

  event.waitUntil(
    self.registration.showNotification(notificationData.title, options)
  );
});

// Manejar clics en notificaciones
self.addEventListener('notificationclick', event => {
  console.log('Service Worker: Notificación clickeada');
  console.log('Service Worker: Datos de la notificación:', event.notification.data);
  
  event.notification.close();
  
  // Obtener la URL de los datos de la notificación, o usar '/' por defecto
  const urlToOpen = event.notification.data?.url || '/';
  
  event.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then(clientList => {
      // Si ya hay una ventana abierta, enfocarla
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      // Si no hay ventana abierta, abrir una nueva
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

// Manejar mensajes del cliente
self.addEventListener('message', event => {
  console.log('Service Worker: Mensaje recibido:', event.data);
  
  if (event.data && event.data.type === 'SUBSCRIBE_PUSH') {
    const { vapidPublicKey } = event.data;
    
    // Verificar que tenemos el puerto del MessageChannel
    if (!event.ports || event.ports.length === 0) {
      console.error('Service Worker: No se recibió MessageChannel port');
      return;
    }
    
    const messagePort = event.ports[0];
    
    // Validar que tenemos la VAPID key
    if (!vapidPublicKey) {
      console.error('Service Worker: VAPID public key no proporcionada');
      messagePort.postMessage({
        success: false,
        error: 'VAPID public key no proporcionada'
      });
      return;
    }
    
    try {
      // Convertir VAPID key
      const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);
      console.log('Service Worker: VAPID key convertida, creando suscripción...');
      
      // Suscribirse a push
      event.waitUntil(
        self.registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: applicationServerKey
        }).then(subscription => {
          console.log('Service Worker: Suscripción creada exitosamente:', subscription);
          // Enviar suscripción de vuelta al cliente
          messagePort.postMessage({
            success: true,
            subscription: subscription
          });
        }).catch(error => {
          console.error('Service Worker: Error creando suscripción:', error);
          console.error('Service Worker: Detalles del error:', {
            name: error.name,
            message: error.message,
            stack: error.stack
          });
          messagePort.postMessage({
            success: false,
            error: error.message || 'Error desconocido al crear suscripción'
          });
        })
      );
    } catch (error) {
      console.error('Service Worker: Error convirtiendo VAPID key:', error);
      messagePort.postMessage({
        success: false,
        error: `Error procesando VAPID key: ${error.message}`
      });
    }
  }
});

// Función auxiliar para convertir VAPID key
function urlBase64ToUint8Array(base64String) {
  if (!base64String) {
    throw new Error('VAPID key no proporcionada');
  }
  
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}