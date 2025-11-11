// Script de prueba para la sincronización
import apiService from './apiService.js';
import dbManager from './database.js';

// Función para probar la sincronización
async function testSync() {
  console.log('🧪 Iniciando test de sincronización...');
  
  try {
    // 1. Verificar estado inicial
    console.log('\n1. 📊 Estado inicial:');
    const initialStats = await apiService.getStats();
    console.log('Estadísticas:', initialStats);
    
    // 2. Simular datos offline
    console.log('\n2. 📱 Simulando datos offline...');
    const testData = {
      url: 'http://localhost:3000/api/tasks',
      method: 'POST',
      endpoint: '/tasks',
      data: {
        title: 'Test Task Offline',
        body: 'Esta tarea fue creada offline',
        userId: 1
      },
      id: Date.now().toString()
    };
    
    await dbManager.savePendingData(testData);
    console.log('✅ Dato guardado en IndexedDB');
    
    // 3. Verificar datos en IndexedDB
    console.log('\n3. 🗄️ Datos en IndexedDB:');
    const pendingData = await dbManager.getAllPendingData();
    console.log('Datos pendientes:', pendingData.length);
    
    // 4. Probar sincronización
    console.log('\n4. 🔄 Probando sincronización...');
    await apiService.forceSync();
    
    // 5. Verificar resultado
    console.log('\n5. ✅ Verificando resultado:');
    const finalStats = await apiService.getStats();
    console.log('Estadísticas finales:', finalStats);
    
    const remainingData = await dbManager.getAllPendingData();
    console.log('Datos restantes en IndexedDB:', remainingData.length);
    
    if (remainingData.length === 0) {
      console.log('🎉 ¡Sincronización exitosa! Los datos se eliminaron de IndexedDB');
    } else {
      console.log('⚠️ Aún hay datos pendientes en IndexedDB');
    }
    
  } catch (error) {
    console.error('❌ Error en test:', error);
  }
}

// Función para simular pérdida de conexión
async function simulateOffline() {
  console.log('📴 Simulando modo offline...');
  
  // Simular que no hay conexión
  Object.defineProperty(navigator, 'onLine', {
    writable: true,
    value: false
  });
  
  // Disparar evento offline
  window.dispatchEvent(new Event('offline'));
  
  console.log('✅ Modo offline simulado');
}

// Función para simular restauración de conexión
async function simulateOnline() {
  console.log('🌐 Simulando restauración de conexión...');
  
  // Simular que hay conexión
  Object.defineProperty(navigator, 'onLine', {
    writable: true,
    value: true
  });
  
  // Disparar evento online
  window.dispatchEvent(new Event('online'));
  
  console.log('✅ Conexión restaurada simulada');
}

// Exportar funciones para uso en consola
window.testSync = testSync;
window.simulateOffline = simulateOffline;
window.simulateOnline = simulateOnline;

console.log('🔧 Funciones de test disponibles:');
console.log('- testSync(): Probar sincronización completa');
console.log('- simulateOffline(): Simular pérdida de conexión');
console.log('- simulateOnline(): Simular restauración de conexión');
console.log('\n💡 Ejemplo de uso:');
console.log('1. simulateOffline()');
console.log('2. // Crear algunas tareas en la app');
console.log('3. simulateOnline()');
console.log('4. testSync()');
