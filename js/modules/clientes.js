import { DB, DEMO_MODE } from '../supabase-client.js';
import { Utils } from '../utils.js';

/**
 * ICAM 360 - Módulo de Clientes (crm_clientes)
 * CRUD completo: listar, crear, editar clientes
 */

export const ModClientes = (() => {

    // ── Estado local ──────────────────────────────────
    let clientes = [];
    let filtro = '';

    // ── Render principal ──────────────────────────────
    function render() {
        const mc = document.getElementById('module-content');
        mc.innerHTML = `
        <div class="page-toolbar">
            <div class="page-toolbar-left">
                <div class="search-box">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    <input id="clientes-search" type="text" placeholder="Buscar por razón social o RFC…" value="${filtro}">
                </div>
                <button class="btn btn-secondary btn-sm" onclick="ModClientes.recargar()" title="Recargar datos">
                    🔄
                </button>
            </div>
            <div class="page-toolbar-right">
                <button class="btn btn-primary" id="btn-nuevo-cliente">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    Nuevo Cliente
                </button>
            </div>
        </div>

        <div class="table-wrapper">
            <table>
                <thead>
                    <tr>
                        <th>Razón Social</th>
                        <th>RFC</th>
                        <th>Contacto</th>
                        <th>Teléfono</th>
                        <th>Tipo</th>
                        <th>Crédito</th>
                        <th>Acciones</th>
                    </tr>
                </thead>
                <tbody id="clientes-tbody">
                    <tr><td colspan="7"><div class="loading-center"><div class="spinner"></div><span>Cargando clientes…</span></div></td></tr>
                </tbody>
            </table>
        </div>`;

        document.getElementById('clientes-search').addEventListener('input', e => {
            filtro = e.target.value;
            renderTabla();
        });
        document.getElementById('btn-nuevo-cliente').addEventListener('click', () => abrirModal());

        cargarClientes();
    }

    // ── Carga de datos ────────────────────────────────
    async function cargarClientes() {
        const raw = await DB.getAll('crm_clientes', { orderBy: 'razon_social' });
        clientes = raw || dataSeed();
        renderTabla();
    }

    // Recargar datos desde Supabase (forzar recarga sin caché)
    async function recargar() {
        App.toast('Recargando clientes...', 'info');
        const raw = await DB.getAll('crm_clientes', { orderBy: 'razon_social', forceReload: true });
        clientes = raw || dataSeed();
        renderTabla();
        App.toast(`Cargados ${clientes.length} clientes`, 'success');
    }

    function dataSeed() {
        return [
            { id: 1, razon_social: 'CONSTRUCTORA TORRES DEL NORTE SA DE CV', rfc: 'CTN020305JH2', contacto_principal: 'Ing. Ramírez', telefono: '81 2345 6789', tipo_cliente: 'cliente_activo', limite_credito: 500000 },
            { id: 2, razon_social: 'EDIFICACIONES MONTERREY SA DE CV', rfc: 'EMO150812KL4', contacto_principal: 'Arq. Flores', telefono: '81 9876 5432', tipo_cliente: 'cliente_activo', limite_credito: 350000 },
            { id: 3, razon_social: 'GRUPO CONSTRUCTOR DEL BAJÍO', rfc: 'GCB200115MN6', contacto_principal: 'Lic. González', telefono: '477 123 4567', tipo_cliente: 'prospecto', limite_credito: 0 },
            { id: 4, razon_social: 'INMOBILIARIA NUEVA ÉPOCA SC', rfc: 'INE180920PQ8', contacto_principal: 'Carmen Vásquez', telefono: '33 4567 8901', tipo_cliente: 'cliente_activo', limite_credito: 750000 },
        ];
    }

    function renderTabla() {
        const tbody = document.getElementById('clientes-tbody');
        if (!tbody) return;

        const f = filtro.toLowerCase();
        const data = clientes.filter(c =>
            c.razon_social.toLowerCase().includes(f) ||
            (c.rfc || '').toLowerCase().includes(f)
        );

        if (data.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
                <h3>Sin clientes</h3><p>Crea el primer cliente con el botón "Nuevo Cliente".</p>
            </div></td></tr>`;
            return;
        }

        tbody.innerHTML = data.map(c => {
            const _e = Utils.escapeHtml;
            return `
            <tr>
                <td>
                    <strong style="color:var(--text-main)">${_e(c.razon_social)}</strong>
                    ${c.agente_ventas ? `<div class="text-xs text-muted">👤 Agente: ${_e(c.agente_ventas)}</div>` : ''}
                </td>
                <td class="td-mono">${_e(c.rfc) || '—'}</td>
                <td>${_e(c.contacto_principal) || '—'}</td>
                <td>${_e(c.telefono) || '—'}</td>
                <td>${badgeTipo(c.tipo_cliente)}</td>
                <td class="td-mono">$${Number(c.limite_credito || 0).toLocaleString('es-MX')}</td>
                <td>
                    <div class="flex gap-2">
                        <button class="btn btn-secondary btn-sm" onclick="ModClientes.editar(${c.id})">Editar</button>
                    </div>
                </td>
            </tr>`;
        }).join('');
    }

    // ── Modal ──────────────────────────────────────────
    function abrirModal(clienteId = null) {
        const cliente = clienteId ? clientes.find(c => c.id === clienteId) : null;
        const titulo = cliente ? 'Editar Cliente' : 'Nuevo Cliente';

        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.id = 'modal-clientes';
        overlay.innerHTML = `
        <div class="modal modal-lg">
            <div class="modal-header">
                <div>
                    <div class="modal-title">${titulo}</div>
                    <div class="modal-subtitle">Información del cliente en el CRM</div>
                </div>
                <button class="modal-close" onclick="document.getElementById('modal-clientes').remove()">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
            </div>
            <div class="modal-body">
                <div class="form-row cols-3">
                    <div class="form-group">
                        <label class="form-label">Razón Social <span class="required">*</span></label>
                        <input id="cli-razon" class="form-control" placeholder="EMPRESA SA DE CV" value="${cliente?.razon_social || ''}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">RFC</label>
                        <input id="cli-rfc" class="form-control" placeholder="EMP000101XXX" maxlength="13" value="${cliente?.rfc || ''}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Agente de Ventas</label>
                        <input id="cli-agente" class="form-control" placeholder="Nombre del agente" value="${cliente?.agente_ventas || ''}">
                    </div>
                </div>
                <div class="form-row cols-2">
                    <div class="form-group">
                        <label class="form-label">Contacto Principal</label>
                        <input id="cli-contacto" class="form-control" placeholder="Nombre del contacto" value="${cliente?.contacto_principal || ''}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Teléfono</label>
                        <input id="cli-tel" class="form-control" placeholder="81 1234 5678" value="${cliente?.telefono || ''}">
                    </div>
                </div>
                <div class="form-row cols-3">
                    <div class="form-group">
                        <label class="form-label">Email</label>
                        <input id="cli-email" type="email" class="form-control" placeholder="contacto@empresa.com" value="${cliente?.email || ''}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Tipo de Cliente</label>
                        <select id="cli-tipo" class="form-control">
                            ${['prospecto','cliente_activo','inactivo','potencial'].map(t =>
                                `<option value="${t}" ${cliente?.tipo_cliente === t ? 'selected' : ''}>${t.replace('_',' ').toUpperCase()}</option>`
                            ).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Límite de Crédito ($)</label>
                        <input id="cli-credito" type="number" class="form-control" placeholder="0.00" value="${cliente?.limite_credito || 0}">
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label">Dirección</label>
                    <textarea id="cli-dir" class="form-control" placeholder="Calle, Número, Colonia, Ciudad, CP">${cliente?.direccion || ''}</textarea>
                </div>
                <div class="form-group">
                    <label class="form-label">Notas</label>
                    <textarea id="cli-notas" class="form-control" placeholder="Observaciones adicionales…">${cliente?.notas || ''}</textarea>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="document.getElementById('modal-clientes').remove()">Cancelar</button>
                <button class="btn btn-primary" id="btn-guardar-cliente">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                    Guardar
                </button>
            </div>
        </div>`;

        document.body.appendChild(overlay);
        overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
        document.getElementById('btn-guardar-cliente').addEventListener('click', () => guardar(cliente?.id));
    }

    async function guardar(id = null) {
        const razon = document.getElementById('cli-razon').value.trim();
        if (!razon) { App.toast('La razón social es requerida', 'danger'); return; }

        const payload = {
            razon_social: razon,
            rfc: document.getElementById('cli-rfc').value.trim() || null,
            contacto_principal: document.getElementById('cli-contacto').value.trim() || null,
            telefono: document.getElementById('cli-tel').value.trim() || null,
            email: document.getElementById('cli-email').value.trim() || null,
            tipo_cliente: document.getElementById('cli-tipo').value,
            limite_credito: parseFloat(document.getElementById('cli-credito').value) || 0,
            direccion: document.getElementById('cli-dir').value.trim() || null,
            agente_ventas: document.getElementById('cli-agente').value.trim() || null,
            notas: document.getElementById('cli-notas').value.trim() || null,
        };

        if (id) {
            const res = await DB.update('crm_clientes', id, payload);
            if (res.error) {
                App.toast('Error al actualizar: ' + res.error, 'danger');
                return;
            }
            const idx = clientes.findIndex(c => c.id === id);
            clientes[idx] = { ...clientes[idx], ...payload };
            App.toast('Cliente actualizado', 'success');
        } else {
            const res = await DB.insert('crm_clientes', payload);
            if (res.error) {
                App.toast('Error al crear: ' + res.error, 'danger');
                return;
            }
            if (res) clientes.push(res);
            App.toast('Cliente creado', 'success');
        }

        document.getElementById('modal-clientes').remove();
        renderTabla();
    }

    // ── Utilidades ────────────────────────────────────
    function badgeTipo(tipo) {
        const map = {
            'cliente_activo': '<span class="badge badge-success">Activo</span>',
            'prospecto':      '<span class="badge badge-info">Prospecto</span>',
            'inactivo':       '<span class="badge badge-gray">Inactivo</span>',
            'potencial':      '<span class="badge badge-warning">Potencial</span>',
        };
        return map[tipo] || `<span class="badge badge-gray">${tipo || '—'}</span>`;
    }

    // ── API del módulo ────────────────────────────────
    return { 
        render, 
        editar: abrirModal, 
        getClientes: () => clientes,
        cargar: cargarClientes,
        recargar 
    };
})();
