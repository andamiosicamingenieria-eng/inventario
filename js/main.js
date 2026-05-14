/**
 * INVENTARIO-CONTRATOS — Entry Point
 */
import { Utils } from './utils.js';
import { ModContratos } from './modules/contratos.js';
import { ModHS } from './modules/hs.js';
import { ModHE } from './modules/he.js';
import { ModInventario } from './modules/inventario.js';
import { ModEstadoCuenta } from './modules/estado-cuenta.js';

window.ModContratos = ModContratos;
window.ModHS = ModHS;
window.ModHE = ModHE;
window.ModInventario = ModInventario;
window.ModEstadoCuenta = ModEstadoCuenta;
window.Utils = Utils;

import './app.js';
