const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxtwvA06Nv_NevyfgbY7VDw1j_2lh2sgSNQqnDtpxCFnA0A3Csj0cEIfpV7zDWM5SuGlQ/exec"; 
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
        calcularVentasTotales(); // Aquí se ejecuta el cálculo E x K
        actualizarSelect();
        
        if (syncBtn) syncBtn.innerText = "🔄";
    } catch (e) { 
        console.error(e);
        if (syncBtn) syncBtn.innerText = "❌"; 
    }
}

function calcularVentasTotales() {
    // Cálculo exacto: Suma de (Precio Columna E * Cantidad Vendida Columna K)
    let totalSuma = 0;
    
    inventario.forEach(p => {
        const precio = parseFloat(p.precio) || 0;
        const cantidadVendida = parseFloat(p.vendidos) || 0;
        totalSuma += (precio * cantidadVendida);
    });
    
    document.getElementById('gran-total-dinero').innerText = `$${totalSuma.toLocaleString()}`;
}

function renderInventario() {
    const lista = document.getElementById('lista-inventario');
    lista.innerHTML = inventario.map(p => {
        const stockInicial = parseFloat(p.stock) || 0;
        const vendidos = parseFloat(p.vendidos) || 0;
        const disp = stockInicial - vendidos;
        return `<li>
            <div style="flex-grow:1"><strong>${p.nombre}</strong><br><small>Vendidos: ${vendidos}</small></div>
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
    const stockInicial = parseFloat(p.stock) || 0;
    const vendidos = parseFloat(p.vendidos) || 0;
    const disp = stockInicial - vendidos;
    
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
        const stockInicial = parseFloat(p.stock) || 0;
        const vendidos = parseFloat(p.vendidos) || 0;
        const disp = stockInicial - vendidos;
        return `<option value="${p.filaOriginal}">${p.nombre} (${disp} disp.)</option>`;
    }).join('');
}

function switchTab(t) {
    document.querySelectorAll('.tab-content').forEach(s => s.style.display = 'none');
    document.querySelectorAll('.tabs button').forEach(b => b.classList.remove('active'));
    document.getElementById('sec-' + t).style.display = 'block';
    document.getElementById('tab-' + t).classList.add('active');
    if(t === 'stats') generarGraficos();
}

function generarGraficos() {
    if (charts.m) charts.m.destroy();
    if (charts.p) charts.p.destroy();
    const met = historial.reduce((a, c) => (a[c.metodo] = (a[c.metodo] || 0) + 1, a), {});
    charts.m = new Chart(document.getElementById('chartMetodos'), {
        type: 'pie',
        data: { labels: Object.keys(met), datasets: [{ data: Object.values(met), backgroundColor: ['#ff6384', '#36a2eb', '#cc65fe', '#ffce56'] }] }
    });
    const pro = historial.reduce((a, c) => (a[c.producto] = (a[c.producto] || 0) + c.cantidad, a), {});
    const top = Object.entries(pro).sort((a,b) => b[1]-a[1]).slice(0, 5);
    charts.p = new Chart(document.getElementById('chartProductos'), {
        type: 'bar',
        data: { labels: top.map(x => x[0]), datasets: [{ label: 'Ventas', data: top.map(x => x[1]), backgroundColor: '#d63384' }] }
    });
}

window.onload = cargarDesdeDrive;
