// Servicio para manejar peticiones HTTP con fallback a IndexedDB
import dbManager from './database.js';
import { VAPID_PUBLIC_KEY } from './config.js';

class ApiService {
  constructor() {
    // Cambiar a tu API local
    this.baseURL = 'https://backwebos.onrender.com/api'; // Tu API local
    this.maxRetries = 3;
    this.retryDelay = 1000; // 1 segundo
    this.isOnline = navigator.onLine;
    this.syncInProgress = false;
    
    // Cargar token desde localStorage
    this.token = localStorage.getItem('authToken') || null;
    
    // Configurar listeners de conexión
    this.setupConnectionListeners();
  }

  // Obtener headers con autenticación
  getHeaders() {
    const headers = {
      'Content-Type': 'application/json',
    };
    
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    
    return headers;
  }

  // Guardar token
  setToken(token) {
    this.token = token;
    if (token) {
      localStorage.setItem('authToken', token);
    } else {
      localStorage.removeItem('authToken');
    }
  }

  // Registrar usuario
  async register(userData) {
    try {
      const response = await fetch(`${this.baseURL}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Error en el registro');
      }

      const result = await response.json();
      
      if (result.success && result.data.token) {
        this.setToken(result.data.token);
        localStorage.setItem('user', JSON.stringify(result.data.user));
      }
      
      return result;
    } catch (error) {
      console.error('Error en registro:', error);
      throw error;
    }
  }

  // Iniciar sesión
  async login(email, password) {
    try {
      const response = await fetch(`${this.baseURL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Error en el inicio de sesión');
      }

      const result = await response.json();
      
      if (result.success && result.data.token) {
        this.setToken(result.data.token);
        localStorage.setItem('user', JSON.stringify(result.data.user));
      }
      
      return result;
    } catch (error) {
      console.error('Error en login:', error);
      throw error;
    }
  }

  // Cerrar sesión
  logout() {
    this.setToken(null);
    localStorage.removeItem('user');
  }

  // Verificar si está autenticado
  isAuthenticated() {
    return !!this.token;
  }

  // Obtener usuario actual
  getCurrentUser() {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  }

  // Verificar si el usuario es admin
  isAdmin() {
    const user = this.getCurrentUser();
    return user && user.username === 'webos';
  }

  // Obtener todos los usuarios (solo para admin)
  async getAllUsers() {
    try {
      const response = await fetch(`${this.baseURL}/auth/admin/users`, {
        headers: this.getHeaders()
      });

      if (!response.ok) {
        if (response.status === 403) {
          throw new Error('Acceso denegado. Solo el administrador puede acceder a esta información.');
        }
        if (response.status === 401) {
          this.logout();
          throw new Error('Sesión expirada. Por favor inicia sesión nuevamente.');
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error obteniendo usuarios:', error);
      throw error;
    }
  }

  // Método principal para hacer peticiones POST
  async post(endpoint, data) {
    const url = `${this.baseURL}${endpoint}`;
    
    try {
      console.log('Intentando POST a:', url);
      const response = await fetch(url, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('POST exitoso:', result);
      return result;

    } catch (error) {
      console.error('Error en POST, guardando en IndexedDB:', error);
      
      // Obtener userId del usuario logueado
      const currentUser = this.getCurrentUser();
      const userId = currentUser?.id || null;
      
      // Guardar en IndexedDB para sincronización posterior con userId del usuario
      await this.saveToIndexedDB({
        url,
        method: 'POST',
        data: {
          ...data,
          userId: userId // Incluir userId del usuario logueado
        },
        endpoint,
        error: error.message,
        timestamp: new Date().toISOString(),
        userId: userId // También guardar userId en el nivel superior para validación
      });

      // Registrar tarea de sincronización
      await this.registerSyncTask();

      throw error;
    }
  }

  // Método para obtener tareas
  async getTasks() {
    try {
      const response = await fetch(`${this.baseURL}/tasks`, {
        headers: this.getHeaders()
      });
      if (!response.ok) {
        if (response.status === 401) {
          this.logout();
          throw new Error('Sesión expirada. Por favor inicia sesión nuevamente.');
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error obteniendo tareas:', error);
      throw error;
    }
  }

  // Método para crear tarea
  async createTask(taskData) {
    return await this.post('/tasks', taskData);
  }

  // Método para actualizar tarea
  async updateTask(id, taskData) {
    try {
      const response = await fetch(`${this.baseURL}/tasks/${id}`, {
        method: 'PUT',
        headers: this.getHeaders(),
        body: JSON.stringify(taskData)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error actualizando tarea:', error);
      throw error;
    }
  }

  // Método para toggle completar tarea
  async toggleTask(id) {
    try {
      const response = await fetch(`${this.baseURL}/tasks/${id}/toggle`, {
        method: 'PATCH',
        headers: this.getHeaders()
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error toggleando tarea:', error);
      throw error;
    }
  }

  // Método para eliminar tarea
  async deleteTask(id) {
    try {
      const response = await fetch(`${this.baseURL}/tasks/${id}`, {
        method: 'DELETE',
        headers: this.getHeaders()
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error eliminando tarea:', error);
      throw error;
    }
  }

  // Método para sincronizar datos pendientes
  async syncPendingData(pendingData) {
    try {
      const response = await fetch(`${this.baseURL}/sync/pending`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ pendingData })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error sincronizando datos pendientes:', error);
      throw error;
    }
  }

  // Método para obtener estadísticas
  async getStats() {
    try {
      const response = await fetch(`${this.baseURL}/sync/stats`, {
        headers: this.getHeaders()
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error obteniendo estadísticas:', error);
      // Retornar estadísticas locales si falla
      return await dbManager.getStats();
    }
  }

  // Guardar datos en IndexedDB
  async saveToIndexedDB(requestData) {
    try {
      console.log('💾 Guardando en IndexedDB:', requestData);
      await dbManager.init();
      const id = await dbManager.savePendingData(requestData);
      console.log('✅ Datos guardados en IndexedDB con ID:', id);
      return id;
    } catch (error) {
      console.error('❌ Error guardando en IndexedDB:', error);
      throw error;
    }
  }

  // Registrar tarea de sincronización en background
  async registerSyncTask() {
    if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
      try {
        const registration = await navigator.serviceWorker.ready;
        await registration.sync.register('background-sync');
        console.log('Tarea de sincronización registrada');
      } catch (error) {
        console.error('Error registrando tarea de sincronización:', error);
      }
    } else {
      console.warn('Background Sync no está disponible');
    }
  }

  // Método para reintentar peticiones fallidas
  async retryFailedRequests() {
    try {
      const pendingData = await dbManager.getAllPendingData();
      const failedRequests = pendingData.filter(item => 
        item.status === 'pending' && item.retryCount < this.maxRetries
      );

      console.log(`Reintentando ${failedRequests.length} peticiones fallidas`);

      // Si hay datos pendientes, intentar sincronizar con la API
      if (failedRequests.length > 0) {
        try {
          const result = await this.syncPendingData(failedRequests);
          console.log('Sincronización exitosa:', result);
          
          // Eliminar datos sincronizados de IndexedDB
          for (const request of failedRequests) {
            if (result.data.synced.some(synced => synced.originalId === request.id)) {
              await dbManager.deletePendingData(request.id);
            }
          }
        } catch (error) {
          console.error('Error en sincronización masiva, reintentando individualmente:', error);
          
          // Si falla la sincronización masiva, reintentar individualmente
          for (const request of failedRequests) {
            try {
              await this.retryRequest(request);
            } catch (error) {
              console.error('Error reintentando petición:', error);
              await this.handleRetryFailure(request, error);
            }
          }
        }
      }

    } catch (error) {
      console.error('Error en retryFailedRequests:', error);
    }
  }

  // Reintentar una petición específica
  async retryRequest(requestData) {
    const { url, method, data } = requestData;
    
    // Validar que no se envíe userId == 1
    const userId = requestData.userId || data?.userId;
    if (userId === 1 || userId === "1" || userId === null || userId === undefined) {
      console.warn('⚠️ Rechazando reintento: userId inválido o igual a 1', requestData);
      throw new Error('No se puede sincronizar: userId inválido');
    }
    
    try {
      console.log(`Reintentando ${method} a:`, url);
      
      // Remover userId del body ya que el backend lo obtiene del token
      const { userId: _, ...dataWithoutUserId } = data;
      
      const response = await fetch(url, {
        method,
        headers: this.getHeaders(),
        body: JSON.stringify(dataWithoutUserId)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('Reintento exitoso:', result);
      
      // Eliminar de IndexedDB después de éxito
      await dbManager.deletePendingData(requestData.id);
      
      return result;

    } catch (error) {
      console.error('Error en reintento:', error);
      throw error;
    }
  }

  // Manejar fallo en reintento
  async handleRetryFailure(requestData, error) {
    const newRetryCount = (requestData.retryCount || 0) + 1;
    
    if (newRetryCount >= this.maxRetries) {
      // Marcar como fallido definitivamente
      await this.markAsFailed(requestData.id);
      console.log('Petición marcada como fallida definitivamente:', requestData.id);
    } else {
      // Actualizar contador de reintentos
      await dbManager.updateRetryCount(requestData.id, newRetryCount);
      console.log(`Petición ${requestData.id} actualizada, reintentos: ${newRetryCount}`);
    }
  }

  // Marcar petición como fallida
  async markAsFailed(id) {
    try {
      const transaction = dbManager.db.transaction([dbManager.STORE_NAME], 'readwrite');
      const store = transaction.objectStore(dbManager.STORE_NAME);
      const getRequest = store.get(id);

      getRequest.onsuccess = () => {
        const data = getRequest.result;
        if (data) {
          data.status = 'failed';
          data.failedAt = new Date().toISOString();
          
          const updateRequest = store.put(data);
          updateRequest.onsuccess = () => {
            console.log('Petición marcada como fallida:', id);
          };
        }
      };
    } catch (error) {
      console.error('Error marcando como fallida:', error);
    }
  }

  // Obtener estadísticas de peticiones
  async getStats() {
    return await dbManager.getStats();
  }

  // Limpiar datos fallidos (para testing)
  async clearFailedData() {
    try {
      const pendingData = await dbManager.getAllPendingData();
      const failedData = pendingData.filter(item => item.status === 'failed');
      
      for (const item of failedData) {
        await dbManager.deletePendingData(item.id);
      }
      
      console.log(`Eliminados ${failedData.length} elementos fallidos`);
    } catch (error) {
      console.error('Error limpiando datos fallidos:', error);
    }
  }

  // Configurar listeners de conexión
  setupConnectionListeners() {
    window.addEventListener('online', () => {
      console.log('🌐 Conexión detectada - Iniciando sincronización...');
      this.isOnline = true;
      this.autoSync();
    });

    window.addEventListener('offline', () => {
      console.log('📴 Sin conexión');
      this.isOnline = false;
    });
  }

  // Verificar conexión a internet
  async checkConnection() {
    try {
      const response = await fetch(`${this.baseURL.replace('/api', '')}/health`, {
        method: 'GET',
        timeout: 5000
      });
      return response.ok;
    } catch (error) {
      console.log('❌ Sin conexión a la API:', error.message);
      return false;
    }
  }

  // Sincronización automática
  async autoSync() {
    if (this.syncInProgress) {
      console.log('🔄 Sincronización ya en progreso...');
      return;
    }

    this.syncInProgress = true;
    console.log('🚀 Iniciando sincronización automática...');

    try {
      // Verificar conexión
      const isConnected = await this.checkConnection();
      if (!isConnected) {
        console.log('❌ No hay conexión a la API');
        this.syncInProgress = false;
        return;
      }

      // Obtener datos pendientes de IndexedDB
      const pendingData = await dbManager.getAllPendingData();
      console.log(`📦 Encontrados ${pendingData.length} elementos pendientes`);

      if (pendingData.length === 0) {
        console.log('✅ No hay datos pendientes para sincronizar');
        this.syncInProgress = false;
        return;
      }

      // Preparar datos para sincronización
      // Filtrar datos que tengan userId == 1 o que no tengan userId válido
      const dataToSync = pendingData
        .filter(item => {
          const userId = item.userId || item.data?.userId;
          // Rechazar si userId es 1, null, undefined o string "1"
          if (userId === 1 || userId === "1" || userId === null || userId === undefined) {
            console.warn('⚠️ Rechazando sincronización: userId inválido o igual a 1', item);
            return false;
          }
          return true;
        })
        .map(item => {
          // Incluir userId del usuario logueado en el body para validación
          const currentUser = this.getCurrentUser();
          const userId = item.userId || item.data?.userId || currentUser?.id;
          
          return {
            url: item.url,
            method: item.method,
            endpoint: item.endpoint,
            data: {
              ...item.data,
              userId: userId // Incluir userId para que el backend lo valide
            },
            id: item.id
          };
        });

      console.log('📤 Enviando datos a la API...');
      
      // Sincronizar con la API
      const result = await this.syncPendingData(dataToSync);
      
      if (result.success) {
        console.log('✅ Sincronización exitosa:', result.message);
        
        // Eliminar datos sincronizados de IndexedDB
        const syncedIds = result.data.synced.map(item => item.originalId);
        let deletedCount = 0;
        
        for (const id of syncedIds) {
          try {
            await dbManager.deletePendingData(id);
            deletedCount++;
          } catch (error) {
            console.error('Error eliminando dato de IndexedDB:', error);
          }
        }
        
        console.log(`🗑️ Eliminados ${deletedCount} elementos de IndexedDB`);
        
        // Mostrar notificación al usuario
        this.showSyncNotification(result.data.synced.length, result.data.errors.length);
        
      } else {
        console.error('❌ Error en sincronización:', result.message);
      }

    } catch (error) {
      console.error('❌ Error en sincronización automática:', error);
    } finally {
      this.syncInProgress = false;
    }
  }

  // Forzar sincronización manual
  async forceSync() {
    console.log('🔄 Forzando sincronización...');
    await this.autoSync();
  }

  // Mostrar notificación de sincronización
  showSyncNotification(syncedCount, errorCount) {
    if (syncedCount > 0) {
      const message = `✅ ${syncedCount} tareas sincronizadas${errorCount > 0 ? `, ${errorCount} errores` : ''}`;
      console.log(message);
      
      // Crear notificación visual
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('PWA Sync', {
          body: message,
          icon: '/icons/icon-192x192.png'
        });
      }
      
      // Mostrar alerta si no hay notificaciones
      if (Notification.permission !== 'granted') {
        alert(message);
      }
    }
  }

  // Obtener estado de sincronización
  getSyncStatus() {
    return {
      isOnline: this.isOnline,
      syncInProgress: this.syncInProgress
    };
  }

  // Solicitar permisos de notificación y suscribirse a push
  async requestNotificationPermission() {
    try {
      if (!('Notification' in window)) {
        throw new Error('Este navegador no soporta notificaciones');
      }

      if (!('serviceWorker' in navigator)) {
        throw new Error('Este navegador no soporta Service Workers');
      }

      if (!('PushManager' in window)) {
        throw new Error('Este navegador no soporta Push API');
      }

      // Solicitar permisos
      const permission = await Notification.requestPermission();
      
      if (permission !== 'granted') {
        throw new Error('Permisos de notificación denegados');
      }

      console.log('✅ Permisos de notificación concedidos');
      
      // Suscribirse a push
      await this.subscribeToPush();
      
      return { success: true, permission };
    } catch (error) {
      console.error('Error solicitando permisos:', error);
      throw error;
    }
  }

  // Suscribirse al servicio de notificaciones push
  async subscribeToPush() {
    try {
      const registration = await navigator.serviceWorker.ready;
      
      // Verificar si ya existe una suscripción
      let subscription = await registration.pushManager.getSubscription();
      
      if (subscription) {
        console.log('Ya existe una suscripción:', subscription);
        // Verificar si la suscripción está guardada en el servidor
        await this.sendSubscriptionToServer(subscription);
        return subscription;
      }

      // Verificar que tenemos la VAPID key
      if (!VAPID_PUBLIC_KEY || VAPID_PUBLIC_KEY === 'TU_VAPID_PUBLIC_KEY_AQUI') {
        throw new Error('VAPID Public Key no está configurada. Por favor, configura tu clave en config.js');
      }

      // Verificar que estamos en un contexto seguro (HTTPS o localhost)
      if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
        console.warn('⚠️ Las notificaciones push requieren HTTPS o localhost. Protocolo actual:', location.protocol);
      }

      console.log('📤 Creando suscripción push...');
      console.log('VAPID Public Key:', {
        length: VAPID_PUBLIC_KEY.length,
        preview: VAPID_PUBLIC_KEY.substring(0, 20) + '...' + VAPID_PUBLIC_KEY.substring(VAPID_PUBLIC_KEY.length - 10),
        protocol: location.protocol,
        hostname: location.hostname
      });

      // Convertir VAPID key a Uint8Array
      let applicationServerKey;
      try {
        applicationServerKey = this.urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
      } catch (keyError) {
        throw new Error(`Error procesando VAPID key: ${keyError.message}`);
      }
      
      // Crear nueva suscripción directamente
      console.log('Intentando suscribirse con applicationServerKey de', applicationServerKey.length, 'bytes');
      
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey
      });
      
      console.log('✅ Suscripción creada exitosamente:', subscription);
      
      // Enviar suscripción al servidor
      await this.sendSubscriptionToServer(subscription);
      
      return subscription;
    } catch (error) {
      console.error('❌ Error suscribiéndose a push:', error);
      console.error('Detalles del error:', {
        name: error.name,
        message: error.message,
        stack: error.stack
      });

      // Proporcionar mensajes de error más útiles
      let userFriendlyMessage = error.message;
      
      if (error.name === 'AbortError' || error.message.includes('push service error')) {
        userFriendlyMessage = 'Error al conectar con el servicio de notificaciones push. ' +
          'Verifica que:\n' +
          '1. La VAPID public key sea válida y coincida con la del servidor\n' +
          '2. Estés usando HTTPS o localhost\n' +
          '3. Tu navegador soporte notificaciones push\n' +
          `\nError técnico: ${error.message}`;
      } else if (error.message.includes('VAPID')) {
        userFriendlyMessage = `Error con la VAPID key: ${error.message}. ` +
          'Verifica que la clave pública en config.js sea válida y coincida con la del servidor.';
      }

      const enhancedError = new Error(userFriendlyMessage);
      enhancedError.originalError = error;
      throw enhancedError;
    }
  }

  // Convertir VAPID key de base64 URL-safe a Uint8Array
  urlBase64ToUint8Array(base64String) {
    if (!base64String) {
      throw new Error('VAPID key no proporcionada');
    }

    // Validar formato básico de la key
    if (base64String.length < 80) {
      throw new Error(`VAPID key parece ser muy corta (${base64String.length} caracteres). Una VAPID public key válida debe tener aproximadamente 87 caracteres.`);
    }

    try {
      // Agregar padding si es necesario
      const padding = '='.repeat((4 - base64String.length % 4) % 4);
      const base64 = (base64String + padding)
        .replace(/\-/g, '+')
        .replace(/_/g, '/');

      const rawData = window.atob(base64);
      
      // Validar que la decodificación fue exitosa
      if (rawData.length !== 65) {
        console.warn(`VAPID key decodificada tiene ${rawData.length} bytes, se esperaban 65 bytes para una clave pública VAPID válida`);
      }
      
      const outputArray = new Uint8Array(rawData.length);

      for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
      }
      
      console.log('✅ VAPID key convertida exitosamente:', {
        originalLength: base64String.length,
        decodedLength: rawData.length,
        arrayLength: outputArray.length
      });
      
      return outputArray;
    } catch (error) {
      throw new Error(`Error decodificando VAPID key: ${error.message}. Verifica que la key esté en formato base64 URL-safe válido.`);
    }
  }

  // Enviar suscripción al servidor
  async sendSubscriptionToServer(subscription) {
    try {
      const subscriptionData = {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: this.arrayBufferToBase64(subscription.getKey('p256dh')),
          auth: this.arrayBufferToBase64(subscription.getKey('auth'))
        }
      };

      const response = await fetch(`${this.baseURL}/push/subscribe`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ subscription: subscriptionData })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('✅ Suscripción guardada en el servidor:', result);
      return result;
    } catch (error) {
      console.error('Error enviando suscripción al servidor:', error);
      throw error;
    }
  }

  // Convertir ArrayBuffer a Base64
  arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }

  // Desuscribirse de push
  async unsubscribeFromPush() {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      
      if (subscription) {
        await subscription.unsubscribe();
        
        // Eliminar del servidor
        try {
          await fetch(`${this.baseURL}/push/unsubscribe`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify({ endpoint: subscription.endpoint })
          });
        } catch (error) {
          console.error('Error eliminando suscripción del servidor:', error);
        }
        
        console.log('✅ Desuscripción exitosa');
      }
    } catch (error) {
      console.error('Error desuscribiéndose de push:', error);
      throw error;
    }
  }

  // Verificar estado de suscripción
  async getPushSubscriptionStatus() {
    try {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        return { supported: false };
      }

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      const permission = Notification.permission;

      return {
        supported: true,
        subscribed: !!subscription,
        permission: permission,
        subscription: subscription
      };
    } catch (error) {
      console.error('Error verificando estado de suscripción:', error);
      return { supported: false, error: error.message };
    }
  }
}

// Instancia singleton
const apiService = new ApiService();

export default apiService;
