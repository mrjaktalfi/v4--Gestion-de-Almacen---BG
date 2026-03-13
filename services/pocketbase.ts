import PocketBase from 'pocketbase';

// Inicializar el cliente de PocketBase
export const pb = new PocketBase('https://api.believ3.top');

// Desactivar la cancelación automática para evitar errores en peticiones concurrentes
pb.autoCancellation(false);

// Función auxiliar para manejar errores comunes
export const handlePbError = (error: any, context: string) => {
  console.error(`Error en PocketBase (${context}):`, error);
  if (error.response) {
    console.error(`Detalles del error (${context}):`, JSON.stringify(error.response, null, 2));
  }
  if (error.status === 404) {
    throw new Error('Registro no encontrado.');
  }
  if (error.status === 403) {
    throw new Error('No tienes permisos para realizar esta acción.');
  }
  if (error.status === 400) {
    throw new Error('Datos inválidos. Revisa la información enviada.');
  }
  throw new Error(error.message || 'Error de conexión con el servidor.');
};
