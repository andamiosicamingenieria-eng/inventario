import { DB, DEMO_MODE } from './supabase-client.js';
import { Utils } from './utils.js';

const searchInput = document.getElementById('search');
const refreshBtn = document.getElementById('refresh-btn');
const csvBtn = document.getElementById('csv-btn');
const autoToggle = document.getElementById('auto-toggle');
const tableContainer = document.getElementById('inventory-table');
const statusEl = document.getElementById('status');
const lastUpdatedEl = document.getElementById('last-updated');

let inventoryData = [];
let productsMap = {};
let timer = null;
const INTERVAL_MS = 10000; // 10s

function showStatus(msg) {
  statusEl.textContent = msg || '';
}

async function fetchInventory() {
  showStatus('Cargando...');
  try {
    // Intentamos leer inventario y catálogo
    const [inv, prods] = await Promise.all([
      DB.getAll('inv_master', {
        // Evita traer columnas pesadas/no usadas
        select: [
          'id',
          'producto_id',
          'almacen',
          'ubicacion',
          'cantidad_disponible',
          'cantidad_rentada',
          'cantidad_en_mantenimiento',
          'cantidad_en_transito',
          'cantidad_reservada',
          'stock_minimo',
          'stock_maximo',
          'ultima_entrada',
          'ultima_salida',
        ].join(','),
        orderBy: 'producto_id',
      }),
      DB.getAll('cat_productos', {
        // Solo lo que se usa para render y búsqueda
        select: ['id', 'codigo', 'nombre'].join(','),
        orderBy: 'id',
      })
    ]);

    if (!inv || !prods) {
      // Si no hay cliente (ej. Tracking Prevention) mostrar guía y fallback demo
      showStatus('Cliente Supabase no disponible en este navegador. Mostrando datos de ejemplo.');
      loadDemoData();
      return;
    }

    inventoryData = Array.isArray(inv) ? inv : [];
    productsMap = {};
    (prods || []).forEach(p => productsMap[p.id] = p);
    renderTable(inventoryData);
    lastUpdatedEl.textContent = new Date().toLocaleTimeString();
    showStatus('');
  } catch (err) {
    console.error(err);
    showStatus('Error cargando inventario: ' + (err.message || err));
    loadDemoData();
  }
}

function loadDemoData() {
  // Datos de ejemplo rápidos para cuando no hay conexión
  const sampleProds = [
    { id: 1, codigo: 'AND-001', nombre: 'Andamio 1' },
    { id: 2, codigo: 'GEN-010', nombre: 'Generador 3kW' },
    { id: 3, codigo: 'BOM-100', nombre: 'Bomba agua' }
  ];
  productsMap = {};
  sampleProds.forEach(p => productsMap[p.id] = p);

  inventoryData = [
    { id:1, producto_id:1, almacen:'Principal', ubicacion:'A1', cantidad_disponible:120, cantidad_rentada:5, cantidad_en_mantenimiento:2, cantidad_en_transito:3, cantidad_reservada:4, stock_minimo:10, stock_maximo:200, ultima_entrada:'2026-04-01', ultima_salida:'2026-04-20' },
    { id:2, producto_id:2, almacen:'Sucursal Nte', ubicacion:'B2', cantidad_disponible:8, cantidad_rentada:2, cantidad_en_mantenimiento:0, cantidad_en_transito:1, cantidad_reservada:0, stock_minimo:5, stock_maximo:50, ultima_entrada:'2026-04-15', ultima_salida:'2026-04-18' },
    { id:3, producto_id:3, almacen:'Principal', ubicacion:'C3', cantidad_disponible:0, cantidad_rentada:0, cantidad_en_mantenimiento:1, cantidad_en_transito:0, cantidad_reservada:0, stock_minimo:1, stock_maximo:20, ultima_entrada:'2026-03-01', ultima_salida:'2026-04-10' }
  ];
  renderTable(inventoryData);
  lastUpdatedEl.textContent = new Date().toLocaleTimeString();
}

function renderTable(data) {
  const q = (searchInput.value || '').trim().toLowerCase();
  let rows = (data || []).filter(r => Number(r.cantidad_disponible || 0) > 0);
  if (q) {
    rows = rows.filter(r => {
      const p = productsMap[r.producto_id] || {};
      return String(r.producto_id).includes(q) || (p.nombre||'').toLowerCase().includes(q) || (p.codigo||'').toLowerCase().includes(q) || (r.almacen||'').toLowerCase().includes(q) || (r.ubicacion||'').toLowerCase().includes(q);
    });
  }

  const html = `
    <div class="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>SKU</th>
            <th>Producto</th>
            <th>Almacén</th>
            <th>Disponible</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(r => {
            const p = productsMap[r.producto_id] || {};
            return `
              <tr>
                <td class="td-mono">${Utils.escapeHtml(p.codigo || r.producto_id)}</td>
                <td>${Utils.escapeHtml(p.nombre || '—')}</td>
                <td>${Utils.escapeHtml(r.almacen || '—')}</td>
                <td class="td-mono">${Number(r.cantidad_disponible || 0).toLocaleString('es-MX')}</td>
              </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;

  tableContainer.innerHTML = html;
}

function downloadCSV() {
  const rows = [];
  rows.push(['producto_id','codigo','nombre','almacen','cantidad_disponible']);
  inventoryData
    .filter(r => Number(r.cantidad_disponible || 0) > 0)
    .forEach(r => {
    const p = productsMap[r.producto_id] || {};
    rows.push([
      r.producto_id,
      p.codigo || '',
      p.nombre || '',
      r.almacen || '',
      r.cantidad_disponible || 0
    ]);
  });
  const csv = rows.map(r => r.map(cell => `"${String(cell||'').replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `inventario_${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function startAutoRefresh() {
  if (timer) clearInterval(timer);
  timer = setInterval(fetchInventory, INTERVAL_MS);
}

function stopAutoRefresh() {
  if (timer) { clearInterval(timer); timer = null; }
}

function setupEventHandlers() {
  refreshBtn.addEventListener('click', () => fetchInventory());
  csvBtn.addEventListener('click', () => downloadCSV());
  searchInput.addEventListener('input', () => renderTable(inventoryData));
  autoToggle.addEventListener('change', () => {
    if (autoToggle.checked) startAutoRefresh(); else stopAutoRefresh();
  });
}

window.addEventListener('load', () => {
  setupEventHandlers();
  fetchInventory();
  if (autoToggle.checked) startAutoRefresh();
});
