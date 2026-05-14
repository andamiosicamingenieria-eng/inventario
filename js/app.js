/**
 * INVENTARIO-CONTRATOS — App Principal
 * Enrutador SPA, dashboard, toasts
 */
import { DB } from './supabase-client.js';
import { Utils } from './utils.js';
import { ModContratos } from './modules/contratos.js';
import { ModHS } from './modules/hs.js';
import { ModHE } from './modules/he.js';
import { ModInventario } from './modules/inventario.js';
import { ModEstadoCuenta } from './modules/estado-cuenta.js';

const MODULES = {
    dashboard:     { title: 'Dashboard',          breadcrumb: 'ICAM / Dashboard',                render: renderDashboard },
    contratos:     { title: 'Contratos',           breadcrumb: 'Operaciones / Contratos',         render: () => ModContratos.render() },
    hs:            { title: 'Hojas de Salida',     breadcrumb: 'Logística / Hojas de Salida',     render: () => ModHS.render() },
    he:            { title: 'Hojas de Entrada',    breadcrumb: 'Logística / Hojas de Entrada',    render: () => ModHE.render() },
    inventario:    { title: 'Inventario',          breadcrumb: 'Almacén / Inventario',            render: () => ModInventario.render() },
    estado_cuenta: { title: 'Estado de Cuenta',    breadcrumb: 'Almacén / Estado de Cuenta',      render: (arg) => ModEstadoCuenta.render(arg) },
};

let currentModule = 'dashboard';

window.App = {
    navigate(module, arg = null) {
        if (!MODULES[module]) return;
        currentModule = module;
        document.querySelectorAll('.nav-item').forEach(el => {
            el.classList.toggle('active', el.dataset.module === module);
        });
        document.getElementById('header-title').textContent = MODULES[module].title;
        document.getElementById('header-breadcrumb').textContent = MODULES[module].breadcrumb;
        const mc = document.getElementById('module-content');
        mc.innerHTML = `<div class="loading-center"><div class="spinner"></div><span>Cargando…</span></div>`;
        setTimeout(async () => {
            try {
                const r = MODULES[module].render(arg);
                if (r instanceof Promise) await r;
            } catch (e) {
                console.error('Error módulo:', e);
                mc.innerHTML = `<div class="alert alert-danger">Error: ${e.message}</div>`;
            }
        }, 50);
    },
    toast(msg, type = 'success') {
        const c = document.getElementById('toast-container');
        const icons = {
            success: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>',
            danger: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
            warning: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
        };
        const t = document.createElement('div');
        t.className = `toast toast-${type}`;
        t.innerHTML = `${icons[type] || ''}<span>${msg}</span>`;
        c.appendChild(t);
        setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translateX(100%)'; t.style.transition = 'all 0.3s'; setTimeout(() => t.remove(), 300); }, 4000);
    },
};

// ── Dashboard ──
async function renderDashboard() {
    const mc = document.getElementById('module-content');
    mc.innerHTML = '<div class="loading-center"><div class="spinner"></div></div>';

    const [contratos, inv, hsList, heList] = await Promise.all([
        DB.getAll('contratos', { orderBy: 'numero_contrato', ascending: false }),
        DB.getAll('inventario'),
        DB.getAll('hs', { orderBy: 'fecha', ascending: false }),
        DB.getAll('he', { orderBy: 'fecha', ascending: false }),
    ]);

    const c = contratos || [];
    const activos = c.filter(x => x.estatus === 'activo').length;
    let totalDisp = 0, totalObra = 0, totalMto = 0;
    (inv || []).forEach(i => {
        totalDisp += Number(i.cantidad_disponible || 0);
        totalObra += Number(i.cantidad_en_obra || 0);
        totalMto += Number(i.cantidad_mantenimiento || 0);
    });
    const totalHS = (hsList || []).length;
    const totalHE = (heList || []).length;

    mc.innerHTML = `
    <div class="card mb-4" style="background:linear-gradient(135deg,#1e3a8a 0%,#2563eb 100%);border:none;color:white;">
        <div class="card-body" style="padding:2rem;">
            <h2 style="font-size:1.5rem;font-weight:800;margin-bottom:0.5rem;">Panel de Inventarios</h2>
            <p style="opacity:0.85;font-size:0.9rem;">Seguimiento de entregas, recolecciones y stock — ${new Date().toLocaleDateString('es-MX',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}</p>
        </div>
    </div>

    <div class="stats-grid">
        <div class="stat-card" style="cursor:pointer" onclick="App.navigate('contratos')">
            <div class="stat-icon" style="background:var(--primary-light);color:var(--primary)">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            </div>
            <div class="stat-label">Contratos Activos</div>
            <div class="stat-value">${activos}</div>
            <div class="stat-change up">de ${c.length} totales</div>
        </div>
        <div class="stat-card" style="cursor:pointer" onclick="App.navigate('inventario')">
            <div class="stat-icon" style="background:var(--success-light);color:var(--success)">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/></svg>
            </div>
            <div class="stat-label">Piezas Disponibles</div>
            <div class="stat-value" style="color:var(--success)">${Utils.fmtNum(totalDisp)}</div>
            <div class="stat-change up">en almacén</div>
        </div>
        <div class="stat-card" style="cursor:pointer" onclick="App.navigate('inventario')">
            <div class="stat-icon" style="background:var(--info-light);color:var(--info)">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
            </div>
            <div class="stat-label">Piezas en Obra</div>
            <div class="stat-value" style="color:var(--info)">${Utils.fmtNum(totalObra)}</div>
            <div class="stat-change">entregadas</div>
        </div>
        <div class="stat-card" style="cursor:pointer" onclick="App.navigate('inventario')">
            <div class="stat-icon" style="background:var(--warning-light);color:var(--warning)">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
            </div>
            <div class="stat-label">En Mantenimiento</div>
            <div class="stat-value" style="color:var(--warning)">${Utils.fmtNum(totalMto)}</div>
        </div>
    </div>

    <div class="section-header mt-4"><div class="section-title">Acciones Rápidas</div></div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:1rem">
        ${[
            { label: '+ Hoja de Salida', module: 'hs', color: 'var(--success)', icon: '🚛' },
            { label: '+ Hoja de Entrada', module: 'he', color: 'var(--info)', icon: '📥' },
            { label: 'Ver Inventario', module: 'inventario', color: 'var(--purple)', icon: '📦' },
            { label: 'Estado de Cuenta', module: 'estado_cuenta', color: 'var(--warning)', icon: '📊' },
            { label: 'Ver Contratos', module: 'contratos', color: 'var(--primary)', icon: '📄' },
        ].map(a => `
        <div onclick="App.navigate('${a.module}')" style="background:white;border:1px solid var(--border);border-radius:var(--radius-lg);padding:1.25rem;cursor:pointer;transition:var(--transition);text-align:center;box-shadow:var(--shadow-sm)" onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='var(--shadow)'" onmouseout="this.style.transform='';this.style.boxShadow='var(--shadow-sm)'">
            <div style="font-size:1.75rem;margin-bottom:0.5rem">${a.icon}</div>
            <div style="font-size:0.8rem;font-weight:600;color:${a.color}">${a.label}</div>
        </div>`).join('')}
    </div>

    ${c.length ? `
    <div class="section-header mt-6"><div class="section-title">Últimos Contratos (del Macro)</div></div>
    <div class="table-wrapper">
        <table><thead><tr><th>Folio</th><th>Cliente</th><th>Obra</th><th>Sistema</th><th>Tipo</th><th>Importe</th></tr></thead>
        <tbody>${c.slice(0,8).map(x => `<tr style="cursor:pointer" onclick="App.navigate('contratos')">
            <td class="td-mono">${x.numero_contrato}</td>
            <td><strong>${Utils.escapeHtml(x.cliente)}</strong></td>
            <td style="font-size:0.8rem">${Utils.escapeHtml(x.obra || '—')}</td>
            <td style="font-size:0.8rem">${Utils.escapeHtml(x.sistema || '—')}</td>
            <td>${Utils.badgeEstatus(x.tipo === 'EN RENTA' ? 'activo' : 'finalizado')}</td>
            <td class="td-mono">${Utils.fmtMoney((x.subtotal||0) + (x.iva||0))}</td>
        </tr>`).join('')}</tbody></table>
    </div>` : `
    <div class="alert alert-warning mt-6">
        <span><strong>Sin contratos.</strong> Los datos llegarán cuando se ejecute el macro de Excel.</span>
    </div>`}`;
}

// ── Init ──
function init() {
    document.querySelectorAll('.nav-item[data-module]').forEach(el => {
        el.addEventListener('click', e => { e.preventDefault(); App.navigate(el.dataset.module); });
    });

    const badge = document.getElementById('conn-badge');
    if (badge) {
        const { _supabase } = require_supabase();
        badge.textContent = _supabase ? '● Conectado' : '● Sin conexión';
        badge.className = _supabase ? 'badge badge-success' : 'badge badge-danger';
    }

    App.navigate('dashboard');
}

function require_supabase() {
    try { return { _supabase: window.supabase ? true : false }; } catch { return { _supabase: false }; }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
