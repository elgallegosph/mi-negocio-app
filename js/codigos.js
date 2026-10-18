/* Códigos de barras: escáner con la cámara, lectores USB/Bluetooth, códigos internos y etiquetas */
'use strict';

LIBS.scan = ['https://cdnjs.cloudflare.com/ajax/libs/html5-qrcode/2.3.8/html5-qrcode.min.js', () => window.Html5Qrcode];

/* ---------- EAN-13 ---------- */
function eanDigito(doce) {
  let s = 0; for (let i = 0; i < 12; i++) s += Number(doce[i]) * (i % 2 ? 3 : 1);
  return String((10 - (s % 10)) % 10);
}
function esEAN13(c) { return /^\d{13}$/.test(c) && eanDigito(c.slice(0, 12)) === c[12]; }
/* Códigos que empiezan por 2 están reservados para uso interno de cada tienda; no chocan con los de fábrica */
function nuevoCodigoInterno() {
  const usados = new Set(DB.all('productos').map(p => p.codigo));
  for (let i = 0; i < 50; i++) {
    const doce = '20' + String(Date.now() % 1e7).padStart(7, '0') + String(Math.floor(Math.random() * 1000)).padStart(3, '0');
    const c = doce + eanDigito(doce);
    if (!usados.has(c)) return c;
  }
  throw new Error('No se pudo generar un código.');
}
function normCodigo(c) {
  c = String(c || '').trim().replace(/\s+/g, '');
  return /^\d+$/.test(c) ? c.replace(/^0+(?=\d{8})/, '') : c.toUpperCase(); // UPC-A (12) y EAN-13 con 0 inicial son el mismo producto
}
function productoPorCodigo(code) {
  const n = normCodigo(code); if (!n) return null;
  return productosActivos().find(p => p.codigo && normCodigo(p.codigo) === n) || null;
}

/* ---------- Pitido y vibración al leer ---------- */
let _audio;
function pitido(ok = true) {
  try {
    _audio = _audio || new (window.AudioContext || window.webkitAudioContext)();
    const o = _audio.createOscillator(); const g = _audio.createGain();
    o.frequency.value = ok ? 1500 : 320; o.type = 'square'; g.gain.value = 0.05;
    o.connect(g); g.connect(_audio.destination); o.start(); o.stop(_audio.currentTime + (ok ? 0.08 : 0.25));
  } catch { }
  try { navigator.vibrate && navigator.vibrate(ok ? 50 : [60, 60, 60]); } catch { }
}

/* ---------- Despacho de códigos leídos ----------
   Cada ventana que quiera recibir códigos se registra con Escaner.usar(fn). Si no hay ninguna,
   el código va a la pantalla actual (Vender agrega al pedido, Inventario abre el producto, Conteo suma). */
const Escaner = {
  pila: [],
  usar(fn) { this.pila.push(fn); return () => { this.pila = this.pila.filter(f => f !== fn); }; },
  procesar(code) {
    code = String(code || '').trim(); if (!code) return;
    const fn = this.pila[this.pila.length - 1] || escaneoPorRuta;
    return fn(code);
  },
};

function escaneoPorRuta(code) {
  if (App.ruta === 'vender') return posAgregarCodigo(code);
  if (App.ruta === 'inventario' && App.s.inv.tab === 'conteo') return conteoSumar(code);
  if (Modal.isOpen()) return { ok: false, msg: 'Cierra la ventana abierta para buscar este código.' };
  const p = productoPorCodigo(code);
  if (p) { verProducto(p.id); return { ok: true, msg: p.nombre }; }
  ofrecerCrear(code);
  return { ok: false, msg: 'Código nuevo' };
}

function posAgregarCodigo(code) {
  const p = productoPorCodigo(code);
  if (!p) { ofrecerCrear(code); return { ok: false, msg: `El código ${code} no está registrado` }; }
  return agregarAlPedido(p);
}
function agregarAlPedido(p) {
  const cart = App.s.pos.cart; const it = cart.find(i => i.productoId === p.id);
  if ((it ? it.cantidad : 0) + 1 > stockDe(p)) return { ok: false, msg: stockDe(p) > 0 ? `Solo hay ${stockDe(p)} de ${p.nombre}` : `${p.nombre} está agotado` };
  if (it) it.cantidad++; else cart.push({ productoId: p.id, nombre: p.nombre, precio: Number(p.precio) || 0, cantidad: 1 });
  posRefrescar();
  const t = totalesCarrito(cart, App.s.pos.descuento);
  return { ok: true, msg: `${p.nombre} · ${money(p.precio)}`, sub: `Pedido: ${t.unidades} und. · ${money(t.total)}` };
}

function conteoSumar(code) {
  const p = productoPorCodigo(code);
  if (!p) return { ok: false, msg: `El código ${code} no está registrado` };
  const c = App.s.inv.conteo; c[p.id] = String((parseQty(c[p.id]) || 0) + 1);
  if (!Modal.isOpen() || $('#scan-view')) { const inp = $(`.conteo input[data-id="${p.id}"]`); if (inp) { inp.value = c[p.id]; INPUTS.conteoCampo(inp); } else App.render(); }
  return { ok: true, msg: `${p.nombre}: ${c[p.id]} contados`, sub: `En la app: ${num(stockDe(p))}` };
}

async function ofrecerCrear(code) {
  if (await confirmar(`El código ${code} no pertenece a ningún producto. ¿Quieres crear el producto con este código?`, { titulo: 'Código nuevo', si: 'Crear producto', no: 'Ahora no' })) {
    while (Modal.isOpen()) Modal.closeTop();
    formProducto(null, { codigo: code });
  }
}

/* ---------- Lectores USB / Bluetooth (funcionan como un teclado muy rápido) ---------- */
(function lectorTeclado() {
  let buf = '', t0 = 0, last = 0, el = null, val = '';
  document.addEventListener('keydown', e => {
    const now = performance.now();
    if (e.key === 'Enter') {
      const rapido = buf.length >= 4 && (now - t0) / buf.length < 45 && now - last < 120;
      if (rapido) {
        e.preventDefault(); e.stopPropagation();
        const code = buf; buf = '';
        if (el && 'value' in el) {
          if (el.dataset && el.dataset.scanFill !== undefined) { el.value = code; el.dispatchEvent(new Event('input', { bubbles: true })); return; }
          el.value = val; el.dispatchEvent(new Event('input', { bubbles: true }));
        }
        avisoLectura(Escaner.procesar(code));
        return;
      }
      buf = ''; return;
    }
    if (e.key.length !== 1 || e.ctrlKey || e.metaKey || e.altKey) return;
    if (now - last > 60) { buf = ''; t0 = now; el = document.activeElement; val = el && 'value' in el ? el.value : ''; }
    buf += e.key; last = now;
  }, true);
})();

function avisoLectura(r) {
  if (!r) return;
  Promise.resolve(r).then(x => { if (!x) return; pitido(x.ok); if (!$('#scan-view')) toast(x.msg, x.ok ? 'ok' : 'warn', 2200); });
}

/* ---------- Escáner con la cámara ---------- */
function abrirEscaner({ titulo = 'Escanear código', continuo = false, ayuda = '', alLeer }) {
  let lector = null, ultimo = '', ultimoT = 0, cerrado = false, quitar = null;
  const leidos = [];
  const manejar = code => {
    const now = Date.now();
    if (code === ultimo && now - ultimoT < 1800) return null; // evita leer el mismo código dos veces seguidas
    ultimo = code; ultimoT = now;
    const r = (alLeer || Escaner.procesar.bind(Escaner))(code) || { ok: true, msg: code };
    Promise.resolve(r).then(x => {
      pitido(x.ok);
      leidos.unshift({ ...x, code });
      pintarLeidos();
      if (!continuo && x.ok) setTimeout(() => cerrar(), 250);
    });
    return null;
  };
  const pintarLeidos = () => {
    const box = $('#scan-log'); if (!box) return;
    box.innerHTML = leidos.slice(0, 6).map((x, i) => `<div class="scan-row ${x.ok ? 'ok' : 'bad'} ${i === 0 ? 'nuevo' : ''}">${icon(x.ok ? 'check' : 'alert', 'sm')}<span><b>${esc(x.msg)}</b>${x.sub ? `<small>${esc(x.sub)}</small>` : ''}</span></div>`).join('');
  };
  let cerrar = () => { };
  Modal.open(`<div class="scan">
      <div class="scan-cam"><div id="scan-view"></div><div class="scan-msg" id="scan-msg">Abriendo la cámara…</div></div>
      ${ayuda ? `<p class="hint center">${esc(ayuda)}</p>` : ''}
      <div id="scan-log" class="scan-log"></div>
      <form id="scan-man" class="scan-man"><input id="scan-in" inputmode="numeric" placeholder="O escribe el código" autocomplete="off" aria-label="Código"><button class="btn ghost" type="submit">Buscar</button></form>
      ${continuo ? '<button class="btn primary block lg" data-close-scan>Terminar</button>' : ''}
    </div>`, {
    title: titulo,
    onOpen(body, close) {
      cerrar = () => { if (!cerrado) close(); };
      quitar = Escaner.usar(code => { manejar(code); return null; });
      $('#scan-man', body).onsubmit = e => { e.preventDefault(); const v = $('#scan-in', body).value.trim(); if (v) { ultimo = ''; manejar(v); $('#scan-in', body).value = ''; } };
      const fin = $('[data-close-scan]', body); if (fin) fin.onclick = () => close();
      iniciarCamara();
    },
    onClose() {
      cerrado = true; quitar && quitar();
      if (lector) { const l = lector; lector = null; l.stop().catch(() => { }).finally(() => { try { l.clear(); } catch { } }); }
    },
  });
  async function iniciarCamara() {
    const msg = $('#scan-msg');
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw Object.assign(new Error('sin cámara'), { name: 'NotSupported' });
      await lib('scan');
      if (cerrado) return;
      const F = window.Html5QrcodeSupportedFormats;
      lector = new Html5Qrcode('scan-view', {
        verbose: false,
        formatsToSupport: [F.EAN_13, F.EAN_8, F.UPC_A, F.UPC_E, F.CODE_128, F.CODE_39, F.ITF, F.QR_CODE],
        experimentalFeatures: { useBarCodeDetectorIfSupported: true },
      });
      await lector.start({ facingMode: 'environment' }, {
        fps: 12, aspectRatio: 1.333,
        qrbox: (w, h) => ({ width: Math.max(150, Math.floor(Math.min(w * 0.86, 360))), height: Math.max(80, Math.floor(Math.min(h * 0.45, 170))) }),
      }, code => manejar(code), () => { });
      if (cerrado) { lector.stop().catch(() => { }); return; }
      msg.textContent = 'Apunta al código de barras';
      msg.classList.add('listo');
    } catch (e) {
      console.warn(e);
      if (cerrado) return;
      const n = (e && (e.name || '')) + ' ' + String(e && e.message || e);
      msg.classList.add('error');
      msg.innerHTML = /NotAllowed|Permission/i.test(n) ? 'No hay permiso para usar la cámara. Actívalo en la configuración del navegador para esta página, o escribe el código abajo.'
        : /NotFound|Requested device not found|sin cámara|NotSupported/i.test(n) ? 'Este dispositivo no tiene cámara disponible. Escribe el código abajo o usa un lector USB/Bluetooth.'
        : /herramienta/i.test(n) ? 'No se pudo cargar el lector. Revisa la conexión a internet.'
        : 'No se pudo abrir la cámara. Cierra otras apps que la estén usando, o escribe el código abajo.';
    }
  }
}

/* Acciones de escaneo de cada pantalla */
Acciones.scanVender = () => abrirEscaner({ titulo: 'Escanear para vender', continuo: true, ayuda: 'Cada producto que escanees se suma al pedido.', alLeer: posAgregarCodigo });
Acciones.scanInventario = () => abrirEscaner({ titulo: 'Buscar por código', alLeer: code => {
  const p = productoPorCodigo(code);
  if (!p) { setTimeout(() => ofrecerCrear(code), 300); return { ok: true, msg: 'Código nuevo: ' + code }; }
  setTimeout(() => verProducto(p.id), 300); return { ok: true, msg: p.nombre };
} });
Acciones.scanConteo = () => abrirEscaner({ titulo: 'Contar con la cámara', continuo: true, ayuda: 'Escanea cada unidad una por una. Cada lectura suma 1.', alLeer: conteoSumar });

/* ---------- Etiquetas con código de barras (PDF) ---------- */
const EAN_L = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011'];
const EAN_G = ['0100111', '0110011', '0011011', '0100001', '0011101', '0111001', '0000101', '0010001', '0001001', '0010111'];
const EAN_R = ['1110010', '1100110', '1101100', '1000010', '1011100', '1001110', '1010000', '1000100', '1001000', '1110100'];
const EAN_PARIDAD = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL'];
function eanBits(c) {
  const par = EAN_PARIDAD[Number(c[0])];
  let b = '101';
  for (let i = 1; i <= 6; i++) b += (par[i - 1] === 'L' ? EAN_L : EAN_G)[Number(c[i])];
  b += '01010';
  for (let i = 7; i <= 12; i++) b += EAN_R[Number(c[i])];
  return b + '101';
}
/* Dibuja un EAN-13 en jsPDF: x,y esquina superior izquierda, w ancho total, h alto de barras */
function dibujarEAN(doc, code, x, y, w, h) {
  const bits = eanBits(code); const quiet = 9; const mod = w / (bits.length + quiet * 2);
  doc.setFillColor(0, 0, 0);
  let i = 0;
  while (i < bits.length) {
    if (bits[i] === '1') { let j = i; while (j < bits.length && bits[j] === '1') j++; const guard = i < 3 || (i >= 45 && i < 50) || i >= 92; doc.rect(x + (quiet + i) * mod, y, (j - i) * mod, h + (guard ? mod * 5 : 0), 'F'); i = j; }
    else i++;
  }
  const fs = Math.min(9, mod * 9 * 2.6); doc.setFont('helvetica', 'normal'); doc.setFontSize(fs); doc.setTextColor(0);
  const ty = y + h + fs * 0.36 + mod * 2;
  doc.text(code[0], x + (quiet - 2) * mod, ty, { align: 'right' });
  doc.text(code.slice(1, 7), x + (quiet + 3 + 21) * mod, ty, { align: 'center' });
  doc.text(code.slice(7), x + (quiet + 50 + 21) * mod, ty, { align: 'center' });
}

const FORMATOS_ETIQUETA = {
  carta: { nombre: 'Hoja carta · 30 etiquetas (3 × 10)', pagina: 'letter', cols: 3, filas: 10, w: 66.7, h: 25.4, mx: 4.8, my: 12.7, gx: 3.2, gy: 0 },
  rollo: { nombre: 'Rollo térmico 50 × 25 mm', pagina: [50, 25], cols: 1, filas: 1, w: 50, h: 25, mx: 0, my: 0, gx: 0, gy: 0 },
};
async function etiquetasPDF(lista, formato) {
  await lib('pdf');
  const F = FORMATOS_ETIQUETA[formato]; const { jsPDF } = window.jspdf; const negocio = cfg().nombre;
  const doc = new jsPDF({ unit: 'mm', format: F.pagina, orientation: formato === 'rollo' ? 'landscape' : 'portrait' });
  const porHoja = F.cols * F.filas; let n = 0;
  lista.forEach(({ p, cantidad }) => {
    for (let k = 0; k < cantidad; k++) {
      if (n && n % porHoja === 0) doc.addPage(F.pagina, formato === 'rollo' ? 'landscape' : 'portrait');
      const i = n % porHoja; const col = i % F.cols; const fila = Math.floor(i / F.cols);
      const x = F.mx + col * (F.w + F.gx); const y = F.my + fila * (F.h + F.gy);
      const pad = 2.2;
      doc.setTextColor(110); doc.setFont('helvetica', 'normal'); doc.setFontSize(5.5);
      doc.text(negocio.toUpperCase(), x + pad, y + pad + 1.6);
      doc.setTextColor(0); doc.setFont('helvetica', 'bold'); doc.setFontSize(7.2);
      const nombre = doc.splitTextToSize(p.nombre, F.w - 2 * pad - 17)[0];
      doc.text(nombre, x + pad, y + pad + 4.8);
      doc.setFontSize(9.5); doc.text(money(p.precio), x + F.w - pad, y + pad + 4.8, { align: 'right' });
      dibujarEAN(doc, p.codigo, x + pad, y + pad + 6.6, F.w - 2 * pad, F.h - pad * 2 - 11.5);
      n++;
    }
  });
  return doc.output('blob');
}

Acciones.etiquetas = el => {
  const preId = el && el.dataset && el.dataset.id;
  const ps = productosActivos();
  const cant = {}; ps.forEach(p => cant[p.id] = preId ? (p.id === preId ? 1 : 0) : 0);
  let formato = 'carta';
  const fila = p => `<div class="item"><span class="item-main"><span class="item-title">${esc(p.nombre)}</span><span class="item-sub num">${esEAN13(p.codigo || '') ? esc(p.codigo) : p.codigo ? `<span class="warn-text">${esc(p.codigo)} · se le asigna un código nuevo</span>` : '<span class="warn-text">Sin código · se le asigna uno</span>'} · stock ${num(stockDe(p))}</span></span>
    <input class="qty-in" type="number" min="0" inputmode="numeric" value="${cant[p.id] || ''}" placeholder="0" data-et="${p.id}" aria-label="Etiquetas de ${esc(p.nombre)}"></div>`;
  Modal.open(`<div class="form">
    <p class="muted-text">Imprime etiquetas con código de barras para los productos que no traen uno, o para marcar el precio. Los productos sin un código EAN-13 válido reciben un código interno que empieza por 2.</p>
    <div class="field"><label>Formato</label><div class="seg" id="et-fmt">${Object.entries(FORMATOS_ETIQUETA).map(([k, f], i) => `<button type="button" class="${i === 0 ? 'on' : ''}" data-f="${k}">${esc(f.nombre)}</button>`).join('')}</div></div>
    <div class="row-btns"><button type="button" class="btn ghost sm" id="et-stock">Una por unidad en stock</button><button type="button" class="btn ghost sm" id="et-uno">Una de cada</button><button type="button" class="btn ghost sm" id="et-cero">Ninguna</button></div>
    <div class="list compact" id="et-list">${ps.map(fila).join('')}</div>
    <div class="sumline"><span id="et-tot"></span></div>
    <button class="btn primary block lg" id="et-go">${icon('download')}Generar PDF de etiquetas</button></div>`, {
    title: 'Etiquetas de código de barras', wide: true,
    onOpen(body, close) {
      const tot = () => { const n = sum(Object.values(cant), v => v); const h = FORMATOS_ETIQUETA[formato].cols * FORMATOS_ETIQUETA[formato].filas; $('#et-tot', body).textContent = `${n} etiquetas${formato === 'carta' && n ? ` · ${Math.ceil(n / h)} ${Math.ceil(n / h) === 1 ? 'hoja' : 'hojas'}` : ''}`; $('#et-go', body).disabled = !n; };
      const pintar = () => { $('#et-list', body).innerHTML = ps.map(fila).join(''); tot(); };
      $('#et-list', body).addEventListener('input', e => { const id = e.target.dataset.et; if (id) { cant[id] = Math.max(0, Math.floor(parseQty(e.target.value))); tot(); } });
      $$('#et-fmt button', body).forEach(b => b.onclick = () => { formato = b.dataset.f; $$('#et-fmt button', body).forEach(x => x.classList.toggle('on', x === b)); tot(); });
      $('#et-stock', body).onclick = () => { ps.forEach(p => cant[p.id] = Math.max(stockDe(p), 0)); pintar(); };
      $('#et-uno', body).onclick = () => { ps.forEach(p => cant[p.id] = 1); pintar(); };
      $('#et-cero', body).onclick = () => { ps.forEach(p => cant[p.id] = 0); pintar(); };
      tot();
      $('#et-go', body).onclick = async () => {
        const elegidos = ps.filter(p => cant[p.id] > 0);
        const sinCodigo = elegidos.filter(p => !esEAN13(p.codigo || ''));
        if (sinCodigo.length && !(await confirmar(`${sinCodigo.length} ${sinCodigo.length === 1 ? 'producto no tiene' : 'productos no tienen'} un código de barras válido. Se les asignará un código interno nuevo (el código anterior se reemplaza).`, { si: 'Asignar y generar' }))) return;
        const ok = await run(async () => {
          const ops = sinCodigo.map(p => { const c = nuevoCodigoInterno(); p.codigo = c; return { t: 'update', col: 'productos', id: p.id, data: { codigo: c } }; });
          if (ops.length) await DB.commit(ops);
          const blob = await etiquetasPDF(elegidos.map(p => ({ p: DB.get('productos', p.id) || p, cantidad: cant[p.id] })), formato);
          await entregarArchivo(blob, `etiquetas-${dayKey()}.pdf`);
          return true;
        });
        if (ok) { toast('Etiquetas generadas'); close(); }
      };
    },
  });
};
