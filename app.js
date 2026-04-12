const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwgDD-haPIbsz2Bqcm2LFjVUL_Bwnlhu8V18WQ8mZ7nI8u5Wis1V3BxKF1jkCGjkQ9-UQ/exec"; 
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
        calcularVentasTotales(); // CÁLCULO REAL
        actualizarSelect();
        
        if (syncBtn) syncBtn.innerText = "🔄";
    } catch (e) { 
        console.error(e);
        if (syncBtn) syncBtn.innerText = "❌"; 
    }
}

function calcularVentasTotales() {
    // Cálculo: Suma de (Precio E * Unidades Vendidas K)
    let sumaReal = 0;
    
    inventario.forEach(p => {
        const precio = parseFloat(p.precio) || 0;
        const unidadesVendidas = parseFloat(p.vendidos) || 0;
        
        // Solo sumamos si ambos valores son mayores a cero para evitar errores de celdas vacías
        if (precio > 0 && unidadesVendidas > 0) {
            sumaReal += (precio * unidadesVendidas);
        }
    });
    
    // Formato de moneda local
    document.getElementById('gran-total-dinero').innerText = `$${sumaReal.toLocaleString('es-CO')}`;
}

function renderInventario() {
    const lista = document.getElementById('lista-inventario');
    lista.innerHTML = inventario.map(p => {
        const disp = (parseFloat(p.stock) || 0) - (parseFloat(p.vendidos) || 0);
        return `<li>
            <div style="flex-grow:1"><strong>${p.nombre}</strong><br><small>Vendidos: ${p.vendidos || 0}</small></div>
            <div style="text-align:right">
                <span class="stock-badge ${disp <= 0 ? 'bg-empty' : 'bg-ok'}">${disp <= 0 ? 'AGOTADO' : 'Cant: ' + disp}</span><br>
                <strong>$${parseFloat(p.precio || 0).toLocaleString()}</strong>
            </div>
        </li>`;
    }).join('');
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
            let mensaje = (metodo === "Efectivo" || metodo === "Transferencia") 
                ? `¡Hola ${cliente}! ✨ Muchas gracias por tu compra de ${nombreProd} en Amare Beauty. ❤️`
                : `Hola ${cliente}, confirmamos tu pedido de ${nombreProd} en Amare Beauty ${(metodo === "Fiado") ? "pendiente de pago" : "como separado"}. ✨`;
            window.open(`https://wa.me/${telFinal}?text=${encodeURIComponent(mensaje)}`, '_blank');
        }

        alert("Venta registrada con éxito");
        document.getElementById('nombre-cliente').value = "";
        document.getElementById('tel-cliente').value = "";
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
    s.innerHTML = inventario.map(p => {
        const disp = (parseFloat(p.stock) || 0) - (parseFloat(p.vendidos) || 0);
        return `<option value="${p.filaOriginal}">${p.nombre} (${disp} disp.)</option>`;
    }).join('');
}

function switchTab(t) {
    // 1. Ocultar secciones
    document.querySelectorAll('.tab-content').forEach(s => s.style.display = 'none');
    
    // 2. Quitar active de botones
    document.querySelectorAll('.tabs button').forEach(b => b.classList.remove('active'));
    
    // 3. Mostrar la sección elegida y activar botón
    const sec = document.getElementById('sec-' + t);
    const btn = document.getElementById('tab-' + t);
    
    if (sec) sec.style.display = 'block';
    if (btn) btn.classList.add('active'); // Aquí ya no dará error porque los ID coinciden
    
    if(t === 'stats') generarGraficos();
}

function generarGraficos() {
    if (charts.m) charts.m.destroy();
    if (charts.p) charts.p.destroy();
    
    const met = historial.reduce((a, c) => (a[c.metodo] = (a[c.metodo] || 0) + 1, a), {});
    const ctxM = document.getElementById('chartMetodos');
    if (ctxM) {
        charts.m = new Chart(ctxM, {
            type: 'pie',
            data: { labels: Object.keys(met), datasets: [{ data: Object.values(met), backgroundColor: ['#ff6384', '#36a2eb', '#cc65fe', '#ffce56'] }] }
        });
    }

    const pro = historial.reduce((a, c) => (a[c.producto] = (a[c.producto] || 0) + c.cantidad, a), {});
    const top = Object.entries(pro).sort((a,b) => b[1]-a[1]).slice(0, 5);
    const ctxP = document.getElementById('chartProductos');
    if (ctxP) {
        charts.p = new Chart(ctxP, {
            type: 'bar',
            data: { labels: top.map(x => x[0]), datasets: [{ label: 'Ventas', data: top.map(x => x[1]), backgroundColor: '#d63384' }] }
        });
    }
}

window.onload = cargarDesdeDrive;
