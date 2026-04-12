const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbynBZpdhzUR7oASi0Mg0xU6z3niwx_OjzRKB5CvNRmxxhvJVHLE_jJmjERSaajnLcZ7mg/exec"; 
const CODIGO_PAIS = "57";
let inventario = [];
let historial = [];
let charts = {};

async function cargarDesdeDrive() {
    const syncBtn = document.getElementById('sync-btn');
    if (syncBtn) syncBtn.innerText = "⏳";
    try {
        const res = await fetch(SCRIPT_URL + "?t=" + new Date().getTime());
        const data = await res.json();
        inventario = data.inventario || [];
        historial = data.historial || [];
        renderInventario();
        calcularVentasTotales(); 
        actualizarSelect();
        if (syncBtn) syncBtn.innerText = "🔄";
    } catch (e) { console.error(e); if (syncBtn) syncBtn.innerText = "❌"; }
}

function calcularVentasTotales() {
    let sumaReal = 0;
    inventario.forEach(p => {
        sumaReal += (parseFloat(p.precio) || 0) * (parseFloat(p.vendidos) || 0);
    });
    document.getElementById('gran-total-dinero').innerText = `$${sumaReal.toLocaleString('es-CO')}`;
}

function renderInventario() {
    const lista = document.getElementById('lista-inventario');
    if (!lista) return;
    lista.innerHTML = inventario.map(p => {
        const stockInicial = parseFloat(p.stock) || 0;
        const vendidos = parseFloat(p.vendidos) || 0;
        const disponible = stockInicial - vendidos;
        const precioFormateado = parseFloat(p.precio || 0).toLocaleString('es-CO');
        
        return `<li class="lista-item">
            <div class="product-info">
                <span class="product-name">${p.nombre}</span><br>
                <span class="stock-info">Vendidos: ${vendidos} | Stock inicial: ${stockInicial}</span>
                <span class="price-tag">$${precioFormateado}</span>
            </div>
            <div style="text-align:right">
                <span class="stock-badge ${disponible <= 0 ? 'bg-empty' : 'bg-ok'}" 
                      style="padding: 6px 12px; border-radius: 20px; font-weight: bold; color: white; background: ${disponible <= 0 ? '#ff4d4d' : '#2ecc71'}">
                    ${disponible <= 0 ? 'AGOTADO' : disponible + ' disp.'}
                </span>
            </div>
        </li>`;
    }).join('');
}

function switchTab(t) {
    document.querySelectorAll('.tab-content').forEach(s => s.style.display = 'none');
    document.querySelectorAll('.tabs button').forEach(b => b.classList.remove('active'));
    const sec = document.getElementById('sec-' + t);
    const btn = document.getElementById('tab-' + t);
    if (sec && btn) {
        sec.style.display = 'block';
        btn.classList.add('active');
    }
    if(t === 'stats') setTimeout(dibujarGraficos, 200);
}

function dibujarGraficos() {
    const pink = '#d63384';
    const ctxM = document.getElementById('canvasMetodos');
    if (ctxM) {
        if (charts.m) charts.m.destroy();
        const metData = historial.reduce((a, c) => (a[c.metodo] = (a[c.metodo] || 0) + 1, a), {});
        charts.m = new Chart(ctxM, {
            type: 'doughnut',
            data: { labels: Object.keys(metData), datasets: [{ data: Object.values(metData), backgroundColor: [pink, '#6610f2', '#fd7e14', '#20c997'] }] },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }
    const ctxP = document.getElementById('canvasTop5');
    if (ctxP) {
        if (charts.p) charts.p.destroy();
        const top5 = [...inventario].sort((a,b) => (parseFloat(b.vendidos)||0) - (parseFloat(a.vendidos)||0)).slice(0, 5);
        charts.p = new Chart(ctxP, {
            type: 'bar',
            data: {
                labels: top5.map(p => p.nombre.substring(0, 15)),
                datasets: [{ label: 'Ventas', data: top5.map(p => p.vendidos), backgroundColor: pink }]
            },
            options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false }
        });
    }
}

async function registrarVenta() {
    const select = document.getElementById('select-producto');
    const fila = select.value;
    const nombreProd = select.options[select.selectedIndex].text.split(' (')[0];
    const cantidad = parseInt(document.getElementById('cant-venta').value);
    const metodo = document.getElementById('metodo-pago').value;
    const cliente = document.getElementById('nombre-cliente').value || "Cliente";
    let telInput = document.getElementById('tel-cliente').value.replace(/\s+/g, '');
    const btn = document.querySelector('.btn-save');

    const p = inventario.find(item => item.filaOriginal == fila);
    const disp = (parseFloat(p.stock) || 0) - (parseFloat(p.vendidos) || 0);
    if (disp < cantidad) return alert("¡Stock insuficiente!");

    let telFinal = telInput ? (telInput.startsWith(CODIGO_PAIS) ? telInput : CODIGO_PAIS + telInput) : "N/A";
    btn.disabled = true;

    try {
        await fetch(SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            body: JSON.stringify({
                action: "venta", fila: parseInt(fila), productoNombre: nombreProd,
                cantidad, metodo, cliente, telefono: telFinal
            })
        });

        if (telFinal !== "N/A") {
            let msg = `¡Hola ${cliente}! ✨ Muchas gracias por tu compra de ${nombreProd} en Amare Beauty. ❤️`;
            window.open(`https://wa.me/${telFinal}?text=${encodeURIComponent(msg)}`, '_blank');
        }

        alert("¡Venta Registrada!");
        btn.disabled = false;
        cargarDesdeDrive();
    } catch (e) { alert("Error"); btn.disabled = false; }
}

function filtrarProductos() {
    const txt = document.getElementById('busqueda').value.toLowerCase();
    document.querySelectorAll('#lista-inventario li').forEach(li => {
        li.style.display = li.textContent.toLowerCase().includes(txt) ? 'flex' : 'none';
    });
}

function actualizarSelect() {
    const s = document.getElementById('select-producto');
    if (s) s.innerHTML = inventario.map(p => {
        const disp = (parseFloat(p.stock) || 0) - (parseFloat(p.vendidos) || 0);
        return `<option value="${p.filaOriginal}">${p.nombre} (${disp} disp.)</option>`;
    }).join('');
}

window.onload = cargarDesdeDrive;
