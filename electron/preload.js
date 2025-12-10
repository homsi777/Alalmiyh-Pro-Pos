
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  
  // Database
  query: (sql, params) => ipcRenderer.invoke('db:query', sql, params),
  run: (sql, params) => ipcRenderer.invoke('db:run', sql, params),
  get: (sql, params) => ipcRenderer.invoke('db:get', sql, params),
  executeTransaction: (operations) => ipcRenderer.invoke('db:transaction', operations),

  // Printer
  printerList: () => ipcRenderer.invoke('printer:list'),
  /**
   * Generic print function for both Thermal and A4
   * @param {string} html Content to print
   * @param {object} options { deviceName?: string, silent?: boolean, margins?: 'none' | 'default' }
   */
  printJob: (html, options) => ipcRenderer.invoke('printer:print-job', html, options),
  
  /**
   * Save HTML content as PDF
   * @param {string} html Content to render
   * @param {string} filename Default filename
   * @param {object} options Options like { paperSize: '80mm' | 'A4' }
   */
  savePdf: (html, filename, options) => ipcRenderer.invoke('printer:save-pdf', html, filename, options),
});