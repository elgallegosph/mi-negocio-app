/* Pantallas: Inventario, Caja, Ventas, Clientas, Gastos, Reportes, Ajustes, Más */
'use strict';

/* =================== INVENTARIO =================== */
Pantallas.inventario = {
  titulo: 'Inventario',
  render() {
    const s = App.s.inv;
    const tabs = [{ v: 'productos', l: 'Productos' }, { v: 'entradas', l: 'Entradas' }, { v: 'movimientos', l: 'Movimientos' }, { v: 'conteo', l: 'Conteo físico' }];
    let cuerpo = '';
    if (s.tab === 'productos') cuerpo = invProductos();
    if (s.tab === 'entradas') cuerpo = invEntradas();
    if (s.tab === 'movimientos') cuerpo = invMovimientos();
    if (s.tab === 'conteo') cuerpo = invConteo();
    return `<div class="screen">
      <div class="screen-head"><div class="subtabs">${tabs.map(t => `<button class="${s.tab === t.v ? 'on' : ''}" data-a="seg" data-scope="inv" data-k="tab" data-v="${t.v}">${t.l}</button>`).join('')}</div>
        <div class="head-actions"><button class="icon-btn lg-ic" data-a="scanInventario" aria-label="Escanear código" title="Escanear código">${icon('scan')}</button><button class="btn ghost" data-a="nuevaEntrada">${icon('in')}Entrada</button><button class="btn primary" data-a="nuevoProducto">${icon('plus')}Producto</button></div></div>
      ${cuerpo}</div>`;
  },
};
function invFiltrados() {
  const { q, cat, filtro } = App.s.inv; const nq = norm(q);
  return productosActivos().filter(p => (!cat || p.categoria === cat) && (!filtro || (filtro === 'reponer' ? estadoStock(p) !== 'ok' : estadoStock(p) === filtro)) && (!nq || norm(p.nombre).includes(nq) || norm(p.codigo).includes(nq)));
}
function invListaHTML() {
  const ps = invFiltrados(); const admin = App.puedeVer();
  if (!ps.length) return vacio('box', productosActivos().length ? 'No hay productos con ese filtro' : 'Aún no hay productos', productosActivos().length ? 'Cambia la búsqueda o el filtro.' : 'Crea tus productos uno por uno o impórtalos desde Excel.', productosActivos().length ? '' : `<div class="row-btns"><button class="btn ghost" data-a="importarProductos">${icon('upload')}Importar Excel</button><button class="btn primary" data-a="nuevoProducto">${icon('plus')}Crear producto</button></div>`);
  return `<div class="list">${ps.map(p => `<button class="item" data-a="verProducto" data-id="${p.id}">
      <span class="item-main"><span class="item-title">${esc(p.nombre)}</span><span class="item-sub">${p.codigo ? esc(p.codigo) + ' · ' : ''}${esc(p.categoria || '')}${admin && p.costo ? ` · costo ${money(p.costo)}` : ''}</span></span>
      <span class="item-end"><span class="num strong">${money(p.precio)}</span>${stockPill(p)}</span></button>`).join('')}</div>`;
}
function invProductos() {
  const s = App.s.inv; const inv = valorInventario(); const admin = App.puedeVer();
  const cats = cfg().categorias.filter(c => productosActivos().some(p => p.categoria === c));
  return `<section class="kpis small">
      <div class="kpi"><span class="kpi-l">Productos</span><span class="kpi-v num">${num(inv.productos)}</span><span class="kpi-s">${num(inv.unidades)} unidades</span></div>
      <div class="kpi"><span class="kpi-l">Valor a precio de venta</span><span class="kpi-v num">${money(inv.venta)}</span></div>
      ${admin ? `<div class="kpi"><span class="kpi-l">Valor a costo</span><span class="kpi-v num">${money(inv.costo)}</span><span class="kpi-s">Lo que invertiste</span></div>` : ''}
      <button class="kpi link" data-a="seg" data-scope="inv" data-k="filtro" data-v="${s.filtro === 'reponer' ? '' : 'reponer'}"><span class="kpi-l">Por reponer</span><span class="kpi-v num">${inv.agotados.length + inv.bajos.length}</span><span class="kpi-s">${inv.agotados.length} agotados · ${inv.bajos.length} bajos</span></button>
    </section>
    <div class="toolbar">
      <label class="search">${icon('search')}<input id="inv-q" type="search" placeholder="Buscar por nombre o código" value="${esc(s.q)}" data-in="invBuscar"></label>
      <div class="toolbar-row">${chips('inv', 'filtro', [{ v: '', l: 'Todos' }, { v: 'reponer', l: 'Por reponer' }, { v: 'agotado', l: 'Agotados' }], s.filtro)}
      <select id="inv-cat" data-ch="invCat" aria-label="Categoría"><option value="">Todas las categorías</option>${cats.map(c => `<option ${c === s.cat ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></div>
    </div>
    <div id="inv-list">${invListaHTML()}</div>
    <div class="row-btns end"><button class="btn ghost sm" data-a="etiquetas">${icon('barcode')}Etiquetas</button><button class="btn ghost sm" data-a="importarProductos">${icon('upload')}Importar desde Excel</button><button class="btn ghost sm" data-a="exportarInventario">${icon('download')}Exportar inventario</button></div>`;
}
INPUTS.invBuscar = el => { App.s.inv.q = el.value; $('#inv-list').innerHTML = invListaHTML(); };
Acciones.invCat = el => { App.s.inv.cat = el.value; App.render(); };

function invEntradas() {
  const movs = DB.all('movimientos').filter(m => m.tipo === 'entrada');
  const grupos = Array.from(groupBy(movs, m => m.ref || m.id).values()).map(g => ({ fecha: g[0].fecha, proveedor: g[0].proveedor, nota: g[0].nota, items: g, total: sum(g, m => m.cantidad * (m.costoUnit || 0)), unidades: sum(g, m => m.cantidad) })).sort((a, b) => b.fecha.localeCompare(a.fecha));
  const admin = App.puedeVer();
  if (!grupos.length) return vacio('in', 'Sin entradas de mercancía', 'Cuando llegue un pedido de tu proveedor, regístralo aquí para sumar el stock y actualizar el costo.', `<button class="btn primary" data-a="nuevaEntrada">${icon('in')}Registrar entrada</button>`);
  return `<div class="list">${grupos.map(g => `<details class="item det"><summary>
      <span class="item-main"><span class="item-title">${esc(g.proveedor || 'Entrada de mercancía')}</span><span class="item-sub">${fmtFechaHora(g.fecha)} · ${g.items.length} productos · ${num(g.unidades)} und.${g.nota ? ' · ' + esc(g.nota) : ''}</span></span>
      <span class="item-end">${admin ? `<span class="num strong">${money(g.total)}</span>` : ''}${icon('chevron', 'sm rot')}</span></summary>
      <div class="det-body">${g.items.map(m => filaDato(`${esc(m.productoNombre)} <small>× ${num(m.cantidad)}</small>`, admin ? `<span class="num">${money(m.costoUnit)} c/u</span>` : '')).join('')}</div></details>`).join('')}</div>`;
}

const TIPOS_MOV = { inicial: 'Stock inicial', entrada: 'Entrada', venta: 'Venta', separado: 'Separado', ajuste: 'Ajuste', anulacion: 'Anulación' };
function movRow(m) {
  const pos = m.cantidad > 0;
  return `<div class="item"><span class="mov-ic ${pos ? 'in' : 'out'}">${icon(pos ? 'in' : 'out')}</span>
    <span class="item-main"><span class="item-title">${esc(m.productoNombre)}</span><span class="item-sub">${TIPOS_MOV[m.tipo] || m.tipo}${m.refNumero ? ' #' + esc(m.refNumero) : ''}${m.proveedor ? ' · ' + esc(m.proveedor) : ''}${m.nota ? ' · ' + esc(m.nota) : ''} · ${fmtFechaCorta(m.fecha)}</span></span>
    <span class="item-end"><span class="num strong ${pos ? 'ok-text' : ''}">${pos ? '+' : ''}${num(m.cantidad)}</span></span></div>`;
}
function invMovimientos() {
  const s = App.s.inv;
  const movs = DB.all('movimientos').filter(m => !s.movTipo || m.tipo === s.movTipo).sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, 200);
  return `<div class="toolbar">${chips('inv', 'movTipo', [{ v: '', l: 'Todos' }, { v: 'venta', l: 'Ventas' }, { v: 'entrada', l: 'Entradas' }, { v: 'ajuste', l: 'Ajustes' }, { v: 'separado', l: 'Separados' }, { v: 'anulacion', l: 'Anulaciones' }], s.movTipo)}</div>
    ${movs.length ? `<div class="list">${movs.map(movRow).join('')}</div><p class="fine center">Se muestran los últimos 200 movimientos. El historial completo sale en Exportar a Excel.</p>` : vacio('list', 'Sin movimientos', '')}`;
}
function invConteo() {
  const s = App.s.inv; const ps = productosActivos();
  const cambios = Object.entries(s.conteo).filter(([id, v]) => v !== '' && DB.get('productos', id) && parseQty(v) !== stockDe(DB.get('productos', id)));
  return `<div class="notice">${icon('clipboard')}<span>Cuenta lo que hay en el estante y escribe la cantidad real, o escanea cada unidad (cada lectura suma 1). Solo se ajustan los productos con una cantidad distinta a la que dice la app.</span><button class="btn sm primary" data-a="scanConteo">${icon('scan')}Contar con cámara</button></div>
    <div class="list conteo">${ps.map(p => { const v = s.conteo[p.id] ?? ''; const dif = v === '' ? 0 : parseQty(v) - stockDe(p);
      return `<div class="item"><span class="item-main"><span class="item-title">${esc(p.nombre)}</span><span class="item-sub">En la app: <b class="num">${num(stockDe(p))}</b>${dif ? ` · <span class="${dif > 0 ? 'ok-text' : 'bad-text'}">${dif > 0 ? 'sobran' : 'faltan'} ${num(Math.abs(dif))}</span>` : ''}</span></span>
      <input class="qty-in" type="number" inputmode="numeric" min="0" placeholder="${num(stockDe(p))}" value="${esc(v)}" data-in="conteoCampo" data-id="${p.id}" aria-label="Cantidad contada de ${esc(p.nombre)}"></div>`; }).join('')}</div>
    <div class="sticky-foot"><span>${cambios.length} ${cambios.length === 1 ? 'producto' : 'productos'} con diferencia</span><button class="btn primary" data-a="guardarConteo" ${cambios.length ? '' : 'disabled'}>Guardar conteo</button></div>`;
}
INPUTS.conteoCampo = el => {
  App.s.inv.conteo[el.dataset.id] = el.value;
  const p = DB.get('productos', el.dataset.id); const sub = el.closest('.item').querySelector('.item-sub');
  const dif = el.value === '' ? 0 : parseQty(el.value) - stockDe(p);
  sub.innerHTML = `En la app: <b class="num">${num(stockDe(p))}</b>${dif ? ` · <span class="${dif > 0 ? 'ok-text' : 'bad-text'}">${dif > 0 ? 'sobran' : 'faltan'} ${num(Math.abs(dif))}</span>` : ''}`;
  const n = Object.entries(App.s.inv.conteo).filter(([id, v]) => v !== '' && parseQty(v) !== stockDe(DB.get('productos', id))).length;
  $('.sticky-foot span').textContent = `${n} ${n === 1 ? 'producto' : 'productos'} con diferencia`;
  $('.sticky-foot button').disabled = !n;
};
Acciones.guardarConteo = async () => {
  if (!(await requireAdmin())) return;
  if (!(await confirmar('Se ajustará el stock de los productos con diferencia y quedará registrado como "Conteo físico".', { si: 'Guardar conteo' }))) return;
  const n = await run(() => guardarConteo(App.s.inv.conteo));
  if (n !== undefined) { App.s.inv.conteo = {}; toast(`Conteo guardado: ${n} productos ajustados`); App.render(); }
};

/* Producto: crear / editar / ver */
Acciones.nuevoProducto = () => formProducto(null);
function formProducto(p, pre = {}) {
  const c = cfg(); const admin = App.puedeVer();
  Modal.open(`<form id="pr-form" class="form">
    <div class="field"><label for="pr-nom">Nombre</label><input id="pr-nom" required value="${esc(p?.nombre || '')}" placeholder="Ej.: Labial mate rojo" autofocus></div>
    <div class="grid2">
      <div class="field"><label for="pr-cod">Código de barras</label><div class="input-btns"><input id="pr-cod" value="${esc(p?.codigo || pre.codigo || '')}" placeholder="Escanea o escribe" data-scan-fill autocomplete="off"><button type="button" class="icon-btn" id="pr-scan" aria-label="Escanear con la cámara" title="Escanear con la cámara">${icon('scan')}</button></div>
        <button type="button" class="link-btn sm" id="pr-gen">No tiene código: generar uno</button></div>
      <div class="field"><label for="pr-cat">Categoría</label><select id="pr-cat">${opcionesSelect(c.categorias, p?.categoria || c.categorias[0])}</select></div>
      <div class="field"><label for="pr-pre">Precio de venta</label><input id="pr-pre" data-money inputmode="numeric" required value="${p ? num(p.precio) : ''}" placeholder="0"></div>
      ${admin || !p ? `<div class="field"><label for="pr-cos">Costo (lo que te cuesta)</label><input id="pr-cos" data-money inputmode="numeric" value="${p ? num(p.costo) : ''}" placeholder="0"></div>` : ''}
      ${p ? '' : `<div class="field"><label for="pr-stk">Stock inicial</label><input id="pr-stk" type="number" inputmode="numeric" min="0" value="" placeholder="0"></div>`}
      <div class="field"><label for="pr-min">Avisar cuando queden</label><input id="pr-min" type="number" inputmode="numeric" min="0" value="${p ? esc(p.stockMin ?? c.stockMinDef) : c.stockMinDef}"></div>
    </div>
    <p class="hint" id="pr-margen"></p>
    ${p ? '<p class="hint">Para cambiar el stock usa “Entrada” o “Ajustar stock”, así queda el registro.</p>' : ''}
    <button class="btn primary block lg" type="submit">${p ? 'Guardar cambios' : 'Crear producto'}</button></form>`, {
    title: p ? 'Editar producto' : 'Nuevo producto',
    onOpen(body, close) {
      bindMoneyInputs(body);
      if (pre.codigo) setTimeout(() => $('#pr-nom', body).focus(), 80);
      $('#pr-scan', body).onclick = () => abrirEscaner({ titulo: 'Escanear código del producto', alLeer: code => {
        const otro = productoPorCodigo(code);
        if (otro && (!p || otro.id !== p.id)) return { ok: false, msg: `Ese código ya es de ${otro.nombre}` };
        $('#pr-cod', body).value = code; return { ok: true, msg: code };
      } });
      $('#pr-gen', body).onclick = () => { $('#pr-cod', body).value = nuevoCodigoInterno(); toast('Código interno generado. Imprime su etiqueta desde Inventario.'); };
      const mg = () => { const pr = parseMoney($('#pr-pre', body).value); const co = $('#pr-cos', body) ? parseMoney($('#pr-cos', body).value) : 0; $('#pr-margen', body).textContent = pr && co ? `Ganancia por unidad: ${money(pr - co)} (${Math.round((pr - co) / pr * 100)}%)` : ''; };
      body.addEventListener('input', mg); mg();
      $('#pr-form', body).onsubmit = async e => {
        e.preventDefault();
        const data = { nombre: $('#pr-nom', body).value, codigo: $('#pr-cod', body).value, categoria: $('#pr-cat', body).value, precio: $('#pr-pre', body).value, costo: $('#pr-cos', body) ? $('#pr-cos', body).value : p.costo, stockMin: $('#pr-min', body).value, stock: $('#pr-stk', body) ? $('#pr-stk', body).value : 0 };
        if (await run(() => guardarProducto(data, p), p ? 'Producto actualizado' : 'Producto creado') !== undefined) close();
      };
    },
  });
}
Acciones.verProducto = el => verProducto(el.dataset.id);
function verProducto(id) {
  const p = DB.get('productos', id); if (!p) return;
  const admin = App.puedeVer();
  const movs = DB.all('movimientos').filter(m => m.productoId === p.id).sort((a, b) => b.fecha.localeCompare(a.fecha));
  const vend30 = -sum(movs.filter(m => (m.tipo === 'venta' || m.tipo === 'separado') && diasDesde(m.fecha) < 30), m => m.cantidad);
  Modal.open(`<div class="prod-det">
    <div class="vd-top"><div><p class="eyebrow">${esc(p.categoria || '')}${p.codigo ? ' · ' + esc(p.codigo) : ''}</p><h3>${esc(p.nombre)}</h3></div>${stockPill(p)}</div>
    <div class="kpis small three">
      <div class="kpi"><span class="kpi-l">Precio</span><span class="kpi-v num">${money(p.precio)}</span></div>
      ${admin ? `<div class="kpi"><span class="kpi-l">Costo</span><span class="kpi-v num">${money(p.costo)}</span><span class="kpi-s">${p.precio ? Math.round((p.precio - p.costo) / p.precio * 100) : 0}% de margen</span></div>` : ''}
      <div class="kpi"><span class="kpi-l">Vendidos 30 días</span><span class="kpi-v num">${num(vend30)}</span><span class="kpi-s">${vend30 > 0 && stockDe(p) > 0 ? `Alcanza para ~${Math.round(stockDe(p) / (vend30 / 30))} días` : ''}</span></div>
    </div>
    <div class="row-btns wrap">
      <button class="btn ghost" data-a="editarProducto" data-id="${p.id}">${icon('edit')}Editar</button>
      <button class="btn ghost" data-a="nuevaEntrada" data-id="${p.id}">${icon('in')}Entrada</button>
      <button class="btn ghost" data-a="ajustarProducto" data-id="${p.id}">${icon('adjust')}Ajustar stock</button>
      <button class="btn ghost" data-a="etiquetas" data-id="${p.id}">${icon('barcode')}Etiqueta</button>
    </div>
    <h4>Movimientos</h4>
    ${movs.length ? `<div class="list compact">${movs.slice(0, 40).map(movRow).join('')}</div>` : '<p class="muted-text">Sin movimientos.</p>'}
    <button class="btn danger-ghost block" data-a="archivarProducto" data-id="${p.id}">${icon('trash')}Quitar del catálogo</button>
  </div>`, { title: 'Producto' });
}
Acciones.editarProducto = el => { Modal.closeTop(); formProducto(DB.get('productos', el.dataset.id)); };
Acciones.archivarProducto = async el => {
  if (!(await requireAdmin())) return;
  const p = DB.get('productos', el.dataset.id);
  if (!(await confirmar(`"${p.nombre}" dejará de aparecer en ventas e inventario. Su historial se conserva.`, { si: 'Quitar', peligro: true }))) return;
  if (await run(() => DB.commit([{ t: 'update', col: 'productos', id: p.id, data: { activo: false } }]), 'Producto quitado del catálogo') !== undefined) Modal.closeTop();
};
Acciones.ajustarProducto = async el => {
  if (!(await requireAdmin())) return;
  const p = DB.get('productos', el.dataset.id);
  Modal.open(`<form id="aj-form" class="form">
    <p class="muted-text">Stock en la app: <b class="num">${num(stockDe(p))}</b></p>
    <div class="field"><label for="aj-q">Cantidad real</label><input id="aj-q" type="number" inputmode="numeric" min="0" value="${stockDe(p)}" autofocus></div>
    <div class="field"><label for="aj-m">Motivo</label><select id="aj-m"><option>Producto dañado</option><option>Pérdida o robo</option><option>Muestra o regalo</option><option>Uso interno</option><option>Corrección de conteo</option><option>Otro</option></select></div>
    <button class="btn primary block" type="submit">Guardar ajuste</button></form>`, {
    title: `Ajustar · ${p.nombre}`,
    onOpen(body, close) {
      $('#aj-form', body).onsubmit = async e => {
        e.preventDefault();
        const d = await run(() => ajustarStock(p, $('#aj-q', body).value, $('#aj-m', body).value));
        if (d === undefined) return;
        toast(d ? `Ajuste guardado (${d > 0 ? '+' : ''}${d})` : 'Sin cambios'); close(); Modal.closeTop();
      };
    },
  });
};

/* Entrada de mercancía */
Acciones.nuevaEntrada = el => {
  const c = cfg(); const ps = productosActivos(); const admin = App.puedeVer();
  if (!ps.length) { toast('Primero crea los productos.', 'warn'); return; }
  const lineas = [];
  if (el && el.dataset && el.dataset.id) { Modal.closeTop(); lineas.push({ productoId: el.dataset.id, cantidad: '', costoUnit: '' }); }
  const proveedores = [...new Set(DB.all('movimientos').map(m => m.proveedor).filter(Boolean))];
  let soltarEscaner = null;
  const lineasHTML = () => lineas.length ? lineas.map((l, i) => { const p = DB.get('productos', l.productoId); return `<div class="ent-line">
      <div class="ent-n"><b>${esc(p.nombre)}</b><small>Stock ${num(stockDe(p))}${admin ? ' · costo actual ' + money(p.costo) : ''}</small></div>
      <input type="number" inputmode="numeric" min="1" placeholder="Cant." value="${esc(l.cantidad)}" data-i="${i}" data-k="cantidad" aria-label="Cantidad">
      ${admin ? `<input data-money inputmode="numeric" placeholder="${num(p.costo)}" value="${esc(l.costoUnit)}" data-i="${i}" data-k="costoUnit" aria-label="Costo unitario">` : ''}
      <button type="button" class="icon-btn sm" data-del="${i}" aria-label="Quitar">${icon('x')}</button></div>`; }).join('') : '<p class="muted-text">Busca y agrega los productos que llegaron.</p>';
  Modal.open(`<form id="en-form" class="form" autocomplete="off">
    <div class="grid2"><div class="field"><label for="en-prov">Proveedor</label><input id="en-prov" list="dl-prov" placeholder="Opcional"><datalist id="dl-prov">${proveedores.map(p => `<option value="${esc(p)}">`).join('')}</datalist></div>
    <div class="field"><label for="en-fac">N° de factura</label><input id="en-fac" placeholder="Opcional"></div></div>
    <div class="field"><label for="en-bus">Agregar producto</label><div class="input-btns"><label class="search">${icon('search')}<input id="en-bus" type="search" placeholder="Escribe o escanea"></label><button type="button" class="btn ghost" id="en-scan">${icon('scan')}Escanear</button></div><div id="en-sug" class="sug"></div></div>
    <p class="hint">Con el escáner, cada lectura suma 1 a la cantidad de ese producto.</p>
    <div class="ent-head"><span>Producto</span><span>Cant.</span>${admin ? '<span>Costo c/u</span>' : ''}<span></span></div>
    <div id="en-lines">${lineasHTML()}</div>
    ${admin ? `<p class="hint">El costo se promedia con el que ya tenías. Si lo dejas vacío se usa el costo actual.</p>` : ''}
    <div class="field"><label>¿Cómo se pagó?</label><div class="chips" id="en-pago">${[{ v: 'no', l: 'No registrar pago' }, ...c.metodos.map(m => ({ v: m, l: m }))].map((o, i) => `<button type="button" class="chip ${i === 0 ? 'on' : ''}" data-v="${esc(o.v)}">${esc(o.l)}</button>`).join('')}</div></div>
    <p class="hint">Si eliges un medio de pago se registra como gasto de “${GASTO_MERCANCIA}” (no resta de la ganancia; la ganancia ya descuenta el costo de lo vendido).</p>
    <div class="dl" id="en-tot"></div>
    <button class="btn primary block lg" type="submit">Guardar entrada</button></form>`, {
    title: 'Entrada de mercancía', wide: true,
    onClose() { soltarEscaner && soltarEscaner(); },
    onOpen(body, close) {
      bindMoneyInputs(body);
      let pago = 'no';
      const tot = () => { const t = sum(lineas, l => parseQty(l.cantidad) * (l.costoUnit === '' ? (DB.get('productos', l.productoId).costo || 0) : parseMoney(l.costoUnit))); $('#en-tot', body).innerHTML = lineas.length ? filaDato(`${num(sum(lineas, l => parseQty(l.cantidad)))} unidades`, admin ? `<b class="num">${money(t)}</b>` : '', 'total') : ''; };
      const pintar = () => { $('#en-lines', body).innerHTML = lineasHTML(); bindMoneyInputs($('#en-lines', body)); tot(); };
      tot();
      $('#en-lines', body).addEventListener('input', e => { const i = e.target.dataset.i; if (i === undefined) return; lineas[i][e.target.dataset.k] = e.target.value; tot(); });
      $('#en-lines', body).addEventListener('click', e => { const b = e.target.closest('[data-del]'); if (b) { lineas.splice(Number(b.dataset.del), 1); pintar(); } });
      const bus = $('#en-bus', body); const sug = $('#en-sug', body);
      bus.addEventListener('input', () => {
        const q = norm(bus.value); if (!q) { sug.innerHTML = ''; return; }
        sug.innerHTML = ps.filter(p => norm(p.nombre).includes(q) || norm(p.codigo).includes(q)).slice(0, 6).map(p => `<button type="button" data-pid="${p.id}">${esc(p.nombre)} <small>${num(stockDe(p))} und.</small></button>`).join('') || '<p class="muted-text">Sin resultados. Crea el producto primero.</p>';
      });
      sug.addEventListener('click', e => {
        const b = e.target.closest('[data-pid]'); if (!b) return;
        if (!lineas.find(l => l.productoId === b.dataset.pid)) lineas.push({ productoId: b.dataset.pid, cantidad: '', costoUnit: '' });
        bus.value = ''; sug.innerHTML = ''; pintar();
        const ins = $$('#en-lines input[data-k="cantidad"]', body); ins[ins.length - 1]?.focus();
      });
      const porCodigo = code => {
        const p = productoPorCodigo(code);
        if (!p) return { ok: false, msg: `El código ${code} no está registrado. Crea el producto primero.` };
        let l = lineas.find(x => x.productoId === p.id);
        if (!l) { l = { productoId: p.id, cantidad: '', costoUnit: '' }; lineas.push(l); }
        l.cantidad = String((parseQty(l.cantidad) || 0) + 1);
        pintar();
        return { ok: true, msg: `${p.nombre}: ${l.cantidad}`, sub: `${num(sum(lineas, x => parseQty(x.cantidad)))} unidades en esta entrada` };
      };
      soltarEscaner = Escaner.usar(porCodigo);
      $('#en-scan', body).onclick = () => abrirEscaner({ titulo: 'Escanear mercancía', continuo: true, ayuda: 'Escanea cada unidad que llegó.', alLeer: porCodigo });
      bus.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); const r = porCodigo(bus.value.trim()); if (r.ok) { bus.value = ''; sug.innerHTML = ''; } else toast(r.msg, 'warn'); } });
      $$('#en-pago .chip', body).forEach(b => b.onclick = () => { pago = b.dataset.v; $$('#en-pago .chip', body).forEach(x => x.classList.toggle('on', x === b)); });
      $('#en-form', body).onsubmit = async e => {
        e.preventDefault();
        const r = await run(() => registrarEntrada({ lineas, proveedor: $('#en-prov', body).value.trim(), factura: $('#en-fac', body).value.trim(), pago }));
        if (r) { toast(`Entrada guardada: ${num(sum(lineas, l => parseQty(l.cantidad)))} unidades`); close(); }
      };
    },
  });
};

/* Importar productos */
Acciones.importarProductos = () => {
  Modal.open(`<div class="form">
    <p>Sube un archivo de Excel (.xlsx) o CSV con una fila por producto. Columnas que se reconocen: <b>Nombre</b>, Código, Categoría, Precio, Costo, Stock, Stock mínimo.</p>
    <p class="hint">Si un producto ya existe (mismo código o mismo nombre) se actualizan precio, costo y categoría.</p>
    <button class="btn ghost sm" data-a="plantilla">${icon('download')}Descargar plantilla</button>
    <div class="field"><label for="imp-file">Archivo</label><input id="imp-file" type="file" accept=".xlsx,.xls,.csv"></div>
    <label class="check"><input type="checkbox" id="imp-stock"> Reemplazar también el stock de los productos que ya existen</label>
    <div id="imp-prev"></div>
    <button class="btn primary block" id="imp-go" disabled>Importar</button></div>`, {
    title: 'Importar productos',
    onOpen(body, close) {
      let lista = [];
      $('#imp-file', body).onchange = async e => {
        const f = e.target.files[0]; if (!f) return;
        const filas = await run(() => leerHoja(f)); if (!filas) return;
        lista = filasAProductos(filas);
        $('#imp-prev', body).innerHTML = lista.length ? `<p><b>${lista.length}</b> productos encontrados. Primeros: ${esc(lista.slice(0, 4).map(p => p.nombre).join(', '))}…</p>` : '<p class="bad-text">No se encontró la columna "Nombre".</p>';
        $('#imp-go', body).disabled = !lista.length;
      };
      $('#imp-go', body).onclick = async () => {
        const r = await run(() => importarProductos(lista, { actualizarStock: $('#imp-stock', body).checked }));
        if (r) { toast(`${r.nuevos} nuevos y ${r.actualizados} actualizados`); close(); }
      };
    },
  });
};
Acciones.plantilla = () => run(async () => entregarArchivo(await plantillaProductos(), 'plantilla-productos.xlsx'));
Acciones.exportarInventario = () => run(async () => entregarArchivo(await libroExcel({
  Inventario: productosActivos().map(p => ({ Código: p.codigo, Producto: p.nombre, Categoría: p.categoria, Precio: p.precio, ...(App.puedeVer() ? { Costo: p.costo } : {}), Stock: p.stock, 'Stock mínimo': p.stockMin, Estado: estadoStock(p) })),
}), `inventario-${dayKey()}.xlsx`));

/* =================== CAJA =================== */
Pantallas.caja = {
  titulo: 'Caja',
  render() {
    const caja = cajaAbierta(); const cerradas = cajasCerradas().slice(0, 30);
    const hist = `<section class="card"><div class="card-head"><h2>Cierres anteriores</h2></div>
      ${cerradas.length ? `<div class="list">${cerradas.map(c => `<button class="item" data-a="verCierre" data-id="${c.id}">
        <span class="item-main"><span class="item-title">${fmtFecha(c.apertura)}</span><span class="item-sub">${fmtHora(c.apertura)} a ${fmtHora(c.cierre)} · ${c.resumen?.numVentas || 0} ventas · vendido ${money(c.resumen?.totalVendido)}</span></span>
        <span class="item-end"><span class="num strong">${money(c.contado)}</span>${difPill(c.diferencia)}</span></button>`).join('')}</div>` : '<p class="muted-text">Todavía no hay cierres.</p>'}</section>`;
    if (!caja) {
      return `<div class="screen narrow">${vacio('cash', 'La caja está cerrada', 'Abre la caja al empezar el día con la base en efectivo. Al final del día haces el cierre: cuentas el dinero y la app te dice si cuadra.', `<button class="btn primary lg" data-a="abrirCaja">${icon('cash')}Abrir caja</button>`)}${hist}</div>`;
    }
    const r = resumenCaja(caja); const c = cfg();
    const otros = Object.entries(r.porMetodo).filter(([m, x]) => m !== 'Efectivo' && (x.ventas || x.abonos || x.gastos));
    const eventos = [
      ...r.ventas.filter(v => v.tipo === 'contado').map(v => ({ f: v.fecha, t: `Venta #${v.numero}${v.clienteNombre ? ' · ' + v.clienteNombre : ''}`, m: v.metodo, v: v.total, an: v.estado === 'anulada', id: v.id })),
      ...r.ventas.filter(v => v.tipo !== 'contado').map(v => ({ f: v.fecha, t: `${v.tipo === 'fiado' ? 'Fiado' : 'Separado'} #${v.numero} · ${v.clienteNombre}`, m: 'Crédito', v: v.total, an: v.estado === 'anulada', cred: true, id: v.id })),
      ...r.abonos.map(a => ({ f: a.fecha, t: `Abono #${a.ventaNumero} · ${a.clienteNombre}`, m: a.metodo, v: a.valor, id: a.ventaId })),
      ...r.gastos.map(g => ({ f: g.fecha, t: `Gasto · ${g.descripcion || g.categoria}`, m: g.metodo, v: -g.valor })),
      ...r.movs.map(m => ({ f: m.fecha, t: `${m.tipo === 'ingreso' ? 'Ingreso' : 'Retiro'} · ${m.motivo}`, m: 'Efectivo', v: m.tipo === 'ingreso' ? m.valor : -m.valor })),
    ].sort((a, b) => b.f.localeCompare(a.f));
    return `<div class="screen">
      <section class="caja-hero">
        <div><p class="eyebrow">Caja abierta desde ${fmtFechaCorta(caja.apertura)} · ${esc(caja.usuarioApertura || '')}</p>
        <p class="caja-lbl">Efectivo que debe haber en la caja</p><p class="caja-big num">${money(r.esperado)}</p></div>
        <div class="caja-actions">
          <button class="btn ghost" data-a="cajaMov" data-t="ingreso">${icon('in')}Ingreso</button>
          <button class="btn ghost" data-a="cajaMov" data-t="retiro">${icon('out')}Retiro</button>
          <button class="btn ghost" data-a="nuevoGasto">${icon('wallet')}Gasto</button>
          <button class="btn primary" data-a="cerrarCaja">${icon('lock')}Cerrar caja</button>
        </div>
      </section>
      <div class="cols">
        <section class="card"><div class="card-head"><h2>Cuadre del efectivo</h2></div><div class="dl">
          ${filaDato('Base inicial', `<span class="num">${money(r.base)}</span>`)}
          ${filaDato('+ Ventas en efectivo', `<span class="num">${money(r.efectivoVentas)}</span>`)}
          ${filaDato('+ Abonos en efectivo', `<span class="num">${money(r.efectivoAbonos)}</span>`)}
          ${r.ingresos ? filaDato('+ Otros ingresos', `<span class="num">${money(r.ingresos)}</span>`) : ''}
          ${filaDato('− Gastos pagados en efectivo', `<span class="num">${money(r.efectivoGastos)}</span>`)}
          ${r.retiros ? filaDato('− Retiros', `<span class="num">${money(r.retiros)}</span>`) : ''}
          ${filaDato('Debe haber', `<span class="num">${money(r.esperado)}</span>`, 'total')}
        </div></section>
        <section class="card"><div class="card-head"><h2>Otros medios de pago</h2></div>
          <p class="hint">Revisa que estos valores coincidan con lo que llegó al banco, Nequi o datáfono.</p>
          <div class="dl">${otros.length ? otros.map(([m, x]) => filaDato(esc(m), `<span class="num">${money(x.ventas + x.abonos - x.gastos)}</span>`)).join('') : '<p class="muted-text">Sin pagos por otros medios.</p>'}</div>
          <div class="dl sep">
            ${filaDato('Ventas', `<span class="num">${r.numVentas}</span>`)}
            ${filaDato('Total vendido', `<span class="num">${money(r.totalVendido)}</span>`)}
            ${filaDato('Vendido a crédito', `<span class="num">${money(r.credito)}</span>`)}
            ${filaDato('Dinero recibido (todos los medios)', `<span class="num">${money(r.totalRecaudado)}</span>`)}
          </div></section>
      </div>
      <section class="card"><div class="card-head"><h2>Movimientos de esta caja</h2><span class="muted-text">${eventos.length}</span></div>
        ${eventos.length ? `<div class="list compact">${eventos.map(e => `<${e.id ? `button class="item" data-a="verVenta" data-id="${e.id}"` : 'div class="item"'}>
          <span class="item-main"><span class="item-title ${e.an ? 'tachado' : ''}">${esc(e.t)}</span><span class="item-sub">${fmtHora(e.f)} · ${esc(e.m)}${e.an ? ' · anulada' : ''}</span></span>
          <span class="item-end"><span class="num strong ${e.an || e.cred ? 'muted-text' : e.v < 0 ? 'bad-text' : ''}">${e.v < 0 ? '−' : ''}${money(Math.abs(e.v))}</span></span></${e.id ? 'button' : 'div'}>`).join('')}</div>` : '<p class="muted-text">Todavía no hay movimientos.</p>'}
      </section>
      ${hist}</div>`;
  },
};
function difPill(d) { d = Number(d) || 0; return d === 0 ? pill('Cuadró', 'ok') : d > 0 ? pill('Sobró ' + money(d), 'warn') : pill('Faltó ' + money(-d), 'bad'); }

Acciones.cajaMov = el => {
  const t = el.dataset.t;
  Modal.open(`<form id="cm-form" class="form">
    <p class="muted-text">${t === 'ingreso' ? 'Dinero que entra a la caja y no es una venta (ej.: más sencillo para vueltas).' : 'Dinero que sale de la caja y no es un gasto del negocio (ej.: llevar efectivo al banco, retiro de la dueña).'}</p>
    <div class="field"><label for="cm-val">Valor</label><input id="cm-val" data-money inputmode="numeric" autofocus required></div>
    <div class="field"><label for="cm-mot">Motivo</label><input id="cm-mot" required placeholder="${t === 'ingreso' ? 'Ej.: sencillo para vueltas' : 'Ej.: consignación en el banco'}"></div>
    <button class="btn primary block" type="submit">Registrar ${t}</button></form>`, {
    title: t === 'ingreso' ? 'Ingreso de efectivo' : 'Retiro de efectivo',
    onOpen(body, close) {
      bindMoneyInputs(body);
      $('#cm-form', body).onsubmit = async e => { e.preventDefault(); if (await run(() => movimientoCaja(t, $('#cm-val', body).value, $('#cm-mot', body).value), t === 'ingreso' ? 'Ingreso registrado' : 'Retiro registrado') !== undefined) close(); };
    },
  });
};

Acciones.cerrarCaja = () => {
  const caja = cajaAbierta(); if (!caja) return;
  const r = resumenCaja(caja);
  const det = {}; let modoTotal = false;
  Modal.open(`<form id="cc-form" class="form">
    <div class="cc-top"><span>Debe haber</span><b class="num">${money(r.esperado)}</b></div>
    <div class="seg" id="cc-modo"><button type="button" class="on" data-m="0">Contar billetes y monedas</button><button type="button" data-m="1">Escribir el total</button></div>
    <div id="cc-den" class="den-grid">${DENOMINACIONES.map(d => `<label class="den"><span class="num">${money(d)}</span><input type="number" inputmode="numeric" min="0" placeholder="0" data-den="${d}" aria-label="Cantidad de ${money(d)}"><small class="num" data-sub="${d}"></small></label>`).join('')}</div>
    <div id="cc-tot" class="field" hidden><label for="cc-total">Total contado en efectivo</label><input id="cc-total" data-money inputmode="numeric" placeholder="0"></div>
    <div class="cc-res" id="cc-res"></div>
    <div class="grid2">
      <div class="field"><label for="cc-base">Dejar de base para mañana</label><input id="cc-base" data-money inputmode="numeric" value="${num(caja.base)}"></div>
      <div class="field"><label for="cc-nota">Nota</label><input id="cc-nota" placeholder="Opcional"></div>
    </div>
    <button class="btn primary block lg" type="submit">Cerrar caja</button></form>`, {
    title: 'Cierre de caja', wide: true,
    onOpen(body, close) {
      bindMoneyInputs(body);
      const contado = () => modoTotal ? parseMoney($('#cc-total', body).value) : sum(Object.entries(det), ([d, q]) => Number(d) * q);
      const pintar = () => {
        const cnt = contado(); const dif = cnt - r.esperado;
        $('#cc-res', body).innerHTML = `${filaDato('Contado', `<b class="num">${money(cnt)}</b>`)}${filaDato('Diferencia', `<b class="num ${dif === 0 ? 'ok-text' : dif > 0 ? 'warn-text' : 'bad-text'}">${dif === 0 ? 'Cuadra exacto' : (dif > 0 ? 'Sobran ' : 'Faltan ') + money(Math.abs(dif))}</b>`, 'total')}`;
      };
      $('#cc-den', body).addEventListener('input', e => { const d = e.target.dataset.den; if (!d) return; det[d] = parseQty(e.target.value); const s = $(`[data-sub="${d}"]`, body); s.textContent = det[d] ? money(det[d] * Number(d)) : ''; pintar(); });
      $('#cc-total', body).addEventListener('input', pintar);
      $$('#cc-modo button', body).forEach(b => b.onclick = () => { modoTotal = b.dataset.m === '1'; $$('#cc-modo button', body).forEach(x => x.classList.toggle('on', x === b)); $('#cc-den', body).hidden = modoTotal; $('#cc-tot', body).hidden = !modoTotal; pintar(); });
      pintar();
      $('#cc-form', body).onsubmit = async e => {
        e.preventDefault();
        const cnt = contado(); const dif = cnt - r.esperado;
        if (dif !== 0 && !(await confirmar(`${dif > 0 ? 'Sobran' : 'Faltan'} ${money(Math.abs(dif))}. ¿Cerrar la caja de todas formas? La diferencia queda registrada.`, { si: 'Cerrar caja' }))) return;
        const cerrada = await run(() => cerrarCaja(caja, { contado: cnt, detalle: modoTotal ? {} : det, baseSiguiente: $('#cc-base', body).value, nota: $('#cc-nota', body).value }));
        if (!cerrada) return;
        close(); mostrarCierre(cerrada, true);
      };
    },
  });
};
Acciones.verCierre = el => mostrarCierre(DB.get('cajas', el.dataset.id));
function mostrarCierre(c, recien) {
  const r = c.resumen || {}; const cf = cfg();
  const txt = `*Cierre de caja ${cf.nombre}*\n${fmtFecha(c.apertura)} (${fmtHora(c.apertura)} a ${fmtHora(c.cierre)})\n\nVentas: ${r.numVentas} · Total vendido ${money(r.totalVendido)}\nEfectivo esperado: ${money(c.esperado)}\nEfectivo contado: ${money(c.contado)}\n${c.diferencia === 0 ? 'Cuadró exacto' : (c.diferencia > 0 ? 'Sobrante: ' : 'Faltante: ') + money(Math.abs(c.diferencia))}\n${Object.entries(r.porMetodo || {}).filter(([m]) => m !== 'Efectivo').map(([m, x]) => `${m}: ${money((x.ventas || 0) + (x.abonos || 0) - (x.gastos || 0))}`).join('\n')}\nGastos: ${money(r.totalGastos)}`;
  Modal.open(`<div class="venta-det">
    ${recien ? `<div class="success compact"><div class="success-ic">${icon('check')}</div><h3>Caja cerrada</h3></div>` : ''}
    <div class="vd-top"><div><p class="eyebrow">${fmtFechaHora(c.apertura)} → ${fmtHora(c.cierre)}</p><h3>Cierre del ${fmtFecha(c.apertura)}</h3></div>${difPill(c.diferencia)}</div>
    <div class="dl">
      ${filaDato('Base', `<span class="num">${money(r.base)}</span>`)}
      ${filaDato('Ventas en efectivo', `<span class="num">${money(r.efectivoVentas)}</span>`)}
      ${filaDato('Abonos en efectivo', `<span class="num">${money(r.efectivoAbonos)}</span>`)}
      ${r.ingresos ? filaDato('Otros ingresos', `<span class="num">${money(r.ingresos)}</span>`) : ''}
      ${filaDato('Gastos en efectivo', `<span class="num">−${money(r.efectivoGastos)}</span>`)}
      ${r.retiros ? filaDato('Retiros', `<span class="num">−${money(r.retiros)}</span>`) : ''}
      ${filaDato('Debía haber', `<b class="num">${money(c.esperado)}</b>`, 'total')}
      ${filaDato('Se contó', `<b class="num">${money(c.contado)}</b>`)}
      ${c.baseSiguiente ? filaDato('Se dejó de base', `<span class="num">${money(c.baseSiguiente)}</span>`) : ''}
    </div>
    <h4>Resumen del día</h4><div class="dl">
      ${Object.entries(r.porMetodo || {}).filter(([m]) => m !== 'Efectivo').map(([m, x]) => filaDato(esc(m), `<span class="num">${money((x.ventas || 0) + (x.abonos || 0) - (x.gastos || 0))}</span>`)).join('')}
      ${filaDato('Ventas', `<span class="num">${r.numVentas || 0}${r.numAnuladas ? ` (+${r.numAnuladas} anuladas)` : ''}</span>`)}
      ${filaDato('Total vendido', `<span class="num">${money(r.totalVendido)}</span>`)}
      ${filaDato('Dinero recibido', `<span class="num">${money(r.totalRecaudado)}</span>`)}
      ${filaDato('Gastos', `<span class="num">${money(r.totalGastos)}</span>`)}
      ${App.puedeVer() ? filaDato('Ganancia de las ventas', `<span class="num">${money(r.ganancia)}</span>`) : ''}
    </div>
    ${c.notaCierre ? `<p class="muted-text">Nota: ${esc(c.notaCierre)}</p>` : ''}
    <div class="stack"><div class="row-btns"><button class="btn ghost" data-a="cierrePDF" data-id="${c.id}" data-share="1">${icon('share')}Compartir PDF</button><button class="btn ghost" data-a="cierrePDF" data-id="${c.id}">${icon('download')}Descargar</button></div>
    <button class="btn ghost block" data-a="copiar" data-t="${esc(txt)}">${icon('clipboard')}Copiar resumen para WhatsApp</button></div>
    <p class="fine">Cerró ${esc(c.usuarioCierre || '')}</p></div>`, { title: 'Cierre de caja' });
}
Acciones.cierrePDF = el => { const c = DB.get('cajas', el.dataset.id); run(async () => entregarArchivo(await cierrePDF(c), `Cierre-caja-${dayKey(c.apertura)}.pdf`, { compartir: !!el.dataset.share })); };
Acciones.copiar = el => copiarTexto(el.dataset.t);

/* =================== VENTAS =================== */
Pantallas.ventas = {
  titulo: 'Ventas',
  render() {
    const s = App.s.ventas; const r = rangoPeriodo(s.periodo);
    const nq = norm(s.q);
    let vs = DB.all('ventas').filter(v => enRango(v.dia, r));
    if (s.tipo === 'porEntregar') vs = vs.filter(v => v.tipo === 'separado' && !v.entregado && v.estado !== 'anulada');
    else if (s.tipo === 'anulada') vs = vs.filter(v => v.estado === 'anulada');
    else if (s.tipo === 'credito') vs = vs.filter(v => v.tipo !== 'contado');
    else if (s.tipo) vs = vs.filter(v => v.tipo === s.tipo);
    if (nq) vs = vs.filter(v => norm(v.clienteNombre).includes(nq) || String(v.numero).includes(nq) || v.items.some(i => norm(i.nombre).includes(nq)));
    vs.sort((a, b) => b.fecha.localeCompare(a.fecha));
    const validas = vs.filter(v => v.estado !== 'anulada');
    const porDia = groupBy(vs.slice(0, 300), v => v.dia);
    return `<div class="screen">
      <div class="toolbar">
        ${chips('ventas', 'periodo', [{ v: 'hoy', l: 'Hoy' }, { v: 'ayer', l: 'Ayer' }, { v: '7d', l: '7 días' }, { v: 'mes', l: 'Este mes' }, { v: 'mesAnt', l: 'Mes anterior' }, { v: 'todo', l: 'Todo' }], s.periodo)}
        <div class="toolbar-row"><label class="search">${icon('search')}<input id="v-q" type="search" placeholder="Clienta, número o producto" value="${esc(s.q)}" data-in="ventasBuscar"></label>
        <select data-ch="ventasTipo" aria-label="Tipo"><option value="">Todas</option>${[['contado', 'Contado'], ['credito', 'Fiado y separado'], ['porEntregar', 'Separados por entregar'], ['anulada', 'Anuladas']].map(([v, l]) => `<option value="${v}" ${s.tipo === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
      </div>
      <div class="sumline"><span>${validas.length} ventas</span><b class="num">${money(sum(validas, v => v.total))}</b></div>
      ${vs.length ? Array.from(porDia, ([dia, lista]) => `<h3 class="day-h">${fmtFecha(parseDay(dia))}<span class="num">${money(sum(lista.filter(v => v.estado !== 'anulada'), v => v.total))}</span></h3><div class="list">${lista.map(ventaRow).join('')}</div>`).join('') : vacio('receipt', 'No hay ventas en este periodo', '')}
      ${vs.length > 300 ? '<p class="fine center">Se muestran las 300 más recientes. Usa Exportar en Reportes para ver todas.</p>' : ''}
    </div>`;
  },
};
INPUTS.ventasBuscar = debounce(el => { App.s.ventas.q = el.value; const pos = el.selectionStart; App.render(); const n = $('#v-q'); n.focus(); try { n.setSelectionRange(pos, pos); } catch { } }, 250);
Acciones.ventasTipo = el => { App.s.ventas.tipo = el.value; App.render(); };

/* =================== CLIENTAS Y CARTERA =================== */
Pantallas.clientes = {
  titulo: 'Clientas y cartera',
  render() {
    const s = App.s.cli;
    const tabs = [{ v: 'clientas', l: 'Clientas' }, { v: 'cartera', l: 'Por cobrar' }, { v: 'difusion', l: 'Difusión' }];
    let cuerpo = s.tab === 'cartera' ? cliCartera() : s.tab === 'difusion' ? cliDifusion() : cliLista();
    return `<div class="screen"><div class="screen-head"><div class="subtabs">${tabs.map(t => `<button class="${s.tab === t.v ? 'on' : ''}" data-a="seg" data-scope="cli" data-k="tab" data-v="${t.v}">${t.l}</button>`).join('')}</div>
      <div class="head-actions"><button class="btn primary" data-a="nuevaClienta">${icon('plus')}Clienta</button></div></div>${cuerpo}</div>`;
  },
};
function statsClientes() {
  const m = new Map();
  DB.all('ventas').filter(v => v.estado !== 'anulada' && v.clienteId).forEach(v => {
    const x = m.get(v.clienteId) || { total: 0, n: 0, saldo: 0, ultima: '' };
    x.total += v.total; x.n++; x.saldo += Number(v.saldo) || 0; if (v.fecha > x.ultima) x.ultima = v.fecha; m.set(v.clienteId, x);
  });
  return m;
}
function cliListaHTML() {
  const st = statsClientes(); const nq = norm(App.s.cli.q);
  const cs = DB.all('clientes').filter(c => !nq || norm(c.nombre).includes(nq) || telLimpio(c.tel).includes(nq)).sort((a, b) => ((st.get(b.id)?.total || 0) - (st.get(a.id)?.total || 0)) || a.nombre.localeCompare(b.nombre));
  if (!cs.length) return vacio('users', 'Sin clientas', 'Se guardan solas cuando registras una venta con nombre y WhatsApp.');
  return `<div class="list">${cs.map(c => { const x = st.get(c.id) || { total: 0, n: 0, saldo: 0 };
    return `<button class="item" data-a="verClienta" data-id="${c.id}"><span class="avatar">${esc((c.nombre || '?').trim().charAt(0).toUpperCase())}</span>
      <span class="item-main"><span class="item-title">${esc(c.nombre)}</span><span class="item-sub num">${esc(c.tel || 'Sin teléfono')} · ${x.n} compras${x.ultima ? ' · última ' + fmtFecha(x.ultima) : ''}</span></span>
      <span class="item-end"><span class="num strong">${money(x.total)}</span>${x.saldo > 0 ? pill('Debe ' + money(x.saldo), 'warn') : ''}</span></button>`; }).join('')}</div>`;
}
function cliLista() {
  return `<div class="toolbar"><label class="search">${icon('search')}<input id="cli-q" type="search" placeholder="Buscar por nombre o teléfono" value="${esc(App.s.cli.q)}" data-in="cliBuscar"></label></div>
    <div id="cli-list">${cliListaHTML()}</div>
    <div class="row-btns end"><button class="btn ghost sm" data-a="importarClientas">${icon('upload')}Importar desde Excel</button></div>`;
}
INPUTS.cliBuscar = el => { App.s.cli.q = el.value; $('#cli-list').innerHTML = cliListaHTML(); };

function cliCartera() {
  const vs = ventasConSaldo(); const total = sum(vs, v => v.saldo);
  const grupos = Array.from(groupBy(vs, v => v.clienteId || v.clienteNombre).values()).map(l => ({ nombre: l[0].clienteNombre, tel: l[0].clienteTel, ventas: l, saldo: sum(l, v => v.saldo), dias: diasDesde(l[0].fecha) })).sort((a, b) => b.dias - a.dias);
  const ant = [[0, 15, '0–15 días'], [16, 30, '16–30 días'], [31, 60, '31–60 días'], [61, 1e9, 'Más de 60']].map(([a, b, l]) => ({ l, v: sum(vs.filter(v => diasDesde(v.fecha) >= a && diasDesde(v.fecha) <= b), v => v.saldo) }));
  const btnDeuda = `<div class="row-btns end"><button class="btn ghost sm" data-a="deudaAnterior">${icon('plus')}Registrar deuda anterior</button></div>`;
  if (!vs.length) return vacio('check', 'Nadie te debe', 'Las ventas fiadas y los separados con saldo aparecen aquí.') + btnDeuda;
  return btnDeuda + `<section class="kpis small"><div class="kpi wide"><span class="kpi-l">Total por cobrar</span><span class="kpi-v num">${money(total)}</span><span class="kpi-s">${grupos.length} clientas · ${vs.length} cuentas</span></div>
      ${ant.map(a => `<div class="kpi"><span class="kpi-l">${a.l}</span><span class="kpi-v num">${money(a.v)}</span></div>`).join('')}</section>
    <div class="list">${grupos.map(g => `<details class="item det" ${grupos.length < 4 ? 'open' : ''}><summary>
      <span class="avatar">${esc((g.nombre || '?').charAt(0).toUpperCase())}</span>
      <span class="item-main"><span class="item-title">${esc(g.nombre)}</span><span class="item-sub">${g.ventas.length} ${g.ventas.length === 1 ? 'cuenta' : 'cuentas'} · la más antigua hace ${g.dias} días</span></span>
      <span class="item-end"><span class="num strong">${money(g.saldo)}</span>${g.dias > 30 ? pill(g.dias + ' días', 'bad') : g.dias > 15 ? pill(g.dias + ' días', 'warn') : ''}</span></summary>
      <div class="det-body">${g.ventas.map(v => `<div class="cart-row"><button class="link-btn" data-a="verVenta" data-id="${v.id}">#${esc(v.numero)} · ${v.tipo === 'separado' ? 'Separado' : 'Fiado'} · ${fmtFecha(v.fecha)}</button><span class="num">${money(v.saldo)}</span><button class="btn sm primary" data-a="abonar" data-id="${v.id}">Abonar</button></div>`).join('')}
      <div class="row-btns">${g.ventas[0].clienteId ? `<button class="btn ghost sm" data-a="pdf" data-tipo="cuenta" data-id="${g.ventas[0].clienteId}" data-modo="${puedeCompartirArchivos() ? 'share' : 'download'}">${icon(puedeCompartirArchivos() ? 'share' : 'download')}Estado de cuenta PDF</button>` : ''}
      ${g.tel ? `<a class="btn wa sm" href="${esc(waLink(g.tel, textoCobroWhatsApp(g.nombre, g.ventas), cfg().codigoPais))}" target="_blank" rel="noopener">${icon('whatsapp')}Recordatorio</a>` : ''}</div></div></details>`).join('')}</div>`;
}

function cliDifusion() {
  const s = App.s.cli; const c = cfg();
  if (!s.msg) s.msg = c.mensajeDifusion;
  const cs = DB.all('clientes').filter(x => telLimpio(x.tel).length >= 10).sort((a, b) => a.nombre.localeCompare(b.nombre));
  const texto = x => s.msg.replaceAll('{nombre}', x.nombre.split(' ')[0]).replaceAll('{negocio}', c.nombre).replaceAll('{catalogo}', c.catalogoUrl || '');
  const enviados = Object.keys(s.enviados).length;
  return `<div class="notice">${icon('whatsapp')}<span>Escribe el mensaje y envíalo clienta por clienta. Abrir los chats uno a uno evita que WhatsApp bloquee tu número por envíos masivos. Para muchas clientas, exporta los contactos y crea una lista de difusión en WhatsApp Business.</span></div>
    <div class="field"><label for="dif-msg">Mensaje <small>({nombre}, {negocio} y {catalogo} se reemplazan solos)</small></label><textarea id="dif-msg" rows="3" data-in="difMsg">${esc(s.msg)}</textarea></div>
    <div class="sumline"><span>${cs.length} clientas con WhatsApp · ${enviados} enviados</span><span class="row-btns"><button class="btn ghost sm" data-a="exportarContactos">${icon('download')}Exportar contactos</button>${enviados ? `<button class="btn ghost sm" data-a="difReset">Reiniciar</button>` : ''}</span></div>
    <div class="list">${cs.map(x => `<div class="item ${s.enviados[x.id] ? 'hecho' : ''}"><span class="avatar">${esc(x.nombre.charAt(0).toUpperCase())}</span>
      <span class="item-main"><span class="item-title">${esc(x.nombre)}</span><span class="item-sub num">${esc(x.tel)}</span></span>
      <span class="item-end"><a class="btn sm ${s.enviados[x.id] ? 'ghost' : 'wa'}" href="${esc(waLink(x.tel, texto(x), c.codigoPais))}" target="_blank" rel="noopener" data-a="difEnviado" data-id="${x.id}" data-pass="1">${s.enviados[x.id] ? icon('check') + 'Enviado' : icon('whatsapp') + 'Enviar'}</a></span></div>`).join('')}</div>`;
}
INPUTS.difMsg = debounce(el => { App.s.cli.msg = el.value; $$('[data-a="difEnviado"]').forEach(a => { const x = DB.get('clientes', a.dataset.id); const c = cfg(); a.href = waLink(x.tel, el.value.replaceAll('{nombre}', x.nombre.split(' ')[0]).replaceAll('{negocio}', c.nombre).replaceAll('{catalogo}', c.catalogoUrl || ''), c.codigoPais); }); }, 200);
Acciones.difEnviado = el => { App.s.cli.enviados[el.dataset.id] = true; setTimeout(() => App.render(), 400); };
Acciones.difReset = () => { App.s.cli.enviados = {}; App.render(); };
Acciones.exportarContactos = () => run(async () => entregarArchivo(await libroExcel({ Contactos: DB.all('clientes').filter(c => c.tel).map(c => ({ Nombre: c.nombre, Teléfono: '+' + (telLimpio(c.tel).length === 10 ? cfg().codigoPais : '') + telLimpio(c.tel) })) }), 'contactos-clientas.xlsx'));

Acciones.nuevaClienta = () => formClienta(null);
function formClienta(c) {
  Modal.open(`<form id="cl-form" class="form">
    <div class="field"><label for="cl-nom">Nombre</label><input id="cl-nom" required value="${esc(c?.nombre || '')}" autofocus></div>
    <div class="field"><label for="cl-tel">WhatsApp</label><input id="cl-tel" type="tel" inputmode="tel" value="${esc(c?.tel || '')}" placeholder="300 123 4567"></div>
    <div class="field"><label for="cl-cum">Cumpleaños</label><input id="cl-cum" type="date" value="${esc(c?.cumple || '')}"></div>
    <div class="field"><label for="cl-not">Nota</label><textarea id="cl-not" rows="2" placeholder="Ej.: tono de base, preferencias">${esc(c?.nota || '')}</textarea></div>
    <button class="btn primary block" type="submit">${c ? 'Guardar' : 'Crear clienta'}</button></form>`, {
    title: c ? 'Editar clienta' : 'Nueva clienta',
    onOpen(body, close) {
      $('#cl-form', body).onsubmit = async e => { e.preventDefault(); if (await run(() => guardarCliente({ nombre: $('#cl-nom', body).value, tel: $('#cl-tel', body).value, nota: $('#cl-not', body).value, cumple: $('#cl-cum', body).value }, c), 'Guardado') !== undefined) close(); };
    },
  });
}
Acciones.verClienta = el => {
  const c = DB.get('clientes', el.dataset.id); if (!c) return; const cf = cfg();
  const vs = DB.all('ventas').filter(v => v.clienteId === c.id).sort((a, b) => b.fecha.localeCompare(a.fecha));
  const validas = vs.filter(v => v.estado !== 'anulada'); const saldo = sum(validas, v => v.saldo || 0);
  const favoritos = Array.from(groupBy(validas.flatMap(v => v.items), i => i.nombre), ([n, l]) => [n, sum(l, i => i.cantidad)]).sort((a, b) => b[1] - a[1]).slice(0, 3);
  Modal.open(`<div class="venta-det">
    <div class="vd-top"><div><h3>${esc(c.nombre)}</h3><p class="muted-text num">${esc(c.tel || 'Sin teléfono')}${c.cumple ? ' · cumple ' + fmtFecha(c.cumple + 'T12:00:00').replace(/ \d{4}$/, '') : ''}</p></div>${saldo > 0 ? pill('Debe ' + money(saldo), 'warn') : ''}</div>
    <div class="kpis small three"><div class="kpi"><span class="kpi-l">Total comprado</span><span class="kpi-v num">${money(sum(validas, v => v.total))}</span></div>
      <div class="kpi"><span class="kpi-l">Compras</span><span class="kpi-v num">${validas.length}</span></div>
      <div class="kpi"><span class="kpi-l">Ticket promedio</span><span class="kpi-v num">${money(validas.length ? sum(validas, v => v.total) / validas.length : 0)}</span></div></div>
    ${favoritos.length ? `<p class="muted-text">Lo que más compra: ${esc(favoritos.map(f => `${f[0]} (${f[1]})`).join(', '))}</p>` : ''}
    ${c.nota ? `<p class="notice">${icon('edit')}<span>${esc(c.nota)}</span></p>` : ''}
    <div class="row-btns wrap">${c.tel ? `<a class="btn wa" href="${esc(waLink(c.tel, saldo > 0 ? textoCobroWhatsApp(c.nombre, validas.filter(v => v.saldo > 0)) : '', cf.codigoPais))}" target="_blank" rel="noopener">${icon('whatsapp')}${saldo > 0 ? 'Cobrar' : 'Escribir'}</a>` : ''}
      <button class="btn ghost" data-a="editarClienta" data-id="${c.id}">${icon('edit')}Editar</button>
      <button class="btn ghost" data-a="venderA" data-id="${c.id}">${icon('cart')}Venderle</button>
      ${saldo > 0 ? `<button class="btn ghost" data-a="pdf" data-tipo="cuenta" data-id="${c.id}" data-modo="${puedeCompartirArchivos() ? 'share' : 'download'}">${icon('receipt')}Estado de cuenta</button>` : ''}</div>
    <h4>Compras</h4>${vs.length ? `<div class="list compact">${vs.map(ventaRow).join('')}</div>` : '<p class="muted-text">Sin compras.</p>'}
  </div>`, { title: 'Clienta' });
};
Acciones.editarClienta = el => { Modal.closeTop(); formClienta(DB.get('clientes', el.dataset.id)); };
Acciones.venderA = el => { const c = DB.get('clientes', el.dataset.id); Object.assign(App.s.pos, { cliNombre: c.nombre, cliTel: c.tel || '' }); Modal.closeTop(); App.go('vender'); toast(`Venta para ${c.nombre}: agrega los productos`); };
Acciones.importarClientas = () => {
  Modal.open(`<div class="form"><p>Sube un Excel o CSV con columnas <b>Nombre</b> y <b>Teléfono</b>. Los números que ya existen se omiten.</p>
    <div class="field"><label for="ic-file">Archivo</label><input id="ic-file" type="file" accept=".xlsx,.xls,.csv"></div></div>`, {
    title: 'Importar clientas',
    onOpen(body, close) { $('#ic-file', body).onchange = async e => { const f = e.target.files[0]; if (!f) return; const filas = await run(() => leerHoja(f)); if (!filas) return; const n = await run(() => importarClientes(filas)); if (n !== undefined) { toast(`${n} clientas importadas`); close(); } }; },
  });
};

/* =================== GASTOS =================== */
Pantallas.gastos = {
  titulo: 'Gastos',
  render() {
    const s = App.s.gastos; const r = rangoPeriodo(s.periodo);
    const gs = DB.all('gastos').filter(g => enRango(g.dia, r)).sort((a, b) => b.fecha.localeCompare(a.fecha));
    const val = gs.filter(g => !g.anulado);
    const op = val.filter(g => g.categoria !== GASTO_MERCANCIA);
    const porCat = Array.from(groupBy(val, g => g.categoria), ([l, x]) => ({ l, v: sum(x, g => g.valor) })).sort((a, b) => b.v - a.v);
    return `<div class="screen">
      <div class="screen-head">${chips('gastos', 'periodo', [{ v: '7d', l: '7 días' }, { v: 'mes', l: 'Este mes' }, { v: 'mesAnt', l: 'Mes anterior' }, { v: 'anio', l: 'Este año' }], s.periodo)}
        <div class="head-actions"><button class="btn primary" data-a="nuevoGasto">${icon('plus')}Gasto</button></div></div>
      <section class="kpis small"><div class="kpi"><span class="kpi-l">Gastos del negocio</span><span class="kpi-v num">${money(sum(op, g => g.valor))}</span><span class="kpi-s">${r.nombre}</span></div>
        <div class="kpi"><span class="kpi-l">Compras de mercancía</span><span class="kpi-v num">${money(sum(val.filter(g => g.categoria === GASTO_MERCANCIA), g => g.valor))}</span><span class="kpi-s">No resta de la ganancia</span></div></section>
      ${porCat.length ? `<section class="card"><div class="card-head"><h2>Por categoría</h2></div>${barrasH(porCat)}</section>` : ''}
      ${gs.length ? `<div class="list">${gs.map(g => `<div class="item ${g.anulado ? 'tachado' : ''}">
        <span class="item-main"><span class="item-title">${esc(g.descripcion || g.categoria)}</span><span class="item-sub">${esc(g.categoria)} · ${esc(g.metodo)} · ${fmtFechaCorta(g.fecha)}${g.anulado ? ' · anulado' : ''}</span></span>
        <span class="item-end"><span class="num strong">${money(g.valor)}</span>${!g.anulado ? `<button class="icon-btn sm" data-a="anularGasto" data-id="${g.id}" aria-label="Anular gasto">${icon('trash')}</button>` : ''}</span></div>`).join('')}</div>`
        : vacio('wallet', 'Sin gastos en este periodo', 'Registra arriendo, servicios, transporte y demás para saber tu ganancia real.')}
    </div>`;
  },
};
Acciones.nuevoGasto = () => {
  const c = cfg(); let metodo = 'Efectivo';
  const cats = c.categoriasGasto.filter(x => x !== GASTO_MERCANCIA);
  Modal.open(`<form id="g-form" class="form">
    <div class="field"><label for="g-val">Valor</label><input id="g-val" data-money inputmode="numeric" required autofocus></div>
    <div class="field"><label for="g-cat">Categoría</label><select id="g-cat">${opcionesSelect(cats, cats[0])}</select></div>
    <div class="field"><label for="g-des">Descripción</label><input id="g-des" placeholder="Ej.: recibo de la luz"></div>
    <div class="field"><label>Pagado con</label><div class="chips" id="g-met">${c.metodos.map(m => `<button type="button" class="chip ${m === metodo ? 'on' : ''}" data-m="${esc(m)}">${esc(m)}</button>`).join('')}</div></div>
    <p class="hint" id="g-hint">Si se paga en efectivo, sale de la caja abierta.</p>
    <button class="btn primary block lg" type="submit">Registrar gasto</button></form>`, {
    title: 'Nuevo gasto',
    onOpen(body, close) {
      bindMoneyInputs(body);
      $$('#g-met .chip', body).forEach(b => b.onclick = () => { metodo = b.dataset.m; $$('#g-met .chip', body).forEach(x => x.classList.toggle('on', x === b)); $('#g-hint', body).textContent = metodo === 'Efectivo' ? 'Si se paga en efectivo, sale de la caja abierta.' : ''; });
      $('#g-form', body).onsubmit = async e => { e.preventDefault(); if (await run(() => registrarGasto({ valor: $('#g-val', body).value, categoria: $('#g-cat', body).value, descripcion: $('#g-des', body).value, metodo }), 'Gasto registrado') !== undefined) close(); };
    },
  });
};
Acciones.anularGasto = async el => {
  if (!(await requireAdmin())) return;
  const g = DB.get('gastos', el.dataset.id);
  if (await confirmar(`¿Anular el gasto "${g.descripcion || g.categoria}" por ${money(g.valor)}?`, { si: 'Anular', peligro: true })) run(() => anularGasto(g), 'Gasto anulado');
};

/* =================== REPORTES =================== */
Pantallas.reportes = {
  titulo: 'Reportes',
  render() {
    const s = App.s.rep; const rg = rangoPeriodo(s.periodo, s.desde, s.hasta); const r = reporte(rg);
    const inv = valorInventario(); const porCobrar = sum(ventasConSaldo(), v => v.saldo);
    return `<div class="screen">
      <div class="toolbar">${chips('rep', 'periodo', [{ v: 'hoy', l: 'Hoy' }, { v: '7d', l: '7 días' }, { v: 'mes', l: 'Este mes' }, { v: 'mesAnt', l: 'Mes anterior' }, { v: 'anio', l: 'Este año' }, { v: 'custom', l: 'Elegir fechas' }], s.periodo)}
        ${s.periodo === 'custom' ? `<div class="toolbar-row"><input type="date" value="${esc(s.desde || dayKey())}" data-ch="repDesde" aria-label="Desde"><span>a</span><input type="date" value="${esc(s.hasta || dayKey())}" data-ch="repHasta" aria-label="Hasta"></div>` : ''}</div>
      <div class="rep-head"><h2>${esc(rg.nombre)}</h2><button class="btn ghost sm" data-a="exportarExcel">${icon('download')}Exportar a Excel</button></div>

      <section class="pyg card">
        <div class="pyg-row"><span>Ventas</span><span class="num">${money(r.facturado)}</span></div>
        <div class="pyg-row minus"><span>Costo de los productos vendidos</span><span class="num">−${money(r.costo)}</span></div>
        <div class="pyg-row sub"><span>Ganancia bruta <small>${Math.round(r.margen * 100)}% de margen</small></span><span class="num">${money(r.utilidadBruta)}</span></div>
        <div class="pyg-row minus"><span>Gastos del negocio</span><span class="num">−${money(r.gastosOp)}</span></div>
        <div class="pyg-row total ${r.utilidadNeta < 0 ? 'neg' : ''}"><span>Ganancia neta</span><span class="num">${money(r.utilidadNeta)}</span></div>
      </section>

      <section class="kpis">
        <div class="kpi"><span class="kpi-l">Ventas</span><span class="kpi-v num">${num(r.numVentas)}</span><span class="kpi-s">${num(r.unidades)} unidades${r.anuladas.length ? ` · ${r.anuladas.length} anuladas` : ''}</span></div>
        <div class="kpi"><span class="kpi-l">Ticket promedio</span><span class="kpi-v num">${money(r.ticket)}</span></div>
        <div class="kpi"><span class="kpi-l">Dinero recibido</span><span class="kpi-v num">${money(r.totalRecaudo)}</span><span class="kpi-s">Incluye abonos de cuentas viejas</span></div>
        <div class="kpi"><span class="kpi-l">Vendido a crédito</span><span class="kpi-v num">${money(r.credito)}</span><span class="kpi-s">Hoy te deben ${money(porCobrar)} en total</span></div>
      </section>

      <section class="card"><div class="card-head"><h2>Ventas por día</h2></div>
        ${r.porDia.length > 1 ? barras(r.porDia.map(x => ({ l: String(parseDay(x.dia).getDate()), v: x.ventas, hoy: x.dia === dayKey(), t: `${fmtFecha(parseDay(x.dia))}: ${money(x.ventas)} · ${x.n} ventas` })), { alto: 170 }) : `<p class="muted-text">Elige un periodo de más de un día para ver la gráfica.</p>`}</section>

      <div class="cols">
        <section class="card"><div class="card-head"><h2>Dinero recibido por medio</h2></div>${r.totalRecaudo ? barrasH(Object.entries(r.recaudo).sort((a, b) => b[1] - a[1]).map(([l, v]) => ({ l, v, extra: Math.round(v / r.totalRecaudo * 100) + '%' }))) : '<p class="muted-text">Sin pagos.</p>'}</section>
        <section class="card"><div class="card-head"><h2>Por categoría</h2></div>${r.categorias.length ? barrasH(r.categorias.map(c => ({ l: c.nombre, v: c.valor, extra: `${num(c.cantidad)} und.` }))) : '<p class="muted-text">Sin ventas.</p>'}</section>
      </div>

      <section class="card"><div class="card-head"><h2>Productos más vendidos</h2></div>
        ${r.topProductos.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Producto</th><th class="r">Und.</th><th class="r">Ventas</th><th class="r">Ganancia</th></tr></thead><tbody>
        ${r.topProductos.slice(0, 15).map(p => `<tr><td>${esc(p.nombre)}</td><td class="r num">${num(p.cantidad)}</td><td class="r num">${money(p.valor)}</td><td class="r num">${money(p.ganancia)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted-text">Sin ventas.</p>'}</section>

      <div class="cols">
        <section class="card"><div class="card-head"><h2>Gastos</h2><span class="num muted-text">${money(sum(r.gastos, g => g.valor))}</span></div>${r.gastosCat.length ? barrasH(r.gastosCat.map(([l, v]) => ({ l, v }))) : '<p class="muted-text">Sin gastos.</p>'}</section>
        <section class="card"><div class="card-head"><h2>Inventario hoy</h2></div><div class="dl">
          ${filaDato('Unidades en stock', `<span class="num">${num(inv.unidades)}</span>`)}
          ${filaDato('Valor a costo', `<span class="num">${money(inv.costo)}</span>`)}
          ${filaDato('Valor a precio de venta', `<span class="num">${money(inv.venta)}</span>`)}
          ${filaDato('Ganancia posible', `<span class="num">${money(inv.venta - inv.costo)}</span>`, 'total')}
          ${filaDato('Agotados / bajos', `<span class="num">${inv.agotados.length} / ${inv.bajos.length}</span>`)}
        </div></section>
      </div>
      <p class="fine">La ganancia usa el costo guardado en cada venta. Las compras de mercancía no se restan como gasto porque ya están incluidas en el costo de lo vendido.</p>
    </div>`;
  },
};
Acciones.repDesde = el => { App.s.rep.desde = el.value; App.render(); };
Acciones.repHasta = el => { App.s.rep.hasta = el.value; App.render(); };
Acciones.exportarExcel = () => { const s = App.s.rep; const rg = rangoPeriodo(s.periodo, s.desde, s.hasta); run(async () => entregarArchivo(await exportarExcel(rg), `${cfg().nombre.replace(/\s+/g, '-')}-${rg.desde}-a-${rg.hasta}.xlsx`), 'Excel generado'); };

/* =================== AJUSTES =================== */
Pantallas.ajustes = {
  titulo: 'Ajustes',
  render() {
    const c = cfg(); const demo = DB.mode === 'demo';
    return `<div class="screen narrow">
      ${demo ? `<div class="notice accent">${icon('cloudOff')}<span><b>Modo demo.</b> Los datos se guardan solo en este navegador. Para usar la app de verdad en varios celulares, conecta Firebase (ver el archivo LEEME).</span></div>` : ''}
      <form id="aj-form" class="form card">
        <h2>Datos del negocio</h2>
        <p class="hint">Salen en los recibos y mensajes.</p>
        <div class="grid2">
          <div class="field"><label for="a-nom">Nombre</label><input id="a-nom" value="${esc(c.nombre)}"></div>
          <div class="field"><label for="a-nit">NIT o cédula</label><input id="a-nit" value="${esc(c.nit)}"></div>
          <div class="field"><label for="a-tel">Teléfono / WhatsApp</label><input id="a-tel" value="${esc(c.telefono)}"></div>
          <div class="field"><label for="a-dir">Dirección</label><input id="a-dir" value="${esc(c.direccion)}"></div>
          <div class="field"><label for="a-ciu">Ciudad</label><input id="a-ciu" value="${esc(c.ciudad)}"></div>
          <div class="field"><label for="a-cat">Enlace del catálogo</label><input id="a-cat" type="url" value="${esc(c.catalogoUrl)}"></div>
        </div>
        <div class="field"><label for="a-pie">Mensaje al final del recibo</label><input id="a-pie" value="${esc(c.piePagina)}"></div>
        <h2>Listas</h2>
        <div class="field"><label for="a-cats">Categorías de productos <small>(separadas por coma)</small></label><textarea id="a-cats" rows="2">${esc(c.categorias.join(', '))}</textarea></div>
        <div class="field"><label for="a-met">Medios de pago <small>(Efectivo siempre debe estar)</small></label><textarea id="a-met" rows="2">${esc(c.metodos.join(', '))}</textarea></div>
        <div class="field"><label for="a-gas">Categorías de gastos</label><textarea id="a-gas" rows="2">${esc(c.categoriasGasto.filter(x => x !== GASTO_MERCANCIA).join(', '))}</textarea></div>
        <div class="grid2"><div class="field"><label for="a-min">Avisar stock bajo desde (por defecto)</label><input id="a-min" type="number" min="0" value="${esc(c.stockMinDef)}"></div>
        <div class="field"><label for="a-pais">Código de país para WhatsApp</label><input id="a-pais" value="${esc(c.codigoPais)}"></div></div>
        <h2>Seguridad</h2>
        <div class="field"><label for="a-pin">PIN de administradora</label><input id="a-pin" type="password" inputmode="numeric" maxlength="8" value="${esc(c.pinAdmin)}" placeholder="Sin PIN" autocomplete="new-password"></div>
        <p class="hint">Con PIN, quien no lo sepa (por ejemplo una vendedora) puede vender, recibir abonos y cerrar caja, pero no ve costos ni ganancias, no anula ventas ni cambia ajustes.</p>
        <button class="btn primary block" type="submit">Guardar ajustes</button>
      </form>

      <section class="card"><h2>Respaldo y archivos</h2>
        <div class="stack">
          <button class="btn ghost block" data-a="exportarTodo">${icon('download')}Exportar todo a Excel</button>
          <button class="btn ghost block" data-a="respaldo">${icon('download')}Descargar copia de seguridad (JSON)</button>
          <label class="btn ghost block file-btn">${icon('upload')}Restaurar copia de seguridad<input type="file" accept=".json" data-ch="restaurar" hidden></label>
          <button class="btn ghost block" data-a="importarProductos">${icon('upload')}Importar productos desde Excel</button>
          <button class="btn ghost block" data-a="importarClientas">${icon('upload')}Importar clientas desde Excel</button>
          <button class="btn ghost block" data-a="importarVentas">${icon('upload')}Importar ventas anteriores desde Excel</button>
        </div></section>

      <section class="card"><h2>Cuenta</h2>
        ${demo ? `<p class="muted-text">Estás en modo demo, sin cuenta.</p>
          <div class="stack"><button class="btn ghost block" data-a="demoReset">Volver a cargar datos de ejemplo</button><button class="btn danger-ghost block" data-a="demoVaciar">Empezar en blanco (borrar todo)</button></div>`
        : `<p class="muted-text">Sesión iniciada como <b>${esc(DB.user?.email || '')}</b></p><button class="btn ghost block" data-a="salir">${icon('logout')}Cerrar sesión</button>`}
      </section>
      <p class="fine center">Amare · versión 2.0</p>
    </div>`;
  },
  after(root) {
    $('#aj-form', root).onsubmit = async e => {
      e.preventDefault();
      const lista = id => $(id, root).value.split(',').map(x => x.trim()).filter(Boolean);
      let metodos = lista('#a-met'); if (!metodos.some(m => norm(m) === 'efectivo')) metodos.unshift('Efectivo');
      metodos = metodos.map(m => norm(m) === 'efectivo' ? 'Efectivo' : m);
      const data = {
        nombre: $('#a-nom', root).value.trim() || 'Mi negocio', nit: $('#a-nit', root).value.trim(), telefono: $('#a-tel', root).value.trim(),
        direccion: $('#a-dir', root).value.trim(), ciudad: $('#a-ciu', root).value.trim(), catalogoUrl: $('#a-cat', root).value.trim(), piePagina: $('#a-pie', root).value.trim(),
        categorias: lista('#a-cats'), metodos, categoriasGasto: [...lista('#a-gas'), GASTO_MERCANCIA],
        stockMinDef: parseQty($('#a-min', root).value), codigoPais: telLimpio($('#a-pais', root).value) || '57', pinAdmin: $('#a-pin', root).value.trim(),
      };
      if (data.pinAdmin) App.admin = true;
      await run(() => DB.commit([{ t: 'update', col: 'config', id: 'general', data }]), 'Ajustes guardados');
      document.title = data.nombre; $('#brand-name') && ($('#brand-name').textContent = data.nombre);
    };
  },
};
Acciones.exportarTodo = () => run(async () => entregarArchivo(await exportarExcel(null), `${cfg().nombre.replace(/\s+/g, '-')}-completo-${dayKey()}.xlsx`), 'Excel generado');
Acciones.respaldo = () => run(() => entregarArchivo(respaldoJSON(), `respaldo-${cfg().nombre.replace(/\s+/g, '-')}-${dayKey()}.json`), 'Copia descargada');
Acciones.restaurar = async el => {
  const f = el.files[0]; if (!f) return;
  if (!(await confirmar('Los registros del archivo se agregarán o reemplazarán a los actuales con el mismo identificador.', { si: 'Restaurar' }))) return;
  const n = await run(async () => restaurarRespaldo(JSON.parse(await f.text())));
  if (n !== undefined) toast(`${n} registros restaurados`);
};
Acciones.demoReset = async () => { if (await confirmar('Se borran los datos de este navegador y se cargan los de ejemplo.', { si: 'Recargar ejemplo' })) { DB.resetDemo(); sembrarDemo(); App.go('inicio'); App.render(); toast('Datos de ejemplo cargados'); } };
Acciones.demoVaciar = async () => { if (await confirmar('Se borra todo lo guardado en este navegador y la app queda vacía.', { si: 'Borrar todo', peligro: true })) { DB.resetDemo(); DB._commitDemo([{ t: 'set', col: 'config', id: 'general', data: { ...CONFIG_DEF } }]); App.go('inicio'); App.render(); toast('App en blanco'); } };
Acciones.salir = async () => { if (await confirmar('¿Cerrar sesión en este dispositivo?', { si: 'Cerrar sesión' })) await DB.logout(); };

/* =================== MÁS (móvil) =================== */
Pantallas.mas = {
  titulo: 'Más',
  render() {
    const porCobrar = sum(ventasConSaldo(), v => v.saldo);
    const items = [
      { id: 'ventas', i: 'receipt', t: 'Ventas', s: 'Historial, recibos y anulaciones' },
      { id: 'clientes', i: 'users', t: 'Clientas y cartera', s: porCobrar ? `Te deben ${money(porCobrar)}` : 'Clientas, cobros y difusión' },
      { id: 'gastos', i: 'wallet', t: 'Gastos', s: 'Arriendo, servicios, transporte…' },
      { id: 'balance', i: 'trend', t: 'Balance general', s: 'Ganancia acumulada, inversión, mes a mes', lock: true },
      { id: 'reportes', i: 'chart', t: 'Reportes', s: 'Ganancias, productos estrella, Excel', lock: true },
      { id: 'ajustes', i: 'settings', t: 'Ajustes', s: 'Datos del negocio, PIN, respaldo', lock: true },
    ];
    const c = cfg();
    return `<div class="screen narrow"><div class="list menu">${items.map(x => `<button class="item" data-a="nav" data-nav="${x.id}"><span class="menu-ic">${icon(x.i)}</span>
      <span class="item-main"><span class="item-title">${x.t}</span><span class="item-sub">${esc(x.s)}</span></span><span class="item-end">${x.lock && !App.puedeVer() ? icon('lock', 'sm') : icon('chevron', 'sm')}</span></button>`).join('')}
      ${c.catalogoUrl ? `<a class="item" href="${esc(c.catalogoUrl)}" target="_blank" rel="noopener"><span class="menu-ic">${icon('bag')}</span><span class="item-main"><span class="item-title">Ver catálogo</span><span class="item-sub">Abre el catálogo en Canva</span></span><span class="item-end">${icon('chevron', 'sm')}</span></a>` : ''}
    </div></div>`;
  },
};

/* Deudas que venían de antes de usar la app: quedan en la cartera sin mover inventario ni caja */
Acciones.deudaAnterior = () => {
  const ps = productosActivos(); const clientes = DB.all('clientes').sort((a, b) => a.nombre.localeCompare(b.nombre));
  Modal.open(`<form id="da-form" class="form" autocomplete="off">
    <p class="muted-text">Para fiados o separados que se vendieron antes de usar esta app. Quedan en "Por cobrar" para recibir abonos, pero no descuentan inventario ni entran a la caja.</p>
    <div class="grid2">
      <div class="field"><label for="da-tel">WhatsApp</label><input id="da-tel" type="tel" inputmode="tel" list="da-tels" placeholder="300 123 4567"></div>
      <div class="field"><label for="da-nom">Nombre de la clienta</label><input id="da-nom" required list="da-noms"></div>
    </div>
    <datalist id="da-noms">${clientes.map(c => `<option value="${esc(c.nombre)}">`).join('')}</datalist>
    <datalist id="da-tels">${clientes.filter(c => c.tel).map(c => `<option value="${esc(c.tel)}">${esc(c.nombre)}</option>`).join('')}</datalist>
    <div class="field"><label for="da-prod">Producto</label><select id="da-prod"><option value="">Otro (escribir abajo)</option>${ps.map(x => `<option value="${x.id}">${esc(x.nombre)} · ${money(x.precio)}</option>`).join('')}</select></div>
    <div class="field" id="da-desc-f"><label for="da-desc">Descripción</label><input id="da-desc" placeholder="Ej.: rubor y brillo"></div>
    <div class="grid2">
      <div class="field"><label for="da-val">Valor de la venta</label><input id="da-val" data-money inputmode="numeric" required placeholder="0"></div>
      <div class="field"><label for="da-ab">Ya había abonado</label><input id="da-ab" data-money inputmode="numeric" placeholder="0"></div>
      <div class="field"><label for="da-fec">Fecha de la venta</label><input id="da-fec" type="date" value="${dayKey()}" max="${dayKey()}"></div>
      <div class="field"><label for="da-tipo">Tipo</label><select id="da-tipo"><option value="fiado">Fiado (ya se llevó el producto)</option><option value="separado">Separado (aún no se entrega)</option></select></div>
    </div>
    <div class="row-btns"><button class="btn ghost" type="submit" data-otra="1">Guardar y agregar otra</button><button class="btn primary" type="submit">Guardar</button></div>
  </form>`, {
    title: 'Deuda anterior',
    onOpen(body, close) {
      bindMoneyInputs(body);
      const sel = $('#da-prod', body);
      sel.onchange = () => { const x = DB.get('productos', sel.value); $('#da-desc-f', body).hidden = !!x; if (x) { $('#da-val', body).value = num(x.precio); } };
      $('#da-tel', body).addEventListener('input', e => { const c = buscarClientePorTel(e.target.value); if (c && !$('#da-nom', body).value) $('#da-nom', body).value = c.nombre; });
      $('#da-nom', body).addEventListener('change', e => { const c = DB.all('clientes').find(x => x.nombre === e.target.value); if (c && c.tel && !$('#da-tel', body).value) $('#da-tel', body).value = c.tel; });
      $('#da-form', body).onsubmit = async e => {
        e.preventDefault();
        const otra = e.submitter && e.submitter.dataset.otra;
        const ok = await run(async () => {
          const x = DB.get('productos', sel.value);
          const nombreItem = x ? x.nombre : $('#da-desc', body).value.trim();
          if (!nombreItem) throw new Error('Elige el producto o escribe una descripción.');
          const total = parseMoney($('#da-val', body).value); const abonado = Math.min(parseMoney($('#da-ab', body).value), total);
          if (total <= 0) throw new Error('Escribe el valor de la venta.');
          const nombre = $('#da-nom', body).value.trim(); if (!nombre) throw new Error('Escribe el nombre de la clienta.');
          const cli = clienteOps(nombre, $('#da-tel', body).value);
          const tipo = $('#da-tipo', body).value;
          const f = new Date(parseDay($('#da-fec', body).value || dayKey())); f.setHours(12, 0, 0, 0); const fecha = f.toISOString();
          const numero = await DB.nextNumber('ventas'); const id = DB.newId();
          const items = [{ productoId: x ? x.id : 'ant-' + DB.newId(), nombre: nombreItem, categoria: x ? x.categoria : 'Otros', cantidad: 1, precio: total, costo: x ? Number(x.costo) || 0 : 0 }];
          const venta = { numero, fecha, dia: dayKey(fecha), tipo, items, subtotal: total, descuento: 0, total, costoTotal: items[0].costo, metodo: abonado ? 'Anterior' : '', abonado, saldo: total - abonado, estado: total - abonado > 0 ? 'pendiente' : 'pagada', entregado: tipo !== 'separado', clienteId: cli.id, clienteNombre: cli.nombre || nombre, clienteTel: cli.tel || telLimpio($('#da-tel', body).value), recibido: null, cambio: null, cajaId: null, nota: 'Deuda anterior a la app', usuario: quien(), migrada: true };
          const ops = [...cli.ops, { t: 'set', col: 'ventas', id, data: venta }];
          if (abonado) ops.push({ t: 'set', col: 'abonos', id: DB.newId(), data: { fecha, dia: dayKey(fecha), ventaId: id, ventaNumero: numero, clienteId: cli.id, clienteNombre: venta.clienteNombre, valor: abonado, metodo: 'Anterior', cajaId: null, nota: 'Abonado antes de la app', usuario: quien(), anulado: false } });
          await DB.commit(ops);
          return true;
        });
        if (!ok) return;
        toast('Deuda registrada');
        if (otra) { sel.value = ''; $('#da-desc-f', body).hidden = false; ['#da-desc', '#da-val', '#da-ab'].forEach(s => $(s, body).value = ''); }
        else close();
      };
    },
  });
};

/* Ventas de antes de usar la app: cuentan en reportes y cartera, pero no mueven inventario ni caja */
function fechaCelda(v) {
  if (typeof v === 'number' && v > 20000) { const d = new Date(Math.round((v - 25569) * 864e5)); return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 12); }
  if (v instanceof Date) return new Date(v.getFullYear(), v.getMonth(), v.getDate(), 12);
  const s = String(v || '').trim(); let m;
  if ((m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/))) return new Date(Number(m[3].length === 2 ? '20' + m[3] : m[3]), Number(m[2]) - 1, Number(m[1]), 12);
  if ((m = s.match(/^(\d{4})-(\d{2})-(\d{2})/))) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12);
  return null;
}
function hashTexto(s) { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0; return h.toString(36); }
function prepararVentasAnteriores(filas) {
  const listas = [], errores = []; const vistos = {};
  filas.forEach((f, i) => {
    const filaN = i + 2;
    const cod = String(campo(f, 'codigo', 'sku', 'referencia')).trim();
    const nom = String(campo(f, 'producto', 'nombre')).trim();
    const cant = parseQty(campo(f, 'cantidad', 'unidades'));
    if (!cod && !nom) return;
    if (!cant) return;
    const fecha = fechaCelda(campo(f, 'fecha'));
    if (!fecha) { errores.push(`Fila ${filaN}: falta la fecha`); return; }
    const p = (cod && productoPorCodigo(cod)) || productosActivos().find(x => norm(x.nombre) === norm(nom)) || null;
    const precio = parseMoney(campo(f, 'preciounitario', 'precio')) || (p ? Number(p.precio) || 0 : 0);
    if (!precio) { errores.push(`Fila ${filaN}: falta el precio`); return; }
    const debe = norm(campo(f, 'estado')).startsWith('debe');
    const cli = String(campo(f, 'clienta', 'cliente', 'nombrecliente')).trim();
    const tel = telLimpio(campo(f, 'telefono', 'tel', 'whatsapp'));
    if (debe && !cli) { errores.push(`Fila ${filaN} (${nom || cod}): dice "Debe" pero no tiene clienta`); return; }
    const clave = [dayKey(fecha), cod, nom, cant, precio, debe, cli].join('|');
    vistos[clave] = (vistos[clave] || 0) + 1;
    listas.push({ id: 'hist-' + hashTexto(clave + '#' + vistos[clave]), fecha, p, nombre: p ? p.nombre : nom, cant, precio, debe, cli, tel,
      metodo: String(campo(f, 'mediodepago', 'metodo', 'medio')).trim() || 'No registrado', nota: String(campo(f, 'nota')).trim() });
  });
  listas.sort((a, b) => a.fecha - b.fecha);
  return { listas, errores };
}
async function guardarVentasAnteriores(listas) {
  const ops = []; const clientes = {};
  listas.forEach((v, i) => {
    let cliId = null, cliNombre = v.cli, cliTel = v.tel;
    if (v.cli || v.tel) {
      const k = v.tel || norm(v.cli);
      if (clientes[k]) ({ id: cliId, nombre: cliNombre, tel: cliTel } = clientes[k]);
      else { const c = clienteOps(v.cli, v.tel); ops.push(...c.ops); clientes[k] = { id: c.id, nombre: c.nombre || v.cli, tel: c.tel || v.tel }; ({ id: cliId, nombre: cliNombre, tel: cliTel } = clientes[k]); }
    }
    const total = v.cant * v.precio; const costo = v.p ? (Number(v.p.costo) || 0) : 0; const fecha = v.fecha.toISOString();
    ops.push({ t: 'set', col: 'ventas', id: v.id, data: {
      numero: 'H' + (i + 1), fecha, dia: dayKey(v.fecha), tipo: v.debe ? 'fiado' : 'contado',
      items: [{ productoId: v.p ? v.p.id : 'ant-' + hashTexto(v.nombre), nombre: v.nombre, categoria: v.p ? v.p.categoria : 'Otros', cantidad: v.cant, precio: v.precio, costo }],
      subtotal: total, descuento: 0, total, costoTotal: costo * v.cant, metodo: v.debe ? '' : v.metodo,
      abonado: v.debe ? 0 : total, saldo: v.debe ? total : 0, estado: v.debe ? 'pendiente' : 'pagada', entregado: true,
      clienteId: cliId, clienteNombre: cliNombre || '', clienteTel: cliTel || '', recibido: null, cambio: null, cajaId: null,
      nota: ['Venta anterior a la app', v.nota].filter(Boolean).join(' · '), usuario: quien(), migrada: true,
    } });
  });
  await DB.commit(ops);
  return listas.length;
}
Acciones.importarVentas = () => {
  Modal.open(`<div class="form">
    <p>Sube el Excel de ventas anteriores (columnas <b>Fecha, Código, Producto, Cantidad, Precio unitario, Medio de pago, Estado, Clienta, Teléfono</b>).</p>
    <p class="hint">Estas ventas cuentan en reportes y en "Por cobrar", pero no descuentan inventario ni entran a la caja. Si subes el mismo archivo dos veces, las ventas se reemplazan en vez de duplicarse.</p>
    <div class="field"><label for="iv-file">Archivo</label><input id="iv-file" type="file" accept=".xlsx,.xls,.csv"></div>
    <div id="iv-prev"></div>
    <button class="btn primary block" id="iv-go" disabled>Importar ventas</button></div>`, {
    title: 'Ventas anteriores',
    onOpen(body, close) {
      let datos = null;
      $('#iv-file', body).onchange = async e => {
        const f = e.target.files[0]; if (!f) return;
        const filas = await run(() => leerHoja(f)); if (!filas) return;
        datos = prepararVentasAnteriores(filas);
        const L = datos.listas; const sinProd = L.filter(v => !v.p).length; const deben = L.filter(v => v.debe);
        $('#iv-prev', body).innerHTML = `<div class="dl">
          ${filaDato('Ventas', `<b class="num">${L.length}</b>`)}${filaDato('Unidades', `<span class="num">${num(sum(L, v => v.cant))}</span>`)}
          ${filaDato('Total vendido', `<b class="num">${money(sum(L, v => v.cant * v.precio))}</b>`)}
          ${L.length ? filaDato('Fechas', `${fmtFecha(L[0].fecha)} a ${fmtFecha(L[L.length - 1].fecha)}`) : ''}
          ${filaDato('Fiados pendientes', `<span class="num">${deben.length} · ${money(sum(deben, v => v.cant * v.precio))}</span>`)}
          ${sinProd ? filaDato('Sin producto en el inventario', `<span class="warn-text num">${sinProd}</span>`) : ''}</div>
          ${datos.errores.length ? `<div class="notice warn">${icon('alert')}<span><b>${datos.errores.length} filas no se importan:</b><br>${datos.errores.slice(0, 8).map(esc).join('<br>')}${datos.errores.length > 8 ? '<br>…' : ''}</span></div>` : ''}`;
        $('#iv-go', body).disabled = !L.length;
      };
      $('#iv-go', body).onclick = async () => {
        if (!(await requireAdmin())) return;
        const n = await run(() => guardarVentasAnteriores(datos.listas));
        if (n !== undefined) { toast(`${n} ventas anteriores importadas`); close(); }
      };
    },
  });
};
