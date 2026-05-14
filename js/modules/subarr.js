import { DB, DEMO_MODE } from '../supabase-client.js';
import { Utils } from '../utils.js';

/**
 * ICAM 360 - Módulo Sub-Arrendamiento (ops_subarriendos)
 * Gestión de equipo sub-arrendado a proveedores externos:
 *   → Al recibir equipo: genera HE automática + suma a inventario
 *   → Al devolver equipo: genera HS automática + resta de inventario
 */
export const ModSubArr = (() => {
    let saData = [];
    let filtro = '';
    let filtroEstatus = 'todos';

    // ── Render principal ──────────────────────────────────────
    function render() {
        const mc = document.getElementById('module-content');
        mc.innerHTML = `
        <div class="page-toolbar">
            <div class="page-toolbar-left">
                <div class="search-box">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    <input id="sa-search" type="text" placeholder="Folio SARR, proveedor, contrato destino…" value="${filtro}">
                </div>
                <select id="sa-filtro-est" class="form-control" style="width:160px;font-size:0.82rem;height:36px">
                    <option value="todos"   ${filtroEstatus==='todos'   ?'selected':''}>Todos los estatus</option>
                    <option value="activo"  ${filtroEstatus==='activo'  ?'selected':''}>Activos</option>
                    <option value="devuelto"${filtroEstatus==='devuelto'?'selected':''}>Devueltos</option>
                    <option value="cancelado"${filtroEstatus==='cancelado'?'selected':''}>Cancelados</option>
                </select>
            </div>
            <div class="page-toolbar-right">
                <button class="btn btn-primary" id="btn-nuevo-sa">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    Nuevo Sub-Arrendamiento
                </button>
            </div>
        </div>

        <!-- KPIs -->
        <div class="stats-grid" id="sa-kpis">
            <div class="stat-card">
                <div class="stat-icon" style="background:var(--primary-light);color:var(--primary)">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
                </div>
                <div class="stat-label">Sub-Arr. Activos</div>
                <div class="stat-value" id="kpi-sa-activos">—</div>
                <div class="stat-change up">Contratos en curso</div>
            </div>
            <div class="stat-card">
                <div class="stat-icon" style="background:var(--info-light);color:var(--info)">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>
                </div>
                <div class="stat-label">Piezas en Sub-Renta</div>
                <div class="stat-value" id="kpi-sa-piezas">—</div>
                <div class="stat-change up">Equipo de proveedor</div>
            </div>
            <div class="stat-card">
                <div class="stat-icon" style="background:var(--warning-light);color:var(--warning)">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                </div>
                <div class="stat-label">Costo Acumulado</div>
                <div class="stat-value" id="kpi-sa-costo">—</div>
                <div class="stat-change down">Total a pagar (activos)</div>
            </div>
            <div class="stat-card">
                <div class="stat-icon" style="background:var(--success-light);color:var(--success)">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
                </div>
                <div class="stat-label">Devueltos</div>
                <div class="stat-value" id="kpi-sa-devueltos">—</div>
                <div class="stat-change up">Ciclos completados</div>
            </div>
        </div>

        <!-- Tabla -->
        <div class="table-wrapper">
            <table>
                <thead>
                    <tr>
                        <th>Folio</th>
                        <th>Proveedor</th>
                        <th>Contrato Destino</th>
                        <th>Fecha Inicio</th>
                        <th>Devolución</th>
                        <th>Días</th>
                        <th>Piezas</th>
                        <th>Costo Acum.</th>
                        <th>Estatus</th>
                        <th>Acciones</th>
                    </tr>
                </thead>
                <tbody id="sa-tbody">
                    <tr><td colspan="9"><div class="loading-center"><div class="spinner"></div></div></td></tr>
                </tbody>
            </table>
        </div>`;

        document.getElementById('sa-search').addEventListener('input', e => { filtro = e.target.value; renderTabla(); });
        document.getElementById('sa-filtro-est').addEventListener('change', e => { filtroEstatus = e.target.value; renderTabla(); });
        document.getElementById('btn-nuevo-sa').onclick = () => ModSubArr.abrirModalNuevo();
        cargarSA();
    }

    // ── Carga de datos ────────────────────────────────────────
    async function cargarSA() {
        try {
            const raw = await DB.getAll('ops_subarriendos', { orderBy: 'folio', ascending: false });
            saData = raw || dataSeed();
            renderKPIs();
            renderTabla();
        } catch (err) {
            console.error('SubArr: Error en cargarSA:', err);
            App.toast('Error al cargar datos de Sub-Arrendamiento', 'danger');
        }
    }

    function dataSeed() {
        return [
            {
                id: 1,
                folio: 'SARR-001',
                proveedor: 'Layher México SA de CV',
                contrato_destino_folio: '20001',
                razon_social_destino: 'CONSTRUCTORA TORRES DEL NORTE SA DE CV',
                fecha_inicio: '2026-03-10',
                dias_renta: 30,
                fecha_devolucion: '2026-04-09',
                costo_unitario_dia: 8.50,
                estatus: 'activo',
                folio_he: 'HE-SARR-001',
                folio_hs: null,
                notas: 'Equipo extra para refuerzo de obra norte',
                items: [
                    { producto_id: 1, codigo: 'AND-001', nombre: 'Andamio Tubular 1.56x1.00m', cantidad: 60 },
                    { producto_id: 3, codigo: 'TAB-001', nombre: 'Tablón de Madera 3.00m', cantidad: 20 },
                ],
            },
            {
                id: 2,
                folio: 'SARR-002',
                proveedor: 'Andamios Rentables del Norte SA',
                contrato_destino_folio: '20002',
                razon_social_destino: 'EDIFICACIONES MONTERREY SA DE CV',
                fecha_inicio: '2026-02-15',
                fecha_devolucion: '2026-03-20',
                dias_renta: 33,
                costo_unitario_dia: 6.00,
                estatus: 'devuelto',
                folio_he: 'HE-SARR-002',
                folio_hs: 'HS-SARR-002',
                notas: null,
                items: [
                    { producto_id: 1, codigo: 'AND-001', nombre: 'Andamio Tubular 1.56x1.00m', cantidad: 30 },
                ],
            },
        ];
    }

    // ── KPIs ──────────────────────────────────────────────────
    function renderKPIs() {
        const activos   = saData.filter(s => s.estatus === 'activo');
        const devueltos = saData.filter(s => s.estatus === 'devuelto').length;
        const piezas    = activos.reduce((t, s) => t + totalPiezas(s), 0);
        const costo     = activos.reduce((t, s) => t + calcCosto(s), 0);

        const d = document;
        const el = id => d.getElementById(id);
        if (el('kpi-sa-activos'))  el('kpi-sa-activos').textContent  = activos.length;
        if (el('kpi-sa-piezas'))   el('kpi-sa-piezas').textContent   = piezas.toLocaleString('es-MX');
        if (el('kpi-sa-costo'))    el('kpi-sa-costo').textContent    = `$${costo.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;
        if (el('kpi-sa-devueltos'))el('kpi-sa-devueltos').textContent = devueltos;
    }

    // ── Tabla ─────────────────────────────────────────────────
    function renderTabla() {
        const tbody = document.getElementById('sa-tbody');
        if (!tbody) return;
        const f = filtro.toLowerCase();
        const data = saData.filter(s => {
            const matchFiltro =
                (s.folio||'').toLowerCase().includes(f) ||
                (s.proveedor||'').toLowerCase().includes(f) ||
                (s.contrato_destino_folio||'').toLowerCase().includes(f) ||
                (s.razon_social_destino||'').toLowerCase().includes(f);
            const matchEstatus = filtroEstatus === 'todos' || s.estatus === filtroEstatus;
            return matchFiltro && matchEstatus;
        });

        if (!data.length) {
            tbody.innerHTML = `<tr><td colspan="9"><div class="empty-state">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
                <h3>Sin contratos de sub-arrendamiento</h3>
                <p>Registra el primer sub-arrendamiento con el botón de arriba.</p>
            </div></td></tr>`;
            return;
        }

        tbody.innerHTML = data.map(s => {
            const dias  = calcDias(s);
            const costo = calcCosto(s);
            const pzas  = totalPiezas(s);
            const isVencido = s.estatus === 'activo' && s.fecha_devolucion && (new Date(s.fecha_devolucion + 'T12:00:00') < new Date());
            const devolucionHtml = s.fecha_devolucion
                ? `<span style="font-weight:700;color:${isVencido ? 'var(--danger)' : 'var(--text-main)'}">${fmtFecha(s.fecha_devolucion)}</span>`
                : '—';
            return `
            <tr>
                <td class="td-mono" style="font-weight:700">${s.folio}</td>
                <td><strong style="color:var(--text-main);font-size:0.8rem">${s.proveedor}</strong></td>
                <td>
                    <div class="td-mono" style="font-size:0.75rem">${s.contrato_destino_folio || '—'}</div>
                    <div style="font-size:0.72rem;color:var(--text-muted)">${truncar(s.razon_social_destino, 28)}</div>
                </td>
                <td>${fmtFecha(s.fecha_inicio)}</td>
                <td>${devolucionHtml}</td>
                <td class="td-mono">${dias} días</td>
                <td class="td-mono">${pzas} pzas</td>
                <td class="td-mono" style="font-weight:700;color:var(--warning)">$${costo.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td>
                <td>${badgeEstatus(s.estatus)}</td>
                <td>
                    <div class="flex gap-2">
                        <button class="btn btn-secondary btn-sm" onclick="ModSubArr.verEstadoCuenta(${s.id})">Estado</button>
                        ${s.estatus === 'activo' ? `<button class="btn btn-primary btn-sm" onclick="ModSubArr.abrirDevolucion(${s.id})">Devolver</button>` : ''}
                    </div>
                </td>
            </tr>`;
        }).join('');
    }

    // ── Modal: Nuevo Sub-Arrendamiento ────────────────────────
    async function abrirModalNuevo() {
        console.log('SubArr: Abriendo modal nuevo...');
        // Asegurar que los datos base estén cargados
        const ModP = window.ModProductos;
        const ModC = window.ModContratos;

        try {
            if (ModP && ModP.getProductos().length === 0) {
                console.log('SubArr: Cargando productos...');
                await ModP.cargar();
            }
            if (ModC && ModC.getContratos().length === 0) {
                console.log('SubArr: Cargando contratos...');
                await ModC.cargar();
            }
        } catch (err) {
            console.error('SubArr: Error cargando datos base:', err);
            App.toast('Error al cargar datos necesarios. Revisa la consola.', 'danger');
        }

        const productos  = ModP ? ModP.getProductos() : [];
        const contratos  = ModC ? ModC.getContratos() : [];
        console.log(`SubArr: Datos listos. Prods: ${productos.length}, Contratos: ${contratos.length}`);
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.id = 'modal-sa-nuevo';
        overlay.innerHTML = `
        <div class="modal modal-xl">
            <div class="modal-header">
                <div>
                    <div class="modal-title">Nuevo Sub-Arrendamiento</div>
                    <div class="modal-subtitle">El equipo ingresará al inventario mediante una HE automática</div>
                </div>
                <button class="modal-close" onclick="document.getElementById('modal-sa-nuevo').remove()">✕</button>
            </div>
            <div class="modal-body">

                <div class="form-row cols-3">
                    <div class="form-group">
                        <label class="form-label">Folio SARR</label>
                        <input id="sa-folio" class="form-control td-mono" value="${nextFolio()}" readonly style="background:var(--bg-elevated)">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Proveedor <span class="required">*</span></label>
                        <input id="sa-proveedor" class="form-control" placeholder="Ej. Layher México SA de CV" value="Layher México SA de CV">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Fecha de Inicio (Recepción) <span class="required">*</span></label>
                        <input id="sa-fecha-inicio" type="date" class="form-control" value="${hoyISO()}">
                    </div>
                </div>

                <div class="form-row cols-2">
                    <div class="form-group">
                        <label class="form-label">Contrato de Destino</label>
                        <select id="sa-contrato" class="form-control">
                            <option value="">— Selecciona contrato —</option>
                            ${contratos.filter(c => ['activo','entrega_parcial','borrador'].includes(c.estatus)).map(c =>
                                `<option value="${c.id}">${c.folio} — ${c.razon_social}</option>`
                            ).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Costo Unitario / Día (por pieza) <span class="required">*</span></label>
                        <input id="sa-costo-dia" type="number" class="form-control" placeholder="0.00" min="0" step="0.01">
                    </div>
                </div>

                <div class="form-row cols-2">
                    <div class="form-group">
                        <label class="form-label">Días de renta <span class="required">*</span></label>
                        <input id="sa-dias-renta" type="number" class="form-control" min="1" step="1" value="1">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Fecha de Devolución (automática)</label>
                        <input id="sa-fecha-devolucion" type="date" class="form-control" readonly style="background:var(--bg-elevated)">
                    </div>
                </div>

                <div class="alert alert-info">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                    <span>Al guardar se generará automáticamente una <strong>Hoja de Entrada (HE)</strong> y el equipo se sumará al inventario disponible.</span>
                </div>

                <!-- Items -->
                <div style="font-weight:700;margin-bottom:.75rem;color:var(--text-main)">Equipo a Sub-Arrendar</div>
                <div id="sa-items-lista">
                    <div class="sa-item-row" data-idx="0" style="display:grid;grid-template-columns:1fr 2fr 90px 36px;gap:.75rem;align-items:end;margin-bottom:.75rem">
                        <div class="form-group" style="margin:0">
                            <label class="form-label">Código</label>
                            <select class="form-control sa-item-prod" onchange="ModSubArr._onProdChange(this)">
                                <option value="">— Producto —</option>
                                ${productos.map(p => `<option value="${p.id}" data-codigo="${p.codigo}" data-nombre="${p.nombre}">${p.codigo} — ${p.nombre}</option>`).join('')}
                            </select>
                        </div>
                        <div class="form-group" style="margin:0">
                            <label class="form-label">Descripción</label>
                            <input class="form-control sa-item-nombre" readonly style="background:var(--bg-elevated);font-size:0.78rem" placeholder="(se llena al elegir producto)">
                        </div>
                        <div class="form-group" style="margin:0">
                            <label class="form-label">Cantidad</label>
                            <input type="number" class="form-control sa-item-cant" min="1" value="" placeholder="0">
                        </div>
                        <div style="padding-bottom:2px">
                            <button class="btn btn-secondary btn-sm" style="padding:6px 8px" onclick="ModSubArr._eliminarItemRow(this)">✕</button>
                        </div>
                    </div>
                </div>
                <button class="btn btn-secondary btn-sm" style="margin-top:.25rem" onclick="ModSubArr._agregarItemRow()">+ Agregar producto</button>

                <div class="form-group mt-4">
                    <label class="form-label">Notas</label>
                    <textarea id="sa-notas" class="form-control" placeholder="Motivo del sub-arrendamiento, condiciones especiales…"></textarea>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="document.getElementById('modal-sa-nuevo').remove()">Cancelar</button>
                <button class="btn btn-primary" id="btn-guardar-sa">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                    Registrar y Generar HE
                </button>
            </div>
        </div>`;
        document.body.appendChild(overlay);
        overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
        document.getElementById('btn-guardar-sa').addEventListener('click', guardarNuevo);

        const fechaInicioEl = document.getElementById('sa-fecha-inicio');
        const diasEl = document.getElementById('sa-dias-renta');
        const fechaDevEl = document.getElementById('sa-fecha-devolucion');
        const recalcularDev = () => {
            const f = fechaInicioEl.value;
            const d = parseInt(diasEl.value, 10) || 0;
            if (!f || d <= 0) { fechaDevEl.value = ''; return; }
            const base = new Date(f + 'T12:00:00');
            base.setDate(base.getDate() + d);
            fechaDevEl.value = base.toISOString().slice(0, 10);
        };
        fechaInicioEl.addEventListener('change', recalcularDev);
        diasEl.addEventListener('input', recalcularDev);
        recalcularDev();

        // EVENTO: Cargar items automáticamente al elegir contrato
        document.getElementById('sa-contrato').addEventListener('change', e => {
            const contratoId = parseInt(e.target.value);
            if (!contratoId) return;
            
            const contrato = (ModContratos ? ModContratos.getContratos() : []).find(c => c.id === contratoId);
            // Los items pueden venir del campo .items (Supabase) o de ModContratos.getItems (local)
            const itemsContrato = contrato?.items || (ModContratos ? ModContratos.getItems(contratoId) : []);
            
            if (itemsContrato && itemsContrato.length > 0) {
                const lista = document.getElementById('sa-items-lista');
                lista.innerHTML = ''; // Limpiar actuales
                itemsContrato.forEach(it => {
                    _agregarItemRow({
                        producto_id: it.producto_id,
                        codigo: it.codigo,
                        nombre: it.nombre
                    });
                });
                App.toast(`Cargados ${itemsContrato.length} productos del contrato`, 'info');
            }
        });
    }

    // ── Helpers de filas de items en el modal ─────────────────
    function _agregarItemRow(preData = null) {
        const lista = document.getElementById('sa-items-lista');
        if (!lista) return;
        const idx = lista.querySelectorAll('.sa-item-row').length;
        const ModP = window.ModProductos;
        const productos = ModP ? ModP.getProductos() : [];
        const div = document.createElement('div');
        div.className = 'sa-item-row';
        div.dataset.idx = idx;
        div.style.cssText = 'display:grid;grid-template-columns:1fr 2fr 90px 36px;gap:.75rem;align-items:end;margin-bottom:.75rem';
        div.innerHTML = `
            <div class="form-group" style="margin:0">
                <label class="form-label">Código</label>
                <select class="form-control sa-item-prod" onchange="ModSubArr._onProdChange(this)">
                    <option value="">— Producto —</option>
                    ${productos.map(p => `
                        <option value="${p.id}" 
                            data-codigo="${p.codigo}" 
                            data-nombre="${p.nombre}"
                            ${preData && parseInt(preData.producto_id) === p.id ? 'selected' : ''}
                        >
                            ${p.codigo} — ${p.nombre}
                        </option>`).join('')}
                </select>
            </div>
            <div class="form-group" style="margin:0">
                <label class="form-label">Descripción</label>
                <input class="form-control sa-item-nombre" readonly style="background:var(--bg-elevated);font-size:0.78rem" 
                    value="${preData ? preData.nombre : ''}" 
                    placeholder="(se llena al elegir producto)">
            </div>
            <div class="form-group" style="margin:0">
                <label class="form-label">Cantidad</label>
                <input type="number" class="form-control sa-item-cant" min="1" value="" placeholder="0">
            </div>
            <div style="padding-bottom:2px">
                <button class="btn btn-secondary btn-sm" style="padding:6px 8px" onclick="ModSubArr._eliminarItemRow(this)">✕</button>
            </div>`;
        lista.appendChild(div);
    }

    function _onProdChange(sel) {
        const opt = sel.options[sel.selectedIndex];
        const row = sel.closest('.sa-item-row');
        if (row) {
            const nombreInput = row.querySelector('.sa-item-nombre');
            if (nombreInput) nombreInput.value = opt.dataset.nombre || '';
        }
    }

    function _eliminarItemRow(btn) {
        const row = btn.closest('.sa-item-row');
        const lista = document.getElementById('sa-items-lista');
        if (lista && lista.querySelectorAll('.sa-item-row').length > 1) {
            row.remove();
        } else {
            App.toast('Debe haber al menos un producto', 'warning');
        }
    }

    // ── Guardar nuevo sub-arrendamiento ───────────────────────
    async function guardarNuevo() {
        const proveedor   = document.getElementById('sa-proveedor').value.trim();
        const contratoId  = parseInt(document.getElementById('sa-contrato').value);
        const fechaInicio = document.getElementById('sa-fecha-inicio').value;
        const diasRenta   = parseInt(document.getElementById('sa-dias-renta').value, 10) || 0;
        const fechaDevAuto = document.getElementById('sa-fecha-devolucion').value || null;
        const costoUnDia  = parseFloat(document.getElementById('sa-costo-dia').value) || 0;
        const notas       = document.getElementById('sa-notas').value.trim();

        if (!proveedor)  { App.toast('Ingresa el proveedor', 'danger'); return; }
        // Se quitó la restricción obligatoria del contrato de destino a petición del usuario
        // if (!contratoId) { App.toast('Selecciona el contrato de destino', 'danger'); return; }
        if (!fechaInicio){ App.toast('Selecciona la fecha de inicio', 'danger'); return; }
        if (diasRenta <= 0) { App.toast('Ingresa los días de renta', 'danger'); return; }
        if (costoUnDia <= 0) { App.toast('Ingresa el costo unitario por día', 'danger'); return; }

        // Recopilar items
        const items = [];
        document.querySelectorAll('.sa-item-row').forEach(row => {
            const sel  = row.querySelector('.sa-item-prod');
            const cant = parseInt(row.querySelector('.sa-item-cant').value) || 0;
            if (sel && sel.value && cant > 0) {
                const opt = sel.options[sel.selectedIndex];
                items.push({
                    producto_id: parseInt(sel.value),
                    codigo: opt.dataset.codigo || '',
                    nombre: opt.dataset.nombre || row.querySelector('.sa-item-nombre').value,
                    cantidad: cant,
                });
            }
        });

        if (!items.length) { App.toast('Agrega al menos un producto con cantidad', 'danger'); return; }

        const ModC = window.ModContratos;
        const contratos = ModC ? ModC.getContratos() : [];
        const contrato  = contratos.find(c => c.id === contratoId);

        const folioSA  = document.getElementById('sa-folio').value;
        const folioHE  = nextFolioHE();
        const piezas   = items.reduce((s, i) => s + i.cantidad, 0);

        // Crear el sub-arrendamiento
        const nuevaSA = {
            folio: folioSA,
            proveedor,
            contrato_destino_folio: contrato?.folio || '',
            razon_social_destino:   contrato?.razon_social || '',
            fecha_inicio:  fechaInicio,
            dias_renta: diasRenta,
            fecha_devolucion: fechaDevAuto,
            costo_unitario_dia: costoUnDia,
            estatus: 'activo',
            folio_he: folioHE,
            folio_hs: null,
            notas: notas || null,
            items,
        };

        const resSA = await DB.insert('ops_subarriendos', nuevaSA);
        if (resSA.error) {
            App.toast('Error al guardar Sub-Arrendamiento: ' + resSA.error, 'danger');
            return;
        }

        // NOTA: La HE se crea automáticamente por trigger en Supabase (trg_subarr_crear_he)
        // Si el trigger está deshabilitado, descomenta el código de abajo:
        /*
        // Generar HE automática e inyectarla en la base de datos
        const nuevaHE = {
            folio: folioHE,
            contrato_folio: contrato?.folio || 'SARR-STOCK-INTERNO',
            razon_social: `[SUB-ARR] ${proveedor}`,
            fecha: fechaInicio,
            total_piezas: piezas,
            estatus: 'recibido',
            vaciado_fabricacion: true,
            tipo: 'subarr',
            referencia_sa: folioSA,
            items: items.map(i => ({
                ...i,
                cantidad_recolectada: i.cantidad,
                estado: 'limpio_funcional',
            })),
        };

        const resHE = await DB.insert('ops_he', nuevaHE);
        if (resHE?.error) {
            console.error('Error al generar HE automática:', resHE.error);
            App.toast(`Sub-Arr ${folioSA} guardado, pero NO se pudo generar HE (${folioHE}): ${resHE.error}`, 'warning');
        } else {
            if (window.ModHE && typeof window.ModHE.reload === 'function') {
                await window.ModHE.reload();
            }
        }

        if (resHE && window.ModHE && window.ModHE.getHE) {
            window.ModHE.getHE().push(resHE);
        }
        */

        // Sincronizar localmente
        if (resSA) saData.push(resSA);

        // Actualizar inventario: sumar disponible por cada producto
        // (await para asegurar que se persista en inv_master antes de cerrar)
        if (window.ModInventario && window.ModInventario.actualizarStock) {
            await Promise.all(items.map(it =>
                window.ModInventario.actualizarStock(it.producto_id, +it.cantidad)
            ));
        }

        document.getElementById('modal-sa-nuevo').remove();
        App.toast(`Sub-Arrendamiento ${folioSA} registrado — HE se generará automáticamente`, 'success');
        renderKPIs();
        renderTabla();
    }

    // ── Modal: Registrar Devolución ───────────────────────────
    function abrirDevolucion(saId) {
        const sa = saData.find(x => x.id === saId);
        if (!sa || sa.estatus !== 'activo') return;

        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.id = 'modal-sa-devolucion';
        overlay.innerHTML = `
        <div class="modal modal-md">
            <div class="modal-header">
                <div>
                    <div class="modal-title">Registrar Devolución — ${sa.folio}</div>
                    <div class="modal-subtitle">${sa.proveedor}</div>
                </div>
                <button class="modal-close" onclick="document.getElementById('modal-sa-devolucion').remove()">✕</button>
            </div>
            <div class="modal-body">

                <div class="estado-cuenta-box" style="margin-bottom:1.5rem">
                    <div class="ec-title">📦 Equipo a Devolver</div>
                    ${(sa.items||[]).map(i => `
                    <div class="ec-row">
                        <span class="td-mono" style="font-size:0.8rem">${i.codigo}</span>
                        <span style="font-size:0.8rem">${i.nombre}</span>
                        <strong>${i.cantidad} pzas</strong>
                    </div>`).join('')}
                    <div class="ec-row" style="margin-top:.5rem;border-top:1px solid var(--border);padding-top:.5rem">
                        <span><strong>Días acumulados</strong></span>
                        <strong style="color:var(--warning)">${calcDias(sa)} días</strong>
                    </div>
                    <div class="ec-row">
                        <span><strong>Costo total a pagar</strong></span>
                        <strong style="color:var(--danger);font-size:1.1rem">$${calcCosto(sa).toLocaleString('es-MX',{minimumFractionDigits:2})}</strong>
                    </div>
                </div>

                <div class="alert alert-warning">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                    <span>Al confirmar se generará una <strong>Hoja de Salida (HS)</strong> y el equipo se restará del inventario disponible.</span>
                </div>

                <div class="form-row cols-2">
                    <div class="form-group">
                        <label class="form-label">Fecha de Devolución <span class="required">*</span></label>
                        <input id="dev-fecha" type="date" class="form-control" value="${hoyISO()}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Notas de Devolución</label>
                        <input id="dev-notas" class="form-control" placeholder="Condiciones de entrega, observaciones…">
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="document.getElementById('modal-sa-devolucion').remove()">Cancelar</button>
                <button class="btn btn-danger" id="btn-confirmar-dev" onclick="ModSubArr._confirmarDevolucion(${sa.id})">
                    Confirmar Devolución y Generar HS
                </button>
            </div>
        </div>`;
        document.body.appendChild(overlay);
        overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
    }

    async function _confirmarDevolucion(saId) {
        const sa = saData.find(x => x.id === saId);
        if (!sa) return;

        const fechaDev = document.getElementById('dev-fecha').value;
        const notasDev = document.getElementById('dev-notas').value.trim();
        if (!fechaDev) { App.toast('Selecciona la fecha de devolución', 'danger'); return; }

        const folioHS = nextFolioHS();
        const piezas  = totalPiezas(sa);
        const diasTot = calcDiasEntreFechas(sa.fecha_inicio, fechaDev);

        // Generar HS automática e inyectarla en la base de datos
        const nuevaHS = {
            folio: folioHS,
            contrato_folio: sa.contrato_destino_folio || 'SARR-STOCK-INTERNO',
            razon_social: `[DEVOL. SARR] ${sa.proveedor}`,
            fecha: fechaDev,
            total_piezas: piezas,
            estatus: 'entregado',
            tipo: 'devolucion_subarr',
            referencia_sa: sa.folio,
            notas: notasDev || `Devolución de ${sa.folio} — ${diasTot} días`,
            items: sa.items.map(i => ({ ...i, cantidad_hs: i.cantidad })),
        };

        // Restar inventario disponible
        if (window.ModInventario && window.ModInventario.actualizarStock) {
            await Promise.all((sa.items || []).map(it =>
                window.ModInventario.actualizarStock(it.producto_id, -it.cantidad)
            ));
        }

        // Actualizar el sub-arrendamiento en la base de datos
        sa.estatus          = 'devuelto';
        sa.fecha_devolucion = fechaDev;
        sa.folio_hs         = folioHS;

        await DB.update('ops_subarriendos', saId, {
            estatus: 'devuelto',
            fecha_devolucion: fechaDev,
            folio_hs: folioHS,
        });

        // PERSISTENCIA: Guardar la HS automática en Supabase
        const hsRes = await DB.insert('ops_hs', nuevaHS);
        if (hsRes && !hsRes.error && ModHS && ModHS.getHS) {
            ModHS.getHS().push(hsRes);
        }

        document.getElementById('modal-sa-devolucion').remove();
        App.toast(`Devolución registrada — HS ${folioHS} generada`, 'success');
        renderKPIs();
        renderTabla();
    }

    // ── Estado de Cuenta ──────────────────────────────────────
    function verEstadoCuenta(saId) {
        const sa = saData.find(x => x.id === saId);
        if (!sa) return;
        const dias  = calcDias(sa);
        const costo = calcCosto(sa);
        const pzas  = totalPiezas(sa);

        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.id = 'modal-sa-cuenta';
        overlay.innerHTML = `
        <div class="modal modal-lg">
            <div class="modal-header">
                <div>
                    <div class="modal-title">Estado de Cuenta — ${sa.folio}</div>
                    <div class="modal-subtitle">${sa.proveedor} ${sa.estatus === 'activo' ? '· <span style="color:var(--success)">● Activo</span>' : '· <span style="color:var(--text-muted)">Devuelto</span>'}</div>
                </div>
                <button class="modal-close" onclick="document.getElementById('modal-sa-cuenta').remove()">✕</button>
            </div>
            <div class="modal-body">

                <!-- Resumen cabecera -->
                <div class="form-row cols-3" style="margin-bottom:1.5rem">
                    <div>
                        <span class="stat-label">Contrato Destino</span>
                        <div class="td-mono" style="font-weight:700">${sa.contrato_destino_folio || '—'}</div>
                        <div style="font-size:0.72rem;color:var(--text-muted)">${sa.razon_social_destino || ''}</div>
                    </div>
                    <div>
                        <span class="stat-label">Periodo</span>
                        <div>${fmtFecha(sa.fecha_inicio)} → ${sa.fecha_devolucion ? fmtFecha(sa.fecha_devolucion) : '<span class="badge badge-success">En curso</span>'}</div>
                    </div>
                    <div>
                        <span class="stat-label">Costo / Pieza / Día</span>
                        <div class="td-mono" style="font-weight:700">$${Number(sa.costo_unitario_dia).toFixed(2)}</div>
                    </div>
                </div>

                <!-- Detalle de equipo -->
                <div style="font-weight:700;margin-bottom:.75rem;color:var(--text-main)">Equipo Sub-Arrendado</div>
                <table class="items-table-mini" style="margin-bottom:1.5rem">
                    <thead>
                        <tr>
                            <th>Código</th>
                            <th>Descripción</th>
                            <th>Cantidad</th>
                            <th>Días</th>
                            <th>Costo Unitario</th>
                            <th>Subtotal</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${(sa.items||[]).map(i => {
                            const subtotal = i.cantidad * sa.costo_unitario_dia * dias;
                            return `<tr>
                                <td class="td-mono">${i.codigo}</td>
                                <td>${i.nombre}</td>
                                <td class="td-mono">${i.cantidad} pzas</td>
                                <td class="td-mono">${dias}</td>
                                <td class="td-mono">$${Number(sa.costo_unitario_dia).toFixed(2)}/pza/día</td>
                                <td class="td-mono" style="font-weight:700;color:var(--warning)">$${subtotal.toLocaleString('es-MX',{minimumFractionDigits:2})}</td>
                            </tr>`;
                        }).join('')}
                    </tbody>
                </table>

                <!-- Resumen financiero -->
                <div class="estado-cuenta-box">
                    <div class="ec-title">💰 Resumen Financiero</div>
                    <div class="ec-row">
                        <span>Total piezas</span>
                        <strong>${pzas} pzas</strong>
                    </div>
                    <div class="ec-row">
                        <span>${sa.estatus === 'activo' ? 'Días transcurridos (hasta hoy)' : 'Días totales del contrato'}</span>
                        <strong>${dias} días</strong>
                    </div>
                    <div class="ec-row">
                        <span>Costo unitario / día</span>
                        <strong>$${Number(sa.costo_unitario_dia).toFixed(2)}</strong>
                    </div>
                    <div class="ec-row" style="border-top:2px solid var(--border);padding-top:.75rem;margin-top:.5rem">
                        <span><strong>TOTAL A PAGAR${sa.estatus === 'activo' ? ' (proyectado)' : ''}</strong></span>
                        <strong style="font-size:1.25rem;color:${sa.estatus === 'activo' ? 'var(--warning)' : 'var(--danger)'}">
                            $${costo.toLocaleString('es-MX',{minimumFractionDigits:2})}
                        </strong>
                    </div>
                    ${sa.estatus === 'activo' ? `<div style="font-size:0.72rem;color:var(--text-muted);text-align:right;margin-top:.25rem">
                        = ${pzas} pzas × $${Number(sa.costo_unitario_dia).toFixed(2)}/día × ${dias} días
                    </div>` : ''}
                </div>

                <!-- Documentos generados -->
                <div style="font-weight:700;margin:.1.5rem 0 .75rem;color:var(--text-main);margin-top:1.5rem">Documentos Generados</div>
                <div class="flex gap-4" style="flex-wrap:wrap">
                    <div class="alert alert-success" style="flex:1;min-width:220px;margin:0">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
                        <span><strong>HE Entrada:</strong> <span class="td-mono">${sa.folio_he || '—'}</span></span>
                    </div>
                    <div class="alert ${sa.folio_hs ? 'alert-info' : 'alert-warning'}" style="flex:1;min-width:220px;margin:0">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
                        <span><strong>HS Devolución:</strong> <span class="td-mono">${sa.folio_hs || 'Pendiente'}</span></span>
                    </div>
                </div>

                ${sa.notas ? `<div class="alert alert-info" style="margin-top:1rem"><span>${sa.notas}</span></div>` : ''}
            </div>
            <div class="modal-footer">
                ${sa.estatus === 'activo' ? `<button class="btn btn-danger" onclick="document.getElementById('modal-sa-cuenta').remove();ModSubArr.abrirDevolucion(${sa.id})">Registrar Devolución</button>` : ''}
                <button class="btn btn-secondary" onclick="document.getElementById('modal-sa-cuenta').remove()">Cerrar</button>
            </div>
        </div>`;
        document.body.appendChild(overlay);
        overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
    }

    // ── Cálculos ──────────────────────────────────────────────
    function calcDias(sa) {
        const inicio = sa.fecha_inicio ? new Date(sa.fecha_inicio + 'T12:00:00') : null;
        if (!inicio) return 0;
        const fin = sa.fecha_devolucion
            ? new Date(sa.fecha_devolucion + 'T12:00:00')
            : new Date();
        return Math.max(0, Math.ceil((fin - inicio) / (1000 * 60 * 60 * 24)));
    }

    function calcDiasEntreFechas(f1, f2) {
        const d1 = new Date(f1 + 'T12:00:00');
        const d2 = new Date(f2 + 'T12:00:00');
        return Math.max(0, Math.ceil((d2 - d1) / (1000 * 60 * 60 * 24)));
    }

    function calcCosto(sa) {
        const dias  = calcDias(sa);
        const pzas  = totalPiezas(sa);
        return pzas * (sa.costo_unitario_dia || 0) * dias;
    }

    function totalPiezas(sa) {
        return (sa.items || []).reduce((s, i) => s + (i.cantidad || 0), 0);
    }

    // ── Folios ────────────────────────────────────────────────
    function nextFolio() {
        if (!saData.length) return 'SARR-001';
        const nums = saData.map(s => parseInt((s.folio||'').replace(/\D/g,'')) || 0);
        return `SARR-${String(Math.max(...nums) + 1).padStart(3,'0')}`;
    }

    function nextFolioHE() {
        // Usar el mismo formato secuencial que he.js para mantener consecutivos
        const heList = window.ModHE && window.ModHE.getHE ? window.ModHE.getHE() : [];
        let maxNum = 0;
        heList.forEach(h => {
            const m = String(h?.folio || '').trim().match(/^HE-(\d+)$/);
            if (m) maxNum = Math.max(maxNum, parseInt(m[1], 10) || 0);
        });
        return `HE-${String(maxNum + 1).padStart(3,'0')}`;
    }

    function nextFolioHS() {
        // Usar el mismo formato secuencial que hs.js para mantener consecutivos
        const hsList = window.ModHS && window.ModHS.getHS ? window.ModHS.getHS() : [];
        let maxNum = 0;
        hsList.forEach(h => {
            const m = String(h?.folio || '').trim().match(/^HS-(\d+)$/);
            if (m) maxNum = Math.max(maxNum, parseInt(m[1], 10) || 0);
        });
        return `HS-${String(maxNum + 1).padStart(3,'0')}`;
    }

    function _nextIdHE() {
        const heList = window.ModHE && window.ModHE.getHE ? window.ModHE.getHE() : [];
        return heList.length ? Math.max(...heList.map(h => h.id || 0)) + 1 : 1001;
    }

    function _nextIdHS() {
        const hsList = window.ModHS && window.ModHS.getHS ? window.ModHS.getHS() : [];
        return hsList.length ? Math.max(...hsList.map(h => h.id || 0)) + 1 : 1001;
    }

    // Utility aliases — delegated to Utils
    const fmtFecha = Utils.fmtFecha;
    const hoyISO = Utils.hoyISO;
    const truncar = Utils.truncar;

    // Sub-arrendamiento-specific badge (different map than contracts)
    function badgeEstatus(e) {
        const map = {
            activo:    'badge-success',
            devuelto:  'badge-info',
            cancelado: 'badge-gray',
        };
        return `<span class="badge ${map[e]||'badge-gray'}">${Utils.escapeHtml((e||'—').replace('_',' '))}</span>`;
    }

    return {
        render,
        verEstadoCuenta,
        abrirDevolucion,
        abrirModalNuevo,
        getSA: () => saData,
        // Exponer helpers usados inline en el HTML
        _agregarItemRow,
        _onProdChange,
        _eliminarItemRow,
        _confirmarDevolucion,
    };
})();
