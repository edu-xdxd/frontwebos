import { useState, useEffect, useRef } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'
import apiService from './apiService.js'
import Login from './components/Login.jsx'
import AdminPanel from './components/AdminPanel.jsx'
import './test-sync.js' // Script de testing

function App() {
  console.log('🚀 App cargada - Lista de Tareas v1.2.0')
  const [isAuthenticated, setIsAuthenticated] = useState(apiService.isAuthenticated())
  const [currentUser, setCurrentUser] = useState(apiService.getCurrentUser())
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [cachedData, setCachedData] = useState([])
  const [newItem, setNewItem] = useState('')
  const [apiStats, setApiStats] = useState({})
  const [pushStatus, setPushStatus] = useState(null)
  const [isSubscribing, setIsSubscribing] = useState(false)
  const [showAdminPanel, setShowAdminPanel] = useState(false)

  // Detectar estado de conexión
  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Cargar datos cuando el usuario esté autenticado
  useEffect(() => {
    if (isAuthenticated) {
      const savedData = localStorage.getItem('offlineData')
      if (savedData) {
        setCachedData(JSON.parse(savedData))
      }
      
      // Cargar tareas desde la API
      loadTasksFromAPI()
      
      // Cargar estadísticas de API
      loadApiStats()
      
      // Verificar estado de suscripción push
      checkPushSubscriptionStatus()
      
      // Si ya tiene permisos concedidos, asegurar que la suscripción esté guardada
      if ('Notification' in window && Notification.permission === 'granted') {
        apiService.ensurePushSubscriptionSaved().catch(err => {
          console.error('Error asegurando suscripción:', err)
        })
      }
    }
  }, [isAuthenticated])

  // Verificar estado de suscripción push
  const checkPushSubscriptionStatus = async () => {
    try {
      const status = await apiService.getPushSubscriptionStatus()
      setPushStatus(status)
      console.log('Estado de suscripción push:', status)
      
      // Log adicional para debugging en móvil
      if (status.isMobile) {
        console.log('📱 Dispositivo móvil detectado')
        console.log('Contexto seguro:', status.isSecureContext)
        console.log('Permisos:', status.permission)
      }
    } catch (error) {
      console.error('Error verificando estado de suscripción push:', error)
      setPushStatus({ supported: false, error: error.message })
    }
  }

  // Solicitar permisos de notificación (similar al Dashboard de referencia)
  const requestNotificationPermission = async () => {
    if (!('Notification' in window)) {
      alert('Tu navegador no soporta notificaciones')
      return false
    }

    setIsSubscribing(true)
    try {
      const permission = await Notification.requestPermission()
      const granted = permission === 'granted'
      
      if (granted) {
        // Si se otorgaron permisos, asegurar que la suscripción esté guardada
        await apiService.ensurePushSubscriptionSaved()
        await checkPushSubscriptionStatus()
        alert('✅ Notificaciones habilitadas correctamente')
      } else {
        alert('❌ Los permisos de notificación fueron denegados')
      }
      
      return granted
    } catch (error) {
      console.error('Error solicitando permisos:', error)
      alert(`❌ Error: ${error.message}`)
      return false
    } finally {
      setIsSubscribing(false)
    }
  }

  // Suscribirse a notificaciones push
  const handleSubscribeToPush = async () => {
    // Usar la función simplificada de solicitud de permisos
    await requestNotificationPermission()
  }

  // Desuscribirse de notificaciones push
  const handleUnsubscribeFromPush = async () => {
    if (!confirm('¿Estás seguro de que quieres desuscribirte de las notificaciones push?')) {
      return
    }

    setIsSubscribing(true)
    try {
      await apiService.unsubscribeFromPush()
      await checkPushSubscriptionStatus()
      alert('Te has desuscrito de las notificaciones push')
    } catch (error) {
      console.error('Error desuscribiéndose de push:', error)
      alert(`Error al desuscribirse: ${error.message}`)
    } finally {
      setIsSubscribing(false)
    }
  }

  // Cargar estadísticas de la API
  const loadApiStats = async () => {
    try {
      const stats = await apiService.getStats()
      setApiStats(stats)
    } catch (error) {
      console.error('Error cargando estadísticas:', error)
    }
  }


  // Guardar datos en localStorage
  const saveToCache = (data) => {
    const updatedData = [...cachedData, data]
    setCachedData(updatedData)
    localStorage.setItem('offlineData', JSON.stringify(updatedData))
  }

  // Agregar nuevo elemento
  const addItem = async () => {
    if (newItem.trim()) {
      const item = {
        id: Date.now(),
        text: newItem,
        timestamp: new Date().toLocaleString(),
        synced: false, // Siempre empezar como no sincronizado
        completed: false
      }
      
      // Intentar enviar al servidor usando la nueva API
      try {
        const response = await apiService.createTask({
          title: newItem,
          body: `Tarea: ${newItem}`,
          originalId: item.id.toString()
        })
        
        if (response.success) {
          console.log('✅ Tarea creada en el servidor:', response.data)
          item.synced = true // Marcar como sincronizado
          item.id = response.data._id // Usar ID del servidor
        }
      } catch (error) {
        console.log('❌ Error enviando al servidor, se guardó en IndexedDB:', error)
        // El apiService ya guardó en IndexedDB automáticamente
      }
      
      saveToCache(item)
      setNewItem('')
      
      // Actualizar estadísticas
      await loadApiStats()
    }
  }

  // Marcar tarea como completada
  const toggleTask = (taskId) => {
    const updatedData = cachedData.map(item => {
      if (item.id === taskId) {
        return { ...item, completed: !item.completed }
      }
      return item
    })
    
    setCachedData(updatedData)
    localStorage.setItem('offlineData', JSON.stringify(updatedData))
  }

  // Sincronización manual (botón)
  const syncData = async () => {
    if (isOnline) {
      try {
        console.log('🔄 Iniciando sincronización manual...')
        
        // Usar el nuevo método de sincronización automática
        await apiService.forceSync()
        
        // Recargar datos desde la API
        await loadTasksFromAPI()
        
        // Actualizar estadísticas
        await loadApiStats()
        
        console.log('✅ Sincronización manual completada')
      } catch (error) {
        console.error('Error en sincronización manual:', error)
        alert('Error en sincronización. Algunos datos pueden no haberse sincronizado.')
      }
    }
  }

  // Cargar tareas desde la API
  const loadTasksFromAPI = async () => {
    try {
      const response = await apiService.getTasks()
      if (response.success) {
        // Convertir formato de API a formato local
        const apiTasks = response.data.map(task => ({
          id: task._id,
          text: task.title,
          timestamp: new Date(task.timestamp).toLocaleString(),
          synced: true,
          completed: task.completed
        }))
        
        setCachedData(apiTasks)
        localStorage.setItem('offlineData', JSON.stringify(apiTasks))
        console.log('📥 Tareas cargadas desde la API:', apiTasks.length)
      }
    } catch (error) {
      console.error('Error cargando tareas desde API:', error)
    }
  }

  // Manejar login/registro
  const handleLogin = async (isLogin, formData) => {
    try {
      let result;
      if (isLogin) {
        result = await apiService.login(formData.email, formData.password);
      } else {
        result = await apiService.register({
          username: formData.username,
          email: formData.email,
          password: formData.password
        });
      }
      
      if (result.success) {
        setIsAuthenticated(true);
        setCurrentUser(apiService.getCurrentUser());
        // Cargar tareas después de autenticarse
        await loadTasksFromAPI();
        await loadApiStats();
      }
    } catch (error) {
      throw error;
    }
  }

  // Manejar logout
  const handleLogout = () => {
    apiService.logout();
    setIsAuthenticated(false);
    setCurrentUser(null);
    setCachedData([]);
    localStorage.removeItem('offlineData');
  }

  // Si no está autenticado, mostrar login
  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  // Si se muestra el panel de admin, renderizar solo ese
  if (showAdminPanel) {
    return (
      <>
        <div className="header-bar">
          <div>
            <a href="https://vite.dev" target="_blank">
              <img src={viteLogo} className="logo" alt="Vite logo" />
            </a>
            <a href="https://react.dev" target="_blank">
              <img src={reactLogo} className="logo react" alt="React logo" />
            </a>
          </div>
          <div className="user-info">
            <span>👤 {currentUser?.username || currentUser?.email}</span>
            <button 
              onClick={() => setShowAdminPanel(false)} 
              className="logout-button"
              style={{ marginRight: '10px', background: '#666' }}
            >
              ← Volver
            </button>
            <button onClick={handleLogout} className="logout-button">
              Cerrar Sesión
            </button>
          </div>
        </div>
        <AdminPanel />
      </>
    );
  }

  return (
    <>
      <div className="header-bar">
        <div>
          <a href="https://vite.dev" target="_blank">
            <img src={viteLogo} className="logo" alt="Vite logo" />
          </a>
          <a href="https://react.dev" target="_blank">
            <img src={reactLogo} className="logo react" alt="React logo" />
          </a>
        </div>
        <div className="user-info">
          <span>👤 {currentUser?.username || currentUser?.email}</span>
          {apiService.isAdmin() && (
            <button 
              onClick={() => setShowAdminPanel(true)} 
              className="logout-button"
              style={{ marginRight: '10px', background: '#FF9800' }}
            >
              🔐 Panel Admin
            </button>
          )}
          <button onClick={handleLogout} className="logout-button">
            Cerrar Sesión
          </button>
        </div>
      </div>
      
      <h1>🚀 Mi PWA App</h1>
      <p className="app-description">
        Una aplicación web progresiva con splash screen, iconos de diferentes resoluciones 
        y funcionalidad offline completa.
      </p>
      
      {/* Indicador de estado de conexión */}
      <div className="connection-status">
        <div className={`status-indicator ${isOnline ? 'online' : 'offline'}`}>
          {isOnline ? '🟢 En línea' : '🔴 Sin conexión'}
        </div>
        {!isOnline && (
          <p className="offline-message">
            Estás offline. Los datos se guardarán localmente y se sincronizarán cuando vuelva la conexión.
          </p>
        )}
      </div>

      <div className="card">
        <h3>📝 Lista de Tareas Offline</h3>
        <p>
          Agrega tareas, márcalas como completadas y todo se guarda automáticamente.
          Funciona perfectamente sin conexión a internet.
        </p>
        
      </div>

      {/* Sección de Notificaciones Push */}
      <div className="card" style={{ marginTop: '20px' }}>
        <h3>🔔 Notificaciones Push</h3>
        <p>
          Suscríbete para recibir notificaciones cuando haya actualizaciones importantes.
        </p>
        
        {pushStatus && (
          <div style={{ marginTop: '15px' }}>
            {!pushStatus.supported ? (
              <div style={{ padding: '15px', background: '#ffebee', borderRadius: '5px', color: '#c62828' }}>
                <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>
                  ⚠️ Notificaciones Push No Disponibles
                </div>
                <div style={{ fontSize: '14px' }}>
                  {pushStatus.reason || pushStatus.error || 'Tu navegador no soporta notificaciones push'}
                </div>
                {pushStatus.isMobile && (
                  <div style={{ marginTop: '10px', fontSize: '13px', fontStyle: 'italic' }}>
                    💡 En dispositivos móviles, asegúrate de usar HTTPS o acceder desde localhost
                  </div>
                )}
              </div>
            ) : pushStatus.permission === 'denied' ? (
              <div style={{ padding: '15px', background: '#ffebee', borderRadius: '5px', color: '#c62828' }}>
                <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>
                  ❌ Permisos Denegados
                </div>
                <div style={{ fontSize: '14px', marginBottom: '10px' }}>
                  Los permisos de notificación fueron denegados.
                </div>
                {pushStatus.isMobile ? (
                  <div style={{ fontSize: '13px' }}>
                    <strong>Para habilitarlos en móvil:</strong>
                    <ol style={{ marginTop: '8px', paddingLeft: '20px' }}>
                      <li>Abre la configuración de tu navegador</li>
                      <li>Busca "Permisos del sitio" o "Configuración del sitio"</li>
                      <li>Habilita las notificaciones para este sitio</li>
                      <li>Recarga la página</li>
                    </ol>
                  </div>
                ) : (
                  <div style={{ fontSize: '13px' }}>
                    Por favor, habilita los permisos en la configuración de tu navegador y recarga la página.
                  </div>
                )}
              </div>
            ) : pushStatus.subscribed ? (
              <div style={{ padding: '15px', background: '#e8f5e9', borderRadius: '5px', color: '#2e7d32' }}>
                <div style={{ marginBottom: '10px', fontWeight: 'bold' }}>
                  ✅ Estás suscrito a las notificaciones push
                </div>
                {pushStatus.isMobile && (
                  <div style={{ marginBottom: '10px', fontSize: '13px', opacity: 0.8 }}>
                    📱 Recibirás notificaciones en este dispositivo
                  </div>
                )}
                <button 
                  onClick={handleUnsubscribeFromPush}
                  disabled={isSubscribing}
                  style={{
                    padding: '10px 20px',
                    background: '#f44336',
                    color: 'white',
                    border: 'none',
                    borderRadius: '5px',
                    cursor: isSubscribing ? 'not-allowed' : 'pointer',
                    fontSize: '14px',
                    width: '100%',
                    maxWidth: '200px'
                  }}
                >
                  {isSubscribing ? 'Procesando...' : 'Desuscribirse'}
                </button>
              </div>
            ) : (
              <div style={{ padding: '15px', background: '#fff3e0', borderRadius: '5px', color: '#e65100' }}>
                <div style={{ marginBottom: '15px', fontWeight: 'bold' }}>
                  {pushStatus.permission === 'default' 
                    ? (pushStatus.isMobile 
                        ? '📱 Activa las notificaciones push para este dispositivo'
                        : '🔔 Activa las notificaciones push')
                    : '✅ Tienes permisos, pero aún no estás suscrito'}
                </div>
                {pushStatus.permission === 'default' && pushStatus.isMobile && (
                  <div style={{ marginBottom: '15px', fontSize: '13px', padding: '10px', background: '#fff9e6', borderRadius: '4px' }}>
                    <strong>Importante:</strong> Al hacer clic en el botón, tu navegador te pedirá permiso para mostrar notificaciones. 
                    Asegúrate de permitir las notificaciones para recibirlas en este dispositivo.
                  </div>
                )}
                <button 
                  onClick={handleSubscribeToPush}
                  disabled={isSubscribing}
                  style={{
                    padding: '12px 24px',
                    background: pushStatus?.subscribed ? '#4CAF50' : '#2196F3',
                    color: 'white',
                    border: 'none',
                    borderRadius: '5px',
                    cursor: isSubscribing ? 'not-allowed' : 'pointer',
                    fontSize: '16px',
                    fontWeight: 'bold',
                    width: '100%',
                    maxWidth: '300px',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                  }}
                  title={pushStatus?.subscribed ? 'Notificaciones habilitadas' : 'Habilitar notificaciones'}
                >
                  {isSubscribing 
                    ? '⏳ Suscribiendo...' 
                    : pushStatus?.subscribed 
                      ? '🔔 Notificaciones Activas' 
                      : '🔔 Activar Notificaciones'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Funcionalidad offline demo */}
      <div className="offline-demo">
        <h2>Demo de Funcionalidad Offline</h2>
        
        <div className="add-item">
          <input
            type="text"
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            placeholder="Agregar elemento..."
            onKeyPress={(e) => e.key === 'Enter' && addItem()}
          />
          <button onClick={addItem}>Agregar</button>
        </div>

        {cachedData.length > 0 && (
          <div className="cached-items">
            <h3>Tareas guardadas {isOnline ? '(en línea)' : '(offline)'}</h3>
            <ul>
              {cachedData.map(item => (
                <li key={item.id} className={`${item.synced ? 'synced' : 'pending'} ${item.completed ? 'completed' : ''}`}>
                  <div className="task-content">
                    <input
                      type="checkbox"
                      checked={item.completed}
                      onChange={() => toggleTask(item.id)}
                      className="task-checkbox"
                    />
                    <span className={`task-text ${item.completed ? 'completed-text' : ''}`}>
                      {item.text}
                    </span>
                  </div>
                  <div className="task-meta">
                    <small>{item.timestamp}</small>
                    {!item.synced && <span className="sync-badge">Pendiente</span>}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Botón de sincronización */}
        <div className="sync-controls">
          {isOnline && (
            <button onClick={syncData} className="sync-button">
              🔄 Sincronizar datos pendientes
            </button>
          )}
          
          {/* Estado de sincronización */}
          <div className="sync-status">
            {apiService.getSyncStatus().syncInProgress && (
              <span className="syncing">🔄 Sincronizando...</span>
            )}
            {!isOnline && (
              <span className="offline-status">📴 Modo offline</span>
            )}
            {isOnline && !apiService.getSyncStatus().syncInProgress && (
              <span className="online-status">🌐 En línea</span>
            )}
          </div>
        </div>
      </div>


      <div className="pwa-info">
        <h3>🎨 Características PWA implementadas:</h3>
        <ul>
          <li>✅ <strong>Splash Screen:</strong> Pantalla de carga con color de fondo azul (#2196F3)</li>
          <li>✅ <strong>Iconos múltiples:</strong> 72x72, 96x96, 128x128, 144x144, 152x152, 192x192, 384x384, 512x512</li>
          <li>✅ <strong>Manifest completo:</strong> Configuración para instalación en dispositivos móviles</li>
          <li>✅ <strong>Cache de APP SHELL:</strong> Rutas fijas en cache</li>
          <li>✅ <strong>Cache dinámico:</strong> Contenido nuevo se cachea automáticamente</li>
          <li>✅ <strong>Funcionalidad offline:</strong> Funciona sin conexión a internet</li>
          <li>✅ <strong>Service Worker:</strong> Activación automática para funcionalidad offline</li>
        </ul>
        
        <div className="install-instructions">
          <h4>📱 Para instalar esta PWA:</h4>
          <ol>
            <li>Busca el botón "📱 Instalar PWA" en la esquina superior derecha</li>
            <li>O usa el menú del navegador: "Agregar a pantalla de inicio"</li>
            <li>¡Disfruta de tu PWA con splash screen!</li>
          </ol>
          
          <div className="pwa-status">
            <h4>🔍 Características PWA:</h4>
            <p>✅ Manifest.json configurado</p>
            <p>✅ Service Worker activo</p>
            <p>✅ Iconos optimizados</p>
            <p>✅ Splash screen configurado</p>
            <p>✅ Funcionalidad offline</p>
          </div>
        </div>
      </div>
    </>
  )
}

export default App
