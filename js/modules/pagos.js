import { DB, DEMO_MODE } from '../supabase-client.js';
import { Utils } from '../utils.js';

/**
 * ICAM 360 - Módulo de Cobranza (ops_pagos)
 */
export const ModPagos = (() => {
    let pagos = [];
    let contratos = [];
    let filtro = '';

    async function render() {
        const mc = document.getElementById('module-content');
        mc.innerHTML = `
        <div class="page-toolbar">
            <div class="page-toolbar-left">
                <div class="search-box">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    <input id="pagos-search" type="text" placeholder="Buscar por contrato o cliente…" value="${filtro}">
                </div>
            </div>
            <div class="page-toolbar-right">
                <div class="kpi-mini">
                    <span class="label">Total Pendiente:</span>
                    <span class="value text-danger" id="kpi-total-pendiente">$0.00</span>
                </div>
                <button class="btn btn-primary" id="btn-nuevo-pago">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    Registrar Cobro
                </button>
            </div>
        </div>

        <div class="table-wrapper">
            <table>
                <thead>
                    <tr>
                        <th>Contrato</th>
                        <th>Cliente</th>
                        <th>Monto Total</th>
                        <th>Pagado</th>
                        <th>Saldo</th>
                        <th>Estatus Pago</th>
                        <th>Acciones</th>
                    </tr>
                </thead>
                <tbody id="pagos-tbody">
                    <tr><td colspan="7"><div class="loading-center"><div class="spinner"></div><span>Calculando saldos…</span></div></td></tr>
                </tbody>
            </table>
        </div>`;

        document.getElementById('pagos-search').addEventListener('input', e => {
            filtro = e.target.value;
            renderTabla();
        });
        document.getElementById('btn-nuevo-pago').addEventListener('click', () => abrirModalPago());

        await cargarDatos();
    }

    async function cargarDatos() {
        // Cargar todos los contratos
        contratos = await DB.getAll('ops_contratos', { orderBy: 'folio', ascending: false });
        // Cargar todos los pagos
        pagos = await DB.getAll('ops_pagos', { orderBy: 'fecha_pago', ascending: false });
        
        renderTabla();
        renderKPIs();
    }

    function renderTabla() {
        const tbody = document.getElementById('pagos-tbody');
        if (!tbody) return;

        const f = filtro.toLowerCase();
        const data = (contratos || []).filter(c => 
            c.folio.toLowerCase().includes(f) || 
            (c.razon_social || '').toLowerCase().includes(f)
        );

        if (!data.length) {
            tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><h3>Sin resultados</h3></div></td></tr>`;
            return;
        }

        tbody.innerHTML = data.map(c => {
            const cobrado = calcularTotalPagado(c);
            const saldo = (c.monto_total || 0) - cobrado;
            const estatus = getEstatusPago(saldo, c.monto_total);
            const _e = Utils.escapeHtml;

            return `
            <tr>
                <td class="td-mono">${_e(c.folio)}</td>
                <td><strong>${_e(c.razon_social)}</strong></td>
                <td class="td-mono">$${Number(c.monto_total || 0).toLocaleString('es-MX')}</td>
                <td class="td-mono text-success">$${Number(cobrado).toLocaleString('es-MX')}</td>
                <td class="td-mono ${saldo > 0 ? 'text-danger' : 'text-gray'}">
                    $${Number(saldo).toLocaleString('es-MX')}
                </td>
                <td>${Utils.badgePago(estatus)}</td>
                <td>
                    <button class="btn btn-secondary btn-sm" onclick="ModPagos.verDetalle(${c.id})">Historial</button>
                    <button class="btn btn-primary btn-sm" onclick="ModPagos.abrirModalPago(${c.id})">Abonar</button>
                </td>
            </tr>`;
        }).join('');
    }

    function calcularTotalPagado(contrato) {
        // Incluir el anticipo inicial registrado en el contrato
        const anticipo = parseFloat(contrato.anticipo) || 0;
        // Sumar todos los abonos posteriores en la tabla ops_pagos
        const abonos = (pagos || [])
            .filter(p => p.contrato_id === contrato.id)
            .reduce((sum, p) => sum + (parseFloat(p.monto) || 0), 0);
        
        return anticipo + abonos;
    }

    function getEstatusPago(saldo, total) {
        if (saldo <= 0) return 'liquidado';
        if (saldo >= total) return 'pendiente';
        return 'parcial';
    }

    // badgePago delegated to Utils
    const badgePago = Utils.badgePago;

    function renderKPIs() {
        let totalPendiente = 0;
        contratos.forEach(c => {
            const cobrado = calcularTotalPagado(c);
            const saldo = (c.monto_total || 0) - cobrado;
            if (saldo > 0) totalPendiente += saldo;
        });
        document.getElementById('kpi-total-pendiente').textContent = `$${totalPendiente.toLocaleString('es-MX')}`;
    }

    function abrirModalPago(contratoId = null) {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.id = 'modal-pago';
        
        const selContrato = contratoId ? contratos.find(c => c.id === contratoId) : null;

        overlay.innerHTML = `
        <div class="modal">
            <div class="modal-header">
                <div>
                    <div class="modal-title">Registrar Abono</div>
                    <div class="modal-subtitle">Afectar el saldo de un contrato</div>
                </div>
                <button class="modal-close" onclick="document.getElementById('modal-pago').remove()">✕</button>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <label class="form-label">Contrato Target <span class="required">*</span></label>
                    <select id="pago-contrato" class="form-control" ${contratoId ? 'disabled' : ''}>
                        <option value="">— Selecciona —</option>
                        ${contratos.map(c => `
                            <option value="${c.id}" ${contratoId === c.id ? 'selected' : ''}>
                                ${c.folio} — ${c.razon_social} (Total: $${(c.monto_total||0).toLocaleString()})
                            </option>
                        `).join('')}
                    </select>
                </div>
                <div class="form-row cols-2">
                    <div class="form-group">
                        <label class="form-label">Fecha de Pago</label>
                        <input type="date" id="pago-fecha" class="form-control" value="${new Date().toISOString().split('T')[0]}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Monto del Abono <span class="required">*</span></label>
                        <div style="position:relative">
                            <span style="position:absolute;left:12px;top:10px;color:var(--text-muted)">$</span>
                            <input type="number" id="pago-monto" class="form-control" style="padding-left:24px" placeholder="0.00">
                        </div>
                    </div>
                </div>
                <div class="form-row cols-2">
                    <div class="form-group">
                        <label class="form-label">Método de Pago</label>
                        <select id="pago-metodo" class="form-control">
                            <option value="Transferencia">Transferencia</option>
                            <option value="Efectivo">Efectivo</option>
                            <option value="Cheque">Cheque</option>
                            <option value="Tarjeta">Tarjeta</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Referencia / No. Op.</label>
                        <input id="pago-ref" class="form-control" placeholder="Ej. BBVA-1234">
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label">Notas</label>
                    <textarea id="pago-notas" class="form-control" placeholder="Observaciones…"></textarea>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="document.getElementById('modal-pago').remove()">Cancelar</button>
                <button class="btn btn-primary" id="btn-guardar-pago">Guardar Abono</button>
            </div>
        </div>`;

        document.body.appendChild(overlay);
        document.getElementById('btn-guardar-pago').addEventListener('click', () => guardarPago(contratoId));
    }

    async function guardarPago(fixedContratoId = null) {
        const contratoId = fixedContratoId || parseInt(document.getElementById('pago-contrato').value);
        const monto = parseFloat(document.getElementById('pago-monto').value);
        if (!contratoId || !monto || monto <= 0) {
            App.toast('Monto y Contrato son requeridos', 'danger');
            return;
        }

        const payload = {
            contrato_id: contratoId,
            fecha_pago: document.getElementById('pago-fecha').value,
            monto: monto,
            metodo_pago: document.getElementById('pago-metodo').value,
            referencia: document.getElementById('pago-ref').value,
            notas: document.getElementById('pago-notas').value
        };

        const res = await DB.insert('ops_pagos', payload);
        if (res.error) {
            App.toast('Error al guardar: ' + res.error, 'danger');
            return;
        }

        // Actualizar estatus de pago en el contrato
        const contrato = contratos.find(c => c.id === contratoId);
        const nuevoTotalPagado = calcularTotalPagado(contrato) + monto;
        const saldo = (contrato.monto_total || 0) - nuevoTotalPagado;
        const nuevoEstatus = getEstatusPago(saldo, contrato.monto_total);

        await DB.update('ops_contratos', contratoId, { estatus_pago: nuevoEstatus });

        App.toast('Abono registrado correctamente', 'success');
        document.getElementById('modal-pago').remove();
        render(); // Recargar todo
    }

    async function verDetalle(id) {
        const c = contratos.find(x => x.id === id);
        const historial = pagos.filter(p => p.contrato_id === id);
        
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.id = 'modal-historial';
        overlay.innerHTML = `
        <div class="modal modal-lg">
            <div class="modal-header">
                <div>
                    <div class="modal-title">Historial de Pagos</div>
                    <div class="modal-subtitle">Contrato: ${c.folio} — ${c.razon_social}</div>
                </div>
                <button class="modal-close" onclick="document.getElementById('modal-historial').remove()">✕</button>
            </div>
            <div class="modal-body">
                <div class="flex gap-4 mb-4">
                    <div class="card p-3 flex-1">
                        <div class="modal-subtitle">Total Facturado</div>
                        <div class="modal-title">$${(c.monto_total||0).toLocaleString()}</div>
                    </div>
                    <div class="card p-3 flex-1">
                        <div class="modal-subtitle">Saldo Pendiente</div>
                        <div class="modal-title text-danger">$${((c.monto_total||0) - calcularTotalPagado(c)).toLocaleString()}</div>
                    </div>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th>Fecha</th>
                            <th>Monto</th>
                            <th>Método</th>
                            <th>Referencia</th>
                            <th>Eliminar</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${c.anticipo > 0 ? `
                            <tr style="background:var(--bg-elevated)">
                                <td>—</td>
                                <td><strong>$${c.anticipo.toLocaleString()}</strong></td>
                                <td><span class="badge badge-gray">ANTICIPO INICIAL</span></td>
                                <td>En contrato</td>
                                <td>—</td>
                            </tr>
                        ` : ''}
                        ${historial.map(p => `
                            <tr>
                                <td>${p.fecha_pago}</td>
                                <td>$${p.monto.toLocaleString()}</td>
                                <td>${p.metodo_pago}</td>
                                <td>${p.referencia || '—'}</td>
                                <td><button class="btn btn-secondary btn-sm" onclick="ModPagos.eliminarPago(${p.id})">✕</button></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>`;
        document.body.appendChild(overlay);
    }

    async function eliminarPago(id) {
        if (!confirm('¿Seguro que deseas eliminar este registro de pago?')) return;
        await DB.delete('ops_pagos', id);
        App.toast('Pago eliminado', 'info');
        document.getElementById('modal-historial').remove();
        render();
    }

    return { 
        render, 
        abrirModalPago, 
        verDetalle,
        eliminarPago
    };
})();
