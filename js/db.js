/* Capa de datos.
   - Modo Firebase: Firestore con caché local (funciona sin internet) + inicio de sesión.
   - Modo demo: todo se guarda en este navegador (localStorage). Sirve para probar.
   Las pantallas solo usan: DB.all, DB.get, DB.commit, DB.nextNumber, DB.onChange. */
'use strict';

const FB_VER = '10.12.2';
const COLECCIONES = ['config', 'productos', 'movimientos', 'ventas', 'abonos', 'clientes', 'gastos', 'cajas', 'cajaMovs'];

const DB = {
  mode: 'demo',
  cache: {},
  user: null,
  pending: 0,
  online: navigator.onLine,
  _subs: new Set(),
  _syncSubs: new Set(),
  _fs: null, _db: null, _auth: null, _au: null, _unsubs: [],

  newId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); },
  all(col) { return Array.from((this.cache[col] || new Map()).values()); },
  get(col, id) { return (this.cache[col] || new Map()).get(id) || null; },
  onChange(fn) { this._subs.add(fn); return () => this._subs.delete(fn); },
  onSync(fn) { this._syncSubs.add(fn); fn(this.syncState()); },
  syncState() { return { mode: this.mode, online: this.online, pending: this.pending }; },
  _emit: debounce(function (cols) { DB._subs.forEach(f => { try { f(cols); } catch (e) { console.error(e); } }); }, 60),
  _emitSync() { const s = this.syncState(); this._syncSubs.forEach(f => f(s)); },

  /* ---------- Arranque ---------- */
  async init(cfg) {
    COLECCIONES.forEach(c => this.cache[c] = new Map());
    window.addEventListener('online', () => { this.online = true; this._emitSync(); });
    window.addEventListener('offline', () => { this.online = false; this._emitSync(); });
    if (cfg && cfg.apiKey && cfg.projectId) {
      this.mode = 'firebase';
      await this._initFirebase(cfg);
    } else {
      this.mode = 'demo';
      this._loadDemo();
    }
    this._emitSync();
  },

  /* ---------- Firebase ---------- */
  async _initFirebase(cfg) {
    const base = `https://www.gstatic.com/firebasejs/${FB_VER}/`;
    const [appMod, fs, au] = await Promise.all([
      import(base + 'firebase-app.js'), import(base + 'firebase-firestore.js'), import(base + 'firebase-auth.js'),
    ]);
    const app = appMod.initializeApp(cfg);
    let db;
    try {
      db = fs.initializeFirestore(app, {
        ignoreUndefinedProperties: true,
        localCache: fs.persistentLocalCache({ tabManager: fs.persistentMultipleTabManager() }),
      });
    } catch (e) {
      console.warn('Sin caché persistente', e); db = fs.getFirestore(app);
    }
    this._fs = fs; this._db = db; this._au = au; this._auth = au.getAuth(app);
    await au.setPersistence(this._auth, au.browserLocalPersistence).catch(() => { });
  },
  onAuth(cb) {
    if (this.mode !== 'firebase') { this.user = { email: 'demo', uid: 'demo' }; cb(this.user); return; }
    this._au.onAuthStateChanged(this._auth, async u => {
      this._unsubs.forEach(f => f()); this._unsubs = [];
      this.user = u;
      if (u) await this._listen();
      cb(u);
    });
  },
  async login(email, pass) { return this._au.signInWithEmailAndPassword(this._auth, email, pass); },
  async resetPass(email) { return this._au.sendPasswordResetEmail(this._auth, email); },
  async logout() { if (this.mode === 'firebase') await this._au.signOut(this._auth); },

  /* Para no leer años de historia en cada apertura (y cuidar el plan gratuito de Firebase),
     las colecciones grandes se cargan por ventana de tiempo. Las cuentas por cobrar y la caja abierta
     se cargan siempre, sin importar la fecha. */
  VENTANA_DIAS: 400,
  VENTANA_MOV_DIAS: 120,
  _listen() {
    const fs = this._fs; const db = this._db;
    const desde = d => new Date(Date.now() - d * 864e5).toISOString();
    const col = c => fs.collection(db, c);
    const W = this.VENTANA_DIAS;
    const consultas = [
      ['config', col('config')], ['productos', col('productos')], ['clientes', col('clientes')],
      ['ventas', fs.query(col('ventas'), fs.where('fecha', '>=', desde(W)))],
      ['ventas', fs.query(col('ventas'), fs.where('estado', '==', 'pendiente'))],
      ['ventas', fs.query(col('ventas'), fs.where('entregado', '==', false))],
      ['abonos', fs.query(col('abonos'), fs.where('fecha', '>=', desde(W)))],
      ['gastos', fs.query(col('gastos'), fs.where('fecha', '>=', desde(W)))],
      ['cajas', fs.query(col('cajas'), fs.where('apertura', '>=', desde(W)))],
      ['cajas', fs.query(col('cajas'), fs.where('abierta', '==', true))],
      ['cajaMovs', fs.query(col('cajaMovs'), fs.where('fecha', '>=', desde(W)))],
      ['movimientos', fs.query(col('movimientos'), fs.where('fecha', '>=', desde(this.VENTANA_MOV_DIAS)))],
    ];
    COLECCIONES.forEach(c => this.cache[c] = new Map());
    const parciales = consultas.map(() => new Map());
    const unir = c => {
      const m = new Map();
      consultas.forEach(([cc], i) => { if (cc === c) parciales[i].forEach((v, k) => m.set(k, v)); });
      this.cache[c] = m;
    };
    return Promise.all(consultas.map(([c, q], i) => new Promise(resolve => {
      let first = true;
      const unsub = fs.onSnapshot(q, snap => {
        const m = parciales[i];
        snap.docChanges().forEach(ch => {
          if (ch.type === 'removed') m.delete(ch.doc.id);
          else m.set(ch.doc.id, { ...ch.doc.data(), id: ch.doc.id });
        });
        unir(c);
        if (first) { first = false; resolve(); } else this._emit([c]);
      }, err => { console.error(c, err); if (first) { first = false; resolve(); } });
      this._unsubs.push(unsub);
    })));
  },

  /* ---------- Escritura ----------
     ops: [{t:'set'|'update'|'delete', col, id, data}]
     En 'update' los valores {$inc: n} suman de forma segura (útil para stock). */
  async commit(ops) {
    ops = ops.filter(Boolean);
    if (!ops.length) return;
    if (this.mode === 'demo') return this._commitDemo(ops);
    const fs = this._fs;
    const chunks = [];
    for (let i = 0; i < ops.length; i += 450) chunks.push(ops.slice(i, i + 450));
    const promises = chunks.map(chunk => {
      const b = fs.writeBatch(this._db);
      chunk.forEach(op => {
        const ref = fs.doc(this._db, op.col, op.id);
        if (op.t === 'delete') b.delete(ref);
        else if (op.t === 'set') b.set(ref, limpiar(op.data, fs));
        else b.set(ref, limpiar(op.data, fs), { merge: true });
      });
      this.pending++; this._emitSync();
      return b.commit().finally(() => { this.pending--; this._emitSync(); });
    });
    const all = Promise.all(promises);
    // Sin internet la promesa no termina hasta reconectar; los cambios ya quedaron en el celular.
    await Promise.race([all, new Promise(r => setTimeout(r, 1500))]);
    all.catch(e => { console.error(e); toast('No se pudo guardar en la nube: ' + (e.code || e.message), 'error', 6000); });
  },

  async nextNumber(key) {
    if (this.mode === 'demo') {
      const c = this._demoCounters[key] = (this._demoCounters[key] || 0) + 1;
      this._saveDemo(); return c;
    }
    const fs = this._fs; const ref = fs.doc(this._db, 'contadores', key);
    if (navigator.onLine) {
      try {
        return await Promise.race([
          fs.runTransaction(this._db, async tx => {
            const s = await tx.get(ref); const n = ((s.exists() && s.data().n) || 0) + 1;
            tx.set(ref, { n }); return n;
          }),
          new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 4000)),
        ]);
      } catch (e) { console.warn('Consecutivo sin conexión', e); }
    }
    // Sin conexión: número temporal único basado en la hora
    const d = new Date();
    return `T${pad2(d.getMonth() + 1)}${pad2(d.getDate())}${pad2(d.getHours())}${pad2(d.getMinutes())}${pad2(d.getSeconds())}`;
  },

  /* ---------- Modo demo (localStorage) ---------- */
  _demoKey: 'amare_demo_v3',
  _demoCounters: {},
  _loadDemo() {
    let raw = null;
    try { raw = JSON.parse(localStorage.getItem(this._demoKey) || 'null'); } catch { raw = null; }
    if (raw && raw.data) {
      COLECCIONES.forEach(c => { this.cache[c] = new Map((raw.data[c] || []).map(d => [d.id, d])); });
      this._demoCounters = raw.counters || {};
      this.demoSeeded = true;
    }
  },
  _saveDemo() {
    try {
      const data = {}; COLECCIONES.forEach(c => data[c] = this.all(c));
      localStorage.setItem(this._demoKey, JSON.stringify({ data, counters: this._demoCounters }));
    } catch (e) { /* almacenamiento no disponible: se trabaja en memoria */ }
  },
  _commitDemo(ops) {
    const touched = new Set();
    ops.forEach(op => {
      const m = this.cache[op.col] || (this.cache[op.col] = new Map());
      touched.add(op.col);
      if (op.t === 'delete') { m.delete(op.id); return; }
      const prev = op.t === 'set' ? {} : (m.get(op.id) || {});
      const next = { ...prev };
      Object.entries(op.data || {}).forEach(([k, v]) => {
        if (v && typeof v === 'object' && '$inc' in v) next[k] = (Number(prev[k]) || 0) + v.$inc;
        else if (v !== undefined) next[k] = v;
      });
      next.id = op.id;
      m.set(op.id, next);
    });
    this._saveDemo();
    this._emit(Array.from(touched));
  },
  resetDemo() {
    try { localStorage.removeItem(this._demoKey); } catch { }
    COLECCIONES.forEach(c => this.cache[c] = new Map());
    this._demoCounters = {};
  },
};

function limpiar(data, fs) {
  const out = {};
  Object.entries(data || {}).forEach(([k, v]) => {
    if (v === undefined || k === 'id') return;
    if (v && typeof v === 'object' && '$inc' in v) out[k] = fs.increment(v.$inc);
    else out[k] = v;
  });
  return out;
}
