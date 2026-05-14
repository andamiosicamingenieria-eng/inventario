import { DB, DEMO_MODE } from '../supabase-client.js';
import { Utils } from '../utils.js';
import { PDFGenerator } from './pdf-generator.js';


/**
 * ICAM 360 - Módulo de Contratos (ops_contratos + ops_contratos_items)
 * Tipos: renta, venta, renovacion, venta_perdida, cancelacion
 * Genera PDF genérico con jsPDF
 */
export const ModContratos = (() => {

    let contratos = [];
    let filtro = '';
    let filtroTipo = '';
    let filtroEstatus = '';
    let expandedId = null;

    // Items seed por contrato
    const contratosItems = {};

    function render() {
        const mc = document.getElementById('module-content');
        mc.innerHTML = `
        <div class="page-toolbar">
            <div class="page-toolbar-left">
                <div class="search-box">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    <input id="cont-search" type="text" placeholder="Folio, cliente, agente…" value="${filtro}">
                </div>
                <select id="cont-tipo-filter" class="form-control" style="width:auto">
                    <option value="">Todos los tipos</option>
                    <option value="renta">Renta</option>
                    <option value="venta">Venta</option>
                    <option value="renovacion">Renovación</option>
                    <option value="venta_perdida">Venta Perdida</option>
                    <option value="cancelacion">Cancelación</option>
                </select>
                <select id="cont-est-filter" class="form-control" style="width:auto">
                    <option value="">Todos los estatus</option>
                    <option value="borrador">Borrador</option>
                    <option value="activo">Activo</option>
                    <option value="entrega_parcial">Entrega Parcial</option>
                    <option value="recolectado">Recolectado</option>
                    <option value="renovacion">Renovación</option>
                    <option value="cancelado">Cancelado</option>
                </select>
            </div>
            <div class="page-toolbar-right">
                <button class="btn btn-primary" id="btn-nuevo-cont">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    Nuevo Contrato
                </button>
            </div>
        </div>
        <div class="table-wrapper">
            <table id="cont-table">
                <thead>
                    <tr>
                        <th>Folio</th>
                        <th>Cliente</th>
                        <th>Sistema</th>
                        <th>Entrega</th>
                        <th>Recolección</th>
                        <th>Importe</th>
                        <th>Pago</th>
                        <th>Estatus</th>
                        <th>Vencimiento</th>
                    </tr>
                </thead>
                <tbody id="cont-tbody"></tbody>
            </table>
        </div>`;

        document.getElementById('cont-search').addEventListener('input', e => { filtro = e.target.value; renderTabla(); });
        document.getElementById('cont-tipo-filter').addEventListener('change', e => { filtroTipo = e.target.value; renderTabla(); });
        document.getElementById('cont-est-filter').addEventListener('change', e => { filtroEstatus = e.target.value; renderTabla(); });
        document.getElementById('btn-nuevo-cont').addEventListener('click', () => abrirModal());

        cargarContratos();
    }

    async function cargarContratos() {
        // Asegurar que el catálogo de productos esté cargado antes de mapear items
        if (ModProductos && ModProductos.getProductos().length === 0) {
            await ModProductos.cargar();
        }

        const [raw, itemsRaw, todasHS, todasHE] = await Promise.all([
            DB.getAll('ops_contratos', { orderBy: 'folio', ascending: false }),
            DB.getAll('ops_contratos_items'),
            DB.getAll('ops_hs'),
            DB.getAll('ops_he')
        ]);
        
        contratos = raw || dataSeed();
        const itemsDB = itemsRaw || [];
        
        const prods = ModProductos ? ModProductos.getProductos() : [];
        const itemsMap = {};
        itemsDB.forEach(it => {
            if (!itemsMap[it.contrato_id]) itemsMap[it.contrato_id] = [];
            // producto_id en BD es el código string (FK a cat_productos(codigo))
            const prod = prods.find(p => p.codigo === it.producto_id) || {};
            itemsMap[it.contrato_id].push({
                ...it,
                codigo: it.producto_id,      // el codigo string es el FK
                nombre: prod.nombre || 'Producto Desconocido'
            });
        });

        const hs = todasHS || [];
        const he = todasHE || [];

        contratos.forEach(c => { 
            // Cargar ítems (de la tabla relacional, o fallback a JSON antiguo si existe)
            if (itemsMap[c.id]) {
                contratosItems[c.id] = itemsMap[c.id];
                c.items = itemsMap[c.id]; // para compatibilidad con HS y funciones utils
            } else if (c.items && Array.isArray(c.items) && c.items.length) {
                // Legado JSON
                contratosItems[c.id] = c.items;
            } else if (!contratosItems[c.id]) {
                contratosItems[c.id] = itemsSeed(c);
                c.items = contratosItems[c.id];
            }
            
            // Calcular estatus dinámicos para la tabla
            c._estatusEntrega = calcularEstatusEntrega(c, hs);
            c._estatusRecoleccion = calcularEstatusRecoleccion(c, he);
        });
        
        renderTabla();
    }

    function dataSeed() {
        const hoy = new Date();
        const fmtDate = d => d.toISOString().split('T')[0];
        const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
        return [
            { id: 1, folio: '20001', cliente_id: 1, tipo_contrato: 'renta', estatus: 'activo', fecha_contrato: fmtDate(addDays(hoy,-45)), fecha_inicio_real: fmtDate(addDays(hoy,-40)), fecha_vencimiento: fmtDate(addDays(hoy,20)), dias_renta: 60, monto_total: 85000, vendedor: 'Carlos Hdz', razon_social: 'CONSTRUCTORA TORRES DEL NORTE SA DE CV' },
            { id: 2, folio: '20002', cliente_id: 2, tipo_contrato: 'renta', estatus: 'entrega_parcial', fecha_contrato: fmtDate(addDays(hoy,-10)), fecha_inicio_real: fmtDate(addDays(hoy,-5)), fecha_vencimiento: fmtDate(addDays(hoy,3)), dias_renta: 30, monto_total: 42000, vendedor: 'Ana Martínez', razon_social: 'EDIFICACIONES MONTERREY SA DE CV' },
            { id: 3, folio: '20003', cliente_id: 4, tipo_contrato: 'venta', estatus: 'activo', fecha_contrato: fmtDate(addDays(hoy,-5)), fecha_inicio_real: null, fecha_vencimiento: null, dias_renta: null, monto_total: 320000, vendedor: 'Carlos Hdz', razon_social: 'INMOBILIARIA NUEVA ÉPOCA SC' },
            { id: 4, folio: '20004', cliente_id: 1, tipo_contrato: 'renovacion', estatus: 'activo', fecha_contrato: fmtDate(hoy), fecha_inicio_real: fmtDate(hoy), fecha_vencimiento: fmtDate(addDays(hoy,60)), dias_renta: 60, monto_total: 90000, vendedor: 'Carlos Hdz', razon_social: 'CONSTRUCTORA TORRES DEL NORTE SA DE CV' },
        ];
    }

    function itemsSeed(c) {
        const prods = ModProductos ? ModProductos.getProductos() : [];
        if (!prods.length) return [];
        return [
            { id: 1, producto_id: 1, codigo: 'AND-001', nombre: 'Andamio Tubular 1.56x1.00m', cantidad: 50, precio_unitario: 85 },
            { id: 2, producto_id: 3, codigo: 'TAB-001', nombre: 'Tablón de Madera 3.00m', cantidad: 30, precio_unitario: 35 },
        ];
    }

    function renderTabla() {
        const tbody = document.getElementById('cont-tbody');
        if (!tbody) return;
        const f = filtro.toLowerCase();
        let data = contratos.filter(c =>
            (c.folio || '').includes(f) ||
            (c.razon_social || '').toLowerCase().includes(f) ||
            (c.vendedor || '').toLowerCase().includes(f)
        );
        if (filtroTipo) data = data.filter(c => c.tipo_contrato === filtroTipo);
        if (filtroEstatus) data = data.filter(c => c.estatus === filtroEstatus);

        if (!data.length) {
            tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                <h3>Sin contratos</h3><p>Crea el primer contrato presionando "Nuevo Contrato".</p></div></td></tr>`;
            return;
        }

        const _e = Utils.escapeHtml;
        tbody.innerHTML = data.map(c => {
            const rowHTML = `
            <tr class="cont-row" data-id="${c.id}" style="cursor:pointer;">
                <td class="td-mono">${_e(c.folio)}</td>
                <td><strong style="color:var(--text-main)">${_e(c.razon_social) || '—'}</strong></td>
                <td style="font-size:0.75rem">${_e(c.sistema) || '—'}</td>
                <td>${Utils.getBadgeEntrega(c._estatusEntrega)}</td>
                <td>${Utils.getBadgeRecoleccion(c._estatusRecoleccion)}</td>
                <td class="td-mono" title="Saldo: $${Number((c.monto_total||0)-(c.anticipo||0)).toLocaleString('es-MX')}">
                    $${Number(c.monto_total||0).toLocaleString('es-MX')}
                </td>
                <td>${Utils.badgePago(c.estatus_pago)}</td>
                <td>${Utils.badgeEstatusContrato(c.estatus)}</td>
                <td style="font-size:0.85rem">${c.fecha_vencimiento ? `<span style="color:${Utils.colorVencimiento(c.fecha_vencimiento)};font-weight:600">${Utils.fmtFecha(c.fecha_vencimiento)}</span>` : '—'}</td>
            </tr>`;

            const detailHTML = expandedId === c.id ? `
            <tr class="row-detail-container" data-for="${c.id}">
                <td colspan="8">
                    <div class="row-detail">
                        ${renderDetalle(c)}
                    </div>
                </td>
            </tr>` : '';

            return rowHTML + detailHTML;
        }).join('');

        // Clicks en filas
        document.querySelectorAll('.cont-row').forEach(row => {
            row.addEventListener('click', () => {
                const id = parseInt(row.dataset.id);
                expandedId = expandedId === id ? null : id;
                renderTabla();
            });
        });

        // Botones dentro del detalle
        document.querySelectorAll('.btn-pdf-contrato').forEach(btn => {
            btn.addEventListener('click', e => { e.stopPropagation(); generarPDF(parseInt(btn.dataset.id)); });
        });
        document.querySelectorAll('.btn-edit-contrato').forEach(btn => {
            btn.addEventListener('click', e => { e.stopPropagation(); abrirModal(parseInt(btn.dataset.id)); });
        });
    }

    function renderDetalle(c) {
        const items = contratosItems[c.id] || [];
        return `
        <div class="form-row cols-3" style="margin-bottom:1rem">
            <div><span class="stat-label">Folio Raíz</span><div class="td-mono">${Utils.escapeHtml(c.folio_raiz || c.folio)}</div></div>
            <div><span class="stat-label">Viene de (Ant)</span><div class="td-mono" style="color:var(--primary);cursor:pointer" onclick="App.navigate('contratos','${Utils.escapeHtml(c.renta_anterior)}')">${Utils.escapeHtml(c.renta_anterior) || '—'}</div></div>
            <div><span class="stat-label">Sigue a (Post)</span><div class="td-mono" style="color:var(--primary);cursor:pointer" onclick="App.navigate('contratos','${Utils.escapeHtml(c.renta_posterior)}')">${Utils.escapeHtml(c.renta_posterior) || '—'}</div></div>
        </div>
        <div class="form-row cols-3" style="margin-bottom:1rem">
            <div><span class="stat-label">Sistema</span><div style="font-weight:600;color:var(--primary)">${Utils.escapeHtml(c.sistema) || '—'}</div></div>
            <div><span class="stat-label">Días de Renta</span><div>${c.dias_renta || '—'} días</div></div>
            <div><span class="stat-label">Precio/Día</span><div class="td-mono">$${Number(c.precio_por_dia || (c.monto_total && c.dias_renta ? c.monto_total/c.dias_renta : 0)).toLocaleString('es-MX',{minimumFractionDigits:2})}</div></div>
        </div>
        <div style="font-weight:600;color:var(--text-secondary);font-size:0.775rem;text-transform:uppercase;margin-bottom:.5rem">Ítems del Contrato</div>
        <table class="items-table-mini">
            <thead><tr><th>Código</th><th>Descripción</th><th>Cantidad</th><th>Precio/día</th><th>Importe</th></tr></thead>
            <tbody>${items.map(i => `<tr>
                <td class="td-mono">${i.codigo}</td>
                <td>${i.nombre}</td>
                <td>${i.cantidad}</td>
                <td class="td-mono">$${Number(i.precio_unitario||0).toLocaleString('es-MX',{minimumFractionDigits:2})}</td>
                <td class="td-mono">$${Number((i.cantidad||0)*(i.precio_unitario||0)).toLocaleString('es-MX',{minimumFractionDigits:2})}</td>
            </tr>`).join('') || '<tr><td colspan="5" style="text-align:center;color:var(--text-muted)">Sin ítems registrados</td></tr>'}</tbody>
        </table>
        <div class="flex gap-2 mt-4" style="flex-wrap:wrap">
            <button class="btn btn-primary btn-sm" onclick="App.navigate('estado_cuenta', '${c.folio_raiz || c.folio}')">📑 Estado de Cuenta</button>
            <button class="btn btn-success btn-sm" onclick="ModPagos.abrirModalPago(${c.id})">💰 Registrar Pago</button>
            <button class="btn btn-secondary btn-sm btn-edit-contrato" data-id="${c.id}">✏ Editar</button>
            <button class="btn btn-secondary btn-sm btn-pdf-contrato" data-id="${c.id}">📄 Generar PDF</button>
            <button class="btn btn-warning btn-sm" onclick="ModContratos.prepararVentaPorPerdidaDesdeSeguimiento(${c.id})">⚠ Venta por Pérdida</button>
            <button class="btn btn-secondary btn-sm" onclick="ModContratos.crearSolicitud('entrega', ${c.id})">🔂 Solicitud Entrega</button>
            <button class="btn btn-secondary btn-sm" onclick="ModHS.abrirDesdeContrato(${c.id})">🚛 + HS</button>
            <button class="btn btn-secondary btn-sm" onclick="ModHE.abrirDesdeContrato(${c.id})">📥 + HE</button>
        </div>`;
    }

    // ── Modal Crear/Editar Contrato ───────────────────
    async function abrirModal(contratoId = null, prefillData = null) {
        // Asegurar que los catálogos estén cargados si se entra directo
        if (ModClientes && ModClientes.getClientes().length === 0) await ModClientes.cargar();
        if (ModProductos && ModProductos.getProductos().length === 0) await ModProductos.cargar();

        const c = contratoId ? contratos.find(x => x.id === contratoId) : null;
        const clientes = ModClientes ? ModClientes.getClientes() : [];
        const productos = ModProductos ? ModProductos.getProductos() : [];
        const items = contratoId ? (contratosItems[contratoId] || []) : (prefillData?.items || []);

        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.id = 'modal-contrato';
        overlay.innerHTML = `
        <div class="modal modal-xl">
            <div class="modal-header">
                <div>
                    <div class="modal-title">${c ? `Editar Contrato ${c.folio}` : (prefillData?.tipo_contrato === 'venta_perdida' ? 'Nuevo Contrato - Venta por Pérdida' : 'Nuevo Contrato')}</div>
                    <div class="modal-subtitle">Complete todos los campos del contrato</div>
                </div>
                <button class="modal-close" onclick="document.getElementById('modal-contrato').remove()">✕</button>
            </div>
            <div class="modal-body">

                <!-- TIPO DE CONTRATO con alerta especial -->
                <div class="form-row cols-4" style="margin-bottom:1.25rem">
                    <div class="form-group">
                        <label class="form-label">Tipo de Contrato <span class="required">*</span></label>
                        <select id="c-tipo" class="form-control">
                            <option value="renta" ${c?.tipo_contrato==='renta'?'selected':''}>🏗 Renta</option>
                            <option value="venta" ${c?.tipo_contrato==='venta'?'selected':''}>🛒 Venta</option>
                            <option value="renovacion" ${c?.tipo_contrato==='renovacion'?'selected':''}>🔄 Renovación</option>
                            <option value="venta_perdida" ${c?.tipo_contrato==='venta_perdida'?'selected':''}>⚠ Venta por Pérdida</option>
                            <option value="cancelacion" ${c?.tipo_contrato==='cancelacion'?'selected':''}>❌ Cancelación</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Sistema <span class="required">*</span></label>
                        <select id="c-sistema" class="form-control">
                            <option value="">— Selecciona —</option>
                            ${['Torres de trabajo', 'Multidireccional', 'Hamacas', 'Apuntalamientos', 'Armados', 'Vallas', 'Fletes', 'Otros'].map(s => 
                                `<option value="${s}" ${c?.sistema===s?'selected':''}>${s}</option>`
                            ).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Folio</label>
                        <input id="c-folio" class="form-control td-mono" placeholder="Auto-generado" value="${c?.folio || nextFolio()}" ${c?'readonly':''}>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Estatus</label>
                        <select id="c-estatus" class="form-control">
                            ${['borrador','activo','entrega_parcial','recolectado','renovacion','cancelado'].map(s =>
                                `<option value="${s}" ${c?.estatus===s?'selected':''}>${s.replace('_',' ').toUpperCase()}</option>`
                            ).join('')}
                        </select>
                    </div>
                </div>
                <div class="form-row cols-2" style="margin-bottom:1.25rem;background:var(--primary-light);padding:.75rem;border-radius:var(--radius)">
                    <div class="form-group">
                        <label class="form-label">Viene de (Folio Anterior)</label>
                        <input id="c-anterior" class="form-control td-mono" placeholder="Ej: 20001" value="${c?.renta_anterior || ''}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Sigue a (Folio Posterior)</label>
                        <input id="c-posterior" class="form-control td-mono" placeholder="Ej: 20005" value="${c?.renta_posterior || ''}">
                    </div>
                </div>

                <div id="alerta-venta-perdida" class="alert alert-warning" style="display:${(c?.tipo_contrato==='venta_perdida' || prefillData?.tipo_contrato==='venta_perdida') ? 'flex' : 'none'}">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                    <span>⚠ <strong>Venta por Pérdida:</strong> Al guardar se generará automáticamente una HE y HS para afectar el inventario.</span>
                </div>

                <div class="form-row cols-2">
                    <div class="form-group">
                        <label class="form-label">Cliente <span class="required">*</span></label>
                        <input type="text" id="c-cliente-buscar" class="form-control" placeholder="Buscar por nombre o RFC..." oninput="ModContratos.filtrarClientes(this.value)">
                        <select id="c-cliente" class="form-control" style="margin-top:0.5rem" onchange="ModContratos.seleccionarCliente(this.value)">
                            <option value="">— Selecciona cliente —</option>
                            ${clientes.map(cl => `<option value="${cl.id}" data-rfc="${cl.rfc||''}" data-nombre="${cl.razon_social||''}" ${c?.cliente_id===cl.id?'selected':''}>${cl.razon_social} (${cl.rfc||'Sin RFC'})</option>`).join('')}
                        </select>
                        <div id="c-cliente-seleccionado" style="font-size:0.8rem;color:var(--primary);margin-top:0.25rem;display:${c?.cliente_id?'block':'none'}">
                            ✓ ${c?.cliente_id ? clientes.find(cl=>cl.id===c?.cliente_id)?.razon_social : ''}
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Agente de Ventas</label>
                        <input id="c-vendedor" class="form-control" placeholder="Nombre del agente" value="${c?.vendedor||''}">
                    </div>
                </div>

                <div class="form-row cols-4">
                    <div class="form-group">
                        <label class="form-label">Fecha de Contrato</label>
                        <input id="c-fecha-contrato" type="date" class="form-control" value="${c?.fecha_contrato || Utils.hoyISO()}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Fecha de Inicio Real</label>
                        <input id="c-fecha-inicio" type="date" class="form-control" value="${c?.fecha_inicio_real||''}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Días de Renta</label>
                        <input id="c-dias" type="number" class="form-control" placeholder="30" value="${c?.dias_renta||''}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Vencimiento (calculado)</label>
                        <input id="c-vencimiento" type="date" class="form-control" readonly style="background:var(--bg-elevated)" value="${c?.fecha_vencimiento||''}">
                    </div>
                </div>

                <div class="form-row cols-3">
                    <div class="form-group">
                        <label class="form-label">Monto Total ($)</label>
                        <input id="c-monto" type="number" step="0.01" class="form-control" placeholder="0.00" value="${c?.monto_total||''}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Anticipo ($)</label>
                        <input id="c-anticipo" type="number" step="0.01" class="form-control" placeholder="0.00" value="${c?.anticipo||''}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Precio por Día ($)</label>
                        <input id="c-precio-dia" type="number" step="0.01" class="form-control" readonly style="background:var(--bg-elevated)" value="">
                    </div>
                </div>

                <div class="form-group">
                    <label class="form-label">Dirección de Servicio</label>
                    <textarea id="c-dir" class="form-control">${c?.direccion_servicio||''}</textarea>
                </div>

                <div id="section-entrega" style="display:${(c?.tipo_contrato==='venta_perdida' || prefillData?.tipo_contrato==='venta_perdida') ? 'none' : 'block'}">
                    <hr class="divider" style="margin:1rem 0">
                    <div style="font-weight:600;color:var(--text-secondary);font-size:0.875rem;text-transform:uppercase;margin-bottom:0.75rem">Sección de Entrega</div>

                    <div class="form-row cols-2">
                        <div class="form-group">
                            <label class="form-label">Contacto que Recibe</label>
                            <input id="c-contacto-entrega" class="form-control" placeholder="Nombre del contacto" value="${c?.contacto_entrega||''}">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Teléfono del Contacto</label>
                            <input id="c-tel-contacto" class="form-control" placeholder="Teléfono" value="${c?.telefono_contacto_entrega||''}">
                        </div>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Dirección de Entrega/Obra</label>
                        <textarea id="c-dir-entrega" class="form-control" placeholder="Dirección específica de entrega">${c?.direccion_entrega||''}</textarea>
                    </div>
                </div>

                <hr class="divider" style="margin:1rem 0">
                <div style="font-weight:600;color:var(--text-secondary);font-size:0.875rem;text-transform:uppercase;margin-bottom:0.75rem">Sección de Pago</div>

                <div class="form-row cols-2">
                    <div class="form-group">
                        <label class="form-label">Fecha de Pago</label>
                        <input id="c-fecha-pago" type="date" class="form-control" value="${c?.fecha_pago||''}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Forma de Pago</label>
                        <select id="c-forma-pago" class="form-control">
                            <option value="">— Selecciona forma de pago —</option>
                            <option value="efectivo" ${c?.forma_pago==='efectivo'?'selected':''}>💵 Efectivo</option>
                            <option value="transferencia" ${c?.forma_pago==='transferencia'?'selected':''}>💳 Transferencia Bancaria</option>
                            <option value="tarjeta" ${c?.forma_pago==='tarjeta'?'selected':''}>🏧 Tarjeta de Crédito/Débito</option>
                            <option value="cheque" ${c?.forma_pago==='cheque'?'selected':''}>📄 Cheque</option>
                            <option value="credito" ${c?.forma_pago==='credito'?'selected':''}>📋 Crédito</option>
                            <option value="otro" ${c?.forma_pago==='otro'?'selected':''}>⚙ Otro</option>
                        </select>
                    </div>
                </div>

                <div class="form-group">
                    <label class="form-label">Notas</label>
                    <textarea id="c-notas" class="form-control">${c?.notas||''}</textarea>
                </div>

                <hr class="divider">

                <!-- ITEMS DEL CONTRATO -->
                <div class="flex justify-between items-center mb-3">
                    <div style="font-weight:700;color:var(--text-main)">Ítems del Contrato</div>
                    <button type="button" class="btn btn-secondary btn-sm" id="btn-add-item">+ Agregar Item</button>
                </div>
                <div id="cont-items-container">
                    <table class="items-table-mini">
                        <thead><tr><th>Producto</th><th>Cantidad</th><th>Precio/Día</th><th>Importe</th><th></th></tr></thead>
                        <tbody id="cont-items-tbody">
                            ${items.map((it, idx) => renderItemRow(it, idx, productos)).join('')}
                        </tbody>
                    </table>
                </div>

            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="document.getElementById('modal-contrato').remove()">Cancelar</button>
                <button class="btn btn-primary" id="btn-guardar-cont">Guardar Contrato</button>
            </div>
        </div>`;

        document.body.appendChild(overlay);
        overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

        if (!c && prefillData) {
            const setVal = (id, val) => {
                const el = document.getElementById(id);
                if (el && val !== undefined && val !== null) el.value = val;
            };
            setVal('c-tipo', prefillData.tipo_contrato);
            setVal('c-sistema', prefillData.sistema);
            setVal('c-estatus', prefillData.estatus);
            setVal('c-cliente', prefillData.cliente_id);
            setVal('c-vendedor', prefillData.vendedor);
            setVal('c-anterior', prefillData.renta_anterior);
            setVal('c-fecha-contrato', prefillData.fecha_contrato || hoyISO());
            setVal('c-fecha-inicio', prefillData.fecha_inicio_real || hoyISO());
            setVal('c-monto', prefillData.monto_total || 0);
            setVal('c-notas', prefillData.notas || '');
            setVal('c-dir', prefillData.direccion_servicio || '');
        }

        // Calc vencimiento dinámico
        const calcVenc = () => {
            const inicio = document.getElementById('c-fecha-inicio').value;
            const dias = parseInt(document.getElementById('c-dias').value);
            if (inicio && dias) {
                const d = new Date(inicio + 'T12:00:00');
                d.setDate(d.getDate() + dias);
                document.getElementById('c-vencimiento').value = d.toISOString().split('T')[0];
            }
            const monto = parseFloat(document.getElementById('c-monto').value) || 0;
            if (monto && dias) document.getElementById('c-precio-dia').value = (monto / dias).toFixed(2);
        };
        document.getElementById('c-fecha-inicio').addEventListener('change', calcVenc);
        document.getElementById('c-dias').addEventListener('input', calcVenc);
        document.getElementById('c-monto').addEventListener('input', calcVenc);

        // Alerta venta perdida y ocultar entrega
        document.getElementById('c-tipo').addEventListener('change', e => {
            const isPerdida = e.target.value === 'venta_perdida';
            document.getElementById('alerta-venta-perdida').style.display = isPerdida ? 'flex' : 'none';
            document.getElementById('section-entrega').style.display = isPerdida ? 'none' : 'block';
        });

        // Agregar item
        document.getElementById('btn-add-item').addEventListener('click', () => {
            const tb = document.getElementById('cont-items-tbody');
            const idx = tb.children.length;
            const row = document.createElement('tr');
            row.innerHTML = renderItemRow({ id: null, producto_id: '', cantidad: 1, precio_unitario: 0 }, idx, productos);
            tb.appendChild(row);
            attachItemEvents(row, productos);
        });

        // Attach events a items existentes
        document.querySelectorAll('#cont-items-tbody tr').forEach(row => attachItemEvents(row, productos));

        // Guardar
        document.getElementById('btn-guardar-cont').addEventListener('click', () => guardar(c?.id, items));
        if (c) calcVenc();
    }

    function renderItemRow(item, idx, productos) {
        return `
        <td>
            <select class="form-control item-prod" data-idx="${idx}" style="font-size:0.78rem">
                <option value="">— Producto —</option>
                ${(productos||[]).map(p => `<option value="${p.id}" data-precio="${p.precio_lista||0}" ${parseInt(item.producto_id)===p.id?'selected':''}>${p.codigo} — ${p.nombre}</option>`).join('')}
            </select>
        </td>
        <td><input type="number" class="form-control item-cant" value="${item.cantidad||1}" min="1" style="width:80px;font-size:0.78rem"></td>
        <td><input type="number" class="form-control item-precio" value="${item.precio_unitario||0}" step="0.01" style="width:100px;font-size:0.78rem"></td>
        <td class="td-mono item-total">$${Number((item.cantidad||0)*(item.precio_unitario||0)).toLocaleString('es-MX',{minimumFractionDigits:2})}</td>
        <td><button type="button" class="btn btn-ghost btn-sm btn-del-item" style="color:var(--danger)">✕</button></td>`;
    }

    function attachItemEvents(row, productos) {
        const selProd = row.querySelector('.item-prod');
        const inCant  = row.querySelector('.item-cant');
        const inPrec  = row.querySelector('.item-precio');
        const tdTotal = row.querySelector('.item-total');
        const btnDel  = row.querySelector('.btn-del-item');

        const calcTotal = () => {
            const cant = parseFloat(inCant.value) || 0;
            const prec = parseFloat(inPrec.value) || 0;
            tdTotal.textContent = '$' + (cant * prec).toLocaleString('es-MX', { minimumFractionDigits: 2 });
        };

        selProd?.addEventListener('change', () => {
            const opt = selProd.options[selProd.selectedIndex];
            if (opt.dataset.precio) inPrec.value = opt.dataset.precio;
            calcTotal();
        });
        inCant?.addEventListener('input', calcTotal);
        inPrec?.addEventListener('input', calcTotal);
        btnDel?.addEventListener('click', () => { row.remove(); });
    }

    async function guardar(id = null, prevItems = []) {
        const clienteId = parseInt(document.getElementById('c-cliente').value);
        if (!clienteId) { App.toast('Selecciona un cliente', 'danger'); return; }

        const tipo = document.getElementById('c-tipo').value;
        const clientes = ModClientes.getClientes();
        const cliente = clientes.find(c => c.id === clienteId);

        // Recoger items
        const items = [];
        document.querySelectorAll('#cont-items-tbody tr').forEach((row, idx) => {
            const sel = row.querySelector('.item-prod');
            const cant = row.querySelector('.item-cant');
            const prec = row.querySelector('.item-precio');
            
            if (sel && cant && prec && sel.value) {
                const opt = sel.options[sel.selectedIndex];
                const partes = opt.text.split(' — ');
                const item = {
                    producto_id: parseInt(sel.value),
                    codigo: partes[0]?.trim() || '',
                    nombre: partes[1]?.trim() || partes[0]?.trim() || '',
                    cantidad: parseFloat(cant.value) || 0,
                    precio_unitario: parseFloat(prec.value) || 0,
                };
                items.push(item);
                console.log(`✓ Item ${idx + 1}:`, item);
            } else {
                console.log(`✗ Item ${idx + 1} incompleto (falta: sel=${!sel}, cant=${!cant}, prec=${!prec}, valor=${sel?.value})`);
            }
        });
        
        if (items.length === 0) {
            console.warn('⚠ Advertencia: No se agregaron ítems');
        } else {
            console.log(`✓ Total de ítems recolectados: ${items.length}`);
        }

        const payload = {
            folio: document.getElementById('c-folio').value.trim(),
            cliente_id: clienteId,
            razon_social: cliente?.razon_social || '',
            rfc_cliente: cliente?.rfc || '',
            telefono_cliente: cliente?.telefono || '',
            direccion_cliente: cliente?.direccion || '',
            tipo_contrato: tipo,
            sistema: document.getElementById('c-sistema').value,
            renta_anterior: document.getElementById('c-anterior').value,
            renta_posterior: document.getElementById('c-posterior').value,
            estatus: document.getElementById('c-estatus').value,
            fecha_contrato: document.getElementById('c-fecha-contrato').value || null,
            fecha_inicio_real: document.getElementById('c-fecha-inicio').value || null,
            dias_renta: parseInt(document.getElementById('c-dias').value) || null,
            // fecha_vencimiento se omite porque es autogenerada en la BD
            monto_total: parseFloat(document.getElementById('c-monto').value) || 0,
            anticipo: parseFloat(document.getElementById('c-anticipo').value) || 0,
            vendedor: document.getElementById('c-vendedor').value.trim() || null,
            direccion_servicio: document.getElementById('c-dir').value.trim() || null,
            contacto_entrega: document.getElementById('c-contacto-entrega')?.value.trim() || null,
            telefono_contacto_entrega: document.getElementById('c-tel-contacto')?.value.trim() || null,
            direccion_entrega: document.getElementById('c-dir-entrega')?.value.trim() || null,
            fecha_pago: document.getElementById('c-fecha-pago')?.value || null,
            forma_pago: document.getElementById('c-forma-pago')?.value || null,
            notas: document.getElementById('c-notas').value.trim() || null,
            // YA NO SE GUARDAN LOS ITEMS COMO JSONB AQUI
            // items: items,
            estatus_pago: (parseFloat(document.getElementById('c-anticipo').value) || 0) >= (parseFloat(document.getElementById('c-monto').value) || 0) ? 'liquidado' : ((parseFloat(document.getElementById('c-anticipo').value) || 0) > 0 ? 'parcial' : 'pendiente')
        };

        // ── Lógica de Folio Raíz ────────────────────────
        let folioRaiz = payload.folio;
        if (payload.renta_anterior) {
            const foliosAnt = payload.renta_anterior.split(',').map(f => f.trim());
            const primerPadre = contratos.find(c => c.folio === foliosAnt[0]);
            if (primerPadre) {
                folioRaiz = primerPadre.folio_raiz || primerPadre.folio;
            }
        }
        payload.folio_raiz = folioRaiz;
        // ────────────────────────────────────────────────
        
        if (id) {
            const res = await DB.update('ops_contratos', id, payload);
            if (res.error) {
                App.toast('Error al actualizar: ' + res.error, 'danger');
                return;
            }
            const idx = contratos.findIndex(c => c.id === id);
            contratos[idx] = { ...contratos[idx], ...payload };
            
            // Re-insertar items en ops_contratos_items
            if (!DEMO_MODE) {
                await DB.deleteWhere('ops_contratos_items', 'contrato_id', id);
                for (const it of items) {
                    if (it.codigo && it.cantidad > 0) {
                        // producto_id es el código string (FK a cat_productos(codigo))
                        await DB.insert('ops_contratos_items', { contrato_id: id, producto_id: it.codigo, cantidad: it.cantidad, precio_unitario: it.precio_unitario });
                    }
                }
            }
            contratosItems[id] = items;
            payload.items = items; // Reflejar en memoria
            App.toast('Contrato actualizado', 'success');
        } else {
            const res = await DB.insert('ops_contratos', payload);
            if (res.error) {
                App.toast('Error al guardar: ' + res.error, 'danger');
                return;
            }
            const nuevo = { ...res }; 
            
            if (!DEMO_MODE && nuevo.id) {
                for (const it of items) {
                    if (it.codigo && it.cantidad > 0) {
                        // producto_id es el código string (FK a cat_productos(codigo))
                        await DB.insert('ops_contratos_items', { contrato_id: nuevo.id, producto_id: it.codigo, cantidad: it.cantidad, precio_unitario: it.precio_unitario });
                    }
                }
            }
            
            contratos.push(nuevo);
            contratosItems[nuevo.id] = items;
            nuevo.items = items; // Reflejar en memoria
            
            // Lógica de Venta por Pérdida
            if (tipo === 'venta_perdida') {
                console.log('🔄 Procesando Venta por Pérdida...');
                try {
                    await procesarVentaPerdida(nuevo, items);
                } catch (err) {
                    App.toast('Contrato creado, pero error en HS/HE automática: ' + err.message, 'danger');
                }
            }
            App.toast('Contrato creado', 'success');
        }

        // ── Actualizar Vínculos Posteriores ─────────────
        if (payload.renta_anterior) {
            const foliosAnt = payload.renta_anterior.split(',').map(f => f.trim());
            for (const fAnt of foliosAnt) {
                const anterior = contratos.find(c => c.folio === fAnt);
                if (anterior) {
                    let post = anterior.renta_posterior ? anterior.renta_posterior.split(',').map(f => f.trim()) : [];
                    if (!post.includes(payload.folio)) {
                        post.push(payload.folio);
                        const nPost = post.join(', ');
                        await DB.update('ops_contratos', anterior.id, { renta_posterior: nPost });
                        anterior.renta_posterior = nPost;
                    }
                }
            }
        }
        // ────────────────────────────────────────────────

        document.getElementById('modal-contrato').remove();
        expandedId = null;
        renderTabla();
    }

    async function procesarVentaPerdida(contrato, items) {
        // Generar folios operativos seriales (evita colisiones por folio único)
        const [folioHS, folioHE] = await Promise.all([
            nextFolioOperativo('ops_hs', 'HS'),
            nextFolioOperativo('ops_he', 'HE')
        ]);

        // Registrar HS automática (pérdida = salida definitiva)
        const hs = {
            folio: folioHS,
            contrato_folio: contrato.folio,
            razon_social: contrato.razon_social,
            fecha: contrato.fecha_contrato,
            total_piezas: (items || []).reduce((s, i) => s + (parseFloat(i.cantidad) || 0), 0),
            estatus: 'entregada',
            notas: `HS automática por Venta por Pérdida del contrato ${contrato.folio}`,
            items: (items || []).map(i => ({ ...i, cantidad_hs: i.cantidad })),
        };
        const resHS = await DB.insert('ops_hs', hs);
        if (resHS?.error) throw new Error(`HS: ${resHS.error}`);

        const he = {
            folio: folioHE,
            contrato_folio: contrato.folio,
            razon_social: contrato.razon_social,
            fecha: contrato.fecha_contrato,
            total_piezas: (items || []).reduce((s, i) => s + (parseFloat(i.cantidad) || 0), 0),
            estatus: 'entregada',
            vaciado_fabricacion: false,
            notas: `HE automática por Venta por Pérdida del contrato ${contrato.folio}`,
            items: (items || []).map(i => ({ ...i, cantidad_recolectada: i.cantidad, estado: 'pendiente_clasificacion' })),
        };
        const resHE = await DB.insert('ops_he', he);
        if (resHE?.error) throw new Error(`HE: ${resHE.error}`);

        App.toast(`⚠ Venta por Pérdida: HS y HE (${folioHS}/${folioHE}) generadas`, 'warning');
    }

    async function prepararVentaPorPerdidaDesdeSeguimiento(contratoId) {
        let contratoBase = contratos.find(c => c.id === contratoId);
        if (!contratoBase) {
            const todos = (await DB.getAll('ops_contratos', { orderBy: 'folio', ascending: false })) || [];
            contratoBase = todos.find(c => c.id === contratoId);
        }
        if (!contratoBase) {
            App.toast('No se encontró el contrato base', 'danger');
            return;
        }

        const itemsContrato = (contratosItems[contratoId] && contratosItems[contratoId].length)
            ? contratosItems[contratoId]
            : (contratoBase.items || []);
        if (!itemsContrato.length) {
            App.toast('El contrato no tiene despiece para calcular pérdida', 'danger');
            return;
        }

        const [todasHS, todasHE] = await Promise.all([DB.getAll('ops_hs'), DB.getAll('ops_he')]);

        const hsContrato = (todasHS || []).filter(h => folioIgual(h.contrato_folio, contratoBase.folio));
        const heContrato = (todasHE || []).filter(h => folioIgual(h.contrato_folio, contratoBase.folio));

        const entregadoMap = {};
        hsContrato.forEach(h => {
            (h.items || []).forEach(it => {
                const cantidad = parseFloat(it.cantidad_hs || it.cantidad) || 0;
                entregadoMap[it.producto_id] = (entregadoMap[it.producto_id] || 0) + cantidad;
            });
        });

        const recolectadoMap = {};
        heContrato.forEach(h => {
            (h.items || []).forEach(it => {
                const cantidad = parseFloat(it.cantidad_recolectada || it.cantidad) || 0;
                recolectadoMap[it.producto_id] = (recolectadoMap[it.producto_id] || 0) + cantidad;
            });
        });

        const itemsPerdida = itemsContrato
            .map(it => {
                const entregado = entregadoMap[it.producto_id] || 0;
                const recolectado = recolectadoMap[it.producto_id] || 0;
                const faltante = Math.max(0, entregado - recolectado);
                return faltante > 0 ? { ...it, cantidad: faltante } : null;
            })
            .filter(Boolean);

        if (!itemsPerdida.length) {
            App.toast('No hay equipo faltante por recolectar para cobrar como pérdida', 'warning');
            return;
        }

        const montoTotal = itemsPerdida.reduce((sum, it) => sum + ((parseFloat(it.precio_unitario) || 0) * (parseFloat(it.cantidad) || 0)), 0);
        abrirModal(null, {
            tipo_contrato: 'venta_perdida',
            sistema: contratoBase.sistema || 'Otros',
            cliente_id: contratoBase.cliente_id,
            renta_anterior: contratoBase.folio,
            estatus: 'activo',
            fecha_contrato: hoyISO(),
            fecha_inicio_real: hoyISO(),
            monto_total: montoTotal,
            vendedor: contratoBase.vendedor || null,
            direccion_servicio: contratoBase.direccion_servicio || null,
            notas: `Generado desde seguimiento por equipo faltante de recolectar del contrato ${contratoBase.folio}`,
            items: itemsPerdida,
        });
    }

    // ── Generación de PDF ─────────────────────────────
    function generarPDF(contratoId) {
        const c = contratos.find(x => x.id === contratoId);
        if (!c) {
            App.toast('Contrato no encontrado', 'danger');
            return;
        }
        const items = contratosItems[contratoId] || [];

        try {
            App.toast('Generando documento PDF...', 'info');
            PDFGenerator.generate(c, items);
            App.toast(`PDF del contrato ${c.folio} descargado exitosamente`, 'success');
        } catch (err) {
            console.error('Error generando PDF:', err);
            App.toast('Error generando PDF: ' + err.message, 'danger');
        }
    }

    // ── Utilidades (delegadas a Utils) ────────────────
    function nextFolio() {
        if (!contratos.length) return '20001';
        return String(Math.max(...contratos.map(c => parseInt(c.folio) || 20000)) + 1);
    }

    // Aliases locales que apuntan a Utils (para compatibilidad interna)
    const hoyISO = Utils.hoyISO;
    const fmtFecha = Utils.fmtFecha;
    const colorVencimiento = Utils.colorVencimiento;
    const calcularEstatusEntrega = Utils.calcularEstatusEntrega;
    const calcularEstatusRecoleccion = Utils.calcularEstatusRecoleccion;
    const folioIgual = Utils.folioIgual;

    async function nextFolioOperativo(tabla, prefijo) {
        const rows = (await DB.getAll(tabla, { orderBy: 'folio', ascending: false })) || [];
        const re = new RegExp(`^${prefijo}-(\\d+)$`);
        let maxNum = 0;
        rows.forEach(r => {
            const folio = String(r?.folio || '').trim();
            const m = folio.match(re);
            if (m) maxNum = Math.max(maxNum, parseInt(m[1], 10) || 0);
        });
        return `${prefijo}-${String(maxNum + 1).padStart(3, '0')}`;
    }

    async function crearSolicitud(tipo, contratoId) {
        const c = contratos.find(x => x.id === contratoId);
        if (!c) return;
        const items = contratosItems[contratoId] || [];

        const solicitud = {
            tipo,
            contrato_id: contratoId,
            folio_contrato: c.folio,
            fecha_programada: new Date().toISOString().split('T')[0],
            estatus: 'pendiente',
            datos_entrega: {
                contacto: c.contacto_entrega,
                telefono: c.telefono_contacto_entrega,
                direccion: c.direccion_entrega || c.direccion_servicio
            },
            items: items.map(i => ({ codigo: i.producto_id || i.codigo, nombre: i.nombre, cantidad: i.cantidad }))
        };

        const res = await DB.insert('ops_solicitudes', solicitud);
        if (res.error) {
            App.toast('Error al crear solicitud: ' + res.error, 'danger');
            return;
        }

        // ────────────────────────────────────────────────

        document.getElementById('modal-contrato').remove();
        expandedId = null;
        renderTabla();
    }

    async function procesarVentaPerdida(contrato, items) {
        const [folioHS, folioHE] = await Promise.all([
            nextFolioOperativo('ops_hs', 'HS'),
            nextFolioOperativo('ops_he', 'HE')
        ]);

        const hs = {
            folio: folioHS,
            contrato_folio: contrato.folio,
            razon_social: contrato.razon_social,
            fecha: contrato.fecha_contrato,
            total_piezas: (items || []).reduce((s, i) => s + (parseFloat(i.cantidad) || 0), 0),
            estatus: 'entregada',
            notas: `HS automática por Venta por Pérdida del contrato ${contrato.folio}`,
            items: (items || []).map(i => ({ ...i, cantidad_hs: i.cantidad })),
        };
        const resHS = await DB.insert('ops_hs', hs);
        if (resHS?.error) throw new Error(`HS: ${resHS.error}`);

        const he = {
            folio: folioHE,
            contrato_folio: contrato.folio,
            razon_social: contrato.razon_social,
            fecha: contrato.fecha_contrato,
            total_piezas: (items || []).reduce((s, i) => s + (parseFloat(i.cantidad) || 0), 0),
            estatus: 'entregada',
            vaciado_fabricacion: false,
            notas: `HE automática por Venta por Pérdida del contrato ${contrato.folio}`,
            items: (items || []).map(i => ({ ...i, cantidad_recolectada: i.cantidad, estado: 'pendiente_clasificacion' })),
        };
        const resHE = await DB.insert('ops_he', he);
        if (resHE?.error) throw new Error(`HE: ${resHE.error}`);

        App.toast(`⚠ Venta por Pérdida: HS y HE (${folioHS}/${folioHE}) generadas`, 'warning');
    }

    async function prepararVentaPorPerdidaDesdeSeguimiento(contratoId) {
        let contratoBase = contratos.find(c => c.id === contratoId);
        if (!contratoBase) {
            const todos = (await DB.getAll('ops_contratos', { orderBy: 'folio', ascending: false })) || [];
            contratoBase = todos.find(c => c.id === contratoId);
        }
        if (!contratoBase) {
            App.toast('No se encontró el contrato base', 'danger');
            return;
        }

        const itemsContrato = (contratosItems[contratoId] && contratosItems[contratoId].length)
            ? contratosItems[contratoId]
            : (contratoBase.items || []);
        
        const [todasHS, todasHE] = await Promise.all([DB.getAll('ops_hs'), DB.getAll('ops_he')]);
        const hsContrato = (todasHS || []).filter(h => Utils.folioIgual(h.contrato_folio, contratoBase.folio));
        const heContrato = (todasHE || []).filter(h => Utils.folioIgual(h.contrato_folio, contratoBase.folio));

        const entregadoMap = {};
        hsContrato.forEach(h => {
            (h.items || []).forEach(it => {
                const cantidad = parseFloat(it.cantidad_hs || it.cantidad) || 0;
                entregadoMap[it.producto_id] = (entregadoMap[it.producto_id] || 0) + cantidad;
            });
        });

        const recolectadoMap = {};
        heContrato.forEach(h => {
            (h.items || []).forEach(it => {
                const cantidad = parseFloat(it.cantidad_recolectada || it.cantidad) || 0;
                recolectadoMap[it.producto_id] = (recolectadoMap[it.producto_id] || 0) + cantidad;
            });
        });

        const itemsPerdida = itemsContrato
            .map(it => {
                const entregado = entregadoMap[it.producto_id] || 0;
                const recolectado = recolectadoMap[it.producto_id] || 0;
                const faltante = Math.max(0, entregado - recolectado);
                return faltante > 0 ? { ...it, cantidad: faltante } : null;
            })
            .filter(Boolean);

        if (!itemsPerdida.length) {
            App.toast('No hay equipo faltante por recolectar para cobrar como pérdida', 'warning');
            return;
        }

        const montoTotal = itemsPerdida.reduce((sum, it) => sum + ((parseFloat(it.precio_unitario) || 0) * (parseFloat(it.cantidad) || 0)), 0);
        abrirModal(null, {
            tipo_contrato: 'venta_perdida',
            sistema: contratoBase.sistema || 'Otros',
            cliente_id: contratoBase.cliente_id,
            renta_anterior: contratoBase.folio,
            estatus: 'activo',
            fecha_contrato: Utils.hoyISO(),
            fecha_inicio_real: Utils.hoyISO(),
            monto_total: montoTotal,
            vendedor: contratoBase.vendedor || null,
            direccion_servicio: contratoBase.direccion_servicio || null,
            notas: `Generado desde seguimiento por equipo faltante de recolectar del contrato ${contratoBase.folio}`,
            items: itemsPerdida,
        });
    }

    function generarPDF(contratoId) {
        const c = contratos.find(x => x.id === contratoId);
        if (!c) return;
        const items = contratosItems[contratoId] || [];
        try {
            App.toast('Generando documento PDF...', 'info');
            PDFGenerator.generate(c, items);
        } catch (err) {
            console.error('Error generando PDF:', err);
            App.toast('Error generando PDF: ' + err.message, 'danger');
        }
    }

    async function crearSolicitud(tipo, contratoId) {
        const c = contratos.find(x => x.id === contratoId);
        if (!c) return;
        const items = contratosItems[contratoId] || [];
        const solicitud = {
            tipo,
            contrato_id: contratoId,
            folio_contrato: c.folio,
            fecha_programada: new Date().toISOString().split('T')[0],
            estatus: 'pendiente',
            items: items.map(i => ({ codigo: i.producto_id || i.codigo, nombre: i.nombre, cantidad: i.cantidad }))
        };
        const res = await DB.insert('ops_solicitudes', solicitud);
        if (res.error) {
            App.toast('Error al crear solicitud: ' + res.error, 'danger');
            return;
        }
        App.toast(`Solicitud de ${tipo} creada`, 'success');
        if (PDFGenerator) PDFGenerator.generate(tipo === 'entrega' ? 'SOLICITUD_ENTREGA' : 'SOLICITUD_RECOLECCION', c, solicitud.items);
    }

    function nextFolio() {
        if (!contratos.length) return '20001';
        return String(Math.max(...contratos.map(c => parseInt(c.folio) || 20000)) + 1);
    }

    async function nextFolioOperativo(tabla, prefijo) {
        const rows = (await DB.getAll(tabla, { orderBy: 'folio', ascending: false })) || [];
        const re = new RegExp(`^${prefijo}-(\\d+)$`);
        let maxNum = 0;
        rows.forEach(r => {
            const m = String(r?.folio || '').match(re);
            if (m) maxNum = Math.max(maxNum, parseInt(m[1], 10) || 0);
        });
        return `${prefijo}-${String(maxNum + 1).padStart(3, '0')}`;
    }

    // Filtrar clientes en el select por nombre o RFC
    function filtrarClientes(texto) {
        const select = document.getElementById('c-cliente');
        const buscar = texto.toLowerCase().trim();
        let opciones = select.options;
        let encontrados = 0;
        
        for (let i = 1; i < opciones.length; i++) {
            const opt = opciones[i];
            const nombre = (opt.getAttribute('data-nombre') || '').toLowerCase();
            const rfc = (opt.getAttribute('data-rfc') || '').toLowerCase();
            const coincide = buscar === '' || nombre.includes(buscar) || rfc.includes(buscar);
            opt.style.display = coincide ? '' : 'none';
            if (coincide) encontrados++;
        }
        
        // Mostrar mensaje si no hay resultados
        let msg = document.getElementById('cliente-buscar-mensaje');
        if (encontrados === 0 && buscar !== '') {
            if (!msg) {
                msg = document.createElement('div');
                msg.id = 'cliente-buscar-mensaje';
                msg.style.cssText = 'color:var(--danger);font-size:0.8rem;margin-top:0.25rem';
                select.parentNode.appendChild(msg);
            }
            msg.textContent = `No se encontraron clientes con "${texto}"`;
            msg.style.display = 'block';
        } else if (msg) {
            msg.style.display = 'none';
        }
    }

    // Seleccionar cliente del dropdown filtrado
    function seleccionarCliente(id) {
        const select = document.getElementById('c-cliente');
        const msg = document.getElementById('cliente-buscar-mensaje');
        const info = document.getElementById('c-cliente-seleccionado');
        
        if (id) {
            const opt = select.options[select.selectedIndex];
            const nombre = opt.getAttribute('data-nombre') || '';
            if (info) {
                info.textContent = '✓ ' + nombre;
                info.style.display = 'block';
            }
            if (msg) msg.style.display = 'none';
        } else {
            if (info) info.style.display = 'none';
        }
    }

    return { 
        render, 
        getContratos: () => contratos, 
        getItems: id => contratosItems[id] || [], 
        generarPDF, 
        prepararVentaPorPerdidaDesdeSeguimiento,
        crearSolicitud,
        cargar: cargarContratos,
        filtrarClientes,
        seleccionarCliente
    };
})();
