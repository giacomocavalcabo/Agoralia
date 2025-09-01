// frontend/src/lib/numbersApi.js
// Alias temporaneo per mantenere compatibilità con componenti esistenti
// TODO: Migrare tutti gli import a telephonyApi.js

export * from './telephonyApi';

// Mantieni anche le funzioni legacy se esistono ancora
export const listNumbers = (await import('./telephonyApi')).listNumbers;
export const purchaseRetellNumber = (await import('./telephonyApi')).purchaseNumber;
export const importNumber = (await import('./telephonyApi')).importNumber;
export const setRouting = (await import('./telephonyApi')).bindNumber;
export const confirmImport = async () => ({ success: true }); // Stub per compatibilità
