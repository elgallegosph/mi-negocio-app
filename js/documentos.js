/* Recibos y cierres en PDF, Excel, respaldos e importación */
'use strict';

const LIBS = {
  pdf: ['https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js', () => window.jspdf],
  xlsx: ['https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js', () => window.XLSX],
};
const _libPromesas = {};
function lib(n) {
  if (LIBS[n][1]()) return Promise.resolve();
  return _libPromesas[n] || (_libPromesas[n] = new Promise((res, rej) => {
    const s = document.createElement('script'); s.src = LIBS[n][0]; s.async = true;
    s.onload = () => res(); s.onerror = () => { delete _libPromesas[n]; s.remove(); rej(new Error('No se pudo cargar la herramienta de archivos. Revisa la conexión a internet.')); };
    document.head.appendChild(s);
  }));
}

let _logoCache = null;
function logoDataURL() {
  if (_logoCache) return Promise.resolve(_logoCache);
  return new Promise(res => {
    const img = new Image();
    img.onload = () => {
      try {
        const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
        c.getContext('2d').drawImage(img, 0, 0); _logoCache = c.toDataURL('image/png'); res(_logoCache);
      } catch { res(null); }
    };
    img.onerror = () => res(null);
    img.src = window.LOGO_SRC || 'logo-sm.png';
  });
}

/* Dibuja un tiquete de 80 mm. draw(t) usa t.text/t.row/t.line/t.gap; se mide primero y luego se dibuja */
function tiquete(draw, logo) {
  const { jsPDF } = window.jspdf;
  const W = 80, M = 5;
  const run = (doc) => {
    let y = 6;
    const t = {
      doc, W, M,
      logo() { if (logo) { doc.addImage(logo, 'PNG', (W - 22) / 2, y, 22, 22); y += 24; } },
      text(s, { size = 8.5, bold = false, align = 'left', color = 20 } = {}) {
        doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(size); doc.setTextColor(color);
        const lines = doc.splitTextToSize(String(s ?? ''), W - 2 * M);
        lines.forEach(l => { y += size * 0.42; doc.text(l, align === 'center' ? W / 2 : align === 'right' ? W - M : M, y, { align }); y += 1.1; });
      },
      row(a, b, { size = 8.5, bold = false } = {}) {
        doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(size); doc.setTextColor(20);
        const bw = doc.getTextWidth(String(b)) + 3;
        const lines = doc.splitTextToSize(String(a), W - 2 * M - bw);
        y += size * 0.42;
        doc.text(String(b), W - M, y, { align: 'right' });
        lines.forEach((l, i) => { if (i) y += size * 0.42 + 1.1; doc.text(l, M, y); });
        y += 1.4;
      },
      line(dash = true) { y += 1.5; doc.setDrawColor(150); doc.setLineWidth(0.2); if (dash) doc.setLineDashPattern([0.8, 0.8], 0); doc.line(M, y, W - M, y); doc.setLineDashPattern([], 0); y += 1.5; },
      gap(n = 2) { y += n; },
      get y() { return y; },
    };
    draw(t);
    return y;
  };
  const alto = run(new jsPDF({ unit: 'mm', format: [W, 1000] })) + 8;
  const doc = new jsPDF({ unit: 'mm', format: [W, Math.max(alto, 60)] });
  run(doc);
  return doc;
}

function encabezadoNegocio(t) {
  const c = cfg();
  t.logo();
  t.text(c.nombre.toUpperCase(), { size: 12, bold: true, align: 'center' });
  if (c.nit) t.text('NIT ' + c.nit, { align: 'center', size: 8 });
  if (c.direccion) t.text(c.direccion + (c.ciudad ? ', ' + c.ciudad : ''), { align: 'center', size: 8 });
  if (c.telefono) t.text('Tel. / WhatsApp ' + c.telefono, { align: 'center', size: 8 });
}

async function reciboPDF(v) {
  await lib('pdf');
  const logo = await logoDataURL();
  const tipoTxt = { contado: 'Venta de contado', fiado: 'Venta a crédito (fiado)', separado: 'Separado' }[v.tipo] || 'Venta';
  const abonos = DB.all('abonos').filter(a => a.ventaId === v.id && !a.anulado).sort((a, b) => a.fecha.localeCompare(b.fecha));
  const doc = tiquete(t => {
    encabezadoNegocio(t);
    t.line();
    t.text(`RECIBO N° ${v.numero}`, { bold: true, size: 10, align: 'center' });
    t.text(fmtFechaHora(v.fecha), { align: 'center', size: 8 });
    t.text(tipoTxt, { align: 'center', size: 8 });
    if (v.estado === 'anulada') t.text('*** VENTA ANULADA ***', { bold: true, align: 'center', size: 10 });
    t.line();
    if (v.clienteNombre) t.row('Cliente', v.clienteNombre, { size: 8 });
    if (v.clienteTel) t.row('Teléfono', v.clienteTel, { size: 8 });
    if (v.clienteNombre || v.clienteTel) t.line();
    v.items.forEach(i => {
      t.text(i.nombre, { size: 8.5 });
      t.row(`  ${i.cantidad} x ${money(i.precio)}`, money(i.cantidad * i.precio), { size: 8 });
    });
    t.line();
    if (v.descuento) { t.row('Subtotal', money(v.subtotal)); t.row('Descuento', '-' + money(v.descuento)); }
    t.row('TOTAL', money(v.total), { bold: true, size: 11 });
    t.gap(1);
    if (v.tipo === 'contado') {
      t.row('Pago', v.metodo);
      if (v.recibido) { t.row('Recibido', money(v.recibido)); t.row('Cambio', money(v.cambio)); }
    } else {
      abonos.forEach(a => t.row(`Abono ${fmtFecha(a.fecha)} (${a.metodo})`, money(a.valor), { size: 8 }));
      t.row('Total abonado', money(v.abonado || 0));
      t.row('SALDO PENDIENTE', money(v.saldo || 0), { bold: true, size: 10 });
      if (v.tipo === 'separado') t.text(v.entregado ? 'Producto entregado.' : 'El producto se entrega al completar el pago.', { size: 8 });
    }
    t.line();
    if (cfg().piePagina) t.text(cfg().piePagina, { align: 'center', size: 8 });
    t.gap(2);
  }, logo);
  return doc.output('blob');
}

async function cierrePDF(caja) {
  await lib('pdf');
  const logo = await logoDataURL();
  const r = caja.resumen || {};
  const doc = tiquete(t => {
    encabezadoNegocio(t);
    t.line();
    t.text('CIERRE DE CAJA', { bold: true, size: 11, align: 'center' });
    t.text(`Abrió: ${fmtFechaHora(caja.apertura)}`, { size: 8, align: 'center' });
    t.text(`Cerró: ${fmtFechaHora(caja.cierre)}`, { size: 8, align: 'center' });
    t.line();
    t.text('EFECTIVO', { bold: true });
    t.row('Base inicial', money(r.base));
    t.row('+ Ventas en efectivo', money(r.efectivoVentas));
    t.row('+ Abonos en efectivo', money(r.efectivoAbonos));
    if (r.ingresos) t.row('+ Otros ingresos', money(r.ingresos));
    t.row('- Gastos en efectivo', money(r.efectivoGastos));
    if (r.retiros) t.row('- Retiros', money(r.retiros));
    t.row('Debía haber', money(caja.esperado), { bold: true });
    t.row('Se contó', money(caja.contado), { bold: true });
    const d = caja.diferencia || 0;
    t.row(d === 0 ? 'Cuadra' : d > 0 ? 'Sobrante' : 'Faltante', money(Math.abs(d)), { bold: true, size: 10 });
    if (caja.baseSiguiente) t.row('Se deja de base', money(caja.baseSiguiente));
    t.line();
    t.text('OTROS MEDIOS DE PAGO', { bold: true });
    Object.entries(r.porMetodo || {}).filter(([m]) => m !== 'Efectivo').forEach(([m, x]) => t.row(m, money((x.ventas || 0) + (x.abonos || 0) - (x.gastos || 0))));
    t.line();
    t.row('Ventas registradas', String(r.numVentas || 0));
    if (r.numAnuladas) t.row('Ventas anuladas', String(r.numAnuladas));
    t.row('Total vendido', money(r.totalVendido));
    t.row('Vendido a crédito', money(r.credito));
    t.row('Dinero recibido', money(r.totalRecaudado));
    t.row('Gastos', money(r.totalGastos));
    const det = caja.detalleConteo || {};
    const dens = Object.entries(det).filter(([, q]) => Number(q) > 0);
    if (dens.length) {
      t.line(); t.text('CONTEO', { bold: true });
      dens.sort((a, b) => Number(b[0]) - Number(a[0])).forEach(([den, q]) => t.row(`${q} x ${money(Number(den))}`, money(q * Number(den)), { size: 8 }));
    }
    if (caja.notaCierre) { t.line(); t.text('Nota: ' + caja.notaCierre, { size: 8 }); }
    t.gap(2);
  }, logo);
  return doc.output('blob');
}

function textoReciboWhatsApp(v) {
  const c = cfg();
  const lineas = v.items.map(i => `• ${i.cantidad} x ${i.nombre}: ${money(i.precio * i.cantidad)}`).join('\n');
  let s = `¡Hola${v.clienteNombre ? ' ' + v.clienteNombre.split(' ')[0] : ''}! Gracias por tu compra en *${c.nombre}*.\n\n*Recibo N° ${v.numero}* · ${fmtFecha(v.fecha)}\n${lineas}\n`;
  if (v.descuento) s += `Descuento: -${money(v.descuento)}\n`;
  s += `*Total: ${money(v.total)}*\n`;
  if (v.tipo !== 'contado') s += `Abonado: ${money(v.abonado || 0)}\n*Saldo: ${money(v.saldo || 0)}*\n`;
  if (v.tipo === 'separado' && !v.entregado) s += `Tu pedido queda separado y se entrega al completar el pago.\n`;
  return s.trim();
}

function textoCobroWhatsApp(nombre, ventas) {
  const c = cfg();
  const total = sum(ventas, v => v.saldo);
  const det = ventas.map(v => `• Recibo ${v.numero} (${fmtFecha(v.fecha)}): ${money(v.saldo)}`).join('\n');
  return `¡Hola ${String(nombre || '').split(' ')[0]}! Te escribimos de *${c.nombre}* para recordarte tu saldo pendiente:\n\n${det}\n\n*Total: ${money(total)}*\n\nPuedes abonar por transferencia o en la tienda. ¡Gracias!`;
}

/* ---------- Excel ---------- */
async function libroExcel(hojas) {
  await lib('xlsx');
  const wb = XLSX.utils.book_new();
  Object.entries(hojas).forEach(([nombre, filas]) => {
    const ws = XLSX.utils.json_to_sheet(filas.length ? filas : [{ '(sin datos)': '' }]);
    const cols = Object.keys(filas[0] || { x: 1 }).map(k => ({ wch: Math.min(40, Math.max(10, k.length + 2, ...filas.slice(0, 200).map(f => String(f[k] ?? '').length + 1))) }));
    ws['!cols'] = cols;
    XLSX.utils.book_append_sheet(wb, ws, nombre.slice(0, 31));
  });
  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

async function exportarExcel(r) {
  const dentro = x => !r || enRango(x.dia, r);
  const ventas = DB.all('ventas').filter(dentro).sort((a, b) => a.fecha.localeCompare(b.fecha));
  return libroExcel({
    'Ventas': ventas.map(v => ({
      'N°': v.numero, Fecha: fmtFecha(v.fecha), Hora: fmtHora(v.fecha), Tipo: v.tipo, Estado: v.estado, Clienta: v.clienteNombre, Teléfono: v.clienteTel,
      Subtotal: v.subtotal, Descuento: v.descuento, Total: v.total, Costo: v.costoTotal, Ganancia: v.estado === 'anulada' ? 0 : v.total - (v.costoTotal || 0),
      'Medio de pago': v.metodo, Abonado: v.abonado, Saldo: v.saldo, Usuario: v.usuario, Nota: v.nota,
    })),
    'Detalle ventas': ventas.flatMap(v => v.items.map(i => ({ 'N°': v.numero, Fecha: fmtFecha(v.fecha), Estado: v.estado, Producto: i.nombre, Categoría: i.categoria, Cantidad: i.cantidad, Precio: i.precio, Costo: i.costo, Total: i.precio * i.cantidad }))),
    'Abonos': DB.all('abonos').filter(dentro).sort((a, b) => a.fecha.localeCompare(b.fecha)).map(a => ({ Fecha: fmtFechaHora(a.fecha), 'Venta N°': a.ventaNumero, Clienta: a.clienteNombre, Valor: a.valor, 'Medio de pago': a.metodo, Anulado: a.anulado ? 'Sí' : 'No' })),
    'Gastos': DB.all('gastos').filter(dentro).sort((a, b) => a.fecha.localeCompare(b.fecha)).map(g => ({ Fecha: fmtFecha(g.fecha), Categoría: g.categoria, Descripción: g.descripcion, Proveedor: g.proveedor, Valor: g.valor, 'Medio de pago': g.metodo, Anulado: g.anulado ? 'Sí' : 'No' })),
    'Por cobrar': ventasConSaldo().map(v => ({ 'N°': v.numero, Fecha: fmtFecha(v.fecha), Tipo: v.tipo, Clienta: v.clienteNombre, Teléfono: v.clienteTel, Total: v.total, Abonado: v.abonado, Saldo: v.saldo, 'Días': diasDesde(v.fecha) })),
    'Inventario': productosActivos().map(p => ({ Código: p.codigo, Producto: p.nombre, Categoría: p.categoria, Precio: p.precio, Costo: p.costo, Stock: p.stock, 'Stock mínimo': p.stockMin, 'Valor a costo': Math.max(stockDe(p), 0) * (p.costo || 0), 'Valor a precio': Math.max(stockDe(p), 0) * (p.precio || 0), Estado: estadoStock(p) })),
    'Movimientos': DB.all('movimientos').filter(dentro).sort((a, b) => a.fecha.localeCompare(b.fecha)).map(m => ({ Fecha: fmtFechaHora(m.fecha), Producto: m.productoNombre, Tipo: m.tipo, Cantidad: m.cantidad, 'Costo unit.': m.costoUnit, Proveedor: m.proveedor, Referencia: m.refNumero || '', Nota: m.nota })),
    'Cierres de caja': DB.all('cajas').filter(c => !c.abierta && dentro(c)).sort((a, b) => a.apertura.localeCompare(b.apertura)).map(c => ({ Apertura: fmtFechaHora(c.apertura), Cierre: fmtFechaHora(c.cierre), Base: c.base, 'Debía haber': c.esperado, Contado: c.contado, Diferencia: c.diferencia, 'Total vendido': c.resumen?.totalVendido, Recaudado: c.resumen?.totalRecaudado, Nota: c.notaCierre })),
    'Clientas': DB.all('clientes').map(c => ({ Nombre: c.nombre, Teléfono: c.tel, Nota: c.nota })),
  });
}

/* ---------- Respaldo completo ---------- */
function respaldoJSON() {
  const data = {}; COLECCIONES.forEach(c => data[c] = DB.all(c));
  return new Blob([JSON.stringify({ app: 'amare', version: 2, fecha: new Date().toISOString(), data }, null, 1)], { type: 'application/json' });
}
async function restaurarRespaldo(json) {
  if (!json || !json.data) throw new Error('El archivo no es un respaldo de esta app.');
  const ops = [];
  COLECCIONES.forEach(c => (json.data[c] || []).forEach(d => { const { id, ...rest } = d; if (id) ops.push({ t: 'set', col: c, id, data: rest }); }));
  await DB.commit(ops);
  return ops.length;
}

/* ---------- Importar desde Excel/CSV ---------- */
async function leerHoja(file) {
  await lib('xlsx');
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(ws, { defval: '' });
}
function campo(fila, ...nombres) {
  const keys = Object.keys(fila);
  for (const n of nombres) { const k = keys.find(k => norm(k).replace(/[^a-z]/g, '') === n); if (k !== undefined && fila[k] !== '') return fila[k]; }
  return '';
}
function filasAProductos(filas) {
  return filas.map(f => ({
    nombre: String(campo(f, 'nombre', 'producto', 'descripcion')).trim(),
    codigo: String(campo(f, 'codigo', 'sku', 'referencia', 'ref')).trim(),
    categoria: String(campo(f, 'categoria', 'linea', 'tipo')).trim(),
    precio: parseMoney(campo(f, 'precio', 'preciodeventa', 'precioventa', 'pvp', 'valor')),
    costo: parseMoney(campo(f, 'costo', 'preciodecompra', 'preciocompra', 'costounitario')),
    stock: campo(f, 'stock', 'cantidad', 'existencias', 'inventario', 'unidades'),
    stockMin: campo(f, 'stockminimo', 'minimo', 'stockmin'),
  })).filter(p => p.nombre);
}
async function importarProductos(lista, { actualizarStock }) {
  const existentes = DB.all('productos');
  const ops = []; let nuevos = 0, actualizados = 0;
  const cats = new Set(cfg().categorias);
  lista.forEach(p => {
    if (p.categoria) cats.add(p.categoria);
    const ex = existentes.find(e => (p.codigo && e.codigo && e.codigo === p.codigo) || norm(e.nombre) === norm(p.nombre));
    if (ex) {
      actualizados++;
      const upd = { activo: true };
      if (p.precio) upd.precio = p.precio; if (p.costo) upd.costo = p.costo; if (p.categoria) upd.categoria = p.categoria; if (p.codigo) upd.codigo = p.codigo;
      if (p.stockMin !== '') upd.stockMin = parseQty(p.stockMin);
      if (actualizarStock && p.stock !== '') {
        const delta = parseQty(p.stock) - stockDe(ex);
        if (delta) { upd.stock = { $inc: delta }; ops.push(movOp({ productoId: ex.id, nombre: ex.nombre, tipo: 'ajuste', cantidad: delta, costoUnit: p.costo || ex.costo, nota: 'Importación de archivo' })); }
      }
      ops.push({ t: 'update', col: 'productos', id: ex.id, data: upd });
    } else {
      nuevos++;
      const id = DB.newId(); const stock = parseQty(p.stock);
      ops.push({ t: 'set', col: 'productos', id, data: { nombre: p.nombre, codigo: p.codigo, categoria: p.categoria || 'Otros', precio: p.precio, costo: p.costo, stock, stockMin: p.stockMin === '' ? cfg().stockMinDef : parseQty(p.stockMin), activo: true, creado: new Date().toISOString() } });
      if (stock) ops.push(movOp({ productoId: id, nombre: p.nombre, tipo: 'inicial', cantidad: stock, costoUnit: p.costo, nota: 'Importación de archivo' }));
    }
  });
  if (cats.size !== cfg().categorias.length) ops.push({ t: 'update', col: 'config', id: 'general', data: { categorias: Array.from(cats) } });
  await DB.commit(ops);
  return { nuevos, actualizados };
}
async function importarClientes(filas) {
  const ops = []; let n = 0; const vistos = new Set();
  filas.forEach(f => {
    const nombre = String(campo(f, 'nombre', 'cliente', 'clienta')).trim();
    const tel = telLimpio(campo(f, 'telefono', 'tel', 'celular', 'whatsapp', 'movil'));
    if (!nombre && !tel) return;
    if (tel && (buscarClientePorTel(tel) || vistos.has(tel))) return;
    if (tel) vistos.add(tel);
    n++;
    ops.push({ t: 'set', col: 'clientes', id: tel ? 'c' + tel : DB.newId(), data: { nombre: nombre || 'Clienta', tel, nota: '', creado: new Date().toISOString() } });
  });
  await DB.commit(ops);
  return n;
}
function plantillaProductos() {
  return libroExcel({ Productos: [{ Codigo: 'LAB-001', Nombre: 'Labial mate rojo', Categoria: 'Labios', Precio: 25000, Costo: 12000, Stock: 10, 'Stock minimo': 3 }] });
}
