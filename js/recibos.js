/* Recibos para enviar: venta, comprobante de cada pago y estado de cuenta.
   El PDF se prepara apenas se abre la ventana, así al tocar "Enviar" el celular abre el menú de compartir
   enseguida (si se tarda, el navegador ya no deja compartir). */
'use strict';

function slug(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w]+/g, '-').replace(/^-|-$/g, '') || 'cliente'; }
function abonosDe(ventaId) { return DB.all('abonos').filter(a => a.ventaId === ventaId && !a.anulado).sort((a, b) => a.fecha.localeCompare(b.fecha)); }

/* ---------- Comprobante de un pago (abono) ---------- */
async function comprobanteAbonoPDF(a) {
  await lib('pdf');
  const logo = await logoDataURL();
  const v = DB.get('ventas', a.ventaId);
  const lista = abonosDe(a.ventaId); const k = lista.findIndex(x => x.id === a.id) + 1;
  const pagadoHasta = sum(lista.slice(0, k), x => x.valor);
  const saldoDespues = Math.max((v ? v.total : 0) - pagadoHasta, 0);
  const saldoAntes = saldoDespues + a.valor;
  const doc = tiquete(t => {
    encabezadoNegocio(t);
    t.line();
    t.text('COMPROBANTE DE PAGO', { bold: true, size: 10.5, align: 'center' });
    t.text(`N° ${v ? v.numero : a.ventaNumero}-${k || 1}`, { align: 'center', size: 9 });
    t.text(fmtFechaHora(a.fecha), { align: 'center', size: 8 });
    t.line();
    t.row('Cliente', a.clienteNombre || (v && v.clienteNombre) || '', { size: 8.5 });
    if (v && v.clienteTel) t.row('Teléfono', v.clienteTel, { size: 8 });
    t.row('Cuenta', `${v && v.tipo === 'separado' ? 'Separado' : 'Venta'} N° ${v ? v.numero : a.ventaNumero} del ${v ? fmtFecha(v.fecha) : ''}`, { size: 8 });
    t.line();
    t.row('VALOR RECIBIDO', money(a.valor), { bold: true, size: 11.5 });
    t.row('Medio de pago', a.metodo || '');
    t.gap(1);
    t.row('Saldo anterior', money(saldoAntes));
    t.row('Este pago', '-' + money(a.valor));
    t.row(saldoDespues > 0 ? 'SALDO PENDIENTE' : 'SALDO', money(saldoDespues), { bold: true, size: 10.5 });
    if (saldoDespues <= 0) t.text('Cuenta pagada en su totalidad. ¡Gracias!', { align: 'center', bold: true, size: 9 });
    if (v) {
      t.line();
      t.text('DETALLE DE LA COMPRA', { bold: true, size: 8 });
      v.items.forEach(i => t.row(`${i.cantidad} x ${i.nombre}`, money(i.cantidad * i.precio), { size: 8 }));
      if (v.descuento) t.row('Descuento', '-' + money(v.descuento), { size: 8 });
      t.row('Total de la compra', money(v.total), { bold: true, size: 8.5 });
      if (lista.length > 1) {
        t.line();
        t.text('PAGOS REALIZADOS', { bold: true, size: 8 });
        lista.slice(0, k).forEach((x, i) => t.row(`${i + 1}. ${fmtFecha(x.fecha)} · ${x.metodo}`, money(x.valor), { size: 8 }));
      }
      if (v.tipo === 'separado') t.text(v.entregado ? 'Producto entregado.' : saldoDespues > 0 ? 'El producto se entrega al completar el pago.' : 'Ya puedes reclamar tu producto.', { size: 8 });
    }
    t.line();
    if (cfg().piePagina) t.text(cfg().piePagina, { align: 'center', size: 8 });
    t.gap(2);
  }, logo);
  return doc.output('blob');
}

/* ---------- Estado de cuenta de una clienta ---------- */
async function estadoCuentaPDF(clienteId) {
  await lib('pdf');
  const logo = await logoDataURL();
  const c = DB.get('clientes', clienteId);
  const vs = ventasConSaldo().filter(v => v.clienteId === clienteId);
  const total = sum(vs, v => v.saldo);
  const doc = tiquete(t => {
    encabezadoNegocio(t);
    t.line();
    t.text('ESTADO DE CUENTA', { bold: true, size: 10.5, align: 'center' });
    t.text(`Corte: ${fmtFechaHora(new Date().toISOString())}`, { align: 'center', size: 8 });
    t.line();
    t.row('Cliente', (c && c.nombre) || (vs[0] && vs[0].clienteNombre) || '', { size: 8.5 });
    if (c && c.tel) t.row('Teléfono', c.tel, { size: 8 });
    vs.forEach(v => {
      t.line();
      t.row(`${v.tipo === 'separado' ? 'Separado' : 'Compra'} N° ${v.numero}`, fmtFecha(v.fecha), { bold: true, size: 8.5 });
      v.items.forEach(i => t.row(`  ${i.cantidad} x ${i.nombre}`, money(i.cantidad * i.precio), { size: 7.5 }));
      t.row('  Total', money(v.total), { size: 8 });
      abonosDe(v.id).forEach(a => t.row(`  Pago ${fmtFecha(a.fecha)}`, '-' + money(a.valor), { size: 7.5 }));
      t.row('  Saldo', money(v.saldo), { bold: true, size: 8.5 });
    });
    t.line(false);
    t.row('TOTAL PENDIENTE', money(total), { bold: true, size: 11.5 });
    if (cfg().telefono) t.text(`Puedes abonar en la tienda o por transferencia. Dudas: ${cfg().telefono}`, { size: 8, align: 'center' });
    t.gap(2);
  }, logo);
  return doc.output('blob');
}

/* ---------- Preparar y entregar ---------- */
const _pdfs = new Map();
function specPDF(tipo, id) {
  const neg = slug(cfg().nombre);
  if (tipo === 'recibo') {
    const v = DB.get('ventas', id); if (!v) throw new Error('No se encontró la venta.');
    return { clave: `r:${id}:${v.abonado}:${v.estado}:${v.entregado}`, gen: () => reciboPDF(v), nombre: `Recibo-${v.numero}-${slug(v.clienteNombre || 'venta')}.pdf`, texto: `Recibo N° ${v.numero} de ${cfg().nombre}` };
  }
  if (tipo === 'abono') {
    const a = DB.get('abonos', id); if (!a) throw new Error('No se encontró el pago.');
    const k = abonosDe(a.ventaId).findIndex(x => x.id === id) + 1;
    return { clave: `a:${id}`, gen: () => comprobanteAbonoPDF(a), nombre: `Pago-${a.ventaNumero}-${k}-${slug(a.clienteNombre)}.pdf`, texto: `Comprobante de pago de ${cfg().nombre}` };
  }
  if (tipo === 'cuenta') {
    const vs = ventasConSaldo().filter(v => v.clienteId === id);
    const c = DB.get('clientes', id);
    return { clave: `c:${id}:${sum(vs, v => v.saldo)}:${vs.length}`, gen: () => estadoCuentaPDF(id), nombre: `Estado-de-cuenta-${slug(c ? c.nombre : '')}-${dayKey()}.pdf`, texto: `Estado de cuenta en ${cfg().nombre}` };
  }
  void neg;
  throw new Error('Documento desconocido.');
}
function prepararPDF(tipo, id) {
  try {
    const s = specPDF(tipo, id);
    if (!_pdfs.has(s.clave)) _pdfs.set(s.clave, s.gen().catch(e => { _pdfs.delete(s.clave); throw e; }));
    return _pdfs.get(s.clave);
  } catch (e) { return Promise.reject(e); }
}

let _puedeCompartir = null;
function puedeCompartirArchivos() {
  if (_puedeCompartir !== null) return _puedeCompartir;
  try { _puedeCompartir = !!(navigator.canShare && navigator.canShare({ files: [new File(['x'], 'x.pdf', { type: 'application/pdf' })] })); }
  catch { _puedeCompartir = false; }
  return _puedeCompartir;
}

Acciones.pdf = async el => {
  const { tipo, id, modo } = el.dataset;
  const label = el.innerHTML; el.disabled = true;
  const t = setTimeout(() => { el.innerHTML = `${icon('download')}Preparando PDF…`; }, 250);
  try {
    const s = specPDF(tipo, id);
    const blob = await prepararPDF(tipo, id);
    const r = await entregarArchivo(blob, s.nombre, { compartir: modo === 'share', titulo: s.nombre.replace(/\.pdf$/, ''), texto: s.texto });
    if (r === 'descargado') toast(modo === 'share' ? 'PDF descargado. Adjúntalo en el chat de WhatsApp.' : 'PDF descargado', 'ok', 4000);
  } catch (e) { console.error(e); toast(e.message || 'No se pudo generar el PDF.', 'error', 5000); }
  finally { clearTimeout(t); el.disabled = false; el.innerHTML = label; }
};

/* Botones para enviar un documento. En celular: menú de compartir (WhatsApp, correo…). En computador: descargar. */
function botonesPDF(tipo, id, { etiqueta = 'recibo', tel = '', textoWA = '' } = {}) {
  prepararPDF(tipo, id).catch(() => { });
  const c = cfg();
  const comp = puedeCompartirArchivos();
  return `<div class="pdf-box">
    ${comp ? `<button class="btn wa block lg" data-a="pdf" data-tipo="${tipo}" data-id="${id}" data-modo="share">${icon('share')}Enviar ${etiqueta} en PDF</button>
      <p class="hint center">Se abre el menú de compartir: elige WhatsApp y el chat de la clienta.</p>`
    : `<button class="btn primary block lg" data-a="pdf" data-tipo="${tipo}" data-id="${id}" data-modo="download">${icon('download')}Descargar ${etiqueta} en PDF</button>`}
    <div class="row-btns">
      ${tel && textoWA ? `<a class="btn ghost" href="${esc(waLink(tel, textoWA, c.codigoPais))}" target="_blank" rel="noopener">${icon('whatsapp')}Mensaje de texto</a>` : ''}
      ${comp ? `<button class="btn ghost" data-a="pdf" data-tipo="${tipo}" data-id="${id}" data-modo="download">${icon('download')}Descargar</button>` : ''}
    </div></div>`;
}

/* Precarga la herramienta de PDF y el logo apenas abre la app (y quedan guardados para usar sin internet) */
function precargarPDF() { setTimeout(() => { lib('pdf').catch(() => { }); logoDataURL(); }, 2000); }
