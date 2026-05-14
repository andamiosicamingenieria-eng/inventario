import { DB, DEMO_MODE } from '../supabase-client.js';
import { Utils } from '../utils.js';

/**
 * ICAM 360 - Módulo Productos (cat_productos)
 */
export const ModProductos = (() => {
    let productos = [];
    let filtro = '';

    function render() {
        const mc = document.getElementById('module-content');
        mc.innerHTML = `
        <div class="page-toolbar">
            <div class="page-toolbar-left">
                <div class="search-box">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    <input id="prod-search" type="text" placeholder="Buscar por código o nombre…" value="${filtro}">
                </div>
            </div>
            <div class="page-toolbar-right">
                <button class="btn btn-primary" id="btn-nuevo-prod">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    Nuevo Producto
                </button>
            </div>
        </div>
        <div class="table-wrapper">
            <table>
                <thead>
                    <tr>
                        <th>Código</th>
                        <th>Nombre</th>
                        <th>Categoría</th>
                        <th>Unidad</th>
                        <th>Peso (kg)</th>
                        <th>Precio Lista</th>
                        <th>Rentable</th>
                        <th>Acciones</th>
                    </tr>
                </thead>
                <tbody id="prod-tbody">
                    <tr><td colspan="8"><div class="loading-center"><div class="spinner"></div><span>Cargando productos…</span></div></td></tr>
                </tbody>
            </table>
        </div>`;

        document.getElementById('prod-search').addEventListener('input', e => { filtro = e.target.value; renderTabla(); });
        document.getElementById('btn-nuevo-prod').addEventListener('click', () => abrirModal());
        cargarProductos();
    }

    async function cargarProductos() {
        const raw = await DB.getAll('cat_productos', { orderBy: 'codigo' });
        
        // Si raw es null significa que hubo un error (no hay tablas, o error RLS) -> Fallback a demo
        // Si raw es [] significa que la tabla existe y está vacía -> Mostrar vacío real
        if (raw === null) {
            productos = dataSeed();
        } else {
            productos = raw;
        }
        renderTabla();
    }

    function dataSeed() {
        return [
            { id: 1, codigo: 'AND-001', nombre: 'Andamio Tubular 1.56x1.00m', categoria: 'Andamios', familia: 'Tubular', unidad_medida: 'PZA', peso_kg: 18.5, precio_lista: 85.00, rentable: true, activo: true },
            { id: 2, codigo: 'AND-002', nombre: 'Andamio Tubular 1.56x0.90m', categoria: 'Andamios', familia: 'Tubular', unidad_medida: 'PZA', peso_kg: 16.2, precio_lista: 75.00, rentable: true, activo: true },
            { id: 3, codigo: 'TAB-001', nombre: 'Tablón de Madera 3.00m', categoria: 'Complementos', familia: 'Acceso', unidad_medida: 'PZA', peso_kg: 12.0, precio_lista: 35.00, rentable: true, activo: true },
            { id: 4, codigo: 'ESC-001', nombre: 'Escalera de Acceso 1.56m', categoria: 'Complementos', familia: 'Acceso', unidad_medida: 'PZA', peso_kg: 8.0, precio_lista: 45.00, rentable: true, activo: true },
            { id: 5, codigo: 'BASE-001', nombre: 'Base Ajustable', categoria: 'Accesorios', familia: 'Nivelación', unidad_medida: 'PZA', peso_kg: 4.5, precio_lista: 20.00, rentable: true, activo: true },
            { id: 6, codigo: 'RUED-001', nombre: 'Rueda con Freno', categoria: 'Accesorios', familia: 'Movilidad', unidad_medida: 'PZA', peso_kg: 3.2, precio_lista: 25.00, rentable: true, activo: true },
        ];
    }

    function renderTabla() {
        const tbody = document.getElementById('prod-tbody');
        if (!tbody) return;
        const f = filtro.toLowerCase();
        const data = productos.filter(p =>
            p.codigo.toLowerCase().includes(f) || p.nombre.toLowerCase().includes(f)
        );
        if (!data.length) {
            tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
                <h3>Sin productos</h3><p>Agrega el primer SKU al catálogo.</p></div></td></tr>`;
            return;
        }
        tbody.innerHTML = data.map(p => {
            const _e = Utils.escapeHtml;
            return `
            <tr>
                <td class="td-mono">${_e(p.codigo)}</td>
                <td><strong style="color:var(--text-main)">${_e(p.nombre)}</strong><br><small style="color:var(--text-muted)">${_e(p.familia) || ''}</small></td>
                <td>${_e(p.categoria) || '—'}</td>
                <td>${_e(p.unidad_medida) || '—'}</td>
                <td class="td-mono">${p.peso_kg || '—'}</td>
                <td class="td-mono">$${Number(p.precio_lista || 0).toLocaleString('es-MX', {minimumFractionDigits:2})}</td>
                <td>${p.rentable ? '<span class="badge badge-success">Sí</span>' : '<span class="badge badge-gray">No</span>'}</td>
                <td><button class="btn btn-secondary btn-sm" onclick="ModProductos.editar(${p.id})">Editar</button></td>
            </tr>`;
        }).join('');
    }

    function abrirModal(prodId = null) {
        const p = prodId ? productos.find(x => x.id === prodId) : null;
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.id = 'modal-productos';
        overlay.innerHTML = `
        <div class="modal modal-lg">
            <div class="modal-header">
                <div>
                    <div class="modal-title">${p ? 'Editar Producto' : 'Nuevo Producto'}</div>
                    <div class="modal-subtitle">Catálogo de productos y SKUs</div>
                </div>
                <button class="modal-close" onclick="document.getElementById('modal-productos').remove()">✕</button>
            </div>
            <div class="modal-body">
                <div class="form-row cols-3">
                    <div class="form-group">
                        <label class="form-label">Código (SKU) <span class="required">*</span></label>
                        <input id="p-codigo" class="form-control" placeholder="AND-001" value="${p?.codigo||''}">
                    </div>
                    <div class="form-group" style="grid-column:span 2">
                        <label class="form-label">Nombre <span class="required">*</span></label>
                        <input id="p-nombre" class="form-control" placeholder="Nombre del producto" value="${p?.nombre||''}">
                    </div>
                </div>
                <div class="form-row cols-3">
                    <div class="form-group">
                        <label class="form-label">Categoría</label>
                        <input id="p-cat" class="form-control" placeholder="Andamios" value="${p?.categoria||''}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Familia</label>
                        <input id="p-familia" class="form-control" placeholder="Tubular" value="${p?.familia||''}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Unidad de Medida</label>
                        <select id="p-unidad" class="form-control">
                            ${['PZA','JGO','MT','M2','KG'].map(u => `<option value="${u}" ${p?.unidad_medida===u?'selected':''}>${u}</option>`).join('')}
                        </select>
                    </div>
                </div>
                <div class="form-row cols-3">
                    <div class="form-group">
                        <label class="form-label">Peso por pieza (kg)</label>
                        <input id="p-peso" type="number" step="0.001" class="form-control" value="${p?.peso_kg||''}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Precio de Lista ($/día)</label>
                        <input id="p-precio" type="number" step="0.01" class="form-control" value="${p?.precio_lista||''}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Costo Unitario</label>
                        <input id="p-costo" type="number" step="0.01" class="form-control" value="${p?.costo_unitario||''}">
                    </div>
                </div>
                <div class="form-row cols-2">
                    <div class="form-group">
                        <label class="form-label">Dimensiones</label>
                        <input id="p-dims" class="form-control" placeholder="1.56m x 1.00m" value="${p?.dimensiones||''}">
                    </div>
                    <div class="form-group" style="display:flex;align-items:center;gap:.75rem;padding-top:1.5rem">
                        <input type="checkbox" id="p-rentable" ${p?.rentable!==false?'checked':''} style="width:16px;height:16px">
                        <label for="p-rentable" class="form-label" style="margin:0">Disponible para renta</label>
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label">Descripción</label>
                    <textarea id="p-desc" class="form-control">${p?.descripcion||''}</textarea>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="document.getElementById('modal-productos').remove()">Cancelar</button>
                <button class="btn btn-primary" id="btn-guardar-prod">Guardar</button>
            </div>
        </div>`;
        document.body.appendChild(overlay);
        overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
        document.getElementById('btn-guardar-prod').addEventListener('click', () => guardar(p?.id));
    }

    async function guardar(id = null) {
        const codigo = document.getElementById('p-codigo').value.trim();
        const nombre = document.getElementById('p-nombre').value.trim();
        if (!codigo || !nombre) { App.toast('El código y nombre son requeridos', 'danger'); return; }

        const payload = {
            codigo, nombre,
            categoria: document.getElementById('p-cat').value.trim() || null,
            familia: document.getElementById('p-familia').value.trim() || null,
            unidad_medida: document.getElementById('p-unidad').value,
            peso_kg: parseFloat(document.getElementById('p-peso').value) || null,
            precio_lista: parseFloat(document.getElementById('p-precio').value) || null,
            costo_unitario: parseFloat(document.getElementById('p-costo').value) || null,
            dimensiones: document.getElementById('p-dims').value.trim() || null,
            descripcion: document.getElementById('p-desc').value.trim() || null,
            rentable: document.getElementById('p-rentable').checked,
            activo: true,
        };

        if (id) {
            const res = await DB.update('cat_productos', id, payload);
            if (res.error) {
                App.toast('Error al actualizar: ' + res.error, 'danger');
                return;
            }
            const idx = productos.findIndex(p => p.id === id);
            productos[idx] = { ...productos[idx], ...payload };
            App.toast('Producto actualizado', 'success');
        } else {
            const res = await DB.insert('cat_productos', payload);
            if (res && !res.error) {
                productos.push(res);
                
                // Inicializar automáticamente en el inventario maestro
                await DB.insert('inv_master', {
                    producto_id: res.id,
                    almacen: 'Principal',
                    cantidad_disponible: 0,
                    cantidad_rentada: 0,
                    cantidad_en_mantenimiento: 0,
                    cantidad_chatarra: 0,
                    cantidad_en_transito: 0
                });
                
                App.toast('Producto creado e inicializado en inventario', 'success');
            } else {
                App.toast('Error al crear producto: ' + (res?.error || 'Desconocido'), 'danger');
                return;
            }
        }
        document.getElementById('modal-productos').remove();
        renderTabla();
    }

    return { 
        render, 
        editar: abrirModal, 
        getProductos: () => productos,
        cargar: cargarProductos
    };
})();
