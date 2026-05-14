import { DB, DEMO_MODE } from '../supabase-client.js';
import { Utils } from '../utils.js';
import { PDFGenerator } from './pdf-generator.js';
import { ModContratos } from './contratos.js';
import { ModProductos } from './productos.js';


/**
 * ICAM 360 - Módulo Hojas de Entrada (ops_he + ops_he_items)
 * Recolección de equipo — suma al inventario
 */
export const ModHE = (() => {
    let heData = [];
    let filtro = '';
    let expandedId = null;
    let solicitudesPendientes = []; let pendientesRecoleccion = [];
    let contratosModal = [];

    function render() {
        const mc = document.getElementById('module-content');
        mc.innerHTML = `
        <div class="page-toolbar">
            <div class="page-toolbar-left">
                <div class="search-box">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    <input id="he-search" type="text" placeholder="Folio HE, folio contrato, cliente…" value="${filtro}">
                </div>
            </div>
            <div class="page-toolbar-right">
                <button class="btn btn-primary" id="btn-nueva-he">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    Nueva Hoja de Entrada
                </button>
            </div>
        </div>
        <div class="section-header mt-4">
            <div class="section-title">📦 Solicitudes de Recolección (Pendientes de Entrada)</div>
        </div>
        <div class="table-wrapper mb-4">
            <table>
                <thead>
                    <tr>
                        <th>Fecha Prog.</th>
                        <th>Contrato</th>
                        <th>Cliente</th>
                        <th>Ubicación</th>
                        <th>Ítems</th>
                        <th>Acción</th>
                    </tr>
                </thead>
                <tbody id="he-solicitudes-tbody">
                    <tr><td colspan="6"><div class="loading-center"><div class="spinner"></div></div></td></tr>
                </tbody>
            </table>
        </div>
        <div class="section-header mt-4">
            <div class="section-title">📊 Seguimiento de Recolecciones por Contrato</div>
        </div>
        <div class="table-wrapper mb-4">
            <table>
                <thead>
                    <tr>
                        <th>Contrato</th>
                        <th>Cliente</th>
                        <th>Recolectado</th>
                        <th>Pendiente</th>
                        <th>Estatus</th>
                        <th>Acción</th>
                    </tr>
                </thead>
                <tbody id="he-seg-tbody">
                    <tr><td colspan="6"><div class="loading-center"><div class="spinner"></div></div></td></tr>
                </tbody>
            </table>
        </div>
        <div class="table-wrapper">
            <table>
                <thead>
                    <tr>
                        <th>Folio HE</th>
                        <th>Contrato</th>
                        <th>Cliente</th>
                        <th>Fecha Recolección</th>
                        <th>Piezas</th>
                        <th>Estatus</th>
                        <th>Vaciado Fab.</th>
                        <th>Acciones</th>
                    </tr>
                </thead>
                <tbody id="he-tbody">
                    <tr><td colspan="8"><div class="loading-center"><div class="spinner"></div></div></td></tr>
                </tbody>
            </table>
        </div>`;

        document.getElementById('he-search').addEventListener('input', e => { filtro = e.target.value; renderTabla(); });
        document.getElementById('btn-nueva-he').addEventListener('click', () => abrirModal());
        cargarHE();
    }

    async function cargarHE() {
        // Cargar productos para enriquecer items con nombre
        if (ModProductos && ModProductos.getProductos().length === 0) {
            await ModProductos.cargar();
        }
        const prods = ModProductos ? ModProductos.getProductos() : [];

        const [raw, heItemsRaw, contratosRaw, solsRaw] = await Promise.all([
            DB.getAll('ops_he', { orderBy: 'folio', ascending: false }),
            DB.getAll('ops_he_items'),
            DB.getAll('ops_contratos', { orderBy: 'folio', ascending: false }),
            DB.getAll('ops_solicitudes', { filter: { estatus: 'pendiente', tipo: 'recoleccion' } })
        ]);

        // Agrupar items de ops_he_items por he_id y enriquecer con codigo/nombre
        const heItemsMap = {};
        (heItemsRaw || []).forEach(it => {
            if (!heItemsMap[it.he_id]) heItemsMap[it.he_id] = [];
            const prod = prods.find(p => p.codigo === it.producto_id) || {};
            heItemsMap[it.he_id].push({
                ...it,
                codigo: it.producto_id,          // producto_id ya es el código string
                nombre: prod.nombre || it.producto_id,
            });
        });

        heData = (raw || []).map(h => {
            const items = heItemsMap[h.id] || h.items || [];
            return {
                ...h,
                items,
                // Recalcular total_piezas desde items si no está guardado
                total_piezas: h.total_piezas || items.reduce((s, it) => s + (parseFloat(it.cantidad_recolectada) || 0), 0)
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
        pendientesRecoleccion = construirPendientesRecoleccion(contratosConItems, heData);
        renderSolicitudesPendientes();
        renderSeguimientoPendientes();
        renderTabla();
    }

    function renderSolicitudesPendientes() {
        const tbody = document.getElementById('he-solicitudes-tbody');
        if (!tbody) return;

        if (solicitudesPendientes.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:1.5rem">No hay solicitudes de recolección pendientes</td></tr>';
            return;
        }

        tbody.innerHTML = solicitudesPendientes.map(s => `
            <tr>
                <td class="font-bold">${Utils.formatDate(s.fecha_programada)}</td>
                <td class="td-mono">${s.folio_contrato}</td>
                <td>${contratosModal.find(c => c.id === s.contrato_id)?.razon_social || '—'}</td>
                <td><div class="text-xs">${s.datos_entrega?.contacto || '—'}</div><div class="text-xs text-muted">${s.datos_entrega?.direccion || '—'}</div></td>
                <td><span class="badge badge-info">${s.items?.length || 0} piezas</span></td>
                <td>
                    <div class="flex gap-2">
                        <button class="btn btn-primary btn-sm" onclick="ModHE.procesarSolicitud(${s.id})">📥 Recolectar</button>
                        <button class="btn btn-secondary btn-sm" onclick="ModHE.imprimirSolicitud(${s.id})">📄 PDF</button>
                    </div>
                </td>
            </tr>
        `).join('');
    }

    function construirPendientesRecoleccion(contratos, todasHE) {
        const abiertos = (contratos || []).filter(c =>
            ['activo', 'entrega_parcial', 'borrador'].includes(c.estatus) &&
            c.tipo_contrato === 'renta'
        );

        return abiertos
            .map(c => {
                const avance = calcularAvanceRecoleccion(c, todasHE || []);
                return { ...c, ...avance };
            })
            .filter(c => c.total_requerido > 0 && c.total_recolectado < c.total_requerido)
            .sort((a, b) => (a.folio || '').localeCompare(b.folio || '', 'es'));
    }

    function calcularAvanceRecoleccion(contrato, todasHE) {
        const itemsReq = (contrato.items && contrato.items.length)
            ? contrato.items
            : (ModContratos && typeof ModContratos.getItems === 'function'
                ? ModContratos.getItems(contrato.id)
                : []);
        const heContrato = (todasHE || []).filter(h => folioIgual(h.contrato_folio, contrato.folio));

        const recolectado = {};
        heContrato.forEach(h => {
            (h.items || []).forEach(it => {
                recolectado[it.producto_id] = (recolectado[it.producto_id] || 0) + (parseFloat(it.cantidad_recolectada || it.cantidad) || 0);
            });
        });

        let totalReq = 0;
        let totalRec = 0;
        itemsReq.forEach(req => {
            totalReq += parseFloat(req.cantidad) || 0;
            totalRec += Math.min(parseFloat(req.cantidad) || 0, recolectado[req.producto_id] || 0);
        });

        const pendiente = Math.max(0, totalReq - totalRec);
        const estatus = totalRec <= 0 ? 'sin_recoleccion' : 'parcial';
        return { total_requerido: totalReq, total_recolectado: totalRec, total_pendiente: pendiente, _estatusRecoleccion: estatus };
    }

    function renderSeguimientoPendientes() {
        const tbody = document.getElementById('he-seg-tbody');
        if (!tbody) return;

        if (!pendientesRecoleccion.length) {
            tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state">
                <h3>Sin contratos pendientes por recolectar</h3>
                <p>Todos los contratos abiertos con equipo ya tienen recolección total.</p>
            </div></td></tr>`;
            return;
        }

        tbody.innerHTML = pendientesRecoleccion.map(c => `
            <tr>
                <td class="td-mono">${c.folio || '—'}</td>
                <td><strong style="color:var(--text-main)">${c.razon_social || '—'}</strong></td>
                <td class="td-mono">${c.total_recolectado}/${c.total_requerido} pzas</td>
                <td class="td-mono" style="font-weight:700;color:var(--warning)">${c.total_pendiente} pzas</td>
                <td>${badgeSeguimientoRecoleccion(c._estatusRecoleccion)}</td>
                <td>
                    <button class="btn btn-primary btn-sm btn-he-desde-seg" data-id="${c.id}">+ Crear HE</button>
                </td>
            </tr>
        `).join('');

        document.querySelectorAll('.btn-he-desde-seg').forEach(btn => {
            btn.addEventListener('click', () => abrirModal(parseInt(btn.dataset.id)));
        });
    }

    function dataSeed() {
        return [
            {
                id: 1, folio: 'HE-001', contrato_folio: '20001', razon_social: 'CONSTRUCTORA TORRES DEL NORTE SA DE CV',
                fecha: '2026-04-01', total_piezas: 30, estatus: 'recibido', vaciado_fabricacion: false,
                items: [
                    { codigo:'AND-001', nombre:'Andamio Tubular 1.56x1.00m', cantidad_recolectada: 25, estado: 'pendiente_clasificacion' },
                    { codigo:'TAB-001', nombre:'Tablón de Madera 3.00m', cantidad_recolectada: 5, estado: 'pendiente_clasificacion' },
                ]
            },
        ];
    }

    function renderTabla() {
        const tbody = document.getElementById('he-tbody');
        if (!tbody) return;
        const f = filtro.toLowerCase();
        const data = heData.filter(h =>
            (h.folio||'').toLowerCase().includes(f) ||
            (h.contrato_folio||'').toLowerCase().includes(f) ||
            (h.razon_social||'').toLowerCase().includes(f)
        );
        if (!data.length) {
            tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
                <h3>Sin Hojas de Entrada</h3><p>Registra la primera recolección de equipo.</p>
            </div></td></tr>`;
            return;
        }
        tbody.innerHTML = data.map(h => filaHE(h)).join('');
    }

    function filaHE(h) {
        const isExpanded = expandedId === h.id;
        const mainRow = `
            <tr onclick="ModHE.toggleExp(${h.id})" class="${isExpanded ? 'row-expanded' : ''}" style="cursor:pointer">
                <td class="td-mono">${h.folio}</td>
                <td class="td-mono">${h.contrato_folio || '—'}</td>
                <td><strong style="color:var(--text-main);font-size:0.8rem">${h.razon_social || '—'}</strong></td>
                <td>${fmtFecha(h.fecha)}</td>
                <td class="td-mono">${h.total_piezas || 0} pzas</td>
                <td>${badgeEstatusHE(h.estatus)}</td>
                <td>${h.vaciado_fabricacion
                    ? '<span class="badge badge-success">✓ Vaciado</span>'
                    : '<span class="badge badge-warning">Pendiente</span>'}</td>
                <td>
                    <div class="flex gap-2">
                        <button class="btn btn-secondary btn-sm" onclick="event.stopPropagation(); ModHE.verDetalle(${h.id})">🔍</button>
                        ${!h.vaciado_fabricacion ? `<button class="btn btn-primary btn-sm" onclick="event.stopPropagation(); ModHE.procesarVaciado(${h.id})">⚙️</button>` : ''}
                    </div>
                </td>
            </tr>`;

        if (!isExpanded) return mainRow;

        const items = h.items || [];
        const detailRow = `
            <tr class="detail-row">
                <td colspan="8">
                    <div class="expand-detail-panel">
                        <div class="expand-detail-title">📥 Detalle de Recolección</div>
                        <table class="items-table-mini">
                            <thead>
                                <tr>
                                    <th>Código</th>
                                    <th>Descripción</th>
                                    <th>Cant. Recolectada</th>
                                    <th>Estado Reportado</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${items.map(it => `
                                    <tr>
                                        <td class="td-mono">${it.codigo}</td>
                                        <td>${it.nombre}</td>
                                        <td class="td-mono">${it.cantidad_recolectada || it.cantidad}</td>
                                        <td><span class="badge badge-gray">${it.estado || 'Recibido'}</span></td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                        <div class="mt-3 flex justify-end">
                            <button class="btn btn-secondary btn-sm" onclick="event.stopPropagation(); ModHE.verDetalle(${h.id})">Ver PDF / Más Detalles</button>
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
        const pendientes = construirPendientesRecoleccion(contratos, heData);
        const idsPendientes = new Set(pendientes.map(c => c.id));
        const contratosParaSeleccion = contratoIdPresel
            ? pendientes.concat(contratos.filter(c => c.id === contratoIdPresel && !idsPendientes.has(c.id)))
            : pendientes;
        const folioSugerido = await nextFolioHE();
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.id = 'modal-he';
        overlay.innerHTML = `
        <div class="modal modal-xl">
            <div class="modal-header">
                <div>
                    <div class="modal-title">Nueva Hoja de Entrada (HE) ${prefillData ? '— Desde Solicitud' : ''}</div>
                    <div class="modal-subtitle">Registro de recolección — el equipo regresa al almacén</div>
                </div>
                <button class="modal-close" onclick="document.getElementById('modal-he').remove()">✕</button>
            </div>
            <div class="modal-body">
                <input type="hidden" id="he-solicitud-id" value="${prefillData?.solicitud_id || ''}">
                <div class="form-row cols-3">
                    <div class="form-group">
                        <label class="form-label">Folio HE</label>
                        <input id="he-folio" class="form-control td-mono" value="${folioSugerido}" readonly style="background:var(--bg-elevated)">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Contrato <span class="required">*</span></label>
                        <select id="he-contrato" class="form-control">
                            <option value="">— Selecciona contrato —</option>
                            ${contratosParaSeleccion.map(c =>
                                `<option value="${c.id}" ${contratoIdPresel===c.id || prefillData?.contrato_id===c.id ?'selected':''}>${c.folio} — ${c.razon_social}</option>`
                            ).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Fecha de Recolección</label>
                        <input id="he-fecha" type="date" class="form-control" value="${hoyISO()}">
                    </div>
                </div>

                <div class="alert alert-success">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                    <span>El equipo recolectado se sumará al inventario disponible. El rol de <strong>Fabricación</strong> luego clasificará su estado.</span>
                </div>

                <div id="he-items-zona" style="display:none">
                    <div style="font-weight:700;margin-bottom:.75rem;color:var(--text-main)">Piezas a Recolectar</div>
                    <table class="items-table-mini">
                        <thead>
                            <tr>
                                <th>Código</th>
                                <th>Descripción</th>
                                <th>En Campo</th>
                                <th>A Recolectar Ahora</th>
                                <th>Estado Inicial</th>
                            </tr>
                        </thead>
                        <tbody id="he-items-tbody"></tbody>
                    </table>
                </div>

                <div class="form-row cols-2 mt-4">
                    <div class="form-group">
                        <label class="form-label">Operador / Chofer</label>
                        <input id="he-operador" class="form-control" placeholder="Nombre del operador">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Notas</label>
                        <textarea id="he-notas" class="form-control" placeholder="Condiciones de entrega, observaciones…">${prefillData?.notas || ''}</textarea>
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="document.getElementById('modal-he').remove()">Cancelar</button>
                <button class="btn btn-primary" id="btn-guardar-he">Guardar Hoja de Entrada</button>
            </div>
        </div>`;
        document.body.appendChild(overlay);
        overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

        const selContrato = document.getElementById('he-contrato');
        selContrato.addEventListener('change', () => cargarItemsContratoHE(selContrato.value));
        if (contratoIdPresel) cargarItemsContratoHE(String(contratoIdPresel));
        document.getElementById('btn-guardar-he').addEventListener('click', guardarHE);
    }

    async function obtenerContratosConItems() {
        const contratosDB = (await DB.getAll('ops_contratos', { orderBy: 'folio', ascending: false })) || [];
        return contratosDB.map(c => ({
            ...c,
            items: (c.items && c.items.length)
                ? c.items
                : (ModContratos && typeof ModContratos.getItems === 'function' ? ModContratos.getItems(c.id) : [])
        }));
    }

    async function cargarItemsContratoHE(contratoId) {
        const contratoNum = parseInt(contratoId);
        const c = contratosModal.find(x => x.id === contratoNum);
        const items = (c?.items && c.items.length)
            ? c.items
            : (ModContratos && typeof ModContratos.getItems === 'function' ? ModContratos.getItems(contratoNum) : []);

        const zona = document.getElementById('he-items-zona');
        const tbody = document.getElementById('he-items-tbody');
        if (!items || !items.length) { zona.style.display = 'none'; return; }
        zona.style.display = 'block';

        // Calcular cantidades en campo: (Suma de HS) - (Suma de HE previas)
        const [todasHS, todasHE] = await Promise.all([
            DB.getAll('ops_hs'),
            DB.getAll('ops_he')
        ]);

        const hsDelContrato = (todasHS || []).filter(h => folioIgual(h.contrato_folio, c?.folio));
        const heDelContrato = (todasHE || []).filter(h => folioIgual(h.contrato_folio, c?.folio));

        const entregadoMap = {};
        hsDelContrato.forEach(h => {
            (h.items || []).forEach(it => {
                entregadoMap[it.producto_id] = (entregadoMap[it.producto_id] || 0) + (it.cantidad_hs || it.cantidad || 0);
            });
        });

        const recolectadoMap = {};
        heDelContrato.forEach(h => {
            (h.items || []).forEach(it => {
                recolectadoMap[it.producto_id] = (recolectadoMap[it.producto_id] || 0) + (it.cantidad_recolectada || it.cantidad || 0);
            });
        });

        tbody.innerHTML = items.map((it, i) => {
            const totEntregado = entregadoMap[it.producto_id] || 0;
            const totRecolectado = recolectadoMap[it.producto_id] || 0;
            const enCampo = Math.max(0, totEntregado - totRecolectado);

            return `<tr>
                <td class="td-mono">${it.codigo}</td>
                <td>${it.nombre}</td>
                <td class="td-mono" style="font-weight:700; color:${enCampo>0?'var(--primary)':'var(--text-muted)'}">${enCampo}</td>
                <td>
                    <input type="number" class="form-control he-cant-item" data-idx="${i}" min="0" max="${enCampo}"
                        value="${enCampo}" style="width:80px;font-size:0.78rem" ${enCampo === 0 ? 'disabled style="background:var(--bg-alt)"' : ''}>
                </td>
                <td>
                    <select class="form-control he-estado-item" style="font-size:0.78rem" ${enCampo === 0 ? 'disabled' : ''}>
                        <option value="pendiente_clasificacion">⏳ Pendiente Clasificación</option>
                        <option value="limpio_funcional">✅ Limpio Funcional</option>
                        <option value="sucio_funcional">🔧 Sucio Funcional</option>
                        <option value="chatarra">❌ Chatarra</option>
                    </select>
                </td>
            </tr>`;
        }).join('');
    }

    async function guardarHE() {
        const contratoId = parseInt(document.getElementById('he-contrato').value);
        if (!contratoId) { App.toast('Selecciona un contrato', 'danger'); return; }

        const c = contratosModal.find(x => x.id === contratoId);
        const contItems = (c?.items && c.items.length)
            ? c.items
            : (ModContratos && typeof ModContratos.getItems === 'function' ? ModContratos.getItems(contratoId) : []);

        const items = [];
        document.querySelectorAll('.he-cant-item').forEach((inp, i) => {
            const it = contItems[i];
            const sel = document.querySelectorAll('.he-estado-item')[i];
            if (it && parseInt(inp.value) > 0) {
                items.push({
                    ...it,
                    cantidad_recolectada: parseInt(inp.value),
                    estado: sel?.value || 'pendiente_clasificacion',
                });
            }
        });

        const nuevaHE = {
            folio: document.getElementById('he-folio').value,
            contrato_folio: c?.folio,
            razon_social: c?.razon_social,
            fecha: document.getElementById('he-fecha').value,
            total_piezas: items.reduce((s, i) => s + i.cantidad_recolectada, 0),
            estatus: 'recibido',
            vaciado_fabricacion: false,
            operador: document.getElementById('he-operador').value.trim() || null,
            notas: document.getElementById('he-notas').value.trim() || null,
            // items van a ops_he_items (tabla relacional), no como JSONB aquí
        };

        const res = await DB.insert('ops_he', nuevaHE);
        if (res.error) {
            App.toast('Error al guardar: ' + res.error, 'danger');
            return;
        }

        // Insertar cada item en ops_he_items (tabla relacional)
        for (const it of items) {
            const codigoKey = it.codigo || String(it.producto_id);
            if (codigoKey && it.cantidad_recolectada > 0) {
                const itemRes = await DB.insert('ops_he_items', {
                    he_id: res.id,
                    producto_id: codigoKey,          // FK → cat_productos(codigo)
                    cantidad_recolectada: it.cantidad_recolectada,
                    cantidad_buena: 0,
                    cantidad_dano: 0,
                    cantidad_perdida: 0
                });
                if (itemRes?.error) {
                    console.error('Error insertando item HE:', itemRes.error);
                }
            }
        }

        // Marcar solicitud como completada si aplica
        const solId = document.getElementById('he-solicitud-id').value;
        if (solId) {
            await DB.update('ops_solicitudes', solId, { estatus: 'completada' });
        }

        if (res) heData.push(res);
        document.getElementById('modal-he').remove();
        App.toast(`Hoja de Entrada ${nuevaHE.folio} registrada`, 'success');
        cargarHE(); // Recargar todo para actualizar paneles
    }

    function verDetalle(heId) {
        const h = heData.find(x => x.id === heId);
        if (!h) return;
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.id = 'modal-he-detalle';
        overlay.innerHTML = `
        <div class="modal modal-lg">
            <div class="modal-header">
                <div>
                    <div class="modal-title">Hoja de Entrada — ${h.folio}</div>
                    <div class="modal-subtitle">${h.razon_social} | Contrato: ${h.contrato_folio}</div>
                </div>
                <button class="modal-close" onclick="document.getElementById('modal-he-detalle').remove()">✕</button>
            </div>
            <div class="modal-body">
                <div class="form-row cols-3" style="margin-bottom:1rem">
                    <div><span class="stat-label">Fecha</span><div>${fmtFecha(h.fecha)}</div></div>
                    <div><span class="stat-label">Total Piezas</span><div class="td-mono">${h.total_piezas} pzas</div></div>
                    <div><span class="stat-label">Vaciado Fabricación</span><div>${h.vaciado_fabricacion ? '<span class="badge badge-success">Completado</span>' : '<span class="badge badge-warning">Pendiente</span>'}</div></div>
                </div>
                <table class="items-table-mini">
                    <thead><tr><th>Código</th><th>Descripción</th><th>Cantidad</th><th>Estado</th></tr></thead>
                    <tbody>${(h.items||[]).map(i => `<tr>
                        <td class="td-mono">${i.codigo}</td>
                        <td>${i.nombre}</td>
                        <td class="td-mono">${i.cantidad_recolectada}</td>
                        <td>${badgeEstadoPieza(i.estado)}</td>
                    </tr>`).join('')}</tbody>
                </table>
                ${h.notas ? `<div class="alert alert-info mt-4"><span>${h.notas}</span></div>` : ''}
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary btn-pdf-he" data-id="${h.id}">📄 Generar PDF</button>
                ${!h.vaciado_fabricacion ? `<button class="btn btn-primary" onclick="ModHE.procesarVaciado(${h.id});document.getElementById('modal-he-detalle').remove()">Procesar Vaciado</button>` : ''}
                <button class="btn btn-secondary" onclick="document.getElementById('modal-he-detalle').remove()">Cerrar</button>
            </div>
        </div>`;
        document.body.appendChild(overlay);
        
        // Attach link to new PDF button
        overlay.querySelector('.btn-pdf-he').addEventListener('click', (e) => {
            e.stopPropagation();
            generarPDF(h.id);
        });

        overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
    }

    async function generarPDF(heId) {
        const h = heData.find(x => x.id === heId);
        if (!h) return;

        try {
            App.toast('Generando Hoja de Entrada en PDF...', 'info');
            
            const url = 'Antecedente/hs_plantilla.pdf';
            const templateBytes = await fetch(url).then(res => {
                if(!res.ok) throw new Error('No se pudo cargar la hoja plantilla de entrada');
                return res.arrayBuffer();
            });

            const { PDFDocument, rgb } = window.PDFLib;
            const pdfDoc = await PDFDocument.load(templateBytes);
            const page = pdfDoc.getPages()[0];
            
            const textColor = rgb(0.1, 0.1, 0.1); 
            const font = await pdfDoc.embedFont(window.PDFLib.StandardFonts.Helvetica);
            const fontBold = await pdfDoc.embedFont(window.PDFLib.StandardFonts.HelveticaBold);

            const draw = (text, x, y, size = 10, isBold = false) => {
                if(text == null || text === '') return;
                page.drawText(String(text), { x, y, size, font: isBold ? fontBold : font, color: textColor });
            };

            // Coordenadas Estimadas para hoja de entrada (usando la plantilla hs_plantilla.pdf)
            draw(h.folio || '0000', 480, 715, 12, true); // Folio HE
            draw(fmtFecha(h.fecha), 460, 695, 10); // Fecha
            draw(h.contrato_folio || '—', 460, 675, 10, true); // Folio contrato asociado
            
            draw(h.razon_social || '', 130, 660, 11, true); // Razón social
            draw('Hoja de Entrada (Recolección)', 130, 640, 10);
            
            // Items
            let startY = 520; 
            const rowHeight = 16;
            
            (h.items || []).forEach((it, idx) => {
                const currentY = startY - (idx * rowHeight);
                draw(it.cantidad_recolectada || 0, 50, currentY, 10); // Cantidad recolectada en esta HE
                draw(it.codigo || '', 100, currentY, 9); // Código
                
                const nombre = it.nombre || '';
                draw(nombre.length > 50 ? nombre.substring(0, 50) + '…' : nombre, 160, currentY, 9); // Nombre
            });

            // Guardar y Descargar
            const pdfBytes = await pdfDoc.save();
            const blob = new Blob([pdfBytes], { type: 'application/pdf' });
            const urlDescarga = window.URL.createObjectURL(blob);
            
            const link = document.createElement('a');
            link.href = urlDescarga;
            link.download = `HE_${h.folio || '000'}.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(urlDescarga);

            App.toast(`PDF de la HE ${h.folio} generado`, 'success');

        } catch (err) {
            console.error('Error generando PDF de HE:', err);
            App.toast('Error generando el formato PDF: ' + err.message, 'danger');
        }
    }

    function procesarVaciado(heId) {
        const h = heData.find(x => x.id === heId);
        if (!h || h.vaciado_fabricacion) return;
        // Redirigir al módulo de fabricación con esta HE preseleccionada
        App.navigate('fabricacion');
        setTimeout(() => ModFabricacion && ModFabricacion.procesarHE(heId), 300);
    }

    async function nextFolioHE() {
        const rows = (await DB.getAll('ops_he', { orderBy: 'folio', ascending: false })) || [];
        let maxNum = 0;
        rows.forEach(r => {
            const m = String(r?.folio || '').trim().match(/^HE-(\d+)$/);
            if (m) maxNum = Math.max(maxNum, parseInt(m[1], 10) || 0);
        });
        return `HE-${String(maxNum + 1).padStart(3,'0')}`;
    }

    // Utility aliases — delegated to Utils
    const fmtFecha = Utils.fmtFecha;
    const hoyISO = Utils.hoyISO;
    const folioIgual = Utils.folioIgual;

    // HE-specific badge functions (not in Utils)
    function badgeEstatusHE(e) {
        const map = { recibido:'badge-success', en_transito:'badge-warning', pendiente:'badge-gray' };
        return `<span class="badge ${map[e]||'badge-gray'}">${Utils.escapeHtml((e||'—').replace('_',' '))}</span>`;
    }
    function badgeEstadoPieza(e) {
        const map = { pendiente_clasificacion:'badge-warning', limpio_funcional:'badge-success', sucio_funcional:'badge-info', chatarra:'badge-danger' };
        return `<span class="badge ${map[e]||'badge-gray'}">${Utils.escapeHtml((e||'—').replace(/_/g,' '))}</span>`;
    }
    function badgeSeguimientoRecoleccion(e) {
        const map = {
            parcial: '<span class="badge badge-warning">📥 Parcial</span>',
            sin_recoleccion: '<span class="badge badge-danger">📥 Sin recolección</span>'
        };
        return map[e] || '<span class="badge badge-gray">—</span>';
    }

    async function procesarSolicitud(solId) {
        const sol = solicitudesPendientes.find(x => x.id === solId);
        if (!sol) return;
        
        // Abrir modal de HE con los datos de la solicitud
        abrirModal(sol.contrato_id, {
            items: sol.items,
            solicitud_id: sol.id,
            notas: `Recolección de solicitud programada para ${Utils.formatDate(sol.fecha_programada)}`
        });
    }

    function imprimirSolicitud(solId) {
        const sol = solicitudesPendientes.find(x => x.id === solId);
        if (!sol) return;
        const c = contratosModal.find(x => x.id === sol.contrato_id);
        if (PDFGenerator) {
            PDFGenerator.generate('SOLICITUD_RECOLECCION', c || { folio: sol.folio_contrato }, sol.items);
        }
    }

    // API Pública
    return { 
        render, 
        verDetalle, 
        getHE: () => heData, 
        reload: async () => {
            await cargarHE();
        },
        toggleExp,
        abrirDesdeContrato: (id) => { abrirModal(id); },
        procesarSolicitud,
        imprimirSolicitud
    };
})();
