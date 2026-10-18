/* Arranque: estructura de la app, inicio de sesión, eventos y modo sin conexión */
'use strict';

function montarShell() {
  const c = cfg(); const logo = window.LOGO_SRC || 'logo-sm.png';
  document.title = c.nombre;
  $('#root').innerHTML = `<div class="app">
    <aside class="sidenav">
      <div class="brand"><img src="${logo}" alt=""><span id="brand-name">${esc(c.nombre)}</span></div>
      <nav>${NAV.filter(n => !n.soloMovil).map(n => `<button data-a="nav" data-nav="${n.id}">${icon(n.i)}<span>${n.t}</span>${n.admin ? `<span class="nav-lock" data-lock>${icon('lock', 'sm')}</span>` : ''}</button>`).join('')}</nav>
      <div class="side-foot"><span class="sync" data-sync></span></div>
    </aside>
    <div class="main">
      <header class="topbar">
        <div class="tb-left"><img class="tb-logo" src="${logo}" alt=""><h1 id="page-title"></h1></div>
        <div class="tb-right"><span class="sync" data-sync></span><button id="lock-btn" class="icon-btn" data-a="bloquear" hidden></button></div>
      </header>
      <main id="view"></main>
    </div>
    <nav class="tabbar">${NAV.filter(n => n.tab).map(n => `<button data-a="nav" data-nav="${n.id}">${icon(n.i)}<span>${n.t}</span></button>`).join('')}</nav>
  </div>`;
  pintarSync(DB.syncState());
}

function pintarSync(s) {
  $$('[data-sync]').forEach(el => {
    let cls = 'ok', ic = 'cloud', t = 'Guardado';
    if (s.mode === 'demo') { cls = 'demo'; ic = 'cloudOff'; t = 'Modo demo'; }
    else if (!s.online) { cls = 'off'; ic = 'cloudOff'; t = s.pending ? `Sin internet · ${s.pending} por subir` : 'Sin internet'; }
    else if (s.pending) { cls = 'busy'; ic = 'cloud'; t = 'Guardando…'; }
    el.className = 'sync ' + cls; el.innerHTML = `${icon(ic)}<span>${t}</span>`;
    el.title = s.mode === 'demo' ? 'Los datos se guardan solo en este navegador' : !s.online ? 'Puedes seguir trabajando. Los cambios se suben solos cuando vuelva la conexión.' : 'Todo está guardado en la nube';
  });
}

function pantallaLogin(error) {
  const logo = window.LOGO_SRC || 'logo-sm.png';
  $('#root').innerHTML = `<div class="login">
    <form id="login-form" class="login-card">
      <img src="${logo}" alt="" class="login-logo">
      <h1>${esc(cfg().nombre)}</h1>
      <p class="muted-text">Ingresa con la cuenta del negocio</p>
      <div class="field"><label for="lg-email">Correo</label><input id="lg-email" type="email" autocomplete="username" required autofocus></div>
      <div class="field"><label for="lg-pass">Contraseña</label><input id="lg-pass" type="password" autocomplete="current-password" required></div>
      <p class="form-error" id="lg-err" ${error ? '' : 'hidden'}>${esc(error || '')}</p>
      <button class="btn primary block lg" type="submit" id="lg-go">Entrar</button>
      <button class="link-btn" type="button" id="lg-reset">Olvidé mi contraseña</button>
    </form></div>`;
  const err = m => { const e = $('#lg-err'); e.textContent = m; e.hidden = !m; };
  $('#login-form').onsubmit = async e => {
    e.preventDefault(); err(''); $('#lg-go').disabled = true; $('#lg-go').textContent = 'Entrando…';
    try { await DB.login($('#lg-email').value.trim(), $('#lg-pass').value); }
    catch (x) {
      const code = x.code || '';
      err(code.includes('invalid') || code.includes('wrong-password') || code.includes('user-not-found') ? 'Correo o contraseña incorrectos.' : code.includes('network') ? 'No hay conexión a internet. La primera vez necesitas internet para entrar.' : code.includes('too-many') ? 'Demasiados intentos. Espera unos minutos.' : 'No se pudo entrar: ' + (x.message || code));
      $('#lg-go').disabled = false; $('#lg-go').textContent = 'Entrar';
    }
  };
  $('#lg-reset').onclick = async () => {
    const email = $('#lg-email').value.trim(); if (!email) { err('Escribe tu correo primero.'); return; }
    try { await DB.resetPass(email); err(''); toast('Te enviamos un correo para cambiar la contraseña'); } catch (x) { err('No se pudo enviar el correo: ' + (x.code || x.message)); }
  };
}

function rutaDesdeHash() {
  const r = location.hash.slice(1);
  App.ruta = Pantallas[r] ? r : 'inicio';
}

let _eventosListos = false;
function eventos() {
  if (_eventosListos) return; _eventosListos = true;
  document.addEventListener('click', e => {
    const el = e.target.closest('[data-a]'); if (!el) return;
    const fn = Acciones[el.dataset.a]; if (!fn) return;
    if (!el.dataset.pass) e.preventDefault();
    if (el.disabled) return;
    fn(el, e);
  });
  document.addEventListener('input', e => { const el = e.target.closest('[data-in]'); if (el && INPUTS[el.dataset.in]) INPUTS[el.dataset.in](el, e); });
  document.addEventListener('change', e => { const el = e.target.closest('[data-ch]'); if (el && Acciones[el.dataset.ch]) Acciones[el.dataset.ch](el, e); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && Modal.isOpen()) Modal.closeTop();
    if (e.key === 'Enter') { const el = e.target.closest && e.target.closest('[data-enter]'); if (el && Acciones[el.dataset.enter]) { e.preventDefault(); Acciones[el.dataset.enter](el, e); } }
  });
  document.addEventListener('focusout', () => setTimeout(() => { const a = document.activeElement; if (App.dirty && !Modal.isOpen() && !(a && /INPUT|TEXTAREA|SELECT/.test(a.tagName))) App.render(); }, 250));
  window.addEventListener('hashchange', () => { rutaDesdeHash(); if (Modal.isOpen()) Modal.stack.slice().forEach(m => m.close()); App.render(); });
}

async function boot() {
  try {
    await DB.init(window.FIREBASE_CONFIG);
  } catch (e) {
    console.error(e);
    $('#root').innerHTML = `<div class="login"><div class="login-card"><h1>No se pudo iniciar</h1><p>${esc(e.message || e)}</p><p class="muted-text">Revisa la conexión a internet y la configuración de Firebase.</p><button class="btn primary" onclick="location.reload()">Reintentar</button></div></div>`;
    return;
  }
  DB.onSync(pintarSync);
  eventos();
  let suscrito = false;
  DB.onAuth(user => {
    if (!user) { pantallaLogin(); return; }
    if (DB.mode === 'demo' && !DB.demoSeeded) { sembrarDemo(); DB.demoSeeded = true; }
    montarShell(); rutaDesdeHash(); App.render();
    if (!suscrito) { suscrito = true; DB.onChange(() => App.onData()); }
  });
  if ('serviceWorker' in navigator && location.protocol === 'https:' && !window.SIN_SW) {
    navigator.serviceWorker.register('sw.js').catch(() => { });
  }
}

boot();
