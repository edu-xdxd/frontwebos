import { useState, useEffect } from 'react'
import apiService from '../apiService.js'
import './AdminPanel.css'

function AdminPanel() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [stats, setStats] = useState(null)
  
  // Estados para envío de notificaciones
  const [showNotificationForm, setShowNotificationForm] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState('')
  const [notificationTitle, setNotificationTitle] = useState('')
  const [notificationBody, setNotificationBody] = useState('')
  const [sendingNotification, setSendingNotification] = useState(false)
  const [notificationError, setNotificationError] = useState('')
  const [notificationSuccess, setNotificationSuccess] = useState('')

  useEffect(() => {
    loadUsers()
  }, [])

  const loadUsers = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await apiService.getAllUsers()
      if (response.success) {
        setUsers(response.data.users)
        setStats({
          total: response.data.total,
          withSubscriptions: response.data.withSubscriptions,
          withoutSubscriptions: response.data.withoutSubscriptions
        })
      }
    } catch (err) {
      setError(err.message)
      console.error('Error cargando usuarios:', err)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A'
    const date = new Date(dateString)
    return date.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // Enviar notificación push a un usuario
  const handleSendNotification = async () => {
    if (!selectedUserId) {
      setNotificationError('Por favor selecciona un usuario')
      return
    }

    if (!notificationTitle || !notificationBody) {
      setNotificationError('Por favor completa el título y el mensaje')
      return
    }

    setSendingNotification(true)
    setNotificationError('')
    setNotificationSuccess('')

    try {
      const response = await apiService.sendPushNotificationToUser(
        selectedUserId,
        notificationTitle,
        notificationBody
      )

      if (response.success) {
        setNotificationSuccess(`✅ Notificación enviada exitosamente a ${response.data.sent} dispositivo(s)`)
        // Limpiar formulario
        setSelectedUserId('')
        setNotificationTitle('')
        setNotificationBody('')
        // Ocultar mensaje después de 5 segundos
        setTimeout(() => {
          setNotificationSuccess('')
          setShowNotificationForm(false)
        }, 5000)
      } else {
        setNotificationError(response.message || 'Error al enviar la notificación')
      }
    } catch (err) {
      setNotificationError(err.message || 'Error al enviar la notificación')
    } finally {
      setSendingNotification(false)
    }
  }

  // Obtener usuarios con suscripciones activas
  const usersWithSubscriptions = users.filter(user => user.hasPushSubscription)

  if (loading) {
    return (
      <div className="admin-panel">
        <div className="admin-header">
          <h2>🔐 Panel de Administrador</h2>
        </div>
        <div className="loading">Cargando usuarios...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="admin-panel">
        <div className="admin-header">
          <h2>🔐 Panel de Administrador</h2>
        </div>
        <div className="error-message">
          <p>❌ {error}</p>
          <button onClick={loadUsers} className="retry-button">
            Reintentar
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="admin-panel">
      <div className="admin-header">
        <h2>🔐 Panel de Administrador</h2>
        <button onClick={loadUsers} className="refresh-button">
          🔄 Actualizar
        </button>
      </div>

      {stats && (
        <div className="admin-stats">
          <div className="stat-card">
            <div className="stat-value">{stats.total}</div>
            <div className="stat-label">Total Usuarios</div>
          </div>
          <div className="stat-card success">
            <div className="stat-value">{stats.withSubscriptions}</div>
            <div className="stat-label">Con Suscripción</div>
          </div>
          <div className="stat-card warning">
            <div className="stat-value">{stats.withoutSubscriptions}</div>
            <div className="stat-label">Sin Suscripción</div>
          </div>
        </div>
      )}

      {/* Sección de Envío de Notificaciones */}
      <div className="notification-section" style={{ marginTop: '30px', marginBottom: '30px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
          <h3 style={{ margin: 0 }}>📤 Enviar Notificación Push</h3>
          <button
            onClick={() => {
              setShowNotificationForm(!showNotificationForm)
              setNotificationError('')
              setNotificationSuccess('')
            }}
            className="refresh-button"
            style={{ background: showNotificationForm ? '#f44336' : '#4CAF50' }}
          >
            {showNotificationForm ? '✖️ Cerrar' : '➕ Nueva Notificación'}
          </button>
        </div>

        {showNotificationForm && (
          <div style={{ 
            padding: '20px', 
            background: '#f5f5f5', 
            borderRadius: '8px',
            border: '1px solid #ddd'
          }}>
            {notificationError && (
              <div style={{ 
                padding: '10px', 
                background: '#ffebee', 
                color: '#c62828', 
                borderRadius: '5px',
                marginBottom: '15px'
              }}>
                ❌ {notificationError}
              </div>
            )}

            {notificationSuccess && (
              <div style={{ 
                padding: '10px', 
                background: '#e8f5e9', 
                color: '#2e7d32', 
                borderRadius: '5px',
                marginBottom: '15px'
              }}>
                {notificationSuccess}
              </div>
            )}

            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                Seleccionar Usuario (solo con suscripciones activas):
              </label>
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: '5px',
                  border: '1px solid #ddd',
                  fontSize: '14px'
                }}
                disabled={sendingNotification}
              >
                <option value="">-- Selecciona un usuario --</option>
                {usersWithSubscriptions.map(user => (
                  <option key={user.id} value={user.id}>
                    {user.username} ({user.email}) - {user.pushSubscriptionsCount} dispositivo(s)
                  </option>
                ))}
              </select>
              {usersWithSubscriptions.length === 0 && (
                <div style={{ marginTop: '5px', fontSize: '13px', color: '#666' }}>
                  No hay usuarios con suscripciones push activas
                </div>
              )}
            </div>

            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                Título de la notificación:
              </label>
              <input
                type="text"
                value={notificationTitle}
                onChange={(e) => setNotificationTitle(e.target.value)}
                placeholder="Ej: Nueva actualización disponible"
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: '5px',
                  border: '1px solid #ddd',
                  fontSize: '14px'
                }}
                disabled={sendingNotification}
              />
            </div>

            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                Mensaje:
              </label>
              <textarea
                value={notificationBody}
                onChange={(e) => setNotificationBody(e.target.value)}
                placeholder="Escribe el mensaje de la notificación..."
                rows="4"
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: '5px',
                  border: '1px solid #ddd',
                  fontSize: '14px',
                  resize: 'vertical'
                }}
                disabled={sendingNotification}
              />
            </div>

            <button
              onClick={handleSendNotification}
              disabled={sendingNotification || !selectedUserId || !notificationTitle || !notificationBody || usersWithSubscriptions.length === 0}
              style={{
                padding: '12px 24px',
                background: sendingNotification ? '#ccc' : '#2196F3',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: sendingNotification ? 'not-allowed' : 'pointer',
                fontSize: '16px',
                fontWeight: 'bold',
                width: '100%'
              }}
            >
              {sendingNotification ? '⏳ Enviando...' : '📤 Enviar Notificación'}
            </button>
          </div>
        )}
      </div>

      <div className="users-table-container">
        <table className="users-table">
          <thead>
            <tr>
              <th>Usuario</th>
              <th>Email</th>
              <th>Suscripción Push</th>
              <th>Cantidad</th>
              <th>Fecha Registro</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr>
                <td colSpan="6" className="no-users">
                  No hay usuarios registrados
                </td>
              </tr>
            ) : (
              users.map(user => (
                <tr key={user.id}>
                  <td>
                    <strong>{user.username}</strong>
                    {user.username === 'webos' && (
                      <span className="admin-badge">👑 Admin</span>
                    )}
                  </td>
                  <td>{user.email}</td>
                  <td>
                    {user.hasPushSubscription ? (
                      <span className="status-badge success">
                        ✅ Sí
                      </span>
                    ) : (
                      <span className="status-badge error">
                        ❌ No
                      </span>
                    )}
                  </td>
                  <td>
                    {user.pushSubscriptionsCount > 0 ? (
                      <span className="subscription-count">
                        {user.pushSubscriptionsCount}
                      </span>
                    ) : (
                      <span>-</span>
                    )}
                  </td>
                  <td>{formatDate(user.createdAt)}</td>
                  <td>
                    {user.hasPushSubscription && (
                      <button
                        onClick={() => {
                          setSelectedUserId(user.id)
                          setShowNotificationForm(true)
                          setNotificationTitle('')
                          setNotificationBody('')
                          setNotificationError('')
                          setNotificationSuccess('')
                        }}
                        style={{
                          padding: '6px 12px',
                          background: '#2196F3',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '12px'
                        }}
                        title="Enviar notificación a este usuario"
                      >
                        📤 Enviar
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default AdminPanel

