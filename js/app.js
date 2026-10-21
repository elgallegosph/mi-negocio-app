/* Núcleo de la interfaz: navegación, acciones, piezas comunes, Inicio y Vender */
'use strict';

const Pantallas = {};
const Acciones = {};
const INPUTS = {};

const NAV = [
  { id: 'inicio', t: 'Inicio', i: 'home', tab: true },
  { id: 'vender', t: 'Vender', i: 'cart', tab: true },
  { id: 'inventario', t: 'Inventario', i: 'box', tab: true },
  { id: 'caja', t: 'Caja', i: 'cash', tab: true },
  { id: 'ventas', t: 'Ventas', i: 'receipt' },
  { id: 'clientes', t: 'Clientas y cartera', i: 'users' },
  { id: 'gastos', t: 'Gastos', i: 'wallet' },
  { id: 'reportes', t: 'Reportes', i: 'chart', admin: true },
  { id: 'ajustes', t: 'Ajustes', i: 'settings', admin: true },
  { id: 'mas', t: 'Más', i: 'more', tab: true, soloMovil: true },
];

const App = {
  ruta: 'inicio', admin: false, dirty: false,
  s: {
    pos: { q: '', cat: '', cart: [], tipo: 'contado', metodo: 'Efectivo', descuento: '', cliNombre: '', cliTel: '', recibido: '', abono: '', metodoAbono: 'Efectivo', nota: '' },
    inv: { tab: 'productos', q: '', cat: '', filtro: '', movTipo: '', conteo: {} },
    ventas: { periodo: 'hoy', q: '', tipo: '' },
    cli: { tab: 'clientas', q: '', msg: '', enviados: {} },
    gastos: { periodo: 'mes' },
    rep: { periodo: 'mes', desde: '', hasta: '' },
  },
  go(r) { if (location.hash.slice(1) === r) this.render(); else location.hash = r; },
  render() {
    const view = $('#view'); if (!view) return;
    const P = Pantallas[this.ruta] || Pantallas.inicio;
    const nav = NAV.find(n => n.id === this.ruta);
    if (nav && nav.admin && !this.puedeVer()) { view.innerHTML = bloqueadoHTML(nav.t); this.marcarNav(); return; }
    const sy = window.scrollY; const mismo = view.dataset.ruta === this.ruta;
    view.dataset.ruta = this.ruta;
    $('#page-title').textContent = P.titulo || (nav && nav.t) || '';
    view.innerHTML = P.render();
    bindMoneyInputs(view);
    P.after && P.after(view);
    this.marcarNav();
    if (mismo) window.scrollTo(0, sy); else window.scrollTo(0, 0);
    this.dirty = false;
  },
  marcarNav() {
    const activo = NAV.find(n => n.id === this.ruta && n.tab) ? this.ruta : 'mas';
    $$('.tabbar [data-nav]').forEach(b => b.classList.toggle('on', b.dataset.nav === activo));
    $$('.sidenav [data-nav]').forEach(b => b.classList.toggle('on', b.dataset.nav === this.ruta));
    $$('[data-admin-only]').forEach(el => el.hidden = !this.puedeVer());
    $$('[data-lock]').forEach(el => el.hidden = this.puedeVer());
    const lock = $('#lock-btn');
    if (lock) { const pin = !!cfg().pinAdmin; lock.hidden = !pin; lock.innerHTML = icon(this.admin ? 'unlock' : 'lock'); lock.title = this.admin ? 'Modo administradora activo. Toca para bloquear.' : 'Desbloquear modo administradora'; }
  },
  puedeVer() { return !cfg().pinAdmin || this.admin; },
  onData() {
    const a = document.activeElement;
    const escribiendo = a && $('#view').contains(a) && /INPUT|TEXTAREA|SELECT/.test(a.tagName) && a.type !== 'button';
    if (Modal.isOpen() || escribiendo) { this.dirty = true; return; }
    this.render();
  },
  flushDirty() { if (this.dirty && !Modal.isOpen()) setTimeout(() => this.render(), 30); },
};

/* ---------- Utilidades de interfaz ---------- */
async function run(fn, okMsg) {
  try { const r = await fn(); if (okMsg) toast(typeof okMsg === 'function' ? okMsg(r) : okMsg); return r; }
  catch (e) { console.error(e); toast(e.message || 'Algo salió mal.', 'error', 4500); return undefined; }
}
function pill(t, k = 'muted') { return `<span class="pill ${k}">${esc(t)}</span>`; }
function vacio(ic, titulo, texto, extra = '') { return `<div class="empty">${icon(ic)}<strong>${esc(titulo)}</strong>${texto ? `<p>${esc(texto)}</p>` : ''}${extra}</div>`; }
function seg(scope, k, opciones, valor, cb = '') {
  return `<div class="seg" role="radiogroup">${opciones.map(o => { const v = typeof o === 'string' ? o : o.v; const l = typeof o === 'string' ? o : o.l; return `<button type="button" role="radio" aria-checked="${v === valor}" class="${v === valor ? 'on' : ''}" data-a="seg" data-scope="${scope}" data-k="${k}" data-v="${esc(v)}" data-cb="${cb}">${esc(l)}</button>`; }).join('')}</div>`;
}
function chips(scope, k, opciones, valor, cb = '') {
  return `<div class="chips">${opciones.map(o => { const v = typeof o === 'string' ? o : o.v; const l = typeof o === 'string' ? o : o.l; return `<button type="button" class="chip ${v === valor ? 'on' : ''}" data-a="seg" data-scope="${scope}" data-k="${k}" data-v="${esc(v)}" data-cb="${cb}">${esc(l)}</button>`; }).join('')}</div>`;
}
function filaDato(a, b, cls = '') { return `<div class="dl-row ${cls}"><span>${a}</span><span>${b}</span></div>`; }
function bloqueadoHTML(nombre) {
  return `<div class="screen">${vacio('lock', `${nombre} está protegido`, 'Esta sección muestra costos y ganancias. Ingresa el PIN de administradora para verla.', `<button class="btn primary" data-a="desbloquear">${icon('unlock')}Desbloquear</button>`)}</div>`;
}
function estadoVentaPill(v) {
  if (v.estado === 'anulada') return pill('Anulada', 'bad');
  if (v.tipo === 'separado' && !v.entregado) return v.saldo > 0 ? pill('Separado · debe ' + money(v.saldo), 'warn') : pill('Pagado · por entregar', 'accent');
  if (v.saldo > 0) return pill('Debe ' + money(v.saldo), 'warn');
  if (v.tipo === 'fiado') return pill('Fiado pagado', 'ok');
  return pill(v.metodo || 'Pagada', 'muted');
}
function stockPill(p) {
  const e = estadoStock(p); const s = stockDe(p);
  return e === 'agotado' ? pill('Agotado', 'bad') : e === 'bajo' ? pill(`Quedan ${num(s)}`, 'warn') : pill(`${num(s)} und.`, 'ok');
}
function opcionesSelect(lista, sel) { return lista.map(x => `<option ${x === sel ? 'selected' : ''}>${esc(x)}</option>`).join(''); }

/* ---------- Acciones genéricas ---------- */
Acciones.seg = el => {
  const { scope, k, v, cb } = el.dataset;
  App.s[scope][k] = v;
  const grupo = el.parentElement;
  $$('[data-a="seg"]', grupo).forEach(b => { const on = b === el; b.classList.toggle('on', on); b.setAttribute('aria-checked', on); });
  if (cb && Acciones[cb]) Acciones[cb](el); else if (!el.closest('.modal')) App.render();
};
Acciones.nav = el => { App.go(el.dataset.nav); };
Acciones.desbloquear = async () => { if (await pedirPIN()) App.render(); };
Acciones.bloquear = () => { if (App.admin) { App.admin = false; toast('Modo administradora bloqueado'); App.render(); } else Acciones.desbloquear(); };
Acciones.cerrarModal = () => Modal.closeTop();

function pedirPIN() {
  const pin = cfg().pinAdmin;
  if (!pin || App.admin) return Promise.resolve(true);
  return new Promise(res => {
    let ok = false;
    Modal.open(`<form id="pin-form" class="form">
      <p class="muted-text">Ingresa el PIN de administradora para ver costos, ganancias, anular ventas y cambiar ajustes.</p>
      <div class="field"><label for="pin-in">PIN</label><input id="pin-in" type="password" inputmode="numeric" autocomplete="off" maxlength="8" autofocus></div>
      <p class="form-error" id="pin-err" hidden>PIN incorrecto. Intenta de nuevo.</p>
      <button class="btn primary block" type="submit">Desbloquear</button></form>`, {
      title: 'Modo administradora',
      onOpen(body, close) {
        $('#pin-form', body).onsubmit = e => {
          e.preventDefault();
          if ($('#pin-in', body).value === String(pin)) { ok = true; App.admin = true; close(); toast('Modo administradora activo'); }
          else { $('#pin-err', body).hidden = false; $('#pin-in', body).value = ''; $('#pin-in', body).focus(); }
        };
      },
      onClose() { res(ok); },
    });
  });
}
async function requireAdmin() { return pedirPIN(); }

/* ---------- Inicio ---------- */
Pantallas.inicio = {
  titulo: 'Inicio',
  render() {
    const c = cfg(); const hoy = dayKey();
    const caja = cajaAbierta();
    const r = reporte(rangoPeriodo('hoy'));
    const ayer = reporte(rangoPeriodo('ayer'));
    const inv = valorInventario();
    const cartera = ventasConSaldo();
    const porCobrar = sum(cartera, v => v.saldo);
    const separados = separadosPorEntregar();
    const semana = reporte(rangoPeriodo('7d'));
    const ultimas = DB.all('ventas').sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, 6);
    const d = new Date(); const saludo = d.getHours() < 12 ? 'Buenos días' : d.getHours() < 19 ? 'Buenas tardes' : 'Buenas noches';
    const varPct = ayer.facturado ? Math.round((r.facturado - ayer.facturado) / ayer.facturado * 100) : null;
    const rc = caja ? resumenCaja(caja) : null;

    return `<div class="screen">
      <div class="hello"><div><p class="eyebrow">${DIAS[d.getDay()]} ${d.getDate()} de ${MESES_L[d.getMonth()]}</p><h1>${saludo}</h1></div>
        <button class="btn primary lg hide-desk" data-a="nav" data-nav="vender">${icon('cart')}Nueva venta</button></div>

      <section class="caja-strip ${caja ? 'open' : 'closed'}">
        <div class="caja-strip-main">
          <span class="dot"></span>
          <div><strong>${caja ? 'Caja abierta' : 'Caja cerrada'}</strong>
          <p>${caja ? `Desde ${fmtHora(caja.apertura)}${caja.dia !== hoy ? ' del ' + fmtFecha(caja.apertura) : ''} · Efectivo en caja <b class="num">${money(rc.esperado)}</b>` : 'Ábrela para empezar a recibir dinero'}</p></div>
        </div>
        ${caja ? `<button class="btn ghost sm" data-a="nav" data-nav="caja">Ver caja</button>` : `<button class="btn primary sm" data-a="abrirCaja">Abrir caja</button>`}
      </section>
      ${caja && caja.dia !== hoy ? `<div class="notice warn">${icon('alert')}<span>La caja sigue abierta desde ${fmtFecha(caja.apertura)}. Haz el cierre para que el cuadre de cada día quede separado.</span></div>` : ''}

      <section class="kpis">
        <div class="kpi"><span class="kpi-l">Ventas de hoy</span><span class="kpi-v num">${money(r.facturado)}</span>
          <span class="kpi-s">${r.numVentas} ${r.numVentas === 1 ? 'venta' : 'ventas'}${varPct !== null ? ` · <span class="${varPct >= 0 ? 'up' : 'down'}">${varPct >= 0 ? '+' : ''}${varPct}% vs. ayer</span>` : ''}</span></div>
        <div class="kpi" data-admin-only><span class="kpi-l">Ganancia de hoy</span><span class="kpi-v num">${money(r.utilidadBruta)}</span><span class="kpi-s">Margen ${Math.round(r.margen * 100)}%</span></div>
        <button class="kpi link" data-a="irCartera"><span class="kpi-l">Por cobrar</span><span class="kpi-v num">${money(porCobrar)}</span><span class="kpi-s">${new Set(cartera.map(v => v.clienteId)).size} clientas ${icon('chevron', 'sm')}</span></button>
        <div class="kpi"><span class="kpi-l">Dinero recibido hoy</span><span class="kpi-v num">${money(r.totalRecaudo)}</span><span class="kpi-s">${Object.entries(r.recaudo).map(([m, v]) => `${esc(m)} ${money(v)}`).join(' · ') || 'Sin pagos aún'}</span></div>
      </section>

      <div class="cols">
        <section class="card">
          <div class="card-head"><h2>Ventas de la semana</h2><span class="muted-text num">${money(semana.facturado)}</span></div>
          ${barras(semana.porDia.map(x => ({ l: DIAS[parseDay(x.dia).getDay()], v: x.ventas, hoy: x.dia === hoy, t: `${fmtFecha(parseDay(x.dia))}: ${money(x.ventas)}` })))}
        </section>
        <section class="card">
          <div class="card-head"><h2>Pendientes</h2></div>
          <div class="alert-list">
            ${inv.agotados.length ? `<button class="alert-item bad" data-a="irInv" data-f="agotado">${icon('ban')}<span><b>${inv.agotados.length} agotados</b><small>${esc(inv.agotados.slice(0, 3).map(p => p.nombre).join(', '))}${inv.agotados.length > 3 ? '…' : ''}</small></span>${icon('chevron', 'sm')}</button>` : ''}
            ${inv.bajos.length ? `<button class="alert-item warn" data-a="irInv" data-f="reponer">${icon('alert')}<span><b>${inv.bajos.length} con poco stock</b><small>${esc(inv.bajos.slice(0, 3).map(p => p.nombre).join(', '))}${inv.bajos.length > 3 ? '…' : ''}</small></span>${icon('chevron', 'sm')}</button>` : ''}
            ${separados.length ? `<button class="alert-item accent" data-a="irVentasSep">${icon('bag')}<span><b>${separados.length} separados por entregar</b><small>${esc(separados.slice(0, 3).map(v => v.clienteNombre).join(', '))}</small></span>${icon('chevron', 'sm')}</button>` : ''}
            ${cartera.filter(v => diasDesde(v.fecha) > 30).length ? `<button class="alert-item warn" data-a="irCartera">${icon('wallet')}<span><b>${cartera.filter(v => diasDesde(v.fecha) > 30).length} cuentas con más de 30 días</b><small>Revisa la cartera y envía recordatorios</small></span>${icon('chevron', 'sm')}</button>` : ''}
            ${!inv.agotados.length && !inv.bajos.length && !separados.length ? `<p class="muted-text">Todo en orden. No hay alertas.</p>` : ''}
          </div>
        </section>
      </div>

      <section class="card">
        <div class="card-head"><h2>Últimas ventas</h2><button class="link-btn" data-a="nav" data-nav="ventas">Ver todas</button></div>
        ${ultimas.length ? `<div class="list">${ultimas.map(ventaRow).join('')}</div>` : vacio('receipt', 'Aún no hay ventas', 'Las ventas que registres aparecerán aquí.')}
      </section>

      <section class="quick">
        <button class="quick-btn" data-a="nuevaEntrada">${icon('in')}<span>Entrada de mercancía</span></button>
        <button class="quick-btn" data-a="nuevoGasto">${icon('wallet')}<span>Registrar gasto</span></button>
        <button class="quick-btn" data-a="irCartera">${icon('users')}<span>Recibir abono</span></button>
        <button class="quick-btn" data-a="nuevoProducto">${icon('tag')}<span>Nuevo producto</span></button>
      </section>
    </div>`;
  },
};
Acciones.irInv = el => { Object.assign(App.s.inv, { tab: 'productos', filtro: el.dataset.f || '', q: '', cat: '' }); App.go('inventario'); };
Acciones.irCartera = () => { App.s.cli.tab = 'cartera'; App.go('clientes'); };
Acciones.irVentasSep = () => { Object.assign(App.s.ventas, { periodo: 'todo', tipo: 'porEntregar', q: '' }); App.go('ventas'); };

function ventaRow(v) {
  return `<button class="item" data-a="verVenta" data-id="${v.id}">
    <span class="item-lead num">#${esc(v.numero)}</span>
    <span class="item-main"><span class="item-title">${esc(v.clienteNombre || 'Venta de mostrador')}</span>
      <span class="item-sub">${fmtFechaCorta(v.fecha)} · ${v.items.reduce((s, i) => s + i.cantidad, 0)} und. · ${esc(v.items.map(i => i.nombre).join(', '))}</span></span>
    <span class="item-end"><span class="num strong ${v.estado === 'anulada' ? 'tachado' : ''}">${money(v.total)}</span>${estadoVentaPill(v)}</span>
  </button>`;
}

/* Gráfico de barras simple en SVG */
function barras(datos, { alto = 140, formato = money } = {}) {
  if (!datos.length) return '';
  const max = Math.max(...datos.map(d => d.v), 1);
  const W = 100 / datos.length;
  const etiquetaCada = Math.ceil(datos.length / 12);
  return `<div class="bars" style="--h:${alto}px">
    <div class="bars-max num">${formato(max)}</div>
    <div class="bars-area">${datos.map((d, i) => `<div class="bar-col ${d.hoy ? 'hoy' : ''}" style="width:${W}%" title="${esc(d.t || formato(d.v))}">
      <div class="bar" style="height:${Math.max(d.v / max * 100, d.v ? 2 : 0)}%"></div>
      <span class="bar-l">${i % etiquetaCada === 0 || d.hoy ? esc(d.l) : ''}</span></div>`).join('')}</div></div>`;
}
function barrasH(datos, { formato = money, max } = {}) {
  max = max || Math.max(...datos.map(d => d.v), 1);
  return `<div class="hbars">${datos.map(d => `<div class="hbar"><div class="hbar-top"><span>${esc(d.l)}</span><span class="num">${formato(d.v)}${d.extra ? ` <small>${d.extra}</small>` : ''}</span></div><div class="hbar-track"><div class="hbar-fill" style="width:${Math.max(d.v / max * 100, 0)}%"></div></div></div>`).join('')}</div>`;
}

/* ---------- Vender ---------- */
function posProductos() {
  const { q, cat } = App.s.pos; const nq = norm(q);
  return productosActivos().filter(p => (!cat || p.categoria === cat) && (!nq || norm(p.nombre).includes(nq) || norm(p.codigo).includes(nq)));
}
function posListaHTML() {
  const ps = posProductos(); const cart = App.s.pos.cart;
  if (!ps.length) return vacio('search', 'No hay productos con ese nombre', productosActivos().length ? 'Prueba con otra palabra o quita el filtro de categoría.' : 'Primero crea tus productos en Inventario.', productosActivos().length ? '' : `<button class="btn primary" data-a="nuevoProducto">${icon('plus')}Crear producto</button>`);
  return ps.map(p => {
    const enCart = cart.find(i => i.productoId === p.id); const s = stockDe(p); const ag = s <= 0;
    return `<button class="prod ${ag ? 'agotado' : ''} ${enCart ? 'en-cart' : ''}" data-a="posAdd" data-id="${p.id}" ${ag ? 'disabled' : ''}>
      ${enCart ? `<span class="prod-q num">${enCart.cantidad}</span>` : ''}
      <span class="prod-n">${esc(p.nombre)}</span>
      <span class="prod-m"><span class="num strong">${money(p.precio)}</span><span class="prod-s ${estadoStock(p)}">${ag ? 'Agotado' : `Quedan ${num(s)}`}</span></span>
    </button>`;
  }).join('');
}
function posLineasHTML(enModal) {
  const cart = App.s.pos.cart;
  if (!cart.length) return `<p class="muted-text center pad">Toca un producto para agregarlo al pedido.</p>`;
  return `<div class="lines">${cart.map((i, idx) => {
    const p = DB.get('productos', i.productoId); const max = stockDe(p);
    return `<div class="line"><div class="line-main"><span class="line-n">${esc(i.nombre)}</span><span class="line-p num">${money(i.precio)} c/u</span></div>
      <div class="stepper"><button class="icon-btn sm" data-a="posQty" data-i="${idx}" data-d="-1" aria-label="Quitar uno">${icon(i.cantidad > 1 ? 'minus' : 'trash')}</button>
      <span class="num">${i.cantidad}</span><button class="icon-btn sm" data-a="posQty" data-i="${idx}" data-d="1" ${i.cantidad >= max ? 'disabled' : ''} aria-label="Agregar uno">${icon('plus')}</button></div>
      <span class="line-t num">${money(i.precio * i.cantidad)}</span></div>`;
  }).join('')}</div>`;
}
function posResumenHTML() {
  const t = totalesCarrito(App.s.pos.cart, App.s.pos.descuento);
  return `<div class="ticket-sum">${t.descuento ? filaDato('Subtotal', `<span class="num">${money(t.subtotal)}</span>`) + filaDato('Descuento', `<span class="num">-${money(t.descuento)}</span>`) : ''}
    ${filaDato('Total', `<span class="num">${money(t.total)}</span>`, 'total')}</div>`;
}
function posCartBar() {
  const t = totalesCarrito(App.s.pos.cart, App.s.pos.descuento);
  return t.unidades ? `<div class="cartbar-in"><div><b class="num">${money(t.total)}</b><small>${t.unidades} ${t.unidades === 1 ? 'producto' : 'productos'}</small></div><button class="btn primary lg" data-a="posCobrar">Cobrar${icon('chevron')}</button></div>` : '';
}

Pantallas.vender = {
  titulo: 'Vender',
  render() {
    const s = App.s.pos; const cats = cfg().categorias.filter(c => productosActivos().some(p => p.categoria === c));
    return `<div class="screen pos">
      <div class="pos-left">
        <div class="toolbar sticky">
          <div class="input-btns"><label class="search">${icon('search')}<input id="pos-q" type="search" placeholder="Buscar o escanear código" value="${esc(s.q)}" data-in="posBuscar" data-enter="posEnter" autocomplete="off"></label><button class="btn primary scan-btn" data-a="scanVender" aria-label="Escanear con la cámara">${icon('scan')}<span>Escanear</span></button></div>
          ${chips('pos', 'cat', [{ v: '', l: 'Todos' }, ...cats], s.cat)}
        </div>
        <div class="prod-grid" id="pos-list">${posListaHTML()}</div>
      </div>
      <aside class="pos-right card">
        <div class="card-head"><h2>Pedido</h2>${s.cart.length ? `<button class="link-btn" data-a="posVaciar">Vaciar</button>` : ''}</div>
        <div id="pos-lines">${posLineasHTML()}</div>
        <div id="pos-sum">${s.cart.length ? posResumenHTML() : ''}</div>
        <button class="btn primary block lg" data-a="posCobrar" ${s.cart.length ? '' : 'disabled'}>Cobrar</button>
      </aside>
      <div class="cartbar" id="pos-cartbar">${posCartBar()}</div>
    </div>`;
  },
};
Acciones.posEnter = el => {
  const q = el.value.trim(); if (!q) return;
  const p = productoPorCodigo(q) || (posProductos().length === 1 ? posProductos()[0] : null);
  if (!p) { pitido(false); toast('No hay un producto con ese código o nombre', 'warn'); return; }
  const r = agregarAlPedido(p);
  pitido(r.ok); if (!r.ok) { toast(r.msg, 'warn'); return; }
  App.s.pos.q = ''; el.value = ''; $('#pos-list').innerHTML = posListaHTML(); posRefrescar();
};
INPUTS.posBuscar = el => { App.s.pos.q = el.value; $('#pos-list').innerHTML = posListaHTML(); };
function posTiles() {
  const cart = App.s.pos.cart;
  $$('#pos-list .prod').forEach(b => {
    const it = cart.find(i => i.productoId === b.dataset.id);
    b.classList.toggle('en-cart', !!it);
    let q = b.querySelector('.prod-q');
    if (it) { if (!q) { q = document.createElement('span'); q.className = 'prod-q num'; b.prepend(q); } q.textContent = it.cantidad; }
    else if (q) q.remove();
  });
}
function posRefrescar() {
  posTiles();
  const ln = $('#pos-lines'); if (ln) ln.innerHTML = posLineasHTML();
  const sm = $('#pos-sum'); if (sm) sm.innerHTML = App.s.pos.cart.length ? posResumenHTML() : '';
  const cb = $('#pos-cartbar'); if (cb) cb.innerHTML = posCartBar();
  const btn = $('.pos-right [data-a="posCobrar"]'); if (btn) btn.disabled = !App.s.pos.cart.length;
  const head = $('.pos-right .card-head'); if (head) head.innerHTML = `<h2>Pedido</h2>${App.s.pos.cart.length ? `<button class="link-btn" data-a="posVaciar">Vaciar</button>` : ''}`;
  const co = $('#co-lines'); if (co) { co.innerHTML = posLineasHTML(true); coTotales(); }
}
Acciones.posAdd = el => {
  const p = DB.get('productos', el.dataset.id); if (!p) return;
  const cart = App.s.pos.cart; const it = cart.find(i => i.productoId === p.id);
  if ((it ? it.cantidad : 0) + 1 > stockDe(p)) { toast(`Solo hay ${stockDe(p)} de ${p.nombre}`, 'warn'); return; }
  if (it) it.cantidad++; else cart.push({ productoId: p.id, nombre: p.nombre, precio: Number(p.precio) || 0, cantidad: 1 });
  posRefrescar();
  el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
};
Acciones.posQty = el => {
  const cart = App.s.pos.cart; const i = Number(el.dataset.i); const it = cart[i]; if (!it) return;
  const p = DB.get('productos', it.productoId);
  it.cantidad += Number(el.dataset.d);
  if (it.cantidad > stockDe(p)) { it.cantidad = stockDe(p); toast(`Solo hay ${stockDe(p)} de ${it.nombre}`, 'warn'); }
  if (it.cantidad <= 0) cart.splice(i, 1);
  posRefrescar();
  if (!cart.length && $('#co-lines')) Modal.closeTop();
};
Acciones.posVaciar = async () => { if (await confirmar('¿Quitar todos los productos del pedido?', { si: 'Vaciar pedido' })) { App.s.pos.cart = []; posRefrescar(); } };

/* Cobro */
function coPagoHTML() {
  const s = App.s.pos; const c = cfg(); const caja = cajaAbierta();
  const t = totalesCarrito(s.cart, s.descuento);
  let h = '';
  if (s.tipo === 'contado') {
    h += `<div class="field"><label>Medio de pago</label>${chips('pos', 'metodo', c.metodos, s.metodo, 'coMetodo')}</div>`;
    if (s.metodo === 'Efectivo') h += `<div class="grid2"><div class="field"><label for="co-rec">Recibido</label><input id="co-rec" data-money inputmode="numeric" placeholder="${num(t.total)}" value="${esc(s.recibido)}" data-in="coCampo" data-k="recibido"></div>
      <div class="field"><label>Cambio</label><div class="readout num" id="co-cambio">—</div></div></div>
      <div class="chips quick-cash">${[...new Set([t.total, Math.ceil(t.total / 10000) * 10000, Math.ceil(t.total / 50000) * 50000, 100000].filter(v => v >= t.total && v > 0))].slice(0, 4).map(v => `<button type="button" class="chip" data-a="coRecibido" data-v="${v}">${money(v)}</button>`).join('')}</div>`;
  } else {
    h += `<p class="muted-text">${s.tipo === 'fiado' ? 'La clienta se lleva el producto y paga después. El saldo queda en la cartera.' : 'El producto se aparta (sale del stock disponible) y se entrega cuando termine de pagar.'}</p>
      <div class="grid2"><div class="field"><label for="co-abono">Abono inicial</label><input id="co-abono" data-money inputmode="numeric" placeholder="0" value="${esc(s.abono)}" data-in="coCampo" data-k="abono"></div>
      <div class="field"><label>Saldo que queda</label><div class="readout num" id="co-saldo">—</div></div></div>
      <div class="field"><label>Medio del abono</label>${chips('pos', 'metodoAbono', c.metodos, s.metodoAbono)}</div>`;
  }
  if (!caja && (s.tipo === 'contado' || parseMoney(s.abono) > 0)) h += `<div class="notice warn">${icon('alert')}<span>La caja está cerrada. Ábrela para poder recibir dinero.</span><button type="button" class="btn sm primary" data-a="abrirCaja">Abrir caja</button></div>`;
  return h;
}
function coTotales() {
  const s = App.s.pos; const t = totalesCarrito(s.cart, s.descuento);
  const tot = $('#co-total'); if (tot) tot.innerHTML = posResumenHTML();
  const cam = $('#co-cambio'); if (cam) { const r = parseMoney(s.recibido); cam.textContent = r ? (r >= t.total ? money(r - t.total) : 'Falta ' + money(t.total - r)) : '—'; cam.classList.toggle('bad-text', r > 0 && r < t.total); }
  const sal = $('#co-saldo'); if (sal) sal.textContent = money(Math.max(t.total - parseMoney(s.abono), 0));
  const btn = $('#co-go'); if (btn) btn.textContent = `Registrar venta · ${money(t.total)}`;
}
Acciones.posCobrar = () => {
  if (!App.s.pos.cart.length) return;
  const s = App.s.pos; const clientes = DB.all('clientes').sort((a, b) => a.nombre.localeCompare(b.nombre));
  Modal.open(`<form id="co-form" class="form" autocomplete="off">
    <div id="co-lines">${posLineasHTML(true)}</div>
    <div class="grid2">
      <div class="field"><label for="co-desc">Descuento ($)</label><input id="co-desc" data-money inputmode="numeric" placeholder="0" value="${esc(s.descuento)}" data-in="coCampo" data-k="descuento"></div>
      <div id="co-total" class="co-total"></div>
    </div>
    <fieldset class="fs"><legend>Clienta <small>(opcional en ventas de contado)</small></legend>
      <div class="grid2">
        <div class="field"><label for="co-tel">WhatsApp</label><input id="co-tel" type="tel" inputmode="tel" placeholder="300 123 4567" value="${esc(s.cliTel)}" data-in="coTel" list="dl-tels"></div>
        <div class="field"><label for="co-nom">Nombre</label><input id="co-nom" placeholder="Nombre" value="${esc(s.cliNombre)}" data-in="coNombre" list="dl-clientes"></div>
      </div>
      <datalist id="dl-clientes">${clientes.map(c => `<option value="${esc(c.nombre)}">${esc(c.tel || '')}</option>`).join('')}</datalist>
      <datalist id="dl-tels">${clientes.filter(c => c.tel).map(c => `<option value="${esc(c.tel)}">${esc(c.nombre)}</option>`).join('')}</datalist>
      <p class="hint" id="co-cli-hint"></p>
    </fieldset>
    <div class="field"><label>Tipo de venta</label>${seg('pos', 'tipo', [{ v: 'contado', l: 'Contado' }, { v: 'fiado', l: 'Fiado' }, { v: 'separado', l: 'Separado' }], s.tipo, 'coTipo')}</div>
    <div id="co-pago">${coPagoHTML()}</div>
    <div class="field"><label for="co-nota">Nota</label><input id="co-nota" placeholder="Opcional" value="${esc(s.nota)}" data-in="coCampo" data-k="nota"></div>
    <button class="btn primary block lg" id="co-go" type="submit">Registrar venta</button>
  </form>`, {
    title: 'Cobrar', wide: true,
    onOpen(body, close) {
      bindMoneyInputs(body); coTotales(); coHintCliente();
      $('#co-form', body).onsubmit = async e => {
        e.preventDefault();
        const btn = $('#co-go', body); btn.disabled = true;
        const v = await run(() => registrarVenta({
          cart: s.cart, descuento: s.descuento, tipo: s.tipo, metodo: s.metodo, recibido: s.recibido,
          abonoInicial: s.abono, metodoAbono: s.metodoAbono, clienteNombre: s.cliNombre, clienteTel: s.cliTel, nota: s.nota,
        }));
        btn.disabled = false;
        if (!v) return;
        Object.assign(App.s.pos, { cart: [], descuento: '', cliNombre: '', cliTel: '', recibido: '', abono: '', nota: '', tipo: 'contado', metodo: 'Efectivo' });
        close(); posRefrescar(); ventaExitosa(v);
      };
    },
  });
};
function coHintCliente() {
  const s = App.s.pos; const h = $('#co-cli-hint'); if (!h) return;
  const c = buscarClientePorTel(s.cliTel);
  if (c) { const deuda = sum(ventasConSaldo().filter(v => v.clienteId === c.id), v => v.saldo); h.innerHTML = `Clienta registrada${deuda ? ` · <b class="warn-text">debe ${money(deuda)}</b>` : ''}`; }
  else h.textContent = telLimpio(s.cliTel).length >= 10 ? 'Clienta nueva: se guardará con esta venta.' : '';
}
INPUTS.coCampo = el => { App.s.pos[el.dataset.k] = el.value; coTotales(); if (el.dataset.k === 'abono') { const p = $('#co-pago'); const tenia = !!$('.notice', p); const necesita = !cajaAbierta() && parseMoney(el.value) > 0; if (tenia !== necesita) { const pos = el.selectionStart; p.innerHTML = coPagoHTML(); bindMoneyInputs(p); const n = $('#co-abono'); n.focus(); try { n.setSelectionRange(pos, pos); } catch { } coTotales(); } } };
INPUTS.coTel = el => {
  App.s.pos.cliTel = el.value;
  const c = buscarClientePorTel(el.value);
  if (c && !App.s.pos.cliNombre) { App.s.pos.cliNombre = c.nombre; $('#co-nom').value = c.nombre; }
  coHintCliente();
};
INPUTS.coNombre = el => {
  App.s.pos.cliNombre = el.value;
  const c = DB.all('clientes').find(x => x.nombre === el.value);
  if (c && c.tel && !App.s.pos.cliTel) { App.s.pos.cliTel = c.tel; $('#co-tel').value = c.tel; coHintCliente(); }
};
Acciones.coTipo = () => { const p = $('#co-pago'); p.innerHTML = coPagoHTML(); bindMoneyInputs(p); coTotales(); };
Acciones.coMetodo = Acciones.coTipo;
Acciones.coRecibido = el => { App.s.pos.recibido = num(el.dataset.v); const i = $('#co-rec'); if (i) i.value = App.s.pos.recibido; coTotales(); };

function ventaExitosa(v) {
  Modal.open(`<div class="success">
    <div class="success-ic">${icon('check')}</div>
    <h3>Venta #${esc(v.numero)} registrada</h3>
    <p class="num big">${money(v.total)}</p>
    ${v.cambio ? `<p class="cambio">Cambio: <b class="num">${money(v.cambio)}</b></p>` : ''}
    ${v.tipo !== 'contado' ? `<p class="muted-text">Saldo pendiente: <b class="num">${money(v.saldo)}</b></p>` : ''}
    <div class="stack">
      ${botonesPDF('recibo', v.id, { etiqueta: 'recibo', tel: v.clienteTel, textoWA: textoReciboWhatsApp(v) })}
      <button class="btn ghost block" data-a="cerrarModal">${icon('cart')}Nueva venta</button>
    </div></div>`, { title: 'Listo' });
}

/* ---------- Detalle de venta (compartido) ---------- */
Acciones.verVenta = el => verVenta(el.dataset.id);
function verVenta(id) {
  const v = DB.get('ventas', id); if (!v) return;
  const c = cfg();
  const abonos = DB.all('abonos').filter(a => a.ventaId === v.id).sort((a, b) => a.fecha.localeCompare(b.fecha));
  const gan = v.total - (v.costoTotal || 0);
  Modal.open(`<div class="venta-det">
    <div class="vd-top"><div><p class="eyebrow">${{ contado: 'Contado', fiado: 'Fiado', separado: 'Separado' }[v.tipo]} · ${fmtFechaHora(v.fecha)}</p>
      <h3>${esc(v.clienteNombre || 'Venta de mostrador')}</h3>${v.clienteTel ? `<p class="muted-text num">${esc(v.clienteTel)}</p>` : ''}</div>${estadoVentaPill(v)}</div>
    ${v.estado === 'anulada' ? `<div class="notice bad">${icon('ban')}<span>Anulada el ${fmtFechaHora(v.anuladaFecha)}${v.motivoAnulacion ? ': ' + esc(v.motivoAnulacion) : ''}</span></div>` : ''}
    <div class="lines ro">${v.items.map(i => `<div class="line"><div class="line-main"><span class="line-n">${esc(i.nombre)}</span><span class="line-p num">${i.cantidad} × ${money(i.precio)}</span></div><span class="line-t num">${money(i.cantidad * i.precio)}</span></div>`).join('')}</div>
    <div class="ticket-sum">
      ${v.descuento ? filaDato('Subtotal', `<span class="num">${money(v.subtotal)}</span>`) + filaDato('Descuento', `<span class="num">-${money(v.descuento)}</span>`) : ''}
      ${filaDato('Total', `<span class="num">${money(v.total)}</span>`, 'total')}
      ${App.puedeVer() ? filaDato('Ganancia', `<span class="num">${money(gan)}</span>`, 'muted') : ''}
      ${v.tipo === 'contado' ? filaDato('Pagó con', esc(v.metodo) + (v.recibido ? ` · recibido ${money(v.recibido)}, cambio ${money(v.cambio)}` : '')) : ''}
    </div>
    ${v.tipo !== 'contado' ? `<h4>Abonos</h4>${abonos.length ? `<div class="list compact">${abonos.map(a => `<div class="item ${a.anulado ? 'tachado' : ''}"><span class="item-main"><span class="item-title num">${money(a.valor)}</span><span class="item-sub">${fmtFechaHora(a.fecha)} · ${esc(a.metodo)}${a.nota ? ' · ' + esc(a.nota) : ''}</span></span>${a.anulado ? '' : `<span class="item-end"><button class="btn ghost sm" data-a="pdf" data-tipo="abono" data-id="${a.id}" data-modo="${puedeCompartirArchivos() ? 'share' : 'download'}">${icon(puedeCompartirArchivos() ? 'share' : 'download')}Comprobante</button></span>`}</div>`).join('')}</div>` : '<p class="muted-text">Sin abonos todavía.</p>'}
      ${filaDato('Saldo pendiente', `<b class="num">${money(v.saldo || 0)}</b>`, 'total')}` : ''}
    ${v.nota ? `<p class="muted-text">Nota: ${esc(v.nota)}</p>` : ''}
    <div class="stack">
      ${v.estado !== 'anulada' && v.saldo > 0 ? `<button class="btn primary block" data-a="abonar" data-id="${v.id}">${icon('cash')}Registrar abono</button>` : ''}
      ${v.estado !== 'anulada' && v.tipo === 'separado' && !v.entregado ? `<button class="btn ${v.saldo > 0 ? 'ghost' : 'primary'} block" data-a="entregar" data-id="${v.id}">${icon('bag')}Marcar como entregado</button>` : ''}
      ${botonesPDF('recibo', v.id, { etiqueta: 'recibo', tel: v.clienteTel, textoWA: v.saldo > 0 ? textoCobroWhatsApp(v.clienteNombre, [v]) : textoReciboWhatsApp(v) })}
      ${v.estado !== 'anulada' ? `<button class="btn danger-ghost block" data-a="anular" data-id="${v.id}">${icon('ban')}Anular venta</button>` : ''}
    </div>
    <p class="fine">Registrada por ${esc(v.usuario || '')}</p>
  </div>`, { title: `Venta #${v.numero}` });
}
Acciones.ventaPDF = async el => {
  const v = DB.get('ventas', el.dataset.id);
  await run(async () => { const b = await reciboPDF(v); await entregarArchivo(b, `Recibo-${v.numero}-${(v.clienteNombre || 'venta').replace(/\s+/g, '-')}.pdf`, { compartir: !!el.dataset.share, titulo: `Recibo ${v.numero}` }); });
};
Acciones.entregar = async el => {
  const v = DB.get('ventas', el.dataset.id);
  if (v.saldo > 0 && !(await confirmar(`Todavía debe ${money(v.saldo)}. ¿Entregar de todas formas? El saldo seguirá en la cartera.`, { si: 'Entregar' }))) return;
  if (await run(() => marcarEntregado(v), 'Marcado como entregado') !== undefined) { Modal.closeTop(); }
};
Acciones.anular = async el => {
  if (!(await requireAdmin())) return;
  const v = DB.get('ventas', el.dataset.id);
  Modal.open(`<form id="an-form" class="form"><p>Se devuelven ${v.items.reduce((s, i) => s + i.cantidad, 0)} unidades al inventario y la venta deja de contar en los reportes. Si el dinero entró en una caja que ya se cerró, se registra la devolución como retiro en la caja actual.</p>
    <div class="field"><label for="an-mot">Motivo</label><input id="an-mot" placeholder="Ej.: la clienta devolvió el producto" autofocus required></div>
    <button class="btn danger block" type="submit">Anular venta #${esc(v.numero)}</button></form>`, {
    title: 'Anular venta',
    onOpen(body, close) {
      $('#an-form', body).onsubmit = async e => {
        e.preventDefault();
        const dev = await run(() => anularVenta(v, $('#an-mot', body).value));
        if (dev === undefined) return;
        toast(dev ? `Venta anulada. Entrega ${money(dev)} en efectivo a la clienta.` : 'Venta anulada', 'ok', 5000);
        close(); Modal.closeTop();
      };
    },
  });
};

/* ---------- Abonos (compartido) ---------- */
Acciones.abonar = el => abonar(el.dataset.id);
function abonar(id) {
  const v = DB.get('ventas', id); const c = cfg();
  let metodo = 'Efectivo';
  Modal.open(`<form id="ab-form" class="form">
    <div class="dl"><div class="dl-row"><span>${esc(v.clienteNombre)} · venta #${esc(v.numero)}</span><span></span></div>${filaDato('Saldo actual', `<b class="num">${money(v.saldo)}</b>`, 'total')}</div>
    <div class="field"><label for="ab-val">Valor del abono</label><input id="ab-val" data-money inputmode="numeric" value="${num(v.saldo)}" autofocus></div>
    <div class="field"><label>Medio de pago</label><div class="chips" id="ab-met">${c.metodos.map(m => `<button type="button" class="chip ${m === metodo ? 'on' : ''}" data-m="${esc(m)}">${esc(m)}</button>`).join('')}</div></div>
    ${!cajaAbierta() ? `<div class="notice warn">${icon('alert')}<span>La caja está cerrada. Ábrela para recibir el abono.</span><button type="button" class="btn sm primary" data-a="abrirCaja">Abrir caja</button></div>` : ''}
    <button class="btn primary block lg" type="submit">Registrar abono</button></form>`, {
    title: 'Registrar abono',
    onOpen(body, close) {
      bindMoneyInputs(body);
      $$('#ab-met .chip', body).forEach(b => b.onclick = () => { metodo = b.dataset.m; $$('#ab-met .chip', body).forEach(x => x.classList.toggle('on', x === b)); });
      $('#ab-form', body).onsubmit = async e => {
        e.preventDefault();
        const r = await run(() => registrarAbono(v, $('#ab-val', body).value, metodo));
        if (r === undefined) return;
        const saldo = r.saldo;
        close(); Modal.stack.length && Modal.closeTop();
        Modal.open(`<div class="success"><div class="success-ic">${icon('check')}</div><h3>Pago registrado</h3>
          <p class="num big">${money(parseMoney($('#ab-val', body).value))}</p>
          <p class="muted-text">${saldo > 0 ? `Saldo pendiente: <b class="num">${money(saldo)}</b>` : '¡Cuenta saldada!'}</p>
          ${saldo <= 0 && v.tipo === 'separado' && !v.entregado ? `<p class="notice accent">${icon('bag')}<span>El separado ya está pago. Puedes entregar el producto.</span></p><button class="btn primary block" data-a="entregar" data-id="${v.id}">Marcar como entregado</button>` : ''}
          <div class="stack">
            ${botonesPDF('abono', r.abonoId, { etiqueta: 'comprobante', tel: v.clienteTel, textoWA: `¡Hola ${String(v.clienteNombre || '').split(' ')[0]}! Recibimos tu pago a la cuenta #${v.numero} en ${c.nombre}. ${saldo > 0 ? 'Saldo pendiente: ' + money(saldo) + '.' : 'Tu cuenta quedó a paz y salvo. ¡Gracias!'}` })}
            <button class="btn ghost block" data-a="cerrarModal">Listo</button></div></div>`, { title: 'Listo' });
      };
    },
  });
}

/* ---------- Abrir caja (compartido) ---------- */
Acciones.abrirCaja = () => {
  const ultima = cajasCerradas()[0];
  const sugerida = ultima ? (ultima.baseSiguiente || 0) : 0;
  Modal.open(`<form id="ac-form" class="form">
    <p class="muted-text">Cuenta el efectivo con el que empiezas el día (la base para dar vueltas).</p>
    <div class="field"><label for="ac-base">Base inicial en efectivo</label><input id="ac-base" data-money inputmode="numeric" value="${num(sugerida)}" autofocus></div>
    ${ultima ? `<p class="hint">En el último cierre se dejaron ${money(ultima.baseSiguiente || 0)} de base.</p>` : ''}
    <div class="field"><label for="ac-nota">Nota</label><input id="ac-nota" placeholder="Opcional"></div>
    <button class="btn primary block lg" type="submit">Abrir caja</button></form>`, {
    title: 'Abrir caja',
    onOpen(body, close) {
      bindMoneyInputs(body);
      $('#ac-form', body).onsubmit = async e => {
        e.preventDefault();
        if (await run(() => abrirCaja($('#ac-base', body).value, $('#ac-nota', body).value), 'Caja abierta') === undefined) return;
        close();
        const p = $('#co-pago'); if (p) { p.innerHTML = coPagoHTML(); bindMoneyInputs(p); coTotales(); }
        $$('.modal .notice.warn').forEach(n => { if (n.textContent.includes('caja está cerrada')) n.remove(); });
        App.render();
      };
    },
  });
};
