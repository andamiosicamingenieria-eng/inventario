import { Auth } from './auth.js';
import { Utils } from './utils.js';
import { DB, _supabase, DEMO_MODE } from './supabase-client.js';
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
import { PDFGenerator } from './modules/pdf-generator.js';


// Asignamos módulos a window para compatibilidad con onclick="..." en el código
window.ModClientes = ModClientes;
window.ModProductos = ModProductos;
window.ModContratos = ModContratos;
window.ModPagos = ModPagos;
window.ModSeguimiento = ModSeguimiento;
window.ModHS = ModHS;
window.ModHE = ModHE;
window.ModInventario = ModInventario;
window.ModFabricacion = ModFabricacion;
window.ModSubArr = ModSubArr;
window.ModEstadoCuenta = ModEstadoCuenta;
window.PDFGenerator = PDFGenerator;


// Asignamos globalmente Utils base si es necesario en onclicks inline del index.html
window.Utils = Utils;

import './app.js'; // Ejecuta app.js
