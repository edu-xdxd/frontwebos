// Módulo para manejar IndexedDB
const DB_NAME = 'PWA_Database';
const DB_VERSION = 1;
const STORE_NAME = 'pendingData';

class DatabaseManager {
  constructor() {
    this.db = null;
  }

  // Inicializar la base de datos
  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('Error abriendo IndexedDB:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('IndexedDB inicializada correctamente');
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        
        // Crear object store si no existe
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { 
            keyPath: 'id', 
            autoIncrement: true 
          });
          
          // Crear índices para búsquedas eficientes
          store.createIndex('timestamp', 'timestamp', { unique: false });
          store.createIndex('url', 'url', { unique: false });
          store.createIndex('method', 'method', { unique: false });
          
          console.log('Object store creado:', STORE_NAME);
        }
      };
    });
  }

  // Guardar datos pendientes
  async savePendingData(data) {
    if (!this.db) {
      console.log('🔧 Inicializando base de datos...');
      await this.init();
    }

    console.log('💾 Preparando para guardar:', data);

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      
      const dataToSave = {
        ...data,
        timestamp: new Date().toISOString(),
        retryCount: 0,
        status: 'pending'
      };
      
      console.log('💾 Datos a guardar:', dataToSave);
      
      const request = store.add(dataToSave);

      request.onsuccess = () => {
        console.log('✅ Datos guardados en IndexedDB con ID:', request.result);
        resolve(request.result);
      };

      request.onerror = () => {
        console.error('❌ Error guardando en IndexedDB:', request.error);
        reject(request.error);
      };
    });
  }

  // Obtener todos los datos pendientes
  async getAllPendingData() {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        console.error('Error obteniendo datos de IndexedDB:', request.error);
        reject(request.error);
      };
    });
  }

  // Eliminar datos después de sincronización exitosa
  async deletePendingData(id) {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);

      request.onsuccess = () => {
        console.log('Datos eliminados de IndexedDB:', id);
        resolve();
      };

      request.onerror = () => {
        console.error('Error eliminando de IndexedDB:', request.error);
        reject(request.error);
      };
    });
  }

  // Actualizar contador de reintentos
  async updateRetryCount(id, retryCount) {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const getRequest = store.get(id);

      getRequest.onsuccess = () => {
        const data = getRequest.result;
        if (data) {
          data.retryCount = retryCount;
          data.lastRetry = new Date().toISOString();
          
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
    });
  }

  // Limpiar base de datos (para testing)
  async clearDatabase() {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();

      request.onsuccess = () => {
        console.log('Base de datos limpiada');
        resolve();
      };

      request.onerror = () => {
        console.error('Error limpiando base de datos:', request.error);
        reject(request.error);
      };
    });
  }

  // Obtener estadísticas de la base de datos
  async getStats() {
    const allData = await this.getAllPendingData();
    return {
      total: allData.length,
      pending: allData.filter(item => item.status === 'pending').length,
      failed: allData.filter(item => item.status === 'failed').length,
      oldestItem: allData.length > 0 ? Math.min(...allData.map(item => new Date(item.timestamp))) : null
    };
  }
}

// Instancia singleton
const dbManager = new DatabaseManager();

export default dbManager;
