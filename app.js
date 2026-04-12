const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbw6_7DQLfpxqg2JIe-EPulXmx5-Zw6PLFEhLQR-mA7Rwcr-lFoN71AdJdgZtAPsSUodXQ/exec"; 
const CODIGO_PAIS = "57";
let inventario = [];
let historial = [];
let charts = {};

async function cargarDesdeDrive() {
    const syncBtn = document.getElementById('sync-btn');
    if (syncBtn) syncBtn.innerText = "⏳";
    try {
        const response = await fetch(`${SCRIPT_URL}?t=${Date.now()}`);
        const data = await response.json();
        inventario = data.inventario || [];
        historial = data.historial || [];
        renderInventario();
        calcularVentasTotales(); 
        actualizarSelect();
        if (syncBtn) syncBtn.innerText = "🔄";
    } catch (e) {
        console.error(e);
        if (syncBtn) syncBtn.innerText = "❌";
    }
}

function renderInventario() {
    const lista = document.getElementById('lista-inventario');
    if (!lista) return;
    lista.innerHTML = inventario.map(p => {
        const disponible = (parseFloat(p.stock) || 0) - (parseFloat(p.vendidos) || 0);
        const agotado = disponible <= 0;
        
        return `<li class="lista-item ${agotado ? 'sin-stock' : ''}" 
            onclick="${agotado ? "alert('Este producto no tiene stock')" : `irAVenta('${p.filaOriginal}', '${p.nombre.replace(/'/g, "\\'")}')`}">
            <div class="product-info">
                <span class="product-name">${p.nombre}</span><br>
                <span style="font-size:0.85rem; color:#666;">Disponibles: ${disponible}</span>
                <span class="price-tag">$${parseFloat(p.precio || 0).toLocaleString('es-CO')}</span>
            </div>
            <div style="text-align:right">
                <span class="stock-badge" style="background:${agotado ? '#ccc' : '#2ecc71'}; color:white; padding:5px 10px; border-radius:15px; font-weight:bold;">
                    ${agotado ? 'AGOTADO' : 'VENDER ➔'}
                </span>
            </div>
        </li>`;
    }).join('');
}

function irAVenta(fila, nombre) {
    switchTab('ventas');
    document.getElementById('busqueda-venta').value = nombre;
    filtrarSelectVentas();
    document.getElementById('select-producto').value = fila;
    validarStockSeleccionado();
}

// NUEVA FUNCIÓN: Bloquea el botón de registro si no hay stock suficiente
function validarStockSeleccionado() {
    const select = document.getElementById('select-producto');
    const btn = document.getElementById('btn-registrar-final');
    const cantInput = document.getElementById('cant-venta');
    const cantidad = parseInt(cantInput.value) || 0;
    
    if (!select.value) return;
    
    const p = inventario.find(item => item.filaOriginal == select.value);
    const disponible = (parseFloat(p.stock) || 0) - (parseFloat(p.vendidos) || 0);
    
    if (disponible <= 0 || cantidad > disponible) {
        btn.disabled = true;
        btn.classList.add('btn-disabled');
        btn.innerText = disponible <= 0 ? "SIN STOCK" : "STOCK INSUFICIENTE";
    } else {
        btn.disabled = false;
        btn.classList.remove('btn-disabled');
        btn.innerText = "REGISTRAR VENTA";
    }
}

function switchTab(t) {
    document.querySelectorAll('.tab-content').forEach(s => s.style.display = 'none');
    document.querySelectorAll('.tabs button').forEach(b => b.classList.remove('active'));
    const sec = document.getElementById('sec-' + t);
    const btn = document.getElementById('tab-' + t);
    if (sec && btn) {
        sec.style.display = 'block';
        btn.classList.add('active');
        if (t !== 'ventas') cargarDesdeDrive(); 
    }
    if(t === 'stats') setTimeout(dibujarGraficos, 300);
}

function calcularVentasTotales() {
    const total = inventario.reduce((sum, p) => sum + ((parseFloat(p.precio) || 0) * (parseFloat(p.vendidos) || 0)), 0);
    document.getElementById('gran-total-dinero').innerText = `$${total.toLocaleString('es-CO')}`;
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

function filtrarSelectVentas() {
    const txt = document.getElementById('busqueda-venta').value.toLowerCase();
    const select = document.getElementById('select-producto');
    select.innerHTML = "";
    inventario.forEach(p => {
        if (p.nombre.toLowerCase().includes(txt)) {
            const disp = (parseFloat(p.stock) || 0) - (parseFloat(p.vendidos) || 0);
            const opt = document.createElement("option");
            opt.value = p.filaOriginal;
            opt.textContent = `${p.nombre} (${disp} disp.)`;
            select.appendChild(opt);
        }
    });
}

async function registrarVenta() {
    const select = document.getElementById('select-producto');
    const fila = select.value;
    const nombreProd = select.options[select.selectedIndex].text.split(' (')[0];
    const cantidad = parseInt(document.getElementById('cant-venta').value);
    const metodo = document.getElementById('metodo-pago').value;
    const cliente = document.getElementById('nombre-cliente').value || "Cliente";
    let telInput = document.getElementById('tel-cliente').value.replace(/\s+/g, '');
    const btn = document.getElementById('btn-registrar-final');

    btn.disabled = true;

    try {
        let telFinal = telInput ? (telInput.startsWith(CODIGO_PAIS) ? telInput : CODIGO_PAIS + telInput) : "N/A";
        await fetch(SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            body: JSON.stringify({
                action: "venta", fila: parseInt(fila), productoNombre: nombreProd,
                cantidad, metodo, cliente, telefono: telFinal
            })
        });

        if (telFinal !== "N/A") {
            let msg = (metodo === "Efectivo" || metodo === "Transferencia") 
                ? `¡Hola ${cliente}! ✨ Gracias por tu compra de ${nombreProd} en Amare Beauty. ❤️`
                : (metodo === "Separado") 
                ? `¡Hola ${cliente}! ✨ Tu producto ${nombreProd} ha sido separado en Amare Beauty. 📦`
                : `¡Hola ${cliente}! ✨ Tu pedido de ${nombreProd} queda pendiente por pagar en Amare Beauty. 📝`;
            window.open(`https://wa.me/${telFinal}?text=${encodeURIComponent(msg)}`, '_blank');
        }

        alert("¡Venta Registrada!");
        document.getElementById('busqueda-venta').value = "";
        btn.disabled = false;
        cargarDesdeDrive();
        switchTab('inventario');
    } catch (e) { alert("Error"); btn.disabled = false; }
}

function filtrarProductos() {
    const txt = document.getElementById('busqueda').value.toLowerCase();
    document.querySelectorAll('#lista-inventario li').forEach(li => {
        li.style.display = li.textContent.toLowerCase().includes(txt) ? 'flex' : 'none';
    });
}

function actualizarSelect() {
    const select = document.getElementById('select-producto');
    if (!select) return;
    select.innerHTML = inventario.map(p => {
        const disp = (parseFloat(p.stock) || 0) - (parseFloat(p.vendidos) || 0);
        return `<option value="${p.filaOriginal}">${p.nombre} (${disp} disp.)</option>`;
    }).join('');
}

window.onload = cargarDesdeDrive;
