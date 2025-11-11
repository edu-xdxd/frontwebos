import { useState, useEffect } from 'react'
import apiService from '../apiService.js'
import './AdminPanel.css'

function AdminPanel() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [stats, setStats] = useState(null)

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

      <div className="users-table-container">
        <table className="users-table">
          <thead>
            <tr>
              <th>Usuario</th>
              <th>Email</th>
              <th>Suscripción Push</th>
              <th>Cantidad</th>
              <th>Fecha Registro</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr>
                <td colSpan="5" className="no-users">
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

