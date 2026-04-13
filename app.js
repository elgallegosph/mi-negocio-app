const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyJj-TZm_9__ZOWz_zQvi_ojC71mxAbjW_qBbn__9tpCTHIw8jG0AEqq6QKDSfCV0EFMg/exec"; 
const CODIGO_PAIS = "57";
const LOGO_URL = "./logo.png"; 
const URL_CATALOGO = "https://drive.google.com/file/d/1FMtOGvlYbLwSofqO3WCkqG4k65MSzccn/view?usp=drive_link"; 

let inventario = [];
let historial = [];
let listaClientes = []; 
let charts = {};

function ocultarSplash() {
    const splash = document.getElementById('splash-screen');
    if (splash) {
        splash.style.opacity = '0';
        setTimeout(() => splash.style.display = 'none', 800);
    }
}

async function cargarDesdeDrive() {
    const syncBtn = document.getElementById('sync-btn');
    if (syncBtn) syncBtn.innerText = "⏳";
    try {
        const response = await fetch(`${SCRIPT_URL}?t=${Date.now()}`);
        const data = await response.json();
        inventario = data.inventario || [];
        historial = data.historial || [];
        listaClientes = data.clientes || [];
        renderInventario();
        calcularVentasTotales(); 
        actualizarSelect();
        if (syncBtn) syncBtn.innerText = "🔄";
        ocultarSplash();
    } catch (e) { 
        console.error(e); 
        ocultarSplash();
    }
}

async function getBase64Image(url) {
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'Anonymous'; 
        img.onload = function() {
            const canvas = document.createElement('canvas');
            canvas.width = this.width;
            canvas.height = this.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(this, 0, 0);
            resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = () => resolve(null);
        img.src = url;
    });
}

function renderInventario() {
    const lista = document.getElementById('lista-inventario');
    if (!lista) return;
    lista.innerHTML = inventario.map(p => {
        const disp = (parseFloat(p.stock) || 0) - (parseFloat(p.vendidos) || 0);
        const agotado = disp <= 0;
        return `<li class="lista-item" onclick="${agotado ? "alert('Sin stock')" : `irAVenta('${p.filaOriginal}', '${p.nombre.replace(/'/g, "\\'")}')`}">
            <div>
                <span style="font-weight:bold;">${p.nombre}</span><br>
                <small>Disponibles: ${disp}</small>
                <div class="price-tag">$${parseFloat(p.precio || 0).toLocaleString('es-CO')}</div>
            </div>
            <button style="background:${agotado ? '#ccc' : '#d63384'}; color:white; border:none; padding:8px 12px; border-radius:10px;">
                ${agotado ? 'OFF' : 'VER'}
            </button>
        </li>`;
    }).join('');
}

function irAVenta(fila, nombre) {
    switchTab('ventas');
    document.getElementById('busqueda-venta').value = nombre;
    filtrarSelectVentas();
    document.getElementById('select-producto').value = fila;
}

async function registrarVenta() {
    const select = document.getElementById('select-producto');
    if (!select.value) return alert("Selecciona producto");
    
    const fila = select.value;
    const nombreProd = select.options[select.selectedIndex].text.split(' (')[0];
    const cantidad = parseInt(document.getElementById('cant-venta').value);
    const metodo = document.getElementById('metodo-pago').value;
    const cliente = document.getElementById('nombre-cliente').value || "Cliente";
    let tel = document.getElementById('tel-cliente').value.replace(/\D/g, '');
    const p = inventario.find(item => item.filaOriginal == fila);
    const totalVenta = (parseFloat(p.precio) || 0) * cantidad;

    try {
        await fetch(SCRIPT_URL, {
            method: 'POST', mode: 'no-cors',
            body: JSON.stringify({ action: "venta", fila: parseInt(fila), productoNombre: nombreProd, cantidad, metodo, cliente, telefono: tel })
        });
        await generarPDF({ cliente, producto: nombreProd, cantidad, total: totalVenta, metodo });
        alert("Venta registrada.");
        cargarDesdeDrive();
        switchTab('inventario');
    } catch (e) { alert("Error"); }
}

async function generarPDF(datos) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const imgData = await getBase64Image(LOGO_URL);
    if (imgData) {
        doc.setGState(new doc.GState({ opacity: 0.1 }));
        doc.addImage(imgData, 'PNG', 45, 80, 120, 120);
        doc.setGState(new doc.GState({ opacity: 1.0 }));
        doc.addImage(imgData, 'PNG', 15, 12, 35, 35);
    }
    doc.setTextColor(214, 51, 132);
    doc.text("AMARE BEAUTY", 195, 25, { align: "right" });
    doc.save(`Recibo_${datos.cliente}.pdf`);
}

function switchTab(t) {
    document.querySelectorAll('.tab-content').forEach(s => s.style.display = 'none');
    document.querySelectorAll('.tabs button').forEach(b => b.classList.remove('active'));
    document.getElementById('sec-' + t).style.display = 'block';
    document.getElementById('tab-' + t).classList.add('active');
    if(t === 'stats') setTimeout(dibujarGraficos, 300);
}

function calcularVentasTotales() {
    const total = inventario.reduce((sum, p) => sum + ((parseFloat(p.precio) || 0) * (parseFloat(p.vendidos) || 0)), 0);
    document.getElementById('gran-total-dinero').innerText = `$${total.toLocaleString('es-CO')}`;
}

function filtrarSelectVentas() {
    const txt = document.getElementById('busqueda-venta').value.toLowerCase();
    const select = document.getElementById('select-producto');
    select.innerHTML = inventario.filter(p => p.nombre.toLowerCase().includes(txt))
        .map(p => `<option value="${p.filaOriginal}">${p.nombre}</option>`).join('');
}

function filtrarProductos() {
    const txt = document.getElementById('busqueda').value.toLowerCase();
    document.querySelectorAll('#lista-inventario li').forEach(li => {
        li.style.display = li.textContent.toLowerCase().includes(txt) ? 'flex' : 'none';
    });
}

function dibujarGraficos() {
    const ctxM = document.getElementById('canvasMetodos');
    if (!ctxM) return;
    if (charts.m) charts.m.destroy();
    const metData = historial.reduce((a, c) => (a[c.metodo] = (a[c.metodo] || 0) + 1, a), {});
    charts.m = new Chart(ctxM, {
        type: 'doughnut',
        data: { labels: Object.keys(metData), datasets: [{ data: Object.values(metData), backgroundColor: ['#d63384', '#6610f2', '#fd7e14', '#20c997'] }] },
        options: { responsive: true, maintainAspectRatio: false }
    });
}

window.onload = cargarDesdeDrive;
