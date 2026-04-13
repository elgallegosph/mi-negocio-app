const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyx-Qo1aSC6EyYnFJfVqJUUL27nTOA2OIilTPFm2wyKwNwpO3ZY-hzXdsUWcM_3OIoeCw/exec"; 
const CODIGO_PAIS = "57";
const LOGO_URL = "./logo.png"; // Ruta local para evitar bloqueos CORS
const URL_CATALOGO = "https://drive.google.com/file/d/1FMtOGvlYbLwSofqO3WCkqG4k65MSzccn/view?usp=drive_link"; 

let inventario = [];
let historial = [];
let charts = {};

function ocultarSplash() {
    const splash = document.getElementById('splash-screen');
    if (splash) {
        splash.style.opacity = '0';
        setTimeout(() => splash.style.display = 'none', 800);
    }
}

async function cargarDesdeDrive() {
    try {
        const response = await fetch(`${SCRIPT_URL}?t=${Date.now()}`);
        const data = await response.json();
        inventario = data.inventario || [];
        historial = data.historial || [];
        renderInventario();
        calcularVentasTotales(); 
        filtrarSelectVentas(); // Reemplaza a actualizarSelect
        ocultarSplash();
    } catch (e) { 
        console.error("Error cargando datos:", e); 
        ocultarSplash(); 
    }
}

function renderInventario() {
    const contenedor = document.getElementById('lista-inventario');
    contenedor.innerHTML = inventario.map(p => {
        const disp = (parseFloat(p.stock) || 0) - (parseFloat(p.vendidos) || 0);
        return `
            <div class="lista-item">
                <div>
                    <strong>${p.nombre}</strong><br>
                    <small>Disponibles: ${disp}</small><br>
                    <span style="color:#d63384; font-weight:bold;">$${parseFloat(p.precio).toLocaleString()}</span>
                </div>
                <button class="btn-vender" onclick="irAVenta('${p.filaOriginal}', '${p.nombre.replace(/'/g, "\\'")}')">VENDER</button>
            </div>
        `;
    }).join('');
}

function irAVenta(fila, nombre) {
    switchTab('ventas');
    document.getElementById('busqueda-venta').value = nombre;
    filtrarSelectVentas();
    document.getElementById('select-producto').value = fila;
}

function filtrarSelectVentas() {
    const txt = document.getElementById('busqueda-venta').value.toLowerCase();
    const select = document.getElementById('select-producto');
    select.innerHTML = inventario
        .filter(p => p.nombre.toLowerCase().includes(txt))
        .map(p => `<option value="${p.filaOriginal}">${p.nombre} ($${parseFloat(p.precio).toLocaleString()})</option>`)
        .join('');
}

async function registrarVenta() {
    const select = document.getElementById('select-producto');
    const fila = select.value;
    if (!fila) return alert("Selecciona un producto");

    const p = inventario.find(item => item.filaOriginal == fila);
    const cantidad = parseInt(document.getElementById('cant-venta').value);
    const metodo = document.getElementById('metodo-pago').value;
    const cliente = document.getElementById('nombre-cliente').value || "Cliente";
    let tel = document.getElementById('tel-cliente').value.replace(/\D/g, '');
    
    const totalVenta = parseFloat(p.precio) * cantidad;

    try {
        await fetch(SCRIPT_URL, {
            method: 'POST', mode: 'no-cors',
            body: JSON.stringify({ 
                action: "venta", fila: parseInt(fila), 
                productoNombre: p.nombre, cantidad, metodo, cliente, telefono: tel 
            })
        });

        // WhatsApp
        if (tel.length >= 10) {
            const msj = encodeURIComponent(`✨ *AMARE BEAUTY* ✨\n\nHola ${cliente}, gracias por tu compra:\n🌸 *Producto:* ${p.nombre}\n🔢 *Cant:* ${cantidad}\n💰 *Total:* $${totalVenta.toLocaleString()}\n💳 *Pago:* ${metodo}`);
            window.open(`https://wa.me/${CODIGO_PAIS}${tel}?text=${msj}`, '_blank');
        }

        generarPDF({ cliente, producto: p.nombre, cantidad, total: totalVenta, metodo });
        alert("Venta registrada");
        cargarDesdeDrive();
        switchTab('inventario');
    } catch (e) { alert("Error al vender"); }
}

function generarPDF(datos) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.setTextColor(214, 51, 132);
    doc.text("AMARE BEAUTY - RECIBO", 105, 20, { align: "center" });
    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.text(`Cliente: ${datos.cliente}`, 20, 40);
    doc.text(`Producto: ${datos.producto}`, 20, 50);
    doc.text(`Cantidad: ${datos.cantidad}`, 20, 60);
    doc.text(`Total: $${datos.total.toLocaleString()}`, 20, 70);
    doc.text(`Método: ${datos.metodo}`, 20, 80);
    doc.save(`Recibo_${datos.cliente}.pdf`);
}

function switchTab(t) {
    document.querySelectorAll('.tab-content').forEach(s => s.style.display = 'none');
    document.querySelectorAll('.tabs button').forEach(b => b.classList.remove('active'));
    document.getElementById('sec-' + t).style.display = 'block';
    document.getElementById('tab-' + t).classList.add('active');
    if(t === 'stats') dibujarGraficos();
}

function dibujarGraficos() {
    const ctx = document.getElementById('canvasMetodos');
    if (!ctx) return;
    if (charts.m) charts.m.destroy();
    
    const stats = historial.reduce((acc, curr) => {
        acc[curr.metodo] = (acc[curr.metodo] || 0) + 1;
        return acc;
    }, {});

    charts.m = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(stats),
            datasets: [{ data: Object.values(stats), backgroundColor: ['#d63384', '#3498db', '#f1c40f', '#2ecc71'] }]
        }
    });
}

function calcularVentasTotales() {
    const total = inventario.reduce((sum, p) => sum + (parseFloat(p.precio) * (parseFloat(p.vendidos) || 0)), 0);
    document.getElementById('gran-total-dinero').innerText = `$${total.toLocaleString('es-CO')}`;
}

function filtrarProductos() {
    const txt = document.getElementById('busqueda').value.toLowerCase();
    renderInventario(); // Re-renderizamos para filtrar
    const items = document.querySelectorAll('.lista-item');
    items.forEach(it => {
        if (!it.textContent.toLowerCase().includes(txt)) it.style.display = 'none';
    });
}

function verCatalogo() { window.open(URL_CATALOGO, '_blank'); }

function enviarMarketingMasivo() {
    const msj = encodeURIComponent(`✨ *AMARE BEAUTY* ✨\n¡Mira nuestras novedades! Haz clic aquí para ver el catálogo: ${URL_CATALOGO}`);
    window.open(`https://wa.me/?text=${msj}`, '_blank');
}

window.onload = cargarDesdeDrive;
