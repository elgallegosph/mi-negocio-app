/* Utilidades generales: formato, fechas, diálogos, íconos */
'use strict';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const _fmtMoney = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 });
function money(n) {
  const v = Math.round(Number(n) || 0);
  return (v < 0 ? '-$' : '$') + _fmtMoney.format(Math.abs(v));
}
function num(n) { return _fmtMoney.format(Math.round(Number(n) || 0)); }

/* "12.500" -> 12500 ; acepta números o texto con puntos/comas */
function parseMoney(v) {
  if (typeof v === 'number') return Math.round(v);
  const s = String(v ?? '').trim();
  if (!s) return 0;
  const neg = s.startsWith('-');
  const digits = s.replace(/[^\d]/g, '');
  return (neg ? -1 : 1) * (parseInt(digits, 10) || 0);
}
function parseQty(v) {
  const n = parseFloat(String(v ?? '').replace(',', '.'));
  return isFinite(n) ? n : 0;
}

/* Fechas en hora local del dispositivo */
function pad2(n) { return String(n).padStart(2, '0'); }
function dayKey(d = new Date()) {
  d = new Date(d);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function parseDay(key) { const [y, m, d] = key.split('-').map(Number); return new Date(y, m - 1, d); }
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const MESES_L = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
function fmtFecha(iso) { const d = new Date(iso); return `${d.getDate()} ${MESES[d.getMonth()]} ${d.getFullYear()}`; }
function fmtHora(iso) {
  const d = new Date(iso); let h = d.getHours(); const ap = h >= 12 ? 'p.m.' : 'a.m.'; h = h % 12 || 12;
  return `${h}:${pad2(d.getMinutes())} ${ap}`;
}
function fmtFechaHora(iso) { return `${fmtFecha(iso)}, ${fmtHora(iso)}`; }
function fmtFechaCorta(iso) {
  const d = new Date(iso); const hoy = dayKey(); const k = dayKey(d);
  if (k === hoy) return 'Hoy ' + fmtHora(iso);
  if (k === dayKey(addDays(new Date(), -1))) return 'Ayer ' + fmtHora(iso);
  return `${d.getDate()} ${MESES[d.getMonth()]} · ${fmtHora(iso)}`;
}
function diasDesde(iso) { return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000); }

function telLimpio(t) { return String(t || '').replace(/\D/g, ''); }
function waLink(tel, texto, codigoPais = '57') {
  let n = telLimpio(tel);
  if (n.length === 10) n = codigoPais + n;
  return `https://wa.me/${n}${texto ? '?text=' + encodeURIComponent(texto) : ''}`;
}

function debounce(fn, ms = 120) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
function sum(arr, f = x => x) { return arr.reduce((s, x) => s + (Number(f(x)) || 0), 0); }
function groupBy(arr, f) { const m = new Map(); for (const x of arr) { const k = f(x); if (!m.has(k)) m.set(k, []); m.get(k).push(x); } return m; }
function norm(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }

/* ---------- Íconos (trazos de 24px) ---------- */
const ICONS = {
  home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M10 21v-6h4v6"/>',
  cart: '<circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/><path d="M2.5 3.5h3l2.4 11.2a1.5 1.5 0 0 0 1.5 1.2h8.3a1.5 1.5 0 0 0 1.5-1.1L21 7.5H6.4"/>',
  box: '<path d="M21 8 12 3 3 8v8l9 5 9-5Z"/><path d="m3 8 9 5 9-5"/><path d="M12 13v8"/>',
  cash: '<rect x="2.5" y="6" width="19" height="12" rx="2"/><circle cx="12" cy="12" r="2.6"/><path d="M6 9.5v5M18 9.5v5"/>',
  more: '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18.5 14.8c1.7.7 2.7 2.4 3 5.2"/>',
  receipt: '<path d="M6 2.5h12v19l-3-2-3 2-3-2-3 2Z"/><path d="M9 7.5h6M9 11h6M9 14.5h4"/>',
  chart: '<path d="M3.5 3.5v17h17"/><path d="M8 16v-5M12.5 16V8M17 16v-8"/>',
  wallet: '<path d="M19 7V5.5A1.5 1.5 0 0 0 17.5 4h-12A2.5 2.5 0 0 0 3 6.5v11A2.5 2.5 0 0 0 5.5 20h14a1.5 1.5 0 0 0 1.5-1.5V9a2 2 0 0 0-2-2H5.5"/><circle cx="16.5" cy="13.5" r="1.2"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1Z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  check: '<path d="m4.5 12.5 5 5 10-11"/>',
  edit: '<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16Z"/><path d="m13.5 6.5 4 4"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  download: '<path d="M12 4v11M7 10.5l5 5 5-5M4.5 20h15"/>',
  upload: '<path d="M12 20V9M7 13.5l5-5 5 5M4.5 4h15"/>',
  in: '<path d="M12 3v12M7 10l5 5 5-5"/><path d="M4 21h16"/>',
  out: '<path d="M12 15V3M7 8l5-5 5 5"/><path d="M4 21h16"/>',
  alert: '<path d="M12 3 2.5 20h19Z"/><path d="M12 10v4.5M12 17.5v.01"/>',
  lock: '<rect x="4.5" y="10.5" width="15" height="10" rx="2"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/>',
  unlock: '<rect x="4.5" y="10.5" width="15" height="10" rx="2"/><path d="M8 10.5V7.5a4 4 0 0 1 7.6-1.8"/>',
  whatsapp: '<path d="M4 20l1.2-4A8 8 0 1 1 8 18.8Z"/><path d="M9 8.6c0 3.2 2.4 6.2 6 6.6l1-1.4-1.8-1-1 .8a4.6 4.6 0 0 1-2.4-2.4l.8-1-1-1.8Z"/>',
  share: '<circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="m8.3 10.8 7.4-4.4M8.3 13.2l7.4 4.4"/>',
  adjust: '<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
  list: '<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/>',
  clipboard: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V2.8h6V4M9 10h6M9 14h6M9 18h3"/>',
  tag: '<path d="M3 12V4h8l10 10-8 8Z"/><circle cx="7.5" cy="8.5" r="1.3"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  chevron: '<path d="m9 5 7 7-7 7"/>',
  cloud: '<path d="M7 18.5a4.5 4.5 0 0 1-.6-9 6 6 0 0 1 11.6 1.5 3.8 3.8 0 0 1-.5 7.5Z"/>',
  cloudOff: '<path d="M3 3l18 18"/><path d="M7 18.5a4.5 4.5 0 0 1-1-8.9M10 6a6 6 0 0 1 8 5 3.8 3.8 0 0 1 2 6.1"/>',
  ban: '<circle cx="12" cy="12" r="8.5"/><path d="m6 6 12 12"/>',
  logout: '<path d="M14 4h5v16h-5"/><path d="M10 8l-4 4 4 4M6 12h11"/>',
  bag: '<path d="M5 8h14l-1 13H6Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
  scan: '<path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16"/><path d="M8 8.5v7M11 8.5v7M13.5 8.5v7M16 8.5v7"/>',
  barcode: '<path d="M3.5 5v14M6.5 5v14M9.5 5v14M11.5 5v14M14.5 5v14M17.5 5v14M20.5 5v14"/>',
  truck: '<path d="M2.5 6h11v10h-11zM13.5 10h4l3 3v3h-7"/><circle cx="6.5" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/>',
};
function icon(name, cls = '') {
  return `<svg class="ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;
}

/* ---------- Avisos ---------- */
function toast(msg, tipo = 'ok', ms = 2800) {
  let box = $('#toasts');
  if (!box) { box = document.createElement('div'); box.id = 'toasts'; document.body.appendChild(box); }
  const el = document.createElement('div');
  el.className = 'toast ' + tipo;
  el.innerHTML = `${icon(tipo === 'error' ? 'alert' : tipo === 'warn' ? 'alert' : 'check')}<span>${esc(msg)}</span>`;
  box.appendChild(el);
  while (box.children.length > 2) box.firstElementChild.remove();
  requestAnimationFrame(() => el.classList.add('in'));
  setTimeout(() => { el.classList.remove('in'); setTimeout(() => el.remove(), 300); }, ms);
}

/* ---------- Ventanas (hoja inferior en móvil) ---------- */
const Modal = {
  stack: [],
  open(html, opts = {}) {
    const wrap = document.createElement('div');
    wrap.className = 'modal-wrap';
    wrap.innerHTML = `<div class="modal-bg"></div><div class="modal ${opts.wide ? 'wide' : ''}" role="dialog" aria-modal="true">
      <div class="modal-head"><h2>${esc(opts.title || '')}</h2><button class="icon-btn" data-close aria-label="Cerrar">${icon('x')}</button></div>
      <div class="modal-body">${html}</div></div>`;
    document.body.appendChild(wrap);
    document.body.classList.add('no-scroll');
    const close = (val) => {
      if (!wrap.isConnected) return;
      wrap.classList.remove('in');
      setTimeout(() => wrap.remove(), 200);
      Modal.stack = Modal.stack.filter(m => m !== entry);
      if (!Modal.stack.length) document.body.classList.remove('no-scroll');
      opts.onClose && opts.onClose(val);
      if (!Modal.stack.length && typeof App !== 'undefined') App.flushDirty();
    };
    const entry = { wrap, close };
    Modal.stack.push(entry);
    wrap.querySelector('.modal-bg').onclick = () => close();
    wrap.querySelector('[data-close]').onclick = () => close();
    requestAnimationFrame(() => wrap.classList.add('in'));
    const body = wrap.querySelector('.modal-body');
    opts.onOpen && opts.onOpen(body, close);
    const first = body.querySelector('[autofocus]');
    if (first) setTimeout(() => first.focus(), 60);
    return { body, close };
  },
  closeTop() { const m = Modal.stack[Modal.stack.length - 1]; m && m.close(); },
  isOpen() { return Modal.stack.length > 0; },
};

function confirmar(texto, { titulo = 'Confirmar', si = 'Sí, continuar', no = 'Cancelar', peligro = false } = {}) {
  return new Promise(res => {
    let decided = false;
    Modal.open(`<p class="confirm-text">${esc(texto)}</p>
      <div class="row-btns"><button class="btn ghost" data-no>${esc(no)}</button><button class="btn ${peligro ? 'danger' : 'primary'}" data-si>${esc(si)}</button></div>`,
      {
        title: titulo,
        onOpen(body, close) {
          body.querySelector('[data-no]').onclick = () => { decided = true; close(); res(false); };
          body.querySelector('[data-si]').onclick = () => { decided = true; close(); res(true); };
        },
        onClose() { if (!decided) res(false); },
      });
  });
}

/* Campo de dinero: muestra separador de miles mientras se escribe */
function bindMoneyInputs(root) {
  $$('input[data-money]', root).forEach(inp => {
    const fmt = () => {
      const raw = inp.value;
      if (raw.trim() === '') return;
      const n = parseMoney(raw);
      const s = num(n);
      if (s !== raw) { inp.value = s; }
    };
    inp.addEventListener('input', fmt);
    inp.addEventListener('focus', () => setTimeout(() => inp.select(), 0));
    fmt();
  });
}

/* Descarga o comparte un archivo */
async function entregarArchivo(blob, nombre, { compartir = false, titulo = '', texto = '' } = {}) {
  blob = blob.type ? blob : new Blob([blob], { type: 'application/pdf' });
  if (compartir && navigator.canShare) {
    try {
      const file = new File([blob], nombre, { type: blob.type });
      if (navigator.canShare({ files: [file] })) {
        const datos = { files: [file], title: titulo || nombre };
        if (texto) datos.text = texto;
        await navigator.share(datos); return 'compartido';
      }
    } catch (e) {
      if (e && e.name === 'AbortError') return false; // la persona cerró el menú de compartir
      console.warn('No se pudo compartir, se descarga', e);
    }
  }
  if (window.claude && typeof window.claude.use === 'function') { // vista previa dentro de Claude
    const dl = await window.claude.use('downloads').catch(() => null);
    if (dl) {
      try { await dl.save({ filename: nombre, data: blob }); return 'descargado'; }
      catch (e) { if (e && e.code !== 'declined') toast('No se pudo descargar el archivo aquí.', 'warn'); return false; }
    }
  }
  const url = URL.createObjectURL(blob);
  const iosApp = /iPhone|iPad|iPod/.test(navigator.userAgent) && (navigator.standalone || matchMedia('(display-mode: standalone)').matches);
  if (iosApp) { window.open(url, '_blank'); setTimeout(() => URL.revokeObjectURL(url), 60000); return 'descargado'; }
  const a = document.createElement('a'); a.href = url; a.download = nombre; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 4000);
  return 'descargado';
}

async function copiarTexto(t) {
  try { await navigator.clipboard.writeText(t); toast('Copiado'); return true; }
  catch { toast('No se pudo copiar. Mantén presionado el texto para copiarlo.', 'warn'); return false; }
}
