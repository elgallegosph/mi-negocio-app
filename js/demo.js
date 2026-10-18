/* Datos de ejemplo para el modo demo (solo se usan si no hay Firebase configurado) */
'use strict';

function sembrarDemo() {
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const pick = a => a[Math.floor(rnd() * a.length)];
  const put = (col, data, id = DB.newId()) => { DB.cache[col].set(id, { ...data, id }); return id; };
  const at = (diasAtras, h, m) => { const d = addDays(new Date(), -diasAtras); d.setHours(h, m, Math.floor(rnd() * 59), 0); return d.toISOString(); };

  put('config', { ...CONFIG_DEF, telefono: '300 000 0000', direccion: 'Cra. 23 # 00-00', ciudad: 'Manizales' }, 'general');

  const P = [
    ['LAB-01', 'Labial mate larga duración', 'Labios', 28000, 13000, 14],
    ['LAB-02', 'Gloss voluminizador', 'Labios', 22000, 9500, 9],
    ['LAB-03', 'Delineador de labios', 'Labios', 12000, 5000, 2],
    ['ROS-01', 'Base líquida cobertura media', 'Rostro', 45000, 22000, 8],
    ['ROS-02', 'Corrector de ojeras', 'Rostro', 26000, 11000, 6],
    ['ROS-03', 'Polvo compacto translúcido', 'Rostro', 32000, 15000, 0],
    ['ROS-04', 'Rubor en crema', 'Rostro', 24000, 10000, 7],
    ['ROS-05', 'Iluminador en barra', 'Rostro', 27000, 12000, 5],
    ['ROS-06', 'Spray fijador de maquillaje', 'Rostro', 34000, 15500, 3],
    ['OJO-01', 'Paleta de sombras 12 tonos', 'Ojos', 55000, 26000, 4],
    ['OJO-02', 'Pestañina a prueba de agua', 'Ojos', 30000, 13000, 11],
    ['OJO-03', 'Delineador líquido negro', 'Ojos', 18000, 7500, 1],
    ['PIE-01', 'Sérum de ácido hialurónico', 'Cuidado de la piel', 48000, 21000, 6],
    ['PIE-02', 'Bloqueador facial FPS 50', 'Cuidado de la piel', 52000, 27000, 9],
    ['PIE-03', 'Agua micelar 400 ml', 'Cuidado de la piel', 29000, 13500, 12],
    ['PIE-04', 'Mascarilla de arcilla', 'Cuidado de la piel', 19000, 8000, 10],
    ['UNA-01', 'Esmalte semipermanente', 'Uñas', 15000, 6000, 20],
    ['ACC-01', 'Kit de brochas x 10', 'Accesorios', 65000, 30000, 3],
    ['ACC-02', 'Esponja de maquillaje', 'Accesorios', 9000, 3500, 16],
  ];
  const ean = i => { const doce = '77090012' + String(3100 + i * 7).padStart(4, '0'); return doce + eanDigito(doce); };
  const prods = P.map(([codigo, nombre, categoria, precio, costo, final], i) => ({ codigo: categoria === 'Accesorios' ? '' : ean(i), nombre, categoria, precio, costo, final, vendidos: 0, id: DB.newId() }));

  const C = ['Valentina Ospina', 'Laura Giraldo', 'Daniela Restrepo', 'Camila Arango', 'Sara Henao', 'Juliana Cardona', 'Mariana López', 'Paula Duque', 'Natalia Correa', 'Isabella Marín'];
  const clientes = C.map((nombre, i) => { const tel = '30000000' + String(10 + i); return { id: put('clientes', { nombre, tel, nota: '', creado: at(40, 9, 0) }, 'c' + tel), nombre, tel }; });

  let numero = 0;
  const DIAS_ATRAS = 34;
  const cajas = [];
  for (let d = DIAS_ATRAS; d >= 0; d--) {
    const fecha = addDays(new Date(), -d);
    if (fecha.getDay() === 0 && d !== 0) continue; // domingos cerrado
    const apertura = at(d, 9, 2);
    const cajaId = put('cajas', { abierta: true, apertura, dia: dayKey(apertura), base: 100000, notaApertura: '', usuarioApertura: 'demo' });
    cajas.push({ id: cajaId, d });
    const n = d === 0 ? 4 : 2 + Math.floor(rnd() * 5);
    for (let k = 0; k < n; k++) {
      const h = 9 + Math.floor(((k + rnd()) / n) * (d === 0 ? 3 : 9));
      const f = at(d, h, 10 + Math.floor(rnd() * 45));
      const nItems = 1 + Math.floor(rnd() * (rnd() > 0.7 ? 3 : 2));
      const items = [];
      for (let j = 0; j < nItems; j++) {
        const p = pick(prods); if (items.find(i => i.productoId === p.id)) continue;
        const q = rnd() > 0.85 ? 2 : 1;
        items.push({ productoId: p.id, nombre: p.nombre, categoria: p.categoria, cantidad: q, precio: p.precio, costo: p.costo });
        p.vendidos += q;
      }
      const r = rnd();
      const tipo = d > 1 && r > 0.92 ? 'fiado' : d > 1 && r > 0.86 ? 'separado' : 'contado';
      const cli = tipo !== 'contado' || rnd() > 0.45 ? pick(clientes) : null;
      const subtotal = sum(items, i => i.precio * i.cantidad);
      const descuento = rnd() > 0.88 ? 5000 : 0;
      const total = subtotal - descuento;
      const metodo = pick(['Efectivo', 'Efectivo', 'Efectivo', 'Nequi', 'Nequi', 'Transferencia', 'Tarjeta', 'Daviplata']);
      numero++;
      const abonoIni = tipo === 'separado' ? Math.round(total / 2 / 1000) * 1000 : 0;
      const vid = DB.newId();
      const venta = {
        numero, fecha: f, dia: dayKey(f), tipo, items, subtotal, descuento, total, costoTotal: sum(items, i => i.costo * i.cantidad),
        metodo: tipo === 'contado' ? metodo : abonoIni ? 'Efectivo' : '',
        abonado: tipo === 'contado' ? total : abonoIni, saldo: tipo === 'contado' ? 0 : total - abonoIni,
        estado: tipo === 'contado' ? 'pagada' : 'pendiente', entregado: tipo !== 'separado',
        clienteId: cli ? cli.id : null, clienteNombre: cli ? cli.nombre : '', clienteTel: cli ? cli.tel : '',
        recibido: null, cambio: null, cajaId, nota: '', usuario: 'demo',
      };
      put('ventas', venta, vid);
      items.forEach(i => put('movimientos', { fecha: f, dia: dayKey(f), productoId: i.productoId, productoNombre: i.nombre, tipo: tipo === 'separado' ? 'separado' : 'venta', cantidad: -i.cantidad, costoUnit: i.costo, ref: vid, refNumero: numero, nota: '', proveedor: '', usuario: 'demo' }));
      if (abonoIni) put('abonos', { fecha: f, dia: dayKey(f), ventaId: vid, ventaNumero: numero, clienteId: cli.id, clienteNombre: cli.nombre, valor: abonoIni, metodo: 'Efectivo', cajaId, nota: 'Abono inicial', usuario: 'demo', anulado: false });
    }
    // gastos
    if (fecha.getDate() === 1 || d === DIAS_ATRAS) put('gastos', { fecha: at(d, 10, 0), dia: dayKey(at(d, 10, 0)), categoria: 'Arriendo', descripcion: 'Arriendo del local', valor: 1200000, metodo: 'Transferencia', proveedor: '', ref: '', cajaId, usuario: 'demo', anulado: false });
    if (fecha.getDate() === 5 || d === DIAS_ATRAS - 3) put('gastos', { fecha: at(d, 11, 0), dia: dayKey(at(d, 11, 0)), categoria: 'Servicios', descripcion: 'Energía e internet', valor: 185000, metodo: 'Nequi', proveedor: '', ref: '', cajaId, usuario: 'demo', anulado: false });
    if (rnd() > 0.75) put('gastos', { fecha: at(d, 15, 0), dia: dayKey(at(d, 15, 0)), categoria: pick(['Transporte', 'Empaques', 'Otros']), descripcion: pick(['Domicilio a clienta', 'Bolsas de regalo', 'Tinto y aseo']), valor: pick([6000, 8000, 12000, 15000]), metodo: 'Efectivo', proveedor: '', ref: '', cajaId, usuario: 'demo', anulado: false });
  }

  // abonos posteriores a fiados y separados
  DB.all('ventas').filter(v => v.tipo !== 'contado').forEach(v => {
    const dias = diasDesde(v.fecha);
    if (dias < 4 || rnd() > 0.7) return;
    const cj = cajas.find(c => c.d === Math.max(dias - 3, 1)) || cajas[cajas.length - 2];
    const valor = rnd() > 0.5 ? v.saldo : Math.round(v.saldo / 2 / 1000) * 1000;
    const f = at(cj.d, 16, 20);
    put('abonos', { fecha: f, dia: dayKey(f), ventaId: v.id, ventaNumero: v.numero, clienteId: v.clienteId, clienteNombre: v.clienteNombre, valor, metodo: pick(['Efectivo', 'Nequi']), cajaId: cj.id, nota: '', usuario: 'demo', anulado: false });
    v.abonado += valor; v.saldo -= valor; if (v.saldo <= 0) { v.estado = 'pagada'; if (v.tipo === 'separado' && rnd() > 0.3) v.entregado = true; }
  });

  // entrada de mercancía hace 8 días
  const fe = at(8, 10, 30); const entradaId = DB.newId();
  [prods[0], prods[10], prods[16]].forEach(p => { put('movimientos', { fecha: fe, dia: dayKey(fe), productoId: p.id, productoNombre: p.nombre, tipo: 'entrada', cantidad: 6, costoUnit: p.costo, ref: entradaId, refNumero: null, nota: 'Factura 4512', proveedor: 'Distribuidora Belleza Total', usuario: 'demo' }); p.entrada = 6; });
  put('gastos', { fecha: fe, dia: dayKey(fe), categoria: GASTO_MERCANCIA, descripcion: 'Mercancía · Distribuidora Belleza Total · Fact. 4512', valor: 6 * (prods[0].costo + prods[10].costo + prods[16].costo), metodo: 'Transferencia', proveedor: 'Distribuidora Belleza Total', ref: entradaId, cajaId: cajas.find(c => c.d === 8)?.id || null, usuario: 'demo', anulado: false });

  // productos con stock final coherente con las ventas
  prods.forEach(p => {
    const inicial = p.final + p.vendidos - (p.entrada || 0);
    put('productos', { nombre: p.nombre, codigo: p.codigo, categoria: p.categoria, precio: p.precio, costo: p.costo, stock: p.final, stockMin: 3, activo: true, creado: at(DIAS_ATRAS + 1, 9, 0) }, p.id);
    put('movimientos', { fecha: at(DIAS_ATRAS + 1, 8, 0), dia: dayKey(at(DIAS_ATRAS + 1, 8, 0)), productoId: p.id, productoNombre: p.nombre, tipo: 'inicial', cantidad: inicial, costoUnit: p.costo, ref: '', refNumero: null, nota: 'Stock inicial', proveedor: '', usuario: 'demo' });
  });

  // cierres de caja (todas menos la de hoy)
  cajas.forEach(c => {
    if (c.d === 0) return;
    const caja = DB.get('cajas', c.id); const r = resumenCaja(caja);
    const dif = rnd() > 0.8 ? pick([-2000, -500, 1000]) : 0;
    const cierre = at(c.d, 19, 5);
    DB.cache.cajas.set(c.id, {
      ...caja, abierta: false, cierre, esperado: r.esperado, contado: r.esperado + dif, diferencia: dif, baseSiguiente: 100000, detalleConteo: {}, notaCierre: dif ? 'Revisar vueltas' : '', usuarioCierre: 'demo',
      resumen: { base: r.base, esperado: r.esperado, ingresos: r.ingresos, retiros: r.retiros, efectivoVentas: r.efectivoVentas, efectivoAbonos: r.efectivoAbonos, efectivoGastos: r.efectivoGastos, numVentas: r.numVentas, numAnuladas: r.numAnuladas, totalVendido: r.totalVendido, totalRecaudado: r.totalRecaudado, totalGastos: r.totalGastos, ganancia: r.ganancia, credito: r.credito, porMetodo: Object.fromEntries(Object.entries(r.porMetodo).filter(([, x]) => x.ventas || x.abonos || x.gastos)) },
    });
  });

  DB._demoCounters = { ventas: numero };
  DB._saveDemo();
}
