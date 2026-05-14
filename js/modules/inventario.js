import { DB, DEMO_MODE } from '../supabase-client.js';
import { Utils } from '../utils.js';

/**
 * ICAM 360 - Módulo de Inventario (inv_master)
 * Dashboard de stock con estados: disponible, rentado, mantenimiento, chatarra
 */
export const ModInventario = (() => {
    let inventario = [];
    let filtro = '';
    let stockLoaded = false;

    function render() {
        const mc = document.getElementById('module-content');
        mc.innerHTML = `
        <div class="page-toolbar">
            <div class="page-toolbar-left">
                <div class="search-box">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    <input id="inv-search" type="text" placeholder="Buscar producto o código…" value="${filtro}">
                </div>
            </div>
            <div class="page-toolbar-right">
                <button class="btn btn-secondary" id="btn-inv-excel">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    Exportar Excel
                </button>
                <button class="btn btn-primary" id="btn-ajuste-inv">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    Ajuste Manual
                </button>
            </div>
        </div>

        <!-- KPIs resumen -->
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-icon" style="background:var(--success-light);color:var(--success)">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>
                </div>
                <div class="stat-label">Total Disponible</div>
                <div class="stat-value" id="kpi-disponible">—</div>
            </div>
            <div class="stat-card">
                <div class="stat-icon" style="background:var(--info-light);color:var(--info)">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
                </div>
                <div class="stat-label">Total Rentado</div>
                <div class="stat-value" id="kpi-rentado">—</div>
            </div>
            <div class="stat-card">
                <div class="stat-icon" style="background:var(--warning-light);color:var(--warning)">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
                </div>
                <div class="stat-label">En Mantenimiento</div>
                <div class="stat-value" id="kpi-mto">—</div>
            </div>
            <div class="stat-card">
                <div class="stat-icon" style="background:var(--danger-light);color:var(--danger)">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                </div>
                <div class="stat-label">Chatarra</div>
                <div class="stat-value" id="kpi-chatarra">—</div>
            </div>
        </div>

        <div class="table-wrapper">
            <table>
                <thead>
                    <tr>
                        <th>Código</th>
                        <th>Producto</th>
                        <th>Disponible</th>
                        <th>Rentado</th>
                        <th>Mantenimiento</th>
                        <th>Chatarra</th>
                        <th>Total</th>
                        <th>Uso %</th>
                    </tr>
                </thead>
                <tbody id="inv-tbody">
                    <tr><td colspan="8"><div class="loading-center"><div class="spinner"></div></div></td></tr>
                </tbody>
            </table>
        </div>`;

        document.getElementById('inv-search').addEventListener('input', e => { filtro = e.target.value; renderTabla(); });
        document.getElementById('btn-ajuste-inv').addEventListener('click', () => abrirAjuste());
        document.getElementById('btn-inv-excel').addEventListener('click', exportarExcel);
        cargarInventario();
    }

    async function cargarInventario(renderUi = true) {
        const [prods, inv] = await Promise.all([
            DB.getAll('cat_productos', { select: 'id,codigo,nombre', orderBy: 'id' }),
            DB.getAll('inv_master', {
                select: 'id,producto_id,cantidad_disponible,cantidad_rentada,cantidad_en_mantenimiento,cantidad_chatarra',
                orderBy: 'producto_id'
            })
        ]);

        if (!prods) {
            inventario = dataSeed();
        } else {
            const invMap = new Map((inv || []).map(i => [i.producto_id, i]));
            // Unir catálogo con inventario
            inventario = prods.map(p => {
                const stock = invMap.get(p.id) || {};
                return {
                    id: stock.id || null, // ID de inv_master
                    producto_id: p.id,
                    codigo: p.codigo,
                    nombre: p.nombre,
                    cantidad_disponible: stock.cantidad_disponible || 0,
                    cantidad_rentada: stock.cantidad_rentada || 0,
                    cantidad_en_mantenimiento: stock.cantidad_en_mantenimiento || 0,
                    cantidad_chatarra: stock.cantidad_chatarra || 0
                };
            });
        }
        stockLoaded = true;
        if (renderUi) {
            renderKPIs();
            renderTabla();
        }
    }

    function dataSeed() {
        return [
            { id: 1, producto_id: 1, codigo: 'AND-001', nombre: 'Andamio Tubular 1.56x1.00m', cantidad_disponible: 180, cantidad_rentada: 70, cantidad_en_mantenimiento: 15, cantidad_chatarra: 5 },
            { id: 2, producto_id: 2, codigo: 'AND-002', nombre: 'Andamio Tubular 1.56x0.90m', cantidad_disponible: 95, cantidad_rentada: 20, cantidad_en_mantenimiento: 8, cantidad_chatarra: 2 },
            { id: 3, producto_id: 3, codigo: 'TAB-001', nombre: 'Tablón de Madera 3.00m', cantidad_disponible: 120, cantidad_rentada: 35, cantidad_en_mantenimiento: 10, cantidad_chatarra: 8 },
            { id: 4, producto_id: 4, codigo: 'ESC-001', nombre: 'Escalera de Acceso 1.56m', cantidad_disponible: 45, cantidad_rentada: 12, cantidad_en_mantenimiento: 3, cantidad_chatarra: 0 },
            { id: 5, producto_id: 5, codigo: 'BASE-001', nombre: 'Base Ajustable', cantidad_disponible: 230, cantidad_rentada: 80, cantidad_en_mantenimiento: 5, cantidad_chatarra: 1 },
            { id: 6, producto_id: 6, codigo: 'RUED-001', nombre: 'Rueda con Freno', cantidad_disponible: 88, cantidad_rentada: 48, cantidad_en_mantenimiento: 12, cantidad_chatarra: 4 },
        ];
    }

    function renderKPIs() {
        const total = (field) => inventario.reduce((s, i) => s + (i[field] || 0), 0);
        const d = document;
        d.getElementById('kpi-disponible').textContent = total('cantidad_disponible').toLocaleString('es-MX');
        d.getElementById('kpi-rentado').textContent = total('cantidad_rentada').toLocaleString('es-MX');
        d.getElementById('kpi-mto').textContent = total('cantidad_en_mantenimiento').toLocaleString('es-MX');
        d.getElementById('kpi-chatarra').textContent = total('cantidad_chatarra').toLocaleString('es-MX');
    }

    function renderTabla() {
        const tbody = document.getElementById('inv-tbody');
        if (!tbody) return;
        const f = filtro.toLowerCase();
        const data = inventario.filter(i =>
            (i.codigo||'').toLowerCase().includes(f) || (i.nombre||'').toLowerCase().includes(f)
        );
        if (!data.length) {
            tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state">
                <h3>Sin registros de inventario</h3></div></td></tr>`;
            return;
        }
        tbody.innerHTML = data.map(i => {
            const _e = Utils.escapeHtml;
            const disp = i.cantidad_disponible || 0;
            const rent = i.cantidad_rentada || 0;
            const mto  = i.cantidad_en_mantenimiento || 0;
            const chat = i.cantidad_chatarra || 0;
            const total = disp + rent + mto + chat;
            const usoPct = total > 0 ? Math.round((rent / total) * 100) : 0;
            const barClass = usoPct >= 80 ? 'high' : usoPct >= 50 ? 'mid' : 'low';
            return `
            <tr onclick="ModInventario.verDetalle(${i.id})">
                <td class="td-mono">${_e(i.codigo)}</td>
                <td><strong style="color:var(--text-main)">${_e(i.nombre)}</strong></td>
                <td>
                    <span style="color:var(--success);font-weight:700;font-size:0.9rem">${disp}</span>
                </td>
                <td>
                    <span style="color:var(--info);font-weight:700;font-size:0.9rem">${rent}</span>
                </td>
                <td>
                    <span style="color:var(--warning);font-weight:700;font-size:0.9rem">${mto}</span>
                </td>
                <td>
                    <span style="color:var(--danger);font-weight:700;font-size:0.9rem">${chat}</span>
                </td>
                <td class="td-mono">${total}</td>
                <td style="min-width:120px">
                    <div class="flex items-center gap-2">
                        <div class="progress-bar-container" style="flex:1">
                            <div class="progress-bar ${barClass}" style="width:${usoPct}%"></div>
                        </div>
                        <span style="font-size:0.75rem;font-weight:600;color:var(--text-muted);min-width:32px">${usoPct}%</span>
                    </div>
                </td>
            </tr>`;
        }).join('');
    }

    function abrirAjuste() {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.id = 'modal-ajuste-inv';
        overlay.innerHTML = `
        <div class="modal modal-md">
            <div class="modal-header">
                <div>
                    <div class="modal-title">Ajuste Manual de Inventario</div>
                    <div class="modal-subtitle">Corrección de cantidades en almacén</div>
                </div>
                <button class="modal-close" onclick="document.getElementById('modal-ajuste-inv').remove()">✕</button>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <label class="form-label">Producto <span class="required">*</span></label>
                    <input id="aj-prod-search" type="text" class="form-control" placeholder="Buscar por código o nombre…" autocomplete="off">
                    <select id="aj-prod" class="form-control">
                        <option value="">— Selecciona producto —</option>
                        ${inventario.map(i => `<option value="${i.producto_id}">${i.codigo} — ${i.nombre}</option>`).join('')}
                    </select>
                </div>
                <div class="form-row cols-2">
                    <div class="form-group">
                        <label class="form-label">Campo a Ajustar</label>
                        <select id="aj-campo" class="form-control">
                            <option value="cantidad_disponible">Disponible</option>
                            <option value="cantidad_rentada">Rentado</option>
                            <option value="cantidad_en_mantenimiento">Mantenimiento</option>
                            <option value="cantidad_chatarra">Chatarra</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Nueva Cantidad</label>
                        <input id="aj-cant" type="number" class="form-control" placeholder="0" min="0">
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label">Motivo del Ajuste <span class="required">*</span></label>
                    <textarea id="aj-motivo" class="form-control" placeholder="Razón del ajuste manual…"></textarea>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="document.getElementById('modal-ajuste-inv').remove()">Cancelar</button>
                <button class="btn btn-primary" id="btn-guardar-ajuste">Aplicar Ajuste</button>
            </div>
        </div>`;
        document.body.appendChild(overlay);
        overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
        document.getElementById('btn-guardar-ajuste').addEventListener('click', aplicarAjuste);
        const searchInput = document.getElementById('aj-prod-search');
        searchInput.addEventListener('input', filtrarProductosAjuste);
        searchInput.addEventListener('keydown', seleccionarPrimerResultadoConEnter);
    }

    function normalizarTexto(valor) {
        return (valor || '')
            .toString()
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .trim();
    }

    function filtrarProductosAjuste(e) {
        const texto = normalizarTexto(e.target.value);
        const select = document.getElementById('aj-prod');
        const searchInput = document.getElementById('aj-prod-search');
        if (!select) return;

        const selectedValue = select.value;
        const filtered = inventario.filter(i =>
            normalizarTexto(i.codigo).includes(texto) ||
            normalizarTexto(i.nombre).includes(texto)
        );

        select.innerHTML = `
            <option value="">— Selecciona producto —</option>
            ${filtered.map(i => `<option value="${i.producto_id}">${i.codigo} — ${i.nombre}</option>`).join('')}
        `;

        if (!filtered.length) {
            select.innerHTML = `<option value="">Sin coincidencias</option>`;
            select.value = '';
            return;
        }

        if (filtered.some(i => String(i.producto_id) === selectedValue)) {
            select.value = selectedValue;
            return;
        }

        if (filtered.length === 1) {
            select.value = String(filtered[0].producto_id);
            if (searchInput) {
                searchInput.value = `${filtered[0].codigo} — ${filtered[0].nombre}`;
            }
        }
    }

    function seleccionarPrimerResultadoConEnter(e) {
        if (e.key !== 'Enter') return;
        const select = document.getElementById('aj-prod');
        if (!select) return;
        if (select.options.length > 1) {
            select.value = select.options[1].value;
        }
    }

    async function aplicarAjuste() {
        const prodId = parseInt(document.getElementById('aj-prod').value);
        const campo = document.getElementById('aj-campo').value;
        const cant = parseInt(document.getElementById('aj-cant').value);
        const motivo = document.getElementById('aj-motivo').value.trim();

        if (!prodId || !motivo) { App.toast('Completa todos los campos', 'danger'); return; }
        const inv = inventario.find(i => i.producto_id === prodId);
        if (!inv) return;

        inv[campo] = cant;
        
        if (inv.id) {
            await DB.update('inv_master', inv.id, { [campo]: cant });
        } else {
            // Si no existía en inv_master, lo creamos
            const res = await DB.insert('inv_master', {
                producto_id: prodId,
                almacen: 'Principal',
                [campo]: cant
            });
            if (res && res.id) inv.id = res.id;
        }

        renderKPIs();
        renderTabla();
        document.getElementById('modal-ajuste-inv').remove();
        App.toast('Inventario ajustado y persistido', 'success');
    }

    function verDetalle(invId) {
        const i = inventario.find(x => x.id === invId);
        if (!i) return;
        const total = (i.cantidad_disponible||0) + (i.cantidad_rentada||0) + (i.cantidad_en_mantenimiento||0) + (i.cantidad_chatarra||0);
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.id = 'modal-inv-detalle';
        overlay.innerHTML = `
        <div class="modal modal-md">
            <div class="modal-header">
                <div>
                    <div class="modal-title">${i.nombre}</div>
                    <div class="modal-subtitle td-mono">${i.codigo}</div>
                </div>
                <button class="modal-close" onclick="document.getElementById('modal-inv-detalle').remove()">✕</button>
            </div>
            <div class="modal-body">
                <div class="estado-cuenta-box">
                    <div class="ec-title">📦 Estado del Inventario</div>
                    <div class="ec-row"><span>✅ Disponible</span><strong style="color:var(--success)">${i.cantidad_disponible||0} pzas</strong></div>
                    <div class="ec-row"><span>🚛 En Renta</span><strong style="color:var(--info)">${i.cantidad_rentada||0} pzas</strong></div>
                    <div class="ec-row"><span>🔧 Mantenimiento</span><strong style="color:var(--warning)">${i.cantidad_en_mantenimiento||0} pzas</strong></div>
                    <div class="ec-row"><span>❌ Chatarra</span><strong style="color:var(--danger)">${i.cantidad_chatarra||0} pzas</strong></div>
                    <div class="ec-row"><span><strong>Total Inventariado</strong></span><strong>${total} pzas</strong></div>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="document.getElementById('modal-inv-detalle').remove()">Cerrar</button>
            </div>
        </div>`;
        document.body.appendChild(overlay);
        overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
    }

    function exportarExcel() {
        if (!window.XLSX) { App.toast('Cargando librería Excel…', 'warning'); return; }
        const wb = XLSX.utils.book_new();
        const wsData = [
            ['Código', 'Producto', 'Disponible', 'Rentado', 'Mantenimiento', 'Chatarra', 'Total'],
            ...inventario.map(i => {
                const t = (i.cantidad_disponible||0) + (i.cantidad_rentada||0) + (i.cantidad_en_mantenimiento||0) + (i.cantidad_chatarra||0);
                return [i.codigo, i.nombre, i.cantidad_disponible||0, i.cantidad_rentada||0, i.cantidad_en_mantenimiento||0, i.cantidad_chatarra||0, t];
            }),
        ];
        const ws = XLSX.utils.aoa_to_sheet(wsData);
        ws['!cols'] = [{wch:12},{wch:35},{wch:12},{wch:12},{wch:14},{wch:10},{wch:10}];
        XLSX.utils.book_append_sheet(wb, ws, 'Inventario');
        const fecha = new Date().toISOString().split('T')[0];
        XLSX.writeFile(wb, `ICAM360_Inventario_${fecha}.xlsx`);
        App.toast('Excel de inventario descargado', 'success');
    }

    // Retorna un mapa codigo → disponible (para módulo HS)
    // Usa el código string porque ops_hs_items.producto_id FK → cat_productos(codigo)
    function getStock() {
        const map = {};
        inventario.forEach(i => { map[i.codigo] = i.cantidad_disponible || 0; });
        return map;
    }

    async function loadStock() {
        if (!stockLoaded) {
            await cargarInventario(false);
        }
        return getStock();
    }

    return { 
        render, 
        getStock,
        loadStock,
        verDetalle, 
        actualizarStock: async (productoId, delta) => {
            const i = inventario.find(x => x.producto_id === productoId);
            if (i) { 
                const nuevaCant = Math.max(0, (i.cantidad_disponible || 0) + delta);
                i.cantidad_disponible = nuevaCant;
                // Persistir en Supabase
                if (i.id) {
                    await DB.update('inv_master', i.id, { cantidad_disponible: nuevaCant });
                } else {
                    const res = await DB.insert('inv_master', {
                        producto_id: productoId,
                        almacen: 'Principal',
                        cantidad_disponible: nuevaCant
                    });
                    if (res && res.id) i.id = res.id;
                }
            }
        }
    };
})();
