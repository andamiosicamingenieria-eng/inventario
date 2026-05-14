import { DB, DEMO_MODE } from '../supabase-client.js';
import { Utils } from '../utils.js';

/**
 * ICAM 360 - Panel de Seguimiento
 */
export const ModSeguimiento = (() => {
    let expandedId = null;

    async function render() {
        const mc = document.getElementById('module-content');
        
        // Cargar datos de Supabase
        const contratos = (await DB.getAll('ops_contratos', { orderBy: 'folio', ascending: false })) || [];
        const todasHS = (await DB.getAll('ops_hs', { orderBy: 'fecha', ascending: false })) || [];
        const todasHE = (await DB.getAll('ops_he', { orderBy: 'fecha', ascending: false })) || [];
        
        const hoy = new Date();
        const activos = (contratos || []).filter(c => 
            ['activo','entrega_parcial','borrador'].includes(c.estatus) && 
            c.tipo_contrato === 'renta'
        );

        const vencidos = activos.filter(c => c.fecha_vencimiento && new Date(c.fecha_vencimiento + 'T12:00:00') < hoy);
        const proximos = activos.filter(c => {
            if (!c.fecha_vencimiento) return false;
            const dias = diasRestantes(c.fecha_vencimiento);
            return dias >= 0 && dias <= 7;
        });
        const ok = activos.filter(c => {
            if (!c.fecha_vencimiento) return true;
            return diasRestantes(c.fecha_vencimiento) > 7;
        });

        mc.innerHTML = `
        <div class="stats-grid">
            <div class="stat-card" style="border-left:4px solid var(--danger)">
                <div class="stat-label">Vencidos</div>
                <div class="stat-value text-danger">${vencidos.length}</div>
            </div>
            <div class="stat-card" style="border-left:4px solid var(--warning)">
                <div class="stat-label">Próximos (≤7d)</div>
                <div class="stat-value text-warning">${proximos.length}</div>
            </div>
            <div class="stat-card" style="border-left:4px solid var(--success)">
                <div class="stat-label">Activos OK</div>
                <div class="stat-value text-success">${ok.length}</div>
            </div>
            <div class="stat-card" style="border-left:4px solid var(--primary)">
                <div class="stat-label">Total Renta</div>
                <div class="stat-value">${activos.length}</div>
            </div>
        </div>

        <div class="section-header mt-4">
            <div class="section-title">📊 Seguimiento Operativo de Contratos</div>
        </div>
        <div class="table-wrapper">
            <table>
                <thead>
                    <tr>
                        <th>Folio</th>
                        <th>Cliente</th>
                        <th>Agente</th>
                        <th>Vencimiento</th>
                        <th>Entrega</th>
                        <th>Recolección</th>
                        <th>Total</th>
                        <th>Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    ${activos.length ? activos.map(c => filaContrato(c, todasHS, todasHE)).join('') : '<tr><td colspan="8"><div class="empty-state">No hay contratos activos en renta.</div></td></tr>'}
                </tbody>
            </table>
        </div>`;

        attachEvents();
    }

    function filaContrato(c, todasHS, todasHE) {
        const dias = c.fecha_vencimiento ? Utils.diasRestantes(c.fecha_vencimiento) : null;
        const diasClass = dias === null ? '' : dias < 0 ? 'text-danger font-bold' : dias <= 7 ? 'text-warning font-bold' : '';
        const diasTexto = dias === null ? '—' : Utils.fmtFecha(c.fecha_vencimiento);

        const estatusEntrega = Utils.calcularEstatusEntrega(c, todasHS);
        const estatusRecoleccion = Utils.calcularEstatusRecoleccion(c, todasHE);

        const rowHTML = `
        <tr class="seg-row" data-id="${c.id}" style="cursor:pointer; ${expandedId === c.id ? 'background:var(--primary-light)' : ''}">
            <td class="td-mono">${Utils.escapeHtml(c.folio)}</td>
            <td>
                <div style="font-weight:600;color:var(--text-main)">${Utils.escapeHtml(c.razon_social) || '—'}</div>
                <div style="font-size:0.7rem;color:var(--text-secondary)">${Utils.escapeHtml(c.sistema) || '—'}</div>
            </td>
            <td><span class="badge badge-gray">👤 ${Utils.escapeHtml(c.vendedor) || '—'}</span></td>
            <td class="${diasClass}">${diasTexto}</td>
            <td>${Utils.getBadgeEntrega(estatusEntrega)}</td>
            <td>${Utils.getBadgeRecoleccion(estatusRecoleccion)}</td>
            <td class="td-mono">$${Number(c.monto_total || 0).toLocaleString()}</td>
            <td>
                <div class="flex gap-1">
                    <button class="btn btn-secondary btn-sm" onclick="App.navigate('contratos')" title="Ir a contratos">📊</button>
                    <button class="btn btn-success btn-sm btn-cerrar-contrato" data-id="${c.id}" title="Cerrar contrato">✓</button>
                </div>
            </td>
        </tr>`;

        const detailHTML = expandedId === c.id ? `
        <tr style="background:var(--bg-alt)">
            <td colspan="8" style="padding:1.5rem; border-bottom:2px solid var(--primary)">
                <div class="stats-grid" style="grid-template-columns:repeat(3, 1fr); margin-bottom:1.5rem">
                    <div class="card p-3" style="border-left:3px solid var(--primary)">
                        <div class="text-xs text-muted mb-1">FOLIO RAÍZ (CADENA)</div>
                        <div class="td-mono font-bold">${c.folio_raiz || c.folio}</div>
                    </div>
                    <div class="card p-3">
                        <div class="text-xs text-muted mb-1">VIENE DE (ANTERIOR)</div>
                        <div class="td-mono">${c.renta_anterior || '—'}</div>
                    </div>
                    <div class="card p-3">
                        <div class="text-xs text-muted mb-1">SIGUE A (POSTERIOR)</div>
                        <div class="td-mono">${c.renta_posterior || '—'}</div>
                    </div>
                </div>
                <div class="flex justify-between items-center">
                    <div class="text-sm">
                        Total de este folio: <strong>$${Number(c.monto_total||0).toLocaleString()}</strong>
                    </div>
                    <div class="flex gap-2">
                        <button class="btn btn-primary" onclick="App.navigate('estado_cuenta', '${c.folio_raiz || c.folio}')">
                            📑 Ver Estado de Cuenta Consolidado
                        </button>
                        <button class="btn btn-secondary" onclick="ModContratos.crearSolicitud('recoleccion', ${c.id})">
                            🔂 Solicitud de Recolección
                        </button>
                        <button class="btn btn-warning" onclick="ModContratos.prepararVentaPorPerdidaDesdeSeguimiento(${c.id})">
                             ⚠ Venta por Pérdida
                        </button>
                    </div>
                </div>
            </td>
        </tr>` : '';

        return rowHTML + detailHTML;
    }

    // Removed duplicate calcularEstatusEntrega, calcularEstatusRecoleccion,
    // getBadgeEntrega, getBadgeRecoleccion — now using Utils.*

    function attachEvents() {
        document.querySelectorAll('.seg-row').forEach(row => {
            row.addEventListener('click', () => {
                const id = parseInt(row.dataset.id);
                expandedId = (expandedId === id) ? null : id;
                render();
            });
        });

        document.querySelectorAll('.btn-cerrar-contrato').forEach(btn => {
            btn.addEventListener('click', async e => {
                e.stopPropagation();
                const id = parseInt(btn.dataset.id);
                if (confirm('¿Cerrar contrato y marcar como recolectado?')) {
                    await DB.update('ops_contratos', id, { estatus: 'recolectado' });
                    App.toast('Contrato actualizado', 'success');
                    render();
                }
            });
        });

    }
    // Utility aliases — delegated to Utils
    const diasRestantes = Utils.diasRestantes;
    const fmtFecha = Utils.fmtFecha;

    return { render };
})();
