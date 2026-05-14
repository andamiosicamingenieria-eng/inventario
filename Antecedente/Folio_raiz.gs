// ============================================================
// ICAM 360 — folio_raiz.gs
// Script de Folio Raíz v3 — lógica bidireccional
// NOTA: onOpen() está en contratos.gs — no se duplica aquí
// ============================================================

// ── CONFIGURACIÓN (prefijo FR_ para evitar conflictos) ───────
var FR_SHEET_NAME = '_data_contratos';
var FR_COL_FOLIO  = 'folio_c';
var FR_COL_RAIZ   = 'folio_raiz';
var FR_COL_ANT    = 'renta_anterior';
var FR_COL_POST   = 'renta_posterior';
// ─────────────────────────────────────────────────────────────

/**
 * Trigger automático al editar una celda.
 * Solo actúa si se editó renta_anterior o renta_posterior.
 * NO ejecutar manualmente desde el editor — solo funciona desde el Sheets.
 */
function onEdit(e) {
  if (!e || !e.range) return; // protección si se ejecuta manualmente
  const sheet = e.range.getSheet();
  if (sheet.getName() !== FR_SHEET_NAME) return;

  const cols      = fr_obtenerColumnas(sheet);
  const colEdited = e.range.getColumn();

  if (colEdited !== cols.ant + 1 && colEdited !== cols.post + 1) return;

  recalcularTodo();
}

// ── FUNCIONES PÚBLICAS (menú ICAM 360) ───────────────────────

function recalcularTodo() {
  fr_recalcular(false);
}

function recalcularVacios() {
  fr_recalcular(true);
}

function recalcularFilaActual() {
  const sheet = SpreadsheetApp.getActiveSheet();
  if (sheet.getName() !== FR_SHEET_NAME) {
    SpreadsheetApp.getUi().alert('Activa la pestaña _data_contratos primero.');
    return;
  }
  const row = SpreadsheetApp.getActiveRange().getRow();
  if (row <= 1) return;

  const cols  = fr_obtenerColumnas(sheet);
  const datos = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
  const grafo = fr_construirGrafo(datos, cols);

  const folioActual = String(datos[row - 2][cols.folio]).trim();
  if (!folioActual) return;

  const raiz = fr_resolverRaiz(folioActual, grafo);
  sheet.getRange(row, cols.raiz + 1).setValue(raiz);
}

function diagnosticarCadenas() {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(FR_SHEET_NAME);
  const cols  = fr_obtenerColumnas(sheet);
  const datos = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();

  var enCadena = 0, sinRaiz = 0;
  var raices = new Set();

  for (var i = 0; i < datos.length; i++) {
    var folio = String(datos[i][cols.folio]).trim();
    var raiz  = String(datos[i][cols.raiz]).trim();
    if (!folio) continue;
    if (!raiz)  { sinRaiz++; continue; }
    raices.add(raiz);
    if (raiz !== folio) enCadena++;
  }

  SpreadsheetApp.getUi().alert(
    'Diagnóstico Folio Raíz\n\n' +
    'Total contratos: ' + datos.length + '\n' +
    'Sin folio_raiz: ' + sinRaiz + '\n' +
    'En cadena (raíz distinta al folio): ' + enCadena + '\n' +
    'Familias únicas: ' + raices.size
  );
}

// ── NÚCLEO (funciones internas con prefijo fr_) ───────────────

function fr_recalcular(soloVacios) {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(FR_SHEET_NAME);
  if (!sheet) throw new Error('Pestaña _data_contratos no encontrada.');

  var cols    = fr_obtenerColumnas(sheet);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return;

  var numRows = lastRow - 1;
  var numCols = sheet.getLastColumn();
  var datos   = sheet.getRange(2, 1, numRows, numCols).getValues();
  var grafo   = fr_construirGrafo(datos, cols);

  var resultados = [];
  for (var i = 0; i < numRows; i++) {
    var folio = String(datos[i][cols.folio]).trim();
    if (!folio) {
      resultados.push([datos[i][cols.raiz]]);
      continue;
    }
    var raizActual = String(datos[i][cols.raiz]).trim();
    if (soloVacios && raizActual !== '') {
      resultados.push([raizActual]);
      continue;
    }
    resultados.push([fr_resolverRaiz(folio, grafo)]);
  }

  sheet.getRange(2, cols.raiz + 1, numRows, 1).setValues(resultados);

  if (!soloVacios) {
    SpreadsheetApp.getActiveSpreadsheet().toast(
      'Folio Raíz recalculado para ' + numRows + ' contratos.',
      'ICAM 360',
      4
    );
  }
}

function fr_obtenerColumnas(sheet) {
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var idx = function(name) {
    var i = headers.findIndex(function(h) {
      return String(h).trim().replace('* ', '') === name;
    });
    if (i === -1) throw new Error('Columna "' + name + '" no encontrada.');
    return i;
  };
  return {
    folio : idx(FR_COL_FOLIO),
    raiz  : idx(FR_COL_RAIZ),
    ant   : idx(FR_COL_ANT),
    post  : idx(FR_COL_POST),
  };
}

function fr_construirGrafo(datos, cols) {
  var grafo = {};

  var asegurar = function(f) {
    if (!grafo[f]) grafo[f] = { padres: [], hijos: [] };
  };

  for (var i = 0; i < datos.length; i++) {
    var folio = String(datos[i][cols.folio]).trim();
    if (!folio) continue;
    asegurar(folio);

    var antRaw = String(datos[i][cols.ant]).trim();
    if (antRaw) {
      var padres = antRaw.split('/').map(function(f) { return f.trim(); }).filter(Boolean);
      for (var p = 0; p < padres.length; p++) {
        asegurar(padres[p]);
        if (grafo[folio].padres.indexOf(padres[p]) === -1) grafo[folio].padres.push(padres[p]);
        if (grafo[padres[p]].hijos.indexOf(folio) === -1)  grafo[padres[p]].hijos.push(folio);
      }
    }

    var postRaw = String(datos[i][cols.post]).trim();
    if (postRaw) {
      var hijos = postRaw.split('/').map(function(f) { return f.trim(); }).filter(Boolean);
      for (var h = 0; h < hijos.length; h++) {
        asegurar(hijos[h]);
        if (grafo[folio].hijos.indexOf(hijos[h]) === -1)   grafo[folio].hijos.push(hijos[h]);
        if (grafo[hijos[h]].padres.indexOf(folio) === -1)  grafo[hijos[h]].padres.push(folio);
      }
    }
  }

  return grafo;
}

function fr_resolverRaiz(folio, grafo) {
  var visitados = [];
  var actual    = folio;

  while (true) {
    if (visitados.indexOf(actual) !== -1) break;
    visitados.push(actual);

    var nodo = grafo[actual];
    if (!nodo || nodo.padres.length === 0) break;

    var padresOrdenados = nodo.padres.slice().sort(function(a, b) {
      var na = parseInt(a, 10), nb = parseInt(b, 10);
      if (!isNaN(na) && !isNaN(nb)) return na - nb;
      return a < b ? -1 : 1;
    });

    actual = padresOrdenados[0];
  }

  return actual;
}