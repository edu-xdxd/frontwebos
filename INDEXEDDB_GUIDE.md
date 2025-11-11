# Guía de IndexedDB y Sincronización Offline

## 🎯 Funcionalidades Implementadas

### 1. Base de Datos IndexedDB
- **Nombre de la base de datos**: `PWA_Database`
- **Versión**: 1
- **Object Store**: `pendingData`
- **Índices**: timestamp, url, method

### 2. Manejo de Errores POST
- Cuando un POST falla, los datos se guardan automáticamente en IndexedDB
- Se registra una tarea de sincronización en background
- Sistema de reintentos con límite de 3 intentos

### 3. Service Worker con Background Sync
- Listener `sync` que procesa datos pendientes cuando vuelve la conexión
- Eliminación automática de datos después de sincronización exitosa
- Actualización de contadores de reintentos

### 4. Interfaz de Visualización
- Visor de base de datos integrado en la aplicación
- Estadísticas en tiempo real
- Controles para limpiar y sincronizar datos

## 🚀 Cómo Usar

### Paso 1: Probar la Funcionalidad
1. Abre la aplicación en el navegador
2. Desconecta la conexión a internet (o usa DevTools > Network > Offline)
3. Agrega una nueva tarea
4. La tarea se guardará en IndexedDB automáticamente

### Paso 2: Ver Datos en IndexedDB
1. Haz clic en "🗄️ Ver Base de Datos" en la aplicación
2. O inspecciona manualmente:
   - Abre DevTools (F12)
   - Ve a Application > Storage > IndexedDB
   - Busca "PWA_Database" > "pendingData"

### Paso 3: Probar Sincronización
1. Reconecta la internet
2. Haz clic en "🔄 Forzar Sincronización"
3. Los datos pendientes se enviarán al servidor
4. Se eliminarán de IndexedDB después del éxito

## 🔍 Inspeccionar IndexedDB en el Navegador

### Chrome/Edge:
1. F12 → Application → Storage → IndexedDB
2. Busca "PWA_Database"
3. Expande "pendingData" para ver los registros

### Firefox:
1. F12 → Storage → IndexedDB
2. Busca "PWA_Database"
3. Haz clic en "pendingData" para ver los datos

### Safari:
1. Develop → Show Web Inspector
2. Storage → IndexedDB
3. Busca "PWA_Database"

## 📊 Estructura de Datos

```javascript
{
  id: 1,                    // ID único autoincremental
  url: "https://...",        // URL del endpoint
  method: "POST",           // Método HTTP
  data: { ... },            // Datos a enviar
  timestamp: "2024-...",    // Fecha de creación
  retryCount: 0,            // Número de reintentos
  status: "pending",        // Estado: pending/failed
  lastRetry: "2024-...",    // Último intento de reintento
  error: "Error message"    // Mensaje de error
}
```

## 🛠️ API del Sistema

### DatabaseManager
```javascript
// Inicializar base de datos
await dbManager.init()

// Guardar datos pendientes
await dbManager.savePendingData(data)

// Obtener todos los datos
await dbManager.getAllPendingData()

// Eliminar datos específicos
await dbManager.deletePendingData(id)

// Obtener estadísticas
await dbManager.getStats()
```

### ApiService
```javascript
// Hacer petición POST con fallback
await apiService.post('/endpoint', data)

// Reintentar peticiones fallidas
await apiService.retryFailedRequests()

// Obtener estadísticas
await apiService.getStats()

// Limpiar datos fallidos
await apiService.clearFailedData()
```

## 🔄 Flujo de Sincronización

1. **POST Fallido** → Datos guardados en IndexedDB
2. **Tarea de Sync Registrada** → Background Sync activado
3. **Conexión Restaurada** → Service Worker ejecuta sincronización
4. **Reintento de Peticiones** → Hasta 3 intentos máximo
5. **Éxito** → Datos eliminados de IndexedDB
6. **Fallo Definitivo** → Marcado como "failed"

## 🎨 Características de la UI

### Visor de Base de Datos
- **Estadísticas**: Total, Pendientes, Fallidas
- **Tabla de Datos**: Vista detallada de todos los registros
- **Controles**: Actualizar, Sincronizar, Limpiar
- **Instrucciones**: Cómo inspeccionar en DevTools

### Indicadores Visuales
- 🟢 **Verde**: Datos sincronizados
- 🟠 **Naranja**: Datos pendientes con reintentos
- 🔴 **Rojo**: Datos fallidos definitivamente

## 🧪 Testing

### Simular Errores de Red:
1. DevTools → Network → Throttling → Offline
2. Agregar tareas (se guardarán en IndexedDB)
3. Network → Online
4. Verificar sincronización automática

### Verificar IndexedDB:
1. Abrir DevTools → Application → IndexedDB
2. Verificar que los datos se guardan correctamente
3. Probar eliminación después de sincronización

## 📝 Notas Técnicas

- **Máximo Reintentos**: 3 intentos por petición
- **Tamaño de Base de Datos**: Sin límite específico
- **Compatibilidad**: Chrome 24+, Firefox 16+, Safari 10+
- **Background Sync**: Requiere HTTPS en producción

## 🚨 Troubleshooting

### Problema: Datos no se sincronizan
- Verificar que el Service Worker esté activo
- Comprobar que Background Sync esté habilitado
- Revisar la consola para errores

### Problema: IndexedDB no se crea
- Verificar permisos del navegador
- Comprobar que no esté en modo incógnito
- Revisar cuota de almacenamiento

### Problema: Sincronización no funciona
- Verificar conexión a internet
- Comprobar que el endpoint sea accesible
- Revisar logs del Service Worker
