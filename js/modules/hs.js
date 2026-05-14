import { DB, DEMO_MODE } from '../supabase-client.js';
import { Utils } from '../utils.js';
import { PDFGenerator } from './pdf-generator.js';
import { ModContratos } from './contratos.js';
import { ModInventario } from './inventario.js';
import { ModProductos } from './productos.js';

/**
 * ICAM 360 - Módulo Hojas de Salida (ops_hs + ops_hs_items)
 * Los ítems se pre-cargan desde el contrato seleccionado
 */
export const ModHS = (() => {
    let hsData = [];
    let filtro = '';
    let expandedId = null;
    let solicitudesPendientes = [];
    let pendientesEntrega = [];
    let contratosModal = [];

    function render() {
        const mc = document.getElementById('module-content');
        if (!mc) return;
        
        mc.innerHTML = `
        <div class="page-toolbar">
            <div class="page-toolbar-left">
                <div class="search-box">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    <input id="hs-search" type="text" placeholder="Folio HS, folio contrato, cliente…" value="${filtro}">
                </div>
            </div>
            <div class="page-toolbar-right">
                <button class="btn btn-primary" id="btn-nueva-hs">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    Nueva Hoja de Salida
                </button>
            </div>
        </div>

        <div class="section-header mt-4">
            <div class="section-title">📦 Solicitudes de Almacén (Pendientes de Salida)</div>
        </div>
        <div class="table-wrapper mb-4">
            <table>
                <thead>
                    <tr>
                        <th>Fecha Prog.</th>
                        <th>Contrato</th>
                        <th>Cliente</th>
                        <th>Contacto / Ubicación</th>
                        <th>Ítems</th>
                        <th>Acción</th>
                    </tr>
                </thead>
                <tbody id="hs-solicitudes-tbody">
                    <tr><td colspan="6"><div class="loading-center"><div class="spinner"></div></div></td></tr>
                </tbody>
            </table>
        </div>

        <div class="section-header mt-4">
            <div class="section-title">📊 Seguimiento de Entregas por Contrato</div>
        </div>
        <div class="table-wrapper mb-4">
            <table>
                <thead>
                    <tr>
                        <th>Contrato</th>
                        <th>Cliente</th>
                        <th>Entrega</th>
                        <th>Pendiente</th>
                        <th>Estatus</th>
                        <th>Acción</th>
                    </tr>
                </thead>
                <tbody id="hs-seg-tbody">
                    <tr><td colspan="6"><div class="loading-center"><div class="spinner"></div></div></td></tr>
                </tbody>
            </table>
        </div>

        <div class="table-wrapper">
            <table>
                <thead>
                    <tr>
                        <th>Folio HS</th>
                        <th>Contrato</th>
                        <th>Cliente</th>
                        <th>Fecha</th>
                        <th>Piezas Total</th>
                        <th>Estatus</th>
                        <th>Acciones</th>
                    </tr>
                </thead>
                <tbody id="hs-tbody">
                    <tr><td colspan="7"><div class="loading-center"><div class="spinner"></div></div></td></tr>
                </tbody>
            </table>
        </div>`;

        document.getElementById('hs-search').addEventListener('input', e => { filtro = e.target.value; renderTabla(); });
        document.getElementById('btn-nueva-hs').addEventListener('click', () => abrirModal());
        cargarHS();
    }

    async function cargarHS() {
        try {
            // Cargar productos para enriquecer items con nombre
            if (ModProductos && ModProductos.getProductos().length === 0) {
                await ModProductos.cargar();
            }
            const prods = ModProductos ? ModProductos.getProductos() : [];

            const [raw, hsItemsRaw, contratosRaw, solsRaw] = await Promise.all([
                DB.getAll('ops_hs', { orderBy: 'folio', ascending: false }),
                DB.getAll('ops_hs_items'),
                DB.getAll('ops_contratos', { orderBy: 'folio', ascending: false }),
                DB.getAll('ops_solicitudes', { filter: { estatus: 'pendiente', tipo: 'entrega' } })
            ]);

            // Agrupar items de ops_hs_items por hs_id y enriquecer con codigo/nombre
            const hsItemsMap = {};
            (hsItemsRaw || []).forEach(it => {
                if (!hsItemsMap[it.hs_id]) hsItemsMap[it.hs_id] = [];
                const prod = prods.find(p => p.codigo === it.producto_id) || {};
                hsItemsMap[it.hs_id].push({
                    ...it,
                    codigo: it.producto_id,          // producto_id ya es el código string
                    nombre: prod.nombre || it.producto_id,
                });
            });

            hsData = (raw || []).map(h => {
                const items = hsItemsMap[h.id] || h.items || [];
                return {
                    ...h,
                    items,
                    // Recalcular total_piezas desde items si no está guardado
                    total_piezas: h.total_piezas || items.reduce((s, it) => s + (parseFloat(it.cantidad_hs) || 0), 0)
                };
            });

            solicitudesPendientes = solsRaw || [];
            contratosModal = contratosRaw || [];
            
            const contratosConItems = (contratosRaw || []).map(c => ({
                ...c,
                items: (c.items && c.items.length)
                    ? c.items
                    : (ModContratos && typeof ModContratos.getItems === 'function' ? ModContratos.getItems(c.id) : [])
            }));
            
            pendientesEntrega = construirPendientesEntrega(contratosConItems, hsData);
            
            renderSolicitudesPendientes();
            renderSeguimientoPendientes();
            renderTabla();
        } catch (err) {
            console.error('Error cargando HS:', err);
        }
    }

    function renderSolicitudesPendientes() {
        const tbody = document.getElementById('hs-solicitudes-tbody');
        if (!tbody) return;

        if (solicitudesPendientes.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:1.5rem">No hay solicitudes de entrega pendientes</td></tr>';
            return;
        }

        tbody.innerHTML = solicitudesPendientes.map(s => `
            <tr>
                <td class="font-bold">${Utils.formatDate(s.fecha_programada)}</td>
                <td class="td-mono">${s.folio_contrato}</td>
                <td><div class="font-bold">${contratosModal.find(c => c.id === s.contrato_id)?.razon_social || '—'}</div></td>
                <td><div class="text-xs">${s.datos_entrega?.contacto || '—'}</div><div class="text-xs text-muted">${s.datos_entrega?.direccion || '—'}</div></td>
                <td><span class="badge badge-info">${s.items?.length || 0} piezas</span></td>
                <td>
                    <div class="flex gap-2">
                        <button class="btn btn-primary btn-sm" onclick="ModHS.procesarSolicitud(${s.id})">📦 Despachar</button>
                        <button class="btn btn-secondary btn-sm" onclick="ModHS.imprimirSolicitud(${s.id})">📄 PDF</button>
                    </div>
                </td>
            </tr>
        `).join('');
    }

    function renderSeguimientoPendientes() {
        const tbody = document.getElementById('hs-seg-tbody');
        if (!tbody) return;

        if (!pendientesEntrega.length) {
            tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state">
                <h3>Sin contratos pendientes por entregar</h3>
                <p>Todos los contratos abiertos con equipo ya tienen entrega total.</p>
            </div></td></tr>`;
            return;
        }

        tbody.innerHTML = pendientesEntrega.map(c => `
            <tr>
                <td class="td-mono">${c.folio || '—'}</td>
                <td><strong style="color:var(--text-main)">${c.razon_social || '—'}</strong></td>
                <td class="td-mono">${c.total_entregado}/${c.total_requerido} pzas</td>
                <td class="td-mono" style="font-weight:700;color:var(--warning)">${c.total_pendiente} pzas</td>
                <td>${badgeSeguimientoEntrega(c._estatusEntrega)}</td>
                <td>
                    <button class="btn btn-primary btn-sm btn-hs-desde-seg" data-id="${c.id}">+ Crear HS</button>
                </td>
            </tr>
        `).join('');

        document.querySelectorAll('.btn-hs-desde-seg').forEach(btn => {
            btn.addEventListener('click', () => abrirModal(parseInt(btn.dataset.id)));
        });
    }

    function renderTabla() {
        const tbody = document.getElementById('hs-tbody');
        if (!tbody) return;
        
        const f = filtro.toLowerCase();
        const data = hsData.filter(h =>
            (h.folio||'').toLowerCase().includes(f) ||
            (h.contrato_folio||'').toLowerCase().includes(f) ||
            (h.razon_social||'').toLowerCase().includes(f)
        );
        
        if (!data.length) {
            tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state">
                <h3>Sin Hojas de Salida</h3><p>Crea la primera HS vinculada a un contrato.</p>
            </div></td></tr>`;
            return;
        }
        tbody.innerHTML = data.map(h => filaHS(h)).join('');
    }

    function filaHS(h) {
        const isExpanded = expandedId === h.id;
        const mainRow = `
            <tr onclick="ModHS.toggleExp(${h.id})" class="${isExpanded ? 'row-expanded' : ''}" style="cursor:pointer">
                <td class="td-mono">${h.folio}</td>
                <td class="td-mono">${h.contrato_folio || '—'}</td>
                <td><strong style="color:var(--text-main);font-size:0.8rem">${h.razon_social || '—'}</strong></td>
                <td>${fmtFecha(h.fecha)}</td>
                <td class="td-mono">${h.total_piezas || 0} pzas</td>
                <td>${badgeEstatusHS(h.estatus)}</td>
                <td>
                    <div class="flex gap-1">
                        <button class="btn btn-secondary btn-sm" onclick="event.stopPropagation(); ModHS.verDetalle(${h.id})">🔍</button>
                    </div>
                </td>
            </tr>`;

        if (!isExpanded) return mainRow;

        const detailRow = `
            <tr class="detail-row">
                <td colspan="7">
                    <div class="expand-detail-panel">
                        <div class="expand-detail-title">📦 Despiece de la Hoja de Salida</div>
                        <table class="items-table-mini">
                            <thead>
                                <tr>
                                    <th>Código</th>
                                    <th>Descripción</th>
                                    <th>Cantidad</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${(h.items||[]).map(it => `
                                    <tr>
                                        <td class="td-mono">${it.codigo}</td>
                                        <td>${it.nombre}</td>
                                        <td class="td-mono">${it.cantidad_hs || it.cantidad}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                        <div class="mt-3 flex justify-end">
                            <button class="btn btn-secondary btn-sm" onclick="event.stopPropagation(); ModHS.verDetalle(${h.id})">Ver PDF / Más Detalles</button>
                        </div>
                    </div>
                </td>
            </tr>`;

        return mainRow + detailRow;
    }

    function toggleExp(id) {
        expandedId = expandedId === id ? null : id;
        renderTabla();
    }

    async function abrirModal(contratoIdPresel = null, prefillData = null) {
        const contratos = await obtenerContratosConItems();
        contratosModal = contratos;
        
        const pendientes = construirPendientesEntrega(contratos, hsData);
        const idsPendientes = new Set(pendientes.map(c => c.id));
        const contratosParaSeleccion = contratoIdPresel
            ? pendientes.concat(contratos.filter(c => c.id === contratoIdPresel && !idsPendientes.has(c.id)))
            : pendientes;
            
        const folioSugerido = await nextFolioHS();
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.id = 'modal-hs';
        overlay.innerHTML = `
        <div class="modal modal-xl">
            <div class="modal-header">
                <div>
                    <div class="modal-title">Nueva Hoja de Salida (HS) ${prefillData ? '— Desde Solicitud' : ''}</div>
                    <div class="modal-subtitle">Los ítems se cargan automáticamente desde el contrato</div>
                </div>
                <button class="modal-close" onclick="document.getElementById('modal-hs').remove()">✕</button>
            </div>
            <div class="modal-body">
                <input type="hidden" id="hs-solicitud-id" value="${prefillData?.solicitud_id || ''}">
                <div class="form-row cols-3">
                    <div class="form-group">
                        <label class="form-label">Folio HS</label>
                        <input id="hs-folio" class="form-control td-mono" value="${folioSugerido}" readonly style="background:var(--bg-elevated)">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Contrato <span class="required">*</span></label>
                        <select id="hs-contrato" class="form-control">
                            <option value="">— Selecciona contrato —</option>
                            ${contratosParaSeleccion.map(c =>
                                `<option value="${c.id}" ${contratoIdPresel===c.id || prefillData?.contrato_id===c.id ?'selected':''}>${c.folio} — ${c.razon_social}</option>`
                            ).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Fecha de Salida</label>
                        <input id="hs-fecha" type="date" class="form-control" value="${hoyISO()}">
                    </div>
                </div>

                <div class="alert alert-info">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                    <span>Selecciona un contrato para cargar automáticamente sus ítems pendientes de entrega.</span>
                </div>

                <div id="hs-items-zona" style="display:none">
                    <div style="font-weight:700;margin-bottom:.75rem;color:var(--text-main)">Detalle de Piezas a Entregar</div>
                    <table class="items-table-mini">
                        <thead>
                            <tr>
                                <th>Código</th>
                                <th>Descripción</th>
                                <th>En Contrato</th>
                                <th>Ya Entregado</th>
                                <th>Pendiente</th>
                                <th>Stock Disp.</th>
                                <th>A Entregar Ahora</th>
                            </tr>
                        </thead>
                        <tbody id="hs-items-tbody"></tbody>
                    </table>
                </div>

                <div class="form-group mt-4">
                    <label class="form-label">Notas</label>
                    <textarea id="hs-notas" class="form-control" placeholder="Observaciones, condiciones de entrega…">${prefillData?.notas || ''}</textarea>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="document.getElementById('modal-hs').remove()">Cancelar</button>
                <button class="btn btn-primary" id="btn-guardar-hs">Guardar Hoja de Salida</button>
            </div>
        </div>`;
        document.body.appendChild(overlay);
        overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

        const selContrato = document.getElementById('hs-contrato');
        selContrato.addEventListener('change', () => cargarItemsContrato(selContrato.value));
        
        if (contratoIdPresel || prefillData?.contrato_id) {
            cargarItemsContrato(String(contratoIdPresel || prefillData.contrato_id), prefillData?.items);
        }
        
        document.getElementById('btn-guardar-hs').addEventListener('click', guardarHS);
    }

    async function cargarItemsContrato(contratoId, itemsPrefill = null) {
        if (!contratoId) return;
        const contratoNum = parseInt(contratoId);
        const c = contratosModal.find(x => x.id === contratoNum);
        const items = (c?.items && c.items.length)
            ? c.items
            : (ModContratos && typeof ModContratos.getItems === 'function' ? ModContratos.getItems(contratoNum) : []);
        
        const zona = document.getElementById('hs-items-zona');
        const tbody = document.getElementById('hs-items-tbody');
        if (!items || !items.length) { zona.style.display = 'none'; return; }
        zona.style.display = 'block';

        const todasHS = hsData; // Local cache is usually enough or fetch if needed
        const hsDelContrato = todasHS.filter(h => folioIgual(h.contrato_folio, c?.folio));
        
        const entregadoMap = {};
        hsDelContrato.forEach(h => {
            (h.items || []).forEach(it => {
                // it.producto_id en ops_hs_items es el codigo string
                const key = it.producto_id || it.codigo;
                entregadoMap[key] = (entregadoMap[key] || 0) + (it.cantidad_hs || it.cantidad || 0);
            });
        });

        // El mapa de stock se indexa por codigo string (FK de ops_hs_items)
        const inv = await ModInventario.loadStock();

        tbody.innerHTML = items.map((it, i) => {
            // Usar it.codigo para buscar el stock (inventario indexa por codigo string)
            const codigoKey = it.codigo || String(it.producto_id);
            const stock = Number(inv[codigoKey] ?? 0);
            const yaEntregado = entregadoMap[codigoKey] || 0;
            const pendiente = Math.max(0, it.cantidad - yaEntregado);
            
            let valSugerido = Math.min(pendiente, stock);
            if (itemsPrefill) {
                const pre = itemsPrefill.find(x => x.producto_id === it.producto_id);
                if (pre) valSugerido = pre.cantidad;
            }

            return `<tr>
                <td class="td-mono">${it.codigo}</td>
                <td>${it.nombre}</td>
                <td class="td-mono">${it.cantidad}</td>
                <td class="td-mono">${yaEntregado}</td>
                <td class="td-mono" style="font-weight:700;color:${pendiente>0?'var(--warning)':'var(--success)'}">${pendiente}</td>
                <td class="td-mono">
                    <span class="badge ${stock<pendiente?'badge-danger':'badge-success'}">${stock}</span>
                </td>
                <td>
                    <input type="number" class="form-control hs-cant-item" data-idx="${i}" data-max="${pendiente}" data-stock="${stock}"
                        value="${valSugerido}" min="0" max="${Math.min(pendiente, stock)}" style="width:80px;font-size:0.78rem"
                        ${(stock === 0 && valSugerido === 0) || (pendiente === 0 && valSugerido === 0) ? 'disabled style="background:var(--bg-alt)"' : ''}>
                </td>
            </tr>`;
        }).join('');

        // Listeners for stock validation
        document.querySelectorAll('.hs-cant-item').forEach(inp => {
            inp.addEventListener('input', () => {
                const max = parseInt(inp.dataset.max);
                const stock = parseInt(inp.dataset.stock);
                const v = parseInt(inp.value) || 0;
                if (v > stock || v > max) {
                    inp.style.borderColor = 'var(--danger)';
                    inp.style.background = 'var(--danger-light)';
                } else {
                    inp.style.borderColor = '';
                    inp.style.background = '';
                }
            });
        });
    }

    async function guardarHS() {
        const contratoId = parseInt(document.getElementById('hs-contrato').value);
        if (!contratoId) { App.toast('Selecciona un contrato', 'danger'); return; }

        let errorStock = false;
        document.querySelectorAll('.hs-cant-item').forEach(inp => {
            if (parseInt(inp.value) > parseInt(inp.dataset.stock)) errorStock = true;
        });
        if (errorStock) { App.toast('Cantidad supera el stock disponible', 'danger'); return; }

        const c = contratosModal.find(x => x.id === contratoId);
        const items = [];
        const contItems = (c?.items && c.items.length) ? c.items : [];
        
        document.querySelectorAll('.hs-cant-item').forEach((inp, i) => {
            const it = contItems[i];
            const val = parseInt(inp.value);
            if (it && val > 0) {
                items.push({ ...it, cantidad_hs: val });
            }
        });

        if (items.length === 0) { App.toast('No hay piezas para entregar', 'warning'); return; }

        const nuevaHS = {
            folio: document.getElementById('hs-folio').value,
            contrato_folio: c?.folio,
            razon_social: c?.razon_social,
            fecha: document.getElementById('hs-fecha').value,
            total_piezas: items.reduce((s, i) => s + i.cantidad_hs, 0),
            estatus: 'entregado',
            notas: document.getElementById('hs-notas').value,
        };

        const res = await DB.insert('ops_hs', nuevaHS);
        if (res.error) { App.toast('Error: ' + res.error, 'danger'); return; }

        // Insertar cada item en ops_hs_items (tabla relacional)
        for (const it of items) {
            const codigoKey = it.codigo || String(it.producto_id);
            if (codigoKey && it.cantidad_hs > 0) {
                const itemRes = await DB.insert('ops_hs_items', {
                    hs_id: res.id,
                    producto_id: codigoKey,   // FK → cat_productos(codigo)
                    cantidad_hs: it.cantidad_hs
                });
                if (itemRes?.error) {
                    console.error('Error insertando item HS:', itemRes.error);
                }
            }
        }

        const solId = document.getElementById('hs-solicitud-id').value;
        if (solId) {
            await DB.update('ops_solicitudes', solId, { estatus: 'completada' });
        }

        document.getElementById('modal-hs').remove();
        App.toast(`Hoja de Salida ${nuevaHS.folio} registrada`, 'success');
        cargarHS();
    }

    function verDetalle(hsId) {
        const h = hsData.find(x => x.id === hsId);
        if (!h) return;
        
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.id = 'modal-hs-detalle';
        overlay.innerHTML = `
        <div class="modal modal-lg">
            <div class="modal-header">
                <div>
                    <div class="modal-title">Hoja de Salida — ${h.folio}</div>
                    <div class="modal-subtitle">${h.razon_social} | Contrato: ${h.contrato_folio}</div>
                </div>
                <button class="modal-close" onclick="document.getElementById('modal-hs-detalle').remove()">✕</button>
            </div>
            <div class="modal-body">
                <div class="form-row cols-3 mb-4">
                    <div><span class="stat-label">Fecha</span><div>${fmtFecha(h.fecha)}</div></div>
                    <div><span class="stat-label">Piezas</span><div class="td-mono">${h.total_piezas}</div></div>
                    <div><span class="stat-label">Estatus</span><div>${badgeEstatusHS(h.estatus)}</div></div>
                </div>
                <table class="items-table-mini">
                    <thead><tr><th>Código</th><th>Descripción</th><th>Cantidad</th></tr></thead>
                    <tbody>${(h.items||[]).map(i => `<tr><td class="td-mono">${i.codigo}</td><td>${i.nombre}</td><td class="td-mono">${i.cantidad_hs || i.cantidad}</td></tr>`).join('')}</tbody>
                </table>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" id="btn-pdf-hs-ver">📄 Exportar PDF</button>
                <button class="btn btn-secondary" onclick="document.getElementById('modal-hs-detalle').remove()">Cerrar</button>
            </div>
        </div>`;
        document.body.appendChild(overlay);
        
        document.getElementById('btn-pdf-hs-ver').addEventListener('click', () => {
            if (PDFGenerator) PDFGenerator.generate('HS', h, h.items);
            else App.toast('PDFGenerator no disponible', 'danger');
        });
    }


    async function obtenerContratosConItems() {
        // Asegurar productos cargados para mapear producto_id numérico
        if (ModProductos && ModProductos.getProductos().length === 0) {
            await ModProductos.cargar();
        }
        const prods = ModProductos ? ModProductos.getProductos() : [];

        const [contratosDB, itemsRaw] = await Promise.all([
            DB.getAll('ops_contratos', { orderBy: 'folio', ascending: false }),
            DB.getAll('ops_contratos_items')
        ]);

        const itemsDB = itemsRaw || [];
        const itemsMap = {};
        itemsDB.forEach(it => {
            if (!itemsMap[it.contrato_id]) itemsMap[it.contrato_id] = [];
            // Soportar producto_id guardado como número o como código string (legado)
            const prodByNum = prods.find(p => p.id === parseInt(it.producto_id));
            const prodByCod = prods.find(p => p.codigo === String(it.producto_id));
            const prod = prodByNum || prodByCod || {};
            itemsMap[it.contrato_id].push({
                ...it,
                producto_id: prod.id || parseInt(it.producto_id) || it.producto_id,
                codigo: prod.codigo || String(it.producto_id),
                nombre: prod.nombre || 'Producto Desconocido'
            });
        });

        return (contratosDB || []).map(c => ({
            ...c,
            items: itemsMap[c.id] || c.items || []
        }));
    }

    async function nextFolioHS() {
        const rows = (await DB.getAll('ops_hs', { orderBy: 'folio', ascending: false })) || [];
        let maxNum = 0;
        rows.forEach(r => {
            const m = String(r?.folio || '').trim().match(/^HS-(\d+)$/);
            if (m) maxNum = Math.max(maxNum, parseInt(m[1], 10) || 0);
        });
        return `HS-${String(maxNum + 1).padStart(3,'0')}`;
    }

    function construirPendientesEntrega(contratos, todasHS) {
        const abiertos = (contratos || []).filter(c => ['activo', 'entrega_parcial', 'borrador'].includes(c.estatus) && c.tipo_contrato === 'renta');
        return abiertos.map(c => {
            const avance = calcularAvanceEntrega(c, todasHS);
            return { ...c, ...avance };
        }).filter(c => c.total_pendiente > 0).sort((a,b) => (a.folio||'').localeCompare(b.folio||''));
    }

    function calcularAvanceEntrega(contrato, todasHS) {
        const itemsReq = contrato.items || [];
        const hsContrato = todasHS.filter(h => folioIgual(h.contrato_folio, contrato.folio));
        const entregado = {};
        hsContrato.forEach(h => {
            (h.items || []).forEach(it => {
                entregado[it.producto_id] = (entregado[it.producto_id] || 0) + (parseFloat(it.cantidad_hs || it.cantidad) || 0);
            });
        });
        let totalReq = 0; let totalEnt = 0;
        itemsReq.forEach(req => {
            totalReq += parseFloat(req.cantidad) || 0;
            totalEnt += Math.min(parseFloat(req.cantidad) || 0, entregado[req.producto_id] || 0);
        });
        const pendiente = Math.max(0, totalReq - totalEnt);
        return { total_requerido: totalReq, total_entregado: totalEnt, total_pendiente: pendiente, _estatusEntrega: (totalEnt <= 0 ? 'sin_entrega' : 'parcial') };
    }

    async function procesarSolicitud(solId) {
        const sol = solicitudesPendientes.find(x => x.id === solId);
        if (!sol) return;
        abrirModal(sol.contrato_id, {
            items: sol.items,
            solicitud_id: sol.id,
            contrato_id: sol.contrato_id,
            notas: `Despacho de solicitud programada para ${Utils.formatDate(sol.fecha_programada)}`
        });
    }

    function imprimirSolicitud(solId) {
        const sol = solicitudesPendientes.find(x => x.id === solId);
        if (!sol) return;
        const c = contratosModal.find(x => x.id === sol.contrato_id);
        if (PDFGenerator) {
            PDFGenerator.generate('SOLICITUD_ENTREGA', c || { folio: sol.folio_contrato }, sol.items);
        }
    }

    // Helpers
    const fmtFecha = Utils.fmtFecha;
    const hoyISO = Utils.hoyISO;
    const folioIgual = Utils.folioIgual;

    function badgeEstatusHS(e) {
        const map = { entregado:'badge-success', parcial:'badge-warning', pendiente:'badge-gray', venta_perdida:'badge-danger' };
        return `<span class="badge ${map[e]||'badge-gray'}">${Utils.escapeHtml((e||'—').replace('_',' '))}</span>`;
    }
    function badgeSeguimientoEntrega(e) {
        const map = { parcial: '<span class="badge badge-warning">🚛 Parcial</span>', sin_entrega: '<span class="badge badge-danger">🚛 Sin entrega</span>' };
        return map[e] || '<span class="badge badge-gray">—</span>';
    }

    return { render, toggleExp, verDetalle, procesarSolicitud, imprimirSolicitud, abrirDesdeContrato: (id) => abrirModal(id) };
})();
