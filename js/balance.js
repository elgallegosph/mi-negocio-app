/* Balance general del negocio: ganancias acumuladas, recuperación de la inversión, mes a mes y dónde está el dinero */
'use strict';

NAV.splice(NAV.findIndex(n => n.id === 'reportes'), 0, { id: 'balance', t: 'Balance', i: 'trend', admin: true });
ICONS.trend = '<path d="M3.5 17.5 9 12l4 4 7.5-7.5"/><path d="M15 8.5h5.5V14"/>';

const MESES_C = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
function pct(a, b) { return b ? Math.round((a - b) / Math.abs(b) * 100) : null; }

function datosBalance() {
  const c = cfg();
  const inicio = c.fechaInicio || (DB.all('ventas').map(v => v.dia).sort()[0]) || dayKey();
  const todo = { desde: inicio, hasta: dayKey(), nombre: 'Desde el inicio' };
  const r = reporte(todo);
  const inversion = Number(c.inversionInicial) || 0;
  const invertido = inversion + r.compras + r.gastosOp;           // todo el dinero que ha salido para el negocio
  const recibido = r.totalRecaudo;                                // todo el dinero que ha entrado
  const inv = valorInventario();
  const porCobrar = sum(ventasConSaldo(), v => v.saldo);
  const dineroGenerado = recibido - r.compras - r.gastosOp;       // lo que dejaron las ventas cobradas, después de comprar y pagar gastos

  // mes a mes
  const meses = new Map();
  const clave = d => d.slice(0, 7);
  let d = parseDay(inicio); d = new Date(d.getFullYear(), d.getMonth(), 1);
  const fin = new Date(); while (d <= fin) { meses.set(`${d.getFullYear()}-${pad2(d.getMonth() + 1)}`, { ventas: 0, costo: 0, gastos: 0, n: 0 }); d = new Date(d.getFullYear(), d.getMonth() + 1, 1); }
  r.ventas.forEach(v => { const m = meses.get(clave(v.dia)); if (m) { m.ventas += v.total; m.costo += v.costoTotal || 0; m.n++; } });
  r.gastos.filter(g => g.categoria !== GASTO_MERCANCIA).forEach(g => { const m = meses.get(clave(g.dia)); if (m) m.gastos += g.valor; });
  const serie = Array.from(meses, ([k, m]) => ({ k, ...m, bruta: m.ventas - m.costo, neta: m.ventas - m.costo - m.gastos })).slice(-12);

  // productos
  const vendidos60 = new Set(DB.all('ventas').filter(v => v.estado !== 'anulada' && diasDesde(v.fecha) <= 60).flatMap(v => v.items.map(i => i.productoId)));
  const quietos = productosActivos().filter(p => stockDe(p) > 0 && !vendidos60.has(p.id)).map(p => ({ p, valor: stockDe(p) * (Number(p.costo) || 0) })).sort((a, b) => b.valor - a.valor);
  const rentables = r.topProductos.slice().sort((a, b) => b.ganancia - a.ganancia);

  return { c, inicio, r, inversion, invertido, recibido, inv, porCobrar, dineroGenerado, serie, quietos, rentables };
}

/* Barras agrupadas (ventas y ganancia neta por mes), con línea en cero si hay meses en pérdida */
function barrasMeses(serie) {
  const max = Math.max(1, ...serie.map(s => Math.max(s.ventas, s.neta)));
  const min = Math.min(0, ...serie.map(s => s.neta));
  const rango = max - min; const H = 180;
  const y = v => (max - v) / rango * H;
  const cero = y(0);
  return `<div class="mchart">
    <div class="legend"><span><i class="sw s-ventas"></i>Ventas</span><span><i class="sw s-gan"></i>Ganancia neta</span></div>
    <div class="mchart-area" style="height:${H}px">
      <div class="mchart-zero" style="top:${cero}px"></div>
      ${serie.map(s => {
        const hv = Math.max(s.ventas / rango * H, s.ventas ? 2 : 0);
        const hn = Math.max(Math.abs(s.neta) / rango * H, s.neta ? 2 : 0);
        const [yy, mm] = s.k.split('-');
        const tip = `${MESES_L[Number(mm) - 1]} ${yy}\nVentas: ${money(s.ventas)}\nGanancia neta: ${money(s.neta)}\nGastos: ${money(s.gastos)}`;
        return `<div class="mcol" title="${esc(tip)}" tabindex="0" aria-label="${esc(tip.replace(/\n/g, '. '))}">
          <div class="mbar s-ventas" style="top:${cero - hv}px;height:${hv}px"></div>
          <div class="mbar s-gan ${s.neta < 0 ? 'neg' : ''}" style="top:${s.neta >= 0 ? cero - hn : cero}px;height:${hn}px"></div>
        </div>`;
      }).join('')}
    </div>
    <div class="mchart-x">${serie.map(s => { const [yy, mm] = s.k.split('-'); return `<span>${MESES_C[Number(mm) - 1]}${mm === '01' || s === serie[0] ? ` ${yy.slice(2)}` : ''}</span>`; }).join('')}</div>
  </div>`;
}

function filaComparada(label, actual, antes) {
  const p = pct(actual, antes);
  return `<div class="cmp-row"><span>${label}</span><span class="num">${money(actual)}</span><span class="num muted-text">${money(antes)}</span>
    <span class="num ${p === null ? 'muted-text' : p >= 0 ? 'up' : 'down'}">${p === null ? '—' : (p >= 0 ? '+' : '') + p + '%'}</span></div>`;
}

Pantallas.balance = {
  titulo: 'Balance',
  render() {
    const b = datosBalance(); const { r } = b;
    const mesAct = reporte(rangoPeriodo('mes')); const mesAnt = reporte(rangoPeriodo('mesAnt'));
    const recuperado = Math.min(b.recibido / (b.invertido || 1), 1);
    const falta = b.invertido - b.recibido;
    const valorNegocio = b.inv.costo + b.porCobrar + b.dineroGenerado;
    return `<div class="screen">
      <section class="bal-hero">
        <div>
          <p class="eyebrow">Ganancia neta desde ${fmtFecha(parseDay(b.inicio))}</p>
          <p class="bal-big num ${r.utilidadNeta < 0 ? 'neg' : ''}">${money(r.utilidadNeta)}</p>
          <p class="bal-sub">${money(r.facturado)} en ventas · margen ${Math.round(r.margen * 100)}% · ${num(r.numVentas)} ventas · ${num(r.unidades)} unidades</p>
        </div>
        <button class="btn ghost sm" data-a="editarInversion">${icon('edit')}Inversión y fecha de inicio</button>
      </section>

      <div class="cols">
        <section class="card">
          <div class="card-head"><h2>Recuperación de la inversión</h2></div>
          ${b.inversion ? '' : `<div class="notice accent">${icon('alert')}<span>Escribe cuánto pusiste para arrancar el negocio, así la app calcula cuánto has recuperado.</span><button class="btn sm primary" data-a="editarInversion">Escribir inversión</button></div>`}
          <div class="meter" role="img" aria-label="Recuperado ${Math.round(recuperado * 100)} por ciento"><div class="meter-fill ${falta <= 0 ? 'ok' : ''}" style="width:${recuperado * 100}%"></div></div>
          <p class="meter-msg">${falta > 0 ? `Llevas <b>${Math.round(recuperado * 100)}%</b>. Te faltan <b class="num">${money(falta)}</b> para recuperar todo lo que has puesto.` : `<b class="ok-text">Ya recuperaste todo lo invertido.</b> Te quedan <b class="num">${money(-falta)}</b> de ganancia en dinero.`}</p>
          <div class="dl">
            ${filaDato('Inversión inicial', `<span class="num">${money(b.inversion)}</span>`)}
            ${filaDato('+ Compras de mercancía', `<span class="num">${money(r.compras)}</span>`)}
            ${filaDato('+ Gastos del negocio', `<span class="num">${money(r.gastosOp)}</span>`)}
            ${filaDato('Total que ha salido', `<span class="num">${money(b.invertido)}</span>`, 'total')}
            ${filaDato('Total que ha entrado (ventas cobradas y abonos)', `<span class="num">${money(b.recibido)}</span>`)}
          </div>
        </section>

        <section class="card">
          <div class="card-head"><h2>¿Dónde está el dinero hoy?</h2></div>
          <div class="dl">
            ${filaDato('Mercancía en el estante (a costo)', `<span class="num">${money(b.inv.costo)}</span>`)}
            ${filaDato('Lo que te deben', `<span class="num">${money(b.porCobrar)}</span>`)}
            ${filaDato(`Dinero que dejaron las ventas <small>(cobrado − compras − gastos)</small>`, `<span class="num">${money(b.dineroGenerado)}</span>`)}
            ${filaDato('Valor del negocio', `<span class="num">${money(valorNegocio)}</span>`, 'total')}
          </div>
          <p class="hint">Si vendes todo lo que hay en el estante a precio normal recibirías ${money(b.inv.venta)}, con una ganancia de ${money(b.inv.venta - b.inv.costo)}.</p>
        </section>
      </div>

      <section class="pyg card">
        <div class="pyg-row"><span>Ventas acumuladas</span><span class="num">${money(r.facturado)}</span></div>
        <div class="pyg-row minus"><span>Costo de los productos vendidos</span><span class="num">−${money(r.costo)}</span></div>
        <div class="pyg-row sub"><span>Ganancia bruta <small>${Math.round(r.margen * 100)}% de margen</small></span><span class="num">${money(r.utilidadBruta)}</span></div>
        <div class="pyg-row minus"><span>Gastos del negocio</span><span class="num">−${money(r.gastosOp)}</span></div>
        <div class="pyg-row total ${r.utilidadNeta < 0 ? 'neg' : ''}"><span>Ganancia neta acumulada</span><span class="num">${money(r.utilidadNeta)}</span></div>
      </section>

      <section class="card">
        <div class="card-head"><h2>Mes a mes</h2></div>
        ${b.serie.length > 1 ? barrasMeses(b.serie) : ''}
        <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Mes</th><th class="r">Ventas</th><th class="r">Costo</th><th class="r">Gastos</th><th class="r">Ganancia neta</th><th class="r">Margen</th></tr></thead><tbody>
          ${b.serie.slice().reverse().map(s => { const [yy, mm] = s.k.split('-'); return `<tr><td>${MESES_C[Number(mm) - 1]} ${yy}</td><td class="r num">${money(s.ventas)}</td><td class="r num">${money(s.costo)}</td><td class="r num">${money(s.gastos)}</td><td class="r num ${s.neta < 0 ? 'bad-text' : ''}"><b>${money(s.neta)}</b></td><td class="r num">${s.ventas ? Math.round(s.bruta / s.ventas * 100) + '%' : '—'}</td></tr>`; }).join('')}
        </tbody></table></div>
      </section>

      <div class="cols">
        <section class="card">
          <div class="card-head"><h2>Este mes vs. el anterior</h2></div>
          <div class="cmp"><div class="cmp-row head"><span></span><span>${MESES_C[new Date().getMonth()]}</span><span>${MESES_C[(new Date().getMonth() + 11) % 12]}</span><span>Cambio</span></div>
            ${filaComparada('Ventas', mesAct.facturado, mesAnt.facturado)}
            ${filaComparada('Ganancia bruta', mesAct.utilidadBruta, mesAnt.utilidadBruta)}
            ${filaComparada('Gastos', mesAct.gastosOp, mesAnt.gastosOp)}
            ${filaComparada('Ganancia neta', mesAct.utilidadNeta, mesAnt.utilidadNeta)}
            ${filaComparada('Ticket promedio', mesAct.ticket, mesAnt.ticket)}
          </div>
          <p class="hint">El mes actual va hasta hoy, así que es normal que sea menor mientras avanza.</p>
        </section>
        <section class="card">
          <div class="card-head"><h2>Ganancia por categoría</h2></div>
          ${r.categorias.length ? barrasH(r.categorias.slice().sort((a, b) => b.ganancia - a.ganancia).map(c => ({ l: c.nombre, v: c.ganancia, extra: c.valor ? Math.round(c.ganancia / c.valor * 100) + '% margen' : '' }))) : '<p class="muted-text">Sin ventas.</p>'}
        </section>
      </div>

      <div class="cols">
        <section class="card">
          <div class="card-head"><h2>Productos que más ganancia dejan</h2></div>
          ${b.rentables.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Producto</th><th class="r">Und.</th><th class="r">Ganancia</th><th class="r">Margen</th></tr></thead><tbody>
            ${b.rentables.slice(0, 10).map(p => `<tr><td>${esc(p.nombre)}</td><td class="r num">${num(p.cantidad)}</td><td class="r num">${money(p.ganancia)}</td><td class="r num">${p.valor ? Math.round(p.ganancia / p.valor * 100) : 0}%</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted-text">Sin ventas.</p>'}
        </section>
        <section class="card">
          <div class="card-head"><h2>Mercancía quieta</h2><span class="muted-text num">${money(sum(b.quietos, q => q.valor))}</span></div>
          <p class="hint">Productos con unidades en el estante que no se venden hace más de 60 días. Es dinero detenido: considera promociones o combos.</p>
          ${b.quietos.length ? `<div class="list compact">${b.quietos.slice(0, 10).map(q => `<button class="item" data-a="verProducto" data-id="${q.p.id}"><span class="item-main"><span class="item-title">${esc(q.p.nombre)}</span><span class="item-sub">${num(stockDe(q.p))} und. · precio ${money(q.p.precio)}</span></span><span class="item-end"><span class="num strong">${money(q.valor)}</span></span></button>`).join('')}</div>` : '<p class="muted-text">Todo lo que hay en el estante se ha movido en los últimos 60 días.</p>'}
        </section>
      </div>
      <p class="fine">Cálculos con las ventas desde ${fmtFecha(parseDay(b.inicio))}. La ganancia usa el costo guardado en cada venta; las compras de mercancía no se restan de la ganancia porque ya están en el costo de lo vendido.</p>
    </div>`;
  },
};

Acciones.editarInversion = async () => {
  if (!(await requireAdmin())) return;
  const c = cfg();
  Modal.open(`<form id="inv-form" class="form">
    <p class="muted-text">La plata que pusiste de tu bolsillo para arrancar (por ejemplo, la primera compra de mercancía). Las compras que registres después en "Entrada de mercancía" se suman solas.</p>
    <div class="field"><label for="inv-val">Inversión inicial</label><input id="inv-val" data-money inputmode="numeric" value="${num(c.inversionInicial || 0)}" autofocus></div>
    <div class="field"><label for="inv-fec">Fecha de inicio del negocio</label><input id="inv-fec" type="date" value="${esc(c.fechaInicio || (DB.all('ventas').map(v => v.dia).sort()[0]) || dayKey())}" max="${dayKey()}"></div>
    <button class="btn primary block" type="submit">Guardar</button></form>`, {
    title: 'Inversión',
    onOpen(body, close) {
      bindMoneyInputs(body);
      $('#inv-form', body).onsubmit = async e => {
        e.preventDefault();
        if (await run(() => DB.commit([{ t: 'update', col: 'config', id: 'general', data: { inversionInicial: parseMoney($('#inv-val', body).value), fechaInicio: $('#inv-fec', body).value } }]), 'Guardado') !== undefined) close();
      };
    },
  });
};
