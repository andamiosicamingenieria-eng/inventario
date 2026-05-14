/**
 * ICAM 360 - App Principal
 * Enrutador SPA, navegación, toasts, roles de usuario
 */

import { Auth } from './auth.js';
import { DB, DEMO_MODE } from './supabase-client.js';
import { ModClientes } from './modules/clientes.js';
import { ModProductos } from './modules/productos.js';
import { ModContratos } from './modules/contratos.js';
import { ModPagos } from './modules/pagos.js';
import { ModSeguimiento } from './modules/seguimiento.js';
import { ModHS } from './modules/hs.js';
import { ModHE } from './modules/he.js';
import { ModInventario } from './modules/inventario.js';
import { ModFabricacion } from './modules/fabricacion.js';
import { ModSubArr } from './modules/subarr.js';
import { ModEstadoCuenta } from './modules/estado-cuenta.js';

// ── Configuración de módulos ───────────────────────────────
const MODULES = {
    dashboard:   { title: 'Dashboard',              breadcrumb: 'ICAM 360 / Dashboard',              render: renderDashboard             },
    clientes:    { title: 'Clientes',               breadcrumb: 'Catálogos / Clientes',              render: () => ModClientes.render()   },
    productos:   { title: 'Productos',              breadcrumb: 'Catálogos / Productos',             render: () => ModProductos.render()  },
    contratos:   { title: 'Contratos',              breadcrumb: 'Operaciones / Contratos',           render: () => ModContratos.render()  },
    seguimiento: { title: 'Seguimiento',            breadcrumb: 'Operaciones / Seguimiento',         render: () => ModSeguimiento.render() },
    subarr:      { title: 'Sub-Arrendamiento',      breadcrumb: 'Operaciones / Sub-Arrendamiento',   render: () => ModSubArr.render()     },
    pagos:       { title: 'Cobranza y Pagos',       breadcrumb: 'Operaciones / Cobranza',            render: () => ModPagos.render()      },
    hs:          { title: 'Hojas de Salida',        breadcrumb: 'Logística / Hojas de Salida',       render: () => ModHS.render()         },
    he:          { title: 'Hojas de Entrada',       breadcrumb: 'Logística / Hojas de Entrada',      render: () => ModHE.render()         },
    inventario:  { title: 'Inventario',             breadcrumb: 'Almacén / Inventario',              render: () => ModInventario.render() },
    fabricacion: { title: 'Fabricación',            breadcrumb: 'Taller / Fabricación',              render: () => ModFabricacion.render() },
    estado_cuenta: { title: 'Estado de Cuenta',      breadcrumb: 'Operaciones / Estado de Cuenta',    render: (arg) => ModEstadoCuenta.render(arg) },
};

// ── Roles / Permisos (UI) ───────────────────────────────────
// Nota: esto controla SOLO la navegación del SPA. Para seguridad real en datos,
// complementa con RLS/políticas en Supabase por rol.
const ROLE_LABEL = {
    admin: 'Administrador',
    contratos: 'Contratos',
    revisor: 'Revisor de Contratos',
    inventarios: 'Inventarios',
};

const ROLE_MODULES = {
    admin: null, // null = todos los módulos definidos en MODULES
    contratos: new Set(['clientes', 'productos', 'contratos', 'seguimiento', 'pagos', 'estado_cuenta']),
    revisor: new Set(['clientes', 'productos', 'contratos', 'seguimiento', 'pagos', 'estado_cuenta']),
    inventarios: new Set(['productos', 'subarr', 'hs', 'he', 'inventario', 'fabricacion']),
};

function normalizeRole(raw) {
    const r = String(raw || '').trim().toLowerCase();
    if (r === 'admin' || r === 'administrador' || r === 'administrator') return 'admin';
    if (r === 'contratos' || r === 'revisor_contratos' || r === 'revisor-contratos' || r === 'contracts') return 'contratos';
    if (r === 'inventarios' || r === 'inventario' || r === 'almacen' || r === 'warehouse') return 'inventarios';
    return '';
}

function roleFromUser(user) {
    if (!user) return 'admin';
    const metaRole =
        user.app_metadata?.role ||
        user.user_metadata?.role ||
        user.app_metadata?.icam_role ||
        user.user_metadata?.icam_role;

    const normalized = normalizeRole(metaRole);
    if (normalized) return normalized;

    // Fallback por email (útil mientras no existan custom claims)
    const email = String(user.email || '').toLowerCase();
    if (email === 'contratos@icam360.com') return 'contratos';
    if (email === 'inventarios@icam360.com') return 'inventarios';
    return 'admin';
}

function allowedModulesForRole(role) {
    const set = ROLE_MODULES[role];
    if (!set) return null; // admin
    return set;
}

function isModuleAllowed(module) {
    const role = roleFromUser(Auth.getUser());
    const allowed = allowedModulesForRole(role);
    if (!allowed) return true;
    return allowed.has(module);
}

function defaultModuleForRole(role) {
    const allowed = allowedModulesForRole(role);
    if (!allowed) return 'dashboard';
    // Preferencias simples por rol
    if (role === 'contratos') return allowed.has('clientes') ? 'clientes' : [...allowed][0];
    if (role === 'inventarios') return allowed.has('inventario') ? 'inventario' : [...allowed][0];
    return [...allowed][0];
}

function applySidebarAcl() {
    const role = roleFromUser(Auth.getUser());
    const allowed = allowedModulesForRole(role);

    document.querySelectorAll('.nav-item[data-module]').forEach(el => {
        const m = el.dataset.module;
        const ok = !allowed || allowed.has(m);
        el.style.display = ok ? '' : 'none';
        if (!ok) el.classList.remove('active');
    });

    // Ocultar secciones vacías (labels sin items visibles)
    document.querySelectorAll('#sidebar .nav-section').forEach(section => {
        const items = section.querySelectorAll('.nav-item[data-module]');
        if (!items.length) return;
        const anyVisible = [...items].some(i => i.style.display !== 'none');
        section.style.display = anyVisible ? '' : 'none';
    });

    const roleEl = document.getElementById('sidebar-role');
    if (roleEl) roleEl.textContent = ROLE_LABEL[role] || role;
}

// ── Estado de la App ───────────────────────────────────────
let currentModule = 'dashboard';

// ── APP Global API ─────────────────────────────────────────
window.App = {
    navigate(module, arg = null, opts = {}) {
        if (!MODULES[module]) return;
        if (!opts.skipAcl && !isModuleAllowed(module)) {
            App.toast('No tienes permiso para acceder a este módulo', 'danger');
            const role = roleFromUser(Auth.getUser());
            App.navigate(defaultModuleForRole(role), null, { skipAcl: true });
            return;
        }
        currentModule = module;

        // Actualizar sidebar
        document.querySelectorAll('.nav-item').forEach(el => {
            el.classList.toggle('active', el.dataset.module === module);
        });

        // Actualizar header
        document.getElementById('header-title').textContent = MODULES[module].title;
        document.getElementById('header-breadcrumb').textContent = MODULES[module].breadcrumb;

        // Render
        const mc = document.getElementById('module-content');
        mc.innerHTML = `<div class="loading-center"><div class="spinner"></div><span>Cargando…</span></div>`;
        setTimeout(async () => {
            try {
                const renderResult = MODULES[module].render(arg);
                if (renderResult instanceof Promise) {
                    await renderResult;
                }
            } catch (e) {
                console.error('Error en módulo:', e);
                mc.innerHTML = `<div class="alert alert-danger"><span>Error al cargar el módulo: ${e.message}</span></div>`;
            }
        }, 50);
    },

    toast(msg, type = 'success') {
        const container = document.getElementById('toast-container');
        const icons = {
            success: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>',
            danger:  '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
            warning: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
        };
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `${icons[type] || ''}<span>${msg}</span>`;
        container.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(100%)';
            toast.style.transition = 'all 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    },
};

// ── Dashboard ──────────────────────────────────────────────
async function renderDashboard() {
    const mc = document.getElementById('module-content');
    mc.innerHTML = '<div class="loading-center"><div class="spinner"></div><div style="margin-top:1rem;color:var(--text-secondary)">Cargando Dashboard...</div></div>';

    // Fetch realtime data for dashboard
    const [rawContratos, rawClientes, rawInventario] = await Promise.all([
        DB.getAll('ops_contratos', { orderBy: 'folio', ascending: false }),
        DB.getAll('crm_clientes'),
        DB.getAll('inv_master')
    ]);

    const contratos = rawContratos || [];
    const clientes = rawClientes || [];
    
    // Process inventory
    let totalDisp = 0;
    if (rawInventario) {
        rawInventario.forEach(i => { totalDisp += (i.cantidad_disponible || 0) });
    }

    const hoy    = new Date();
    const activos = contratos.filter(c => c.estatus === 'activo').length;
    const vencidos = contratos.filter(c => {
        if (!c.fecha_vencimiento) return false;
        return new Date(c.fecha_vencimiento + 'T12:00:00') < hoy;
    }).length;
    mc.innerHTML = `
    <!-- Bienvenida -->
    <div class="card mb-4" style="background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%); border: none; color: white;">
        <div class="card-body" style="padding: 2rem;">
            <div class="flex justify-between items-center">
                <div>
                    <h2 style="font-size: 1.5rem; font-weight: 800; margin-bottom: 0.5rem;">Bienvenido a ICAM 360</h2>
                    <p style="opacity: 0.85; font-size: 0.9rem;">Sistema ERP de Gestión de Andamios — ${new Date().toLocaleDateString('es-MX', {weekday:'long', year:'numeric', month:'long', day:'numeric'})}</p>
                </div>
                <div style="opacity: 0.3;">
                    <svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
                </div>
            </div>
        </div>
    </div>

    <!-- KPIs -->
    <div class="stats-grid">
        <div class="stat-card" style="cursor:pointer" onclick="App.navigate('contratos')">
            <div class="stat-icon" style="background:var(--primary-light);color:var(--primary)">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            </div>
            <div class="stat-label">Total Contratos</div>
            <div class="stat-value">${contratos.length}</div>
            <div class="stat-change up">↑ Ver todos</div>
        </div>
        <div class="stat-card" style="cursor:pointer" onclick="App.navigate('seguimiento')">
            <div class="stat-icon" style="background:var(--success-light);color:var(--success)">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            </div>
            <div class="stat-label">Contratos Activos</div>
            <div class="stat-value" style="color:var(--success)">${activos}</div>
            <div class="stat-change up">↑ Ver seguimiento</div>
        </div>
        <div class="stat-card" style="cursor:pointer" onclick="App.navigate('seguimiento')">
            <div class="stat-icon" style="background:var(--danger-light);color:var(--danger)">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            </div>
            <div class="stat-label">Vencidos</div>
            <div class="stat-value" style="color:var(--danger)">${vencidos}</div>
            <div class="stat-change down">${vencidos > 0 ? '⚠ Requieren atención' : '✓ Sin vencidos'}</div>
        </div>
        <div class="stat-card" style="cursor:pointer" onclick="App.navigate('clientes')">
            <div class="stat-icon" style="background:var(--purple-light);color:var(--purple)">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
            </div>
            <div class="stat-label">Clientes</div>
            <div class="stat-value">${clientes.length}</div>
            <div class="stat-change up">↑ Ver clientes</div>
        </div>
        <div class="stat-card" style="cursor:pointer" onclick="App.navigate('inventario')">
            <div class="stat-icon" style="background:var(--info-light);color:var(--info)">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>
            </div>
            <div class="stat-label">Total Piezas Disponibles</div>
            <div class="stat-value">${totalDisp.toLocaleString('es-MX')}</div>
            <div class="stat-change up">↑ Ver inventario</div>
        </div>
    </div>

    <!-- Accesos rápidos -->
    <div class="section-header mt-4">
        <div class="section-title">Acciones Rápidas</div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:1rem">
        ${[
            { label: '+ Nuevo Contrato', module: 'contratos', color: 'var(--primary)', icon: '📄' },
            { label: '+ Nueva Hoja de Salida', module: 'hs', color: 'var(--success)', icon: '🚛' },
            { label: '+ Nueva Hoja de Entrada', module: 'he', color: 'var(--info)', icon: '📥' },
            { label: 'Ver Seguimiento', module: 'seguimiento', color: 'var(--warning)', icon: '📊' },
            { label: 'Inventario', module: 'inventario', color: 'var(--purple)', icon: '📦' },
            { label: 'Fabricación', module: 'fabricacion', color: '#64748b', icon: '🔧' },
        ].map(a => `
        <div onclick="App.navigate('${a.module}')" style="
            background: white;
            border: 1px solid var(--border);
            border-radius: var(--radius-lg);
            padding: 1.25rem;
            cursor: pointer;
            transition: var(--transition);
            text-align: center;
            box-shadow: var(--shadow-sm);
        " onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='var(--shadow)'"
           onmouseout="this.style.transform='';this.style.boxShadow='var(--shadow-sm)'">
            <div style="font-size: 1.75rem; margin-bottom: 0.5rem;">${a.icon}</div>
            <div style="font-size: 0.8rem; font-weight: 600; color: ${a.color}">${a.label}</div>
        </div>`).join('')}
    </div>

    <!-- Últimos contratos -->
    ${contratos.length ? `
    <div class="section-header mt-6">
        <div class="section-title">Contratos Recientes</div>
    </div>
    <div class="table-wrapper">
        <table>
            <thead><tr><th>Folio</th><th>Cliente</th><th>Tipo</th><th>Estatus</th><th>Importe</th><th>Vencimiento</th></tr></thead>
            <tbody>
            ${contratos.slice(0, 5).map(c => {
                const badgeTipo = { renta:'badge-info', venta:'badge-purple', renovacion:'badge-primary', venta_perdida:'badge-danger', cancelacion:'badge-gray' };
                const badgeEst  = { activo:'badge-success', entrega_parcial:'badge-warning', recolectado:'badge-success', borrador:'badge-gray', cancelado:'badge-gray' };
                return `<tr onclick="App.navigate('contratos')" style="cursor:pointer">
                    <td class="td-mono">${c.folio}</td>
                    <td>${c.razon_social || '—'}</td>
                    <td><span class="badge ${badgeTipo[c.tipo_contrato]||'badge-gray'}">${(c.tipo_contrato||'').replace('_',' ')}</span></td>
                    <td><span class="badge ${badgeEst[c.estatus]||'badge-gray'}">${(c.estatus||'').replace('_',' ')}</span></td>
                    <td class="td-mono">$${Number(c.monto_total||0).toLocaleString('es-MX',{minimumFractionDigits:2})}</td>
                    <td style="color:${c.fecha_vencimiento && new Date(c.fecha_vencimiento+'T12:00:00') < hoy ? 'var(--danger)' : 'var(--text-secondary)'}">
                        ${c.fecha_vencimiento ? new Date(c.fecha_vencimiento+'T12:00:00').toLocaleDateString('es-MX') : '—'}
                    </td>
                </tr>`;
            }).join('')}
            </tbody>
        </table>
    </div>` : ''}

    <!-- Modo Demo aviso -->
    ${DEMO_MODE ? `
    <div class="alert alert-warning mt-6">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        <span><strong>Modo Demo activo.</strong> Los datos son de ejemplo. Para conectar con tu base de datos real, actualiza <code style="background:rgba(0,0,0,0.1);padding:1px 4px;border-radius:3px">js/supabase-client.js</code> con tu URL y clave de Supabase.</span>
    </div>` : ''}`;
}

// ── Inicialización y Autenticación ─────────────────────────
async function initApp() {
    try {
        console.log('🚀 [APP] Iniciando aplicación ICAM 360...');
        
        const appShell = document.getElementById('app-shell');
        const loginView = document.getElementById('login-view');
        const loginForm = document.getElementById('login-form');
        const loginError = document.getElementById('login-error');
        const btnLogout = document.getElementById('btn-logout');

        if (!appShell || !loginView) {
            throw new Error('Elementos HTML no encontrados. Verifica que index.html esté completo.');
        }

        console.log('✓ Elementos HTML encontrados');

        // Inicializar Auth
        console.log('⏳ Inicializando Auth...');
        const isLoggedIn = await Auth.init();
        console.log('✓ Auth inicializado. isLoggedIn:', isLoggedIn);

        if (isLoggedIn) {
            console.log('🔓 Usuario ya conectado, mostrando app');
            showApp();
        } else {
            console.log('🔐 Usuario no conectado, mostrando login');
            showLogin();
        }

        // Login Form Submit
        if (loginForm) {
            loginForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                loginError.style.display = 'none';
                
                const email = document.getElementById('login-email').value;
                const password = document.getElementById('login-password').value;
                
                console.log(`🔑 Intento de login con: ${email}`);
                
                const btn = loginForm.querySelector('button');
                const oldText = btn.textContent;
                btn.textContent = 'Iniciando...';
                btn.disabled = true;

                const result = await Auth.login(email, password);
                
                btn.textContent = oldText;
                btn.disabled = false;

                if (result.error) {
                    console.error('❌ Login error:', result.error);
                    loginError.textContent = result.error;
                    loginError.style.display = 'block';
                } else {
                    console.log('✅ Login exitoso');
                    document.dispatchEvent(new CustomEvent('auth:login', { detail: { user: result } }));
                }
            });
        }

        // Logout Click
        if (btnLogout) {
            btnLogout.addEventListener('click', async () => {
                if (confirm('¿Cerrar sesión?')) {
                    await Auth.logout();
                }
            });
        }

        // Event Listeners globales de Auth
        document.addEventListener('auth:login', (e) => {
            console.log('📢 Evento auth:login recibido');
            showApp();
        });

        document.addEventListener('auth:logout', () => {
            console.log('📢 Evento auth:logout recibido');
            showLogin();
        });

        function showApp() {
            console.log('🎨 Mostrando app...');
            loginView.style.display = 'none';
            appShell.style.display = 'flex';
            
            const user = Auth.getUser();
            if (user) {
                document.getElementById('sidebar-username').textContent = user.email || 'Operador';
                document.getElementById('sidebar-role').textContent = ROLE_LABEL[roleFromUser(user)] || 'Usuario';
            } else if (typeof DEMO_MODE !== 'undefined' && DEMO_MODE) {
                document.getElementById('sidebar-username').textContent = 'Admin (Demo)';
                document.getElementById('sidebar-role').textContent = 'Administrador';
            }

            applySidebarAcl();

            const role = roleFromUser(Auth.getUser());
            const landing = defaultModuleForRole(role);
            // Si el módulo actual no está permitido, forzar landing
            if (!isModuleAllowed(currentModule)) {
                currentModule = landing;
            }

            App.navigate(currentModule || landing);
        }

        function showLogin() {
            console.log('🎨 Mostrando login...');
            appShell.style.display = 'none';
            loginView.style.display = 'flex';
            if (loginForm) loginForm.reset();
            const mc = document.getElementById('module-content');
            if (mc) mc.innerHTML = '';
        }

        // Conectar navegación del sidebar
        document.querySelectorAll('.nav-item[data-module]').forEach(el => {
            el.addEventListener('click', (e) => {
                e.preventDefault();
                App.navigate(el.dataset.module);
            });
        });

        // Actualizar badge de modo demo/conectado
        const badge = document.getElementById('conn-badge');
        if (badge) {
            if (!DEMO_MODE) {
                badge.textContent = '● Supabase Conectado';
                badge.className = 'badge badge-success';
            } else {
                badge.textContent = '● Modo Demo';
                badge.className = 'badge badge-warning';
            }
        }

        console.log('✅ [APP] Aplicación iniciada correctamente');
    } catch (error) {
        console.error('❌ [APP FATAL ERROR]', error);
        console.error('Stack:', error.stack);
        
        // Mostrar error visual
        document.body.innerHTML = `
            <div style="
                font-family: 'Courier New', monospace;
                background: #1a1a1a;
                color: #ff3333;
                padding: 40px;
                margin: 20px;
                border: 2px solid #ff3333;
                border-radius: 8px;
                max-width: 900px;
                margin: 40px auto;
            ">
                <h2 style="color: #ff6666; margin-bottom: 20px;">❌ Error Fatal en la Aplicación</h2>
                <p><strong>Tipo:</strong> ${error.name}</p>
                <p><strong>Mensaje:</strong> ${error.message}</p>
                <details style="margin-top: 20px; color: #ffaa00;">
                    <summary style="cursor: pointer; margin-bottom: 10px;">📍 Stack Trace (Click para ver)</summary>
                    <pre style="background: #0a0a0a; padding: 15px; border-radius: 4px; overflow-x: auto; color: #ff9999;">${error.stack}</pre>
                </details>
                <p style="margin-top: 30px; color: #ffaa00; font-size: 0.9rem;">
                    Abre la consola del navegador (F12 → Console) para más información. Copia el error y contáctate con soporte.
                </p>
            </div>
        `;
    }
}


// Ejecutar initApp si el DOM ya cargó, o esperar al evento
async function startApp() {
    try {
        console.log('🚀 [APP] Iniciando aplicación...');
        await initApp();
        console.log('✅ [APP] Aplicación iniciada correctamente');
    } catch (error) {
        console.error('❌ [APP ERROR] Error fatal:', error);
        console.error('Stack:', error.stack);
        // Mostrar error en la página
        document.body.innerHTML = `
            <div style="
                font-family: monospace;
                background: #1a1a1a;
                color: #ff3333;
                padding: 40px;
                margin: 20px;
                border: 2px solid #ff3333;
                border-radius: 8px;
            ">
                <h2 style="color: #ff6666; margin-bottom: 20px;">❌ Error Fatal en la Aplicación</h2>
                <p><strong>Mensaje:</strong> ${error.message}</p>
                <p><strong>Stack:</strong></p>
                <pre style="background: #0a0a0a; padding: 15px; border-radius: 4px; overflow-x: auto;">${error.stack}</pre>
                <p style="margin-top: 20px; color: #ffaa00;">Abre la consola (F12) para más detalles.</p>
            </div>
        `;
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startApp);
} else {
    startApp();
}
