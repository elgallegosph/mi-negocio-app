/* Reglas del negocio: ventas, inventario, caja, cartera, gastos y reportes */
'use strict';
 
const CONFIG_DEF = {
  nombre: 'Amare Beauty',
  nit: '', telefono: '', direccion: '', ciudad: '',
  piePagina: '¡Gracias por tu compra! Cambios dentro de los 5 días con el recibo.',
  categorias: ['Labios', 'Rostro', 'Ojos', 'Cuidado de la piel', 'Uñas', 'Accesorios', 'Otros'],
  metodos: ['Efectivo', 'Transferencia', 'Nequi', 'Daviplata', 'Tarjeta'],
  categoriasGasto: ['Arriendo', 'Servicios', 'Transporte', 'Publicidad', 'Empaques', 'Nómina', 'Otros', 'Compra de mercancía'],
  pinAdmin: '',
  stockMinDef: 3,
  codigoPais: '57',
  catalogoUrl: 'https://canva.link/6efvhh4xah3pndl',
  mensajeDifusion: '¡Hola {nombre}! Llegaron productos nuevos a {negocio}. Mira el catálogo: {catalogo}',
};
const GASTO_MERCANCIA = 'Compra de mercancía';
const DENOMINACIONES = [100000, 50000, 20000, 10000, 5000, 2000, 1000, 500, 200, 100, 50];
 
function cfg() { return { ...CONFIG_DEF, ...(DB.get('config', 'general') || {}) }; }
function quien() { return (DB.user && DB.user.email) || 'demo'; }
 
/* ---------- Productos ---------- */
function productosActivos() { return DB.all('productos').filter(p => p.activo !== false).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')); }
function stockDe(p) { return Number(p && p.stock) || 0; }
function estadoStock(p) {
  const s = stockDe(p); const min = Number(p.stockMin ?? cfg().stockMinDef) || 0;
  if (s <= 0) return 'agotado';
  if (s <= min) return 'bajo';
  return 'ok';
}
 
async function guardarProducto(data, existente) {
  const id = existente ? existente.id : DB.newId();
  const base = {
    nombre: String(data.nombre || '').trim(),
    codigo: String(data.codigo || '').trim(),
    categoria: data.categoria || 'Otros',
    precio: parseMoney(data.precio),
    costo: parseMoney(data.costo),
    stockMin: parseQty(data.stockMin),
    activo: true,
  };
  if (!base.nombre) throw new Error('Escribe el nombre del producto.');
  if (base.codigo) {
    const otro = DB.all('productos').find(x => x.activo !== false && x.codigo && normCodigo(x.codigo) === normCodigo(base.codigo) && (!existente || x.id !== existente.id));
    if (otro) throw new Error(`El código ${base.codigo} ya es de "${otro.nombre}".`);
  }
  const ops = [];
  if (existente) {
    ops.push({ t: 'update', col: 'productos', id, data: { ...base, editado: new Date().toISOString() } });
  } else {
    const stock = parseQty(data.stock);
    ops.push({ t: 'set', col: 'productos', id, data: { ...base, stock, creado: new Date().toISOString() } });
    if (stock) ops.push(movOp({ productoId: id, nombre: base.nombre, tipo: 'inicial', cantidad: stock, costoUnit: base.costo, nota: 'Stock inicial' }));
  }
  await DB.commit(ops);
  return id;
}
 
function movOp(m) {
  const id = DB.newId(); const fecha = m.fecha || new Date().toISOString();
  return {
    t: 'set', col: 'movimientos', id, data: {
      fecha, dia: dayKey(fecha), productoId: m.productoId, productoNombre: m.nombre, tipo: m.tipo,
      cantidad: m.cantidad, costoUnit: m.costoUnit ?? null, nota: m.nota || '', ref: m.ref || '', refNumero: m.refNumero ?? null,
      proveedor: m.proveedor || '', usuario: quien(),
    },
  };
}
 
/* Entrada de mercancía con varias líneas; actualiza costo promedio */
async function registrarEntrada({ lineas, proveedor, nota, pago, factura }) {
  lineas = lineas.filter(l => l.productoId && parseQty(l.cantidad) > 0);
  if (!lineas.length) throw new Error('Agrega al menos un producto con cantidad.');
  const entradaId = DB.newId(); const fecha = new Date().toISOString();
  const ops = []; let total = 0;
  for (const l of lineas) {
    const p = DB.get('productos', l.productoId); const q = parseQty(l.cantidad);
    const cu = l.costoUnit === '' || l.costoUnit == null ? (Number(p.costo) || 0) : parseMoney(l.costoUnit);
    const s = Math.max(stockDe(p), 0);
    const nuevoCosto = s + q > 0 ? Math.round((s * (Number(p.costo) || 0) + q * cu) / (s + q)) : cu;
    total += q * cu;
    ops.push({ t: 'update', col: 'productos', id: p.id, data: { stock: { $inc: q }, costo: nuevoCosto } });
    ops.push(movOp({ productoId: p.id, nombre: p.nombre, tipo: 'entrada', cantidad: q, costoUnit: cu, ref: entradaId, proveedor, nota: [factura ? 'Factura ' + factura : '', nota].filter(Boolean).join(' · '), fecha }));
  }
  if (pago && pago !== 'no' && total > 0) {
    const caja = cajaAbierta();
    if (pago === 'Efectivo' && !caja) throw new Error('Para pagar en efectivo desde la caja, primero abre la caja.');
    ops.push(gastoOp({ categoria: GASTO_MERCANCIA, descripcion: `Mercancía${proveedor ? ' · ' + proveedor : ''}${factura ? ' · Fact. ' + factura : ''}`, valor: total, metodo: pago, proveedor, ref: entradaId }));
  }
  await DB.commit(ops);
  return { entradaId, total };
}
 
async function ajustarStock(p, nuevo, motivo) {
  const delta = parseQty(nuevo) - stockDe(p);
  if (!delta) return 0;
  await DB.commit([
    { t: 'update', col: 'productos', id: p.id, data: { stock: { $inc: delta } } },
    movOp({ productoId: p.id, nombre: p.nombre, tipo: 'ajuste', cantidad: delta, costoUnit: p.costo, nota: motivo || 'Ajuste' }),
  ]);
  return delta;
}
 
async function guardarConteo(conteos) {
  const ops = []; let n = 0;
  Object.entries(conteos).forEach(([pid, val]) => {
    if (val === '' || val == null) return;
    const p = DB.get('productos', pid); const delta = parseQty(val) - stockDe(p);
    if (!p || !delta) return;
    n++;
    ops.push({ t: 'update', col: 'productos', id: pid, data: { stock: { $inc: delta } } });
    ops.push(movOp({ productoId: pid, nombre: p.nombre, tipo: 'ajuste', cantidad: delta, costoUnit: p.costo, nota: 'Conteo físico' }));
  });
  await DB.commit(ops);
  return n;
}
 
/* ---------- Clientas ---------- */
function buscarClientePorTel(tel) { const t = telLimpio(tel); if (t.length < 7) return null; return DB.all('clientes').find(c => telLimpio(c.tel) === t) || null; }
function clienteOps(nombre, tel) {
  nombre = String(nombre || '').trim(); tel = telLimpio(tel);
  if (!nombre && !tel) return { id: null, ops: [] };
  let c = tel ? buscarClientePorTel(tel) : DB.all('clientes').find(x => norm(x.nombre) === norm(nombre) && !x.tel);
  if (c) {
    const upd = {};
    if (nombre && nombre !== c.nombre && (!c.nombre || c.nombre === 'Clienta')) upd.nombre = nombre;
    return { id: c.id, nombre: c.nombre || nombre, tel: c.tel, ops: Object.keys(upd).length ? [{ t: 'update', col: 'clientes', id: c.id, data: upd }] : [] };
  }
  const id = tel ? 'c' + tel : DB.newId();
  return { id, nombre: nombre || 'Clienta', tel, ops: [{ t: 'set', col: 'clientes', id, data: { nombre: nombre || 'Clienta', tel, nota: '', creado: new Date().toISOString() } }] };
}
async function guardarCliente(data, existente) {
  const nombre = String(data.nombre || '').trim(); if (!nombre) throw new Error('Escribe el nombre.');
  const tel = telLimpio(data.tel);
  if (tel) { const otro = buscarClientePorTel(tel); if (otro && (!existente || otro.id !== existente.id)) throw new Error(`Ese número ya es de ${otro.nombre}.`); }
  const id = existente ? existente.id : (tel ? 'c' + tel : DB.newId());
  await DB.commit([{ t: existente ? 'update' : 'set', col: 'clientes', id, data: { nombre, tel, nota: data.nota || '', cumple: data.cumple || '', ...(existente ? {} : { creado: new Date().toISOString() }) } }]);
  return id;
}
 
/* ---------- Ventas ---------- */
function totalesCarrito(cart, descuento = 0) {
  const subtotal = sum(cart, i => i.precio * i.cantidad);
  const desc = Math.min(Math.max(parseMoney(descuento), 0), subtotal);
  return { subtotal, descuento: desc, total: subtotal - desc, unidades: sum(cart, i => i.cantidad) };
}
 
async function registrarVenta(v) {
  const { cart } = v;
  if (!cart.length) throw new Error('El pedido está vacío.');
  for (const it of cart) {
    const p = DB.get('productos', it.productoId);
    if (!p) throw new Error(`El producto ${it.nombre} ya no existe.`);
    if (it.cantidad > stockDe(p)) throw new Error(`Solo hay ${stockDe(p)} de ${p.nombre}.`);
  }
  const t = totalesCarrito(cart, v.descuento);
  const tipo = v.tipo || 'contado';
  const abonoIni = tipo === 'contado' ? 0 : Math.min(parseMoney(v.abonoInicial), t.total);
  const caja = cajaAbierta();
  if ((tipo === 'contado' && t.total > 0 || abonoIni > 0) && !caja) throw new Error('Abre la caja antes de recibir dinero.');
  if (tipo !== 'contado' && !String(v.clienteNombre || '').trim()) throw new Error('Para fiado o separado escribe el nombre de la clienta.');
  if (tipo !== 'contado' && !telLimpio(v.clienteTel)) throw new Error('Para fiado o separado agrega el WhatsApp de la clienta, así se le puede cobrar.');
 
  const cli = clienteOps(v.clienteNombre, v.clienteTel);
  const numero = await DB.nextNumber('ventas');
  const id = DB.newId(); const fecha = new Date().toISOString();
  const items = cart.map(i => {
    const p = DB.get('productos', i.productoId);
    return { productoId: i.productoId, nombre: p.nombre, categoria: p.categoria || 'Otros', cantidad: i.cantidad, precio: i.precio, costo: Number(p.costo) || 0 };
  });
  const recibido = tipo === 'contado' && v.metodo === 'Efectivo' ? parseMoney(v.recibido) : 0;
  const venta = {
    numero, fecha, dia: dayKey(fecha), tipo, items,
    subtotal: t.subtotal, descuento: t.descuento, total: t.total,
    costoTotal: sum(items, i => i.costo * i.cantidad),
    metodo: tipo === 'contado' ? v.metodo : (abonoIni > 0 ? v.metodoAbono : ''),
    abonado: tipo === 'contado' ? t.total : abonoIni,
    saldo: tipo === 'contado' ? 0 : t.total - abonoIni,
    estado: tipo === 'contado' || t.total - abonoIni <= 0 ? 'pagada' : 'pendiente',
    entregado: tipo !== 'separado',
    clienteId: cli.id, clienteNombre: cli.nombre || String(v.clienteNombre || '').trim() || '', clienteTel: cli.tel || telLimpio(v.clienteTel),
    recibido: recibido || null, cambio: recibido ? Math.max(recibido - t.total, 0) : null,
    cajaId: caja ? caja.id : null, nota: v.nota || '', usuario: quien(),
  };
  const ops = [...cli.ops, { t: 'set', col: 'ventas', id, data: venta }];
  items.forEach(i => {
    ops.push({ t: 'update', col: 'productos', id: i.productoId, data: { stock: { $inc: -i.cantidad } } });
    ops.push(movOp({ productoId: i.productoId, nombre: i.nombre, tipo: tipo === 'separado' ? 'separado' : 'venta', cantidad: -i.cantidad, costoUnit: i.costo, ref: id, refNumero: numero, fecha }));
  });
  if (abonoIni > 0) ops.push(abonoOp({ venta: { ...venta, id }, valor: abonoIni, metodo: v.metodoAbono, caja, nota: 'Abono inicial' }));
  await DB.commit(ops);
  return { ...venta, id };
}
 
function abonoOp({ venta, valor, metodo, caja, nota }) {
  const id = DB.newId(); const fecha = new Date().toISOString();
  return { t: 'set', col: 'abonos', id, data: { fecha, dia: dayKey(fecha), ventaId: venta.id, ventaNumero: venta.numero, clienteId: venta.clienteId, clienteNombre: venta.clienteNombre, valor, metodo, cajaId: caja ? caja.id : null, nota: nota || '', usuario: quien(), anulado: false } };
}
 
async function registrarAbono(venta, valor, metodo) {
  valor = parseMoney(valor);
  const saldo = Number(venta.saldo) || 0;
  if (valor <= 0) throw new Error('Escribe el valor del abono.');
  if (valor > saldo) throw new Error(`El saldo es ${money(saldo)}. El abono no puede ser mayor.`);
  const caja = cajaAbierta();
  if (!caja) throw new Error('Abre la caja antes de recibir un abono.');
  const nuevoSaldo = saldo - valor;
  await DB.commit([
    abonoOp({ venta, valor, metodo, caja }),
    { t: 'update', col: 'ventas', id: venta.id, data: { abonado: { $inc: valor }, saldo: { $inc: -valor }, estado: nuevoSaldo <= 0 ? 'pagada' : 'pendiente', ultimoAbono: new Date().toISOString() } },
  ]);
  return nuevoSaldo;
}
 
async function marcarEntregado(venta) {
  await DB.commit([{ t: 'update', col: 'ventas', id: venta.id, data: { entregado: true, fechaEntrega: new Date().toISOString() } }]);
}
 
/* Anular: devuelve el stock y, si el dinero entró en una caja ya cerrada, registra la devolución en la caja actual */
async function anularVenta(venta, motivo) {
  if (venta.estado === 'anulada') return;
  const caja = cajaAbierta();
  const abonos = DB.all('abonos').filter(a => a.ventaId === venta.id && !a.anulado);
  const pagosEfectivoFuera = [];
  // Las ventas anteriores a la app (importadas) no movieron inventario ni caja: al anularlas tampoco se devuelve nada
  if (!venta.migrada && venta.tipo === 'contado' && venta.metodo === 'Efectivo' && venta.cajaId !== (caja && caja.id)) pagosEfectivoFuera.push(venta.total);
  if (!venta.migrada) abonos.forEach(a => { if (a.metodo === 'Efectivo' && a.cajaId !== (caja && caja.id)) pagosEfectivoFuera.push(a.valor); });
  const devolverEfectivo = sum(pagosEfectivoFuera);
  if (devolverEfectivo > 0 && !caja) throw new Error(`Hay que devolver ${money(devolverEfectivo)} en efectivo. Abre la caja primero.`);
  const fecha = new Date().toISOString();
  const ops = [{ t: 'update', col: 'ventas', id: venta.id, data: { estado: 'anulada', saldo: 0, anuladaFecha: fecha, motivoAnulacion: motivo || '', anuladaPor: quien() } }];
  if (!venta.migrada) venta.items.forEach(i => {
    if (DB.get('productos', i.productoId)) ops.push({ t: 'update', col: 'productos', id: i.productoId, data: { stock: { $inc: i.cantidad } } });
    ops.push(movOp({ productoId: i.productoId, nombre: i.nombre, tipo: 'anulacion', cantidad: i.cantidad, costoUnit: i.costo, ref: venta.id, refNumero: venta.numero, nota: motivo || 'Venta anulada', fecha }));
  });
  abonos.forEach(a => ops.push({ t: 'update', col: 'abonos', id: a.id, data: { anulado: true } }));
  if (devolverEfectivo > 0) ops.push(cajaMovOp({ tipo: 'retiro', valor: devolverEfectivo, motivo: `Devolución venta #${venta.numero}`, caja }));
  await DB.commit(ops);
  return devolverEfectivo;
}
 
/* ---------- Gastos ---------- */
function gastoOp({ categoria, descripcion, valor, metodo, proveedor, ref, fecha }) {
  const caja = cajaAbierta();
  const id = DB.newId(); fecha = fecha || new Date().toISOString();
  return { t: 'set', col: 'gastos', id, data: { fecha, dia: dayKey(fecha), categoria, descripcion: descripcion || '', valor: parseMoney(valor), metodo, proveedor: proveedor || '', ref: ref || '', cajaId: caja ? caja.id : null, usuario: quien(), anulado: false } };
}
async function registrarGasto(g) {
  if (parseMoney(g.valor) <= 0) throw new Error('Escribe el valor del gasto.');
  if (g.metodo === 'Efectivo' && !cajaAbierta()) throw new Error('Para pagar en efectivo desde la caja, primero abre la caja.');
  await DB.commit([gastoOp(g)]);
}
async function anularGasto(g) { await DB.commit([{ t: 'update', col: 'gastos', id: g.id, data: { anulado: true } }]); }
 
/* ---------- Caja ---------- */
function cajaAbierta() { return DB.all('cajas').find(c => c.abierta) || null; }
function cajasCerradas() { return DB.all('cajas').filter(c => !c.abierta).sort((a, b) => b.cierre.localeCompare(a.cierre)); }
function cajaMovOp({ tipo, valor, motivo, caja }) {
  const id = DB.newId(); const fecha = new Date().toISOString();
  return { t: 'set', col: 'cajaMovs', id, data: { fecha, cajaId: caja.id, tipo, valor: parseMoney(valor), motivo: motivo || '', usuario: quien() } };
}
async function abrirCaja(base, nota) {
  if (cajaAbierta()) throw new Error('Ya hay una caja abierta.');
  const id = DB.newId(); const fecha = new Date().toISOString();
  await DB.commit([{ t: 'set', col: 'cajas', id, data: { abierta: true, apertura: fecha, dia: dayKey(fecha), base: parseMoney(base), notaApertura: nota || '', usuarioApertura: quien() } }]);
  return id;
}
async function movimientoCaja(tipo, valor, motivo) {
  const caja = cajaAbierta(); if (!caja) throw new Error('No hay caja abierta.');
  if (parseMoney(valor) <= 0) throw new Error('Escribe el valor.');
  await DB.commit([cajaMovOp({ tipo, valor, motivo, caja })]);
}
 
function resumenCaja(caja) {
  const id = caja.id;
  const ventas = DB.all('ventas').filter(v => v.cajaId === id);
  const validas = ventas.filter(v => v.estado !== 'anulada');
  const contado = validas.filter(v => v.tipo === 'contado');
  const abonos = DB.all('abonos').filter(a => a.cajaId === id && !a.anulado);
  const gastos = DB.all('gastos').filter(g => g.cajaId === id && !g.anulado);
  const movs = DB.all('cajaMovs').filter(m => m.cajaId === id);
  const metodos = new Set([...cfg().metodos, ...contado.map(v => v.metodo), ...abonos.map(a => a.metodo), ...gastos.map(g => g.metodo)]);
  const porMetodo = {};
  metodos.forEach(m => porMetodo[m] = {
    ventas: sum(contado.filter(v => v.metodo === m), v => v.total),
    abonos: sum(abonos.filter(a => a.metodo === m), a => a.valor),
    gastos: sum(gastos.filter(g => g.metodo === m), g => g.valor),
  });
  const ef = porMetodo['Efectivo'] || { ventas: 0, abonos: 0, gastos: 0 };
  const ingresos = sum(movs.filter(m => m.tipo === 'ingreso'), m => m.valor);
  const retiros = sum(movs.filter(m => m.tipo === 'retiro'), m => m.valor);
  const esperado = (Number(caja.base) || 0) + ef.ventas + ef.abonos + ingresos - retiros - ef.gastos;
  return {
    base: Number(caja.base) || 0, porMetodo, ingresos, retiros, esperado,
    efectivoVentas: ef.ventas, efectivoAbonos: ef.abonos, efectivoGastos: ef.gastos,
    numVentas: validas.length, numAnuladas: ventas.length - validas.length,
    totalVendido: sum(validas, v => v.total),
    credito: sum(validas.filter(v => v.tipo !== 'contado'), v => v.total),
    totalRecaudado: sum(contado, v => v.total) + sum(abonos, a => a.valor),
    totalGastos: sum(gastos, g => g.valor),
    ganancia: sum(validas, v => v.total - (v.costoTotal || 0)),
    ventas, abonos, gastos, movs,
  };
}
 
async function cerrarCaja(caja, { contado, detalle, baseSiguiente, nota }) {
  const r = resumenCaja(caja);
  const c = parseMoney(contado);
  const fecha = new Date().toISOString();
  const resumen = {
    base: r.base, esperado: r.esperado, ingresos: r.ingresos, retiros: r.retiros,
    efectivoVentas: r.efectivoVentas, efectivoAbonos: r.efectivoAbonos, efectivoGastos: r.efectivoGastos,
    numVentas: r.numVentas, numAnuladas: r.numAnuladas, totalVendido: r.totalVendido, totalRecaudado: r.totalRecaudado,
    totalGastos: r.totalGastos, ganancia: r.ganancia, credito: r.credito,
    porMetodo: Object.fromEntries(Object.entries(r.porMetodo).filter(([, x]) => x.ventas || x.abonos || x.gastos)),
  };
  await DB.commit([{ t: 'update', col: 'cajas', id: caja.id, data: {
    abierta: false, cierre: fecha, contado: c, esperado: r.esperado, diferencia: c - r.esperado,
    detalleConteo: detalle || {}, baseSiguiente: parseMoney(baseSiguiente), notaCierre: nota || '', usuarioCierre: quien(), resumen,
  } }]);
  return { ...caja, abierta: false, cierre: fecha, contado: c, esperado: r.esperado, diferencia: c - r.esperado, resumen, baseSiguiente: parseMoney(baseSiguiente), notaCierre: nota || '' };
}
 
/* ---------- Cartera ---------- */
function ventasConSaldo() { return DB.all('ventas').filter(v => v.estado !== 'anulada' && (Number(v.saldo) || 0) > 0).sort((a, b) => a.fecha.localeCompare(b.fecha)); }
function separadosPorEntregar() { return DB.all('ventas').filter(v => v.tipo === 'separado' && v.estado !== 'anulada' && !v.entregado); }
 
/* ---------- Reportes ---------- */
function rangoPeriodo(clave, desde, hasta) {
  const hoy = new Date(); const k = dayKey(hoy);
  switch (clave) {
    case 'hoy': return { desde: k, hasta: k, nombre: 'Hoy' };
    case 'ayer': { const a = dayKey(addDays(hoy, -1)); return { desde: a, hasta: a, nombre: 'Ayer' }; }
    case '7d': return { desde: dayKey(addDays(hoy, -6)), hasta: k, nombre: 'Últimos 7 días' };
    case '30d': return { desde: dayKey(addDays(hoy, -29)), hasta: k, nombre: 'Últimos 30 días' };
    case 'mes': return { desde: dayKey(new Date(hoy.getFullYear(), hoy.getMonth(), 1)), hasta: k, nombre: MESES_L[hoy.getMonth()] + ' ' + hoy.getFullYear() };
    case 'mesAnt': { const i = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1); const f = new Date(hoy.getFullYear(), hoy.getMonth(), 0); return { desde: dayKey(i), hasta: dayKey(f), nombre: MESES_L[i.getMonth()] + ' ' + i.getFullYear() }; }
    case 'anio': return { desde: `${hoy.getFullYear()}-01-01`, hasta: k, nombre: 'Año ' + hoy.getFullYear() };
    case 'custom': return { desde: desde || k, hasta: hasta || k, nombre: `${fmtFecha(parseDay(desde || k))} – ${fmtFecha(parseDay(hasta || k))}` };
    default: return { desde: '0000-00-00', hasta: '9999-12-31', nombre: 'Todo' };
  }
}
const enRango = (dia, r) => dia >= r.desde && dia <= r.hasta;
 
function reporte(r) {
  const ventas = DB.all('ventas').filter(v => enRango(v.dia, r) && v.estado !== 'anulada');
  const anuladas = DB.all('ventas').filter(v => enRango(v.dia, r) && v.estado === 'anulada');
  const abonos = DB.all('abonos').filter(a => enRango(a.dia, r) && !a.anulado);
  const gastos = DB.all('gastos').filter(g => enRango(g.dia, r) && !g.anulado);
  const facturado = sum(ventas, v => v.total);
  const costo = sum(ventas, v => v.costoTotal || sum(v.items, i => i.costo * i.cantidad));
  const gastosOp = gastos.filter(g => g.categoria !== GASTO_MERCANCIA);
  const compras = gastos.filter(g => g.categoria === GASTO_MERCANCIA);
  const utilidadBruta = facturado - costo;
  const totalGastosOp = sum(gastosOp, g => g.valor);
 
  const recaudo = {};
  ventas.filter(v => v.tipo === 'contado').forEach(v => recaudo[v.metodo] = (recaudo[v.metodo] || 0) + v.total);
  abonos.forEach(a => recaudo[a.metodo] = (recaudo[a.metodo] || 0) + a.valor);
 
  const porDia = new Map();
  for (let d = parseDay(r.desde < '2000' ? (ventas.map(v => v.dia).sort()[0] || dayKey()) : r.desde); dayKey(d) <= r.hasta && porDia.size < 400; d = addDays(d, 1)) porDia.set(dayKey(d), { ventas: 0, ganancia: 0, n: 0 });
  ventas.forEach(v => { const x = porDia.get(v.dia); if (x) { x.ventas += v.total; x.ganancia += v.total - (v.costoTotal || 0); x.n++; } });
 
  const prod = new Map(); const cat = new Map();
  ventas.forEach(v => {
    const factor = v.subtotal ? v.total / v.subtotal : 1; // reparte el descuento
    v.items.forEach(i => {
      const val = i.precio * i.cantidad * factor; const gan = val - i.costo * i.cantidad;
      const p = prod.get(i.productoId) || { nombre: i.nombre, cantidad: 0, valor: 0, ganancia: 0 };
      p.cantidad += i.cantidad; p.valor += val; p.ganancia += gan; prod.set(i.productoId, p);
      const c = cat.get(i.categoria || 'Otros') || { nombre: i.categoria || 'Otros', cantidad: 0, valor: 0, ganancia: 0 };
      c.cantidad += i.cantidad; c.valor += val; c.ganancia += gan; cat.set(c.nombre, c);
    });
  });
  const gastosCat = {};
  gastos.forEach(g => gastosCat[g.categoria] = (gastosCat[g.categoria] || 0) + g.valor);
 
  return {
    ventas, anuladas, abonos, gastos,
    facturado, costo, utilidadBruta, margen: facturado ? utilidadBruta / facturado : 0,
    gastosOp: totalGastosOp, compras: sum(compras, g => g.valor), utilidadNeta: utilidadBruta - totalGastosOp,
    numVentas: ventas.length, ticket: ventas.length ? facturado / ventas.length : 0,
    unidades: sum(ventas, v => sum(v.items, i => i.cantidad)),
    recaudo, totalRecaudo: sum(Object.values(recaudo)),
    credito: sum(ventas.filter(v => v.tipo !== 'contado'), v => v.total),
    porDia: Array.from(porDia, ([dia, x]) => ({ dia, ...x })),
    topProductos: Array.from(prod.values()).sort((a, b) => b.valor - a.valor),
    categorias: Array.from(cat.values()).sort((a, b) => b.valor - a.valor),
    gastosCat: Object.entries(gastosCat).sort((a, b) => b[1] - a[1]),
  };
}
 
function valorInventario() {
  const ps = productosActivos();
  return {
    productos: ps.length,
    unidades: sum(ps, p => Math.max(stockDe(p), 0)),
    costo: sum(ps, p => Math.max(stockDe(p), 0) * (Number(p.costo) || 0)),
    venta: sum(ps, p => Math.max(stockDe(p), 0) * (Number(p.precio) || 0)),
    agotados: ps.filter(p => estadoStock(p) === 'agotado'),
    bajos: ps.filter(p => estadoStock(p) === 'bajo'),
  };
}
 
