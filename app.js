const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwT8PCPJYsOoUBBeJbiHWZeDHRUPn3QQOKCqWzLY37EC_SjL1VpMKttV68RGQ1oh_SkvQ/exec"; 
const CODIGO_PAIS = "57";
const LOGO_URL = "./logo.png"; 
const URL_CATALOGO = "https://drive.google.com/file/d/1FMtOGvlYbLwSofqO3WCkqG4k65MSzccn/view?usp=sharing"; 

let inventario = [];
let historial = [];
let clientes = [];
let charts = {};

async function cargarDesdeDrive() {
    const icon = document.getElementById('btn-sync-icon');
    if(icon) icon.classList.add('loading');
    try {
        const response = await fetch(`${SCRIPT_URL}?t=${Date.now()}`);
        const data = await response.json();
        inventario = data.inventario || [];
        historial = data.historial || [];
        clientes = data.clientes || [];
        
        renderInventario();
        renderClientes();
        calcularVentasTotales(); 
        filtrarSelectVentas();
        
        if(icon) icon.classList.remove('loading');
        document.getElementById('splash-screen').style.display = 'none';
    } catch (e) { console.error(e); }
}

function renderInventario() {
    const contenedor = document.getElementById('lista-inventario');
    contenedor.innerHTML = inventario.map(p => {
        const stockActual = (parseFloat(p.stock) || 0) - (parseFloat(p.vendidos) || 0);
        const agotado = stockActual <= 0;
        return `
            <div class="lista-item ${agotado ? 'sin-stock' : ''}">
                <div>
                    <strong>${p.nombre}</strong><br>
                    <small>${agotado ? '❌ AGOTADO' : '✅ Stock: ' + stockActual}</small>
                    <div style="color:#d63384; font-weight:bold;">$${parseFloat(p.precio).toLocaleString()}</div>
                </div>
                <button onclick="${agotado ? '' : `irAVenta('${p.filaOriginal}', '${p.nombre.replace(/'/g, "\\'")}')`}" 
                    style="background:${agotado ? '#ccc' : '#d63384'}; color:white; border:none; padding:10px 15px; border-radius:10px;">
                    ${agotado ? 'SIN STOCK' : 'VENDER'}
                </button>
            </div>
        `;
    }).join('');
}

function switchTab(t) {
    document.querySelectorAll('.tab-content').forEach(s => s.style.display = 'none');
    document.querySelectorAll('.tabs button').forEach(b => b.classList.remove('active'));
    document.getElementById('sec-' + t).style.display = 'block';
    document.getElementById('tab-' + t).classList.add('active');
    
    // ACTUALIZACIÓN AUTOMÁTICA AL CAMBIAR DE SECCIÓN
    cargarDesdeDrive(); 
    if(t === 'stats') setTimeout(dibujarGraficos, 500);
}

function dibujarGraficos() {
    const ctx = document.getElementById('canvasMetodos');
    if (charts.m) charts.m.destroy();
    const stats = historial.reduce((acc, curr) => (acc[curr.metodo] = (acc[curr.metodo] || 0) + 1, acc), {});
    charts.m = new Chart(ctx, {
        type: 'doughnut',
        data: { labels: Object.keys(stats), datasets: [{ data: Object.values(stats), backgroundColor: ['#d63384', '#3498db', '#f1c40f', '#2ecc71'] }] },
        options: { plugins: { title: { display: true, text: 'Métodos de Pago' } } }
    });
}

async function registrarVenta() {
    const select = document.getElementById('select-producto');
    const fila = select.value;
    if (!fila) return alert("Selecciona un producto");

    const p = inventario.find(item => item.filaOriginal == fila);
    const stockActual = (parseFloat(p.stock) || 0) - (parseFloat(p.vendidos) || 0);
    const cantidad = parseInt(document.getElementById('cant-venta').value);

    if (cantidad > stockActual) return alert("Stock insuficiente");

    const metodo = document.getElementById('metodo-pago').value;
    const cliente = document.getElementById('nombre-cliente').value || "Cliente";
    let tel = document.getElementById('tel-cliente').value.replace(/\D/g, '');
    const totalVenta = parseFloat(p.precio) * cantidad;

    try {
        await fetch(SCRIPT_URL, {
            method: 'POST', mode: 'no-cors',
            body: JSON.stringify({ action: "venta", fila: parseInt(fila), productoNombre: p.nombre, cantidad, metodo, cliente, telefono: tel })
        });

        await generarFacturaProfesional({ cliente, producto: p.nombre, cantidad, total: totalVenta, metodo, precioU: p.precio });
        
        if (tel.length >= 10) {
            const msj = `✨ *AMARE BEAUTY* ✨\n¡Hola ${cliente}! Gracias por elegirnos.\n📦 *Producto:* ${p.nombre}\n💰 *Total:* $${totalVenta.toLocaleString()}`;
            window.open(`https://wa.me/${CODIGO_PAIS}${tel}?text=${encodeURIComponent(msj)}`, '_blank');
        }

        alert("Venta registrada");
        switchTab('inventario');
    } catch (e) { alert("Error"); }
}

async function generarFacturaProfesional(datos) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    // Marca de Agua y Logo
    const imgData = await getBase64Image(LOGO_URL);
    if (imgData) {
        doc.saveGraphicsState();
        doc.setGState(new doc.GState({opacity: 0.1}));
        doc.addImage(imgData, 'PNG', 40, 80, 130, 130); // Marca de agua central
        doc.restoreGraphicsState();
        doc.addImage(imgData, 'PNG', 15, 15, 30, 30); // Logo superior
    }

    doc.setFont("helvetica", "bold");
    doc.setTextColor(214, 51, 132);
    doc.setFontSize(22);
    doc.text("AMARE BEAUTY", 195, 25, { align: "right" });
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text("Recibo Oficial de Venta", 195, 32, { align: "right" });

    doc.setDrawColor(214, 51, 132);
    doc.line(15, 50, 195, 50);

    doc.setTextColor(0);
    doc.text(`Fecha: ${new Date().toLocaleDateString()}`, 15, 60);
    doc.text(`Cliente: ${datos.cliente}`, 15, 67);
    doc.text(`Método: ${datos.metodo}`, 15, 74);

    // Tabla
    doc.setFillColor(245, 245, 245);
    doc.rect(15, 85, 180, 10, 'F');
    doc.text("Descripción", 20, 92);
    doc.text("Cant", 120, 92);
    doc.text("Precio U.", 145, 92);
    doc.text("Subtotal", 175, 92);

    doc.text(datos.producto, 20, 105);
    doc.text(datos.cantidad.toString(), 125, 105);
    doc.text(`$${parseFloat(datos.precioU).toLocaleString()}`, 145, 105);
    doc.text(`$${datos.total.toLocaleString()}`, 175, 105);

    doc.line(15, 115, 195, 115);
    doc.setFontSize(14);
    doc.text(`TOTAL: $${datos.total.toLocaleString()}`, 195, 125, { align: "right" });

    doc.setFontSize(9);
    doc.setTextColor(150);
    doc.text("¡Gracias por tu confianza! Síguenos en nuestras redes.", 105, 150, { align: "center" });

    doc.save(`Factura_${datos.cliente}.pdf`);
}

async function getBase64Image(url) {
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.onload = function() {
            const canvas = document.createElement('canvas');
            canvas.width = this.width; canvas.height = this.height;
            canvas.getContext('2d').drawImage(this, 0, 0);
            resolve(canvas.toDataURL('image/png'));
        };
        img.src = url;
    });
}

function renderClientes() {
    const contenedor = document.getElementById('lista-clientes-marketing');
    contenedor.innerHTML = clientes.map(c => `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:8px; border-bottom:1px solid #eee;">
            <span>${c.nombre}</span>
            <button onclick="marketingIndividual('${c.tel}', '${c.nombre}')" style="background:#25d366; color:white; border:none; padding:5px; border-radius:5px;">📲</button>
        </div>
    `).join('');
}

function marketingIndividual(tel, nombre) {
    const msj = `¡Hola ${nombre}! ✨ Te compartimos nuestro catálogo actualizado: ${URL_CATALOGO}`;
    window.open(`https://wa.me/${CODIGO_PAIS}${tel}?text=${encodeURIComponent(msj)}`, '_blank');
}

function marketingMasivo() {
    if (clientes.length === 0) return alert("Sin clientes");
    clientes.forEach((c, i) => setTimeout(() => marketingIndividual(c.tel, c.nombre), i * 1500));
}

function calcularVentasTotales() {
    const total = inventario.reduce((sum, p) => sum + (parseFloat(p.precio) * (parseFloat(p.vendidos) || 0)), 0);
    document.getElementById('gran-total-dinero').innerText = `$${total.toLocaleString('es-CO')}`;
}

function filtrarSelectVentas() {
    const txt = document.getElementById('busqueda-venta').value.toLowerCase();
    document.getElementById('select-producto').innerHTML = inventario
        .filter(p => p.nombre.toLowerCase().includes(txt))
        .map(p => {
            const stockActual = (parseFloat(p.stock) || 0) - (parseFloat(p.vendidos) || 0);
            return `<option value="${p.filaOriginal}" ${stockActual <= 0 ? 'disabled' : ''}>${p.nombre} (${stockActual <= 0 ? 'AGOTADO' : '$' + parseFloat(p.precio).toLocaleString()})</option>`;
        }).join('');
}

function filtrarProductos() {
    const txt = document.getElementById('busqueda').value.toLowerCase();
    document.querySelectorAll('.lista-item').forEach(it => {
        it.style.display = it.innerText.toLowerCase().includes(txt) ? 'flex' : 'none';
    });
}

function irAVenta(fila, nombre) {
    switchTab('ventas');
    document.getElementById('busqueda-venta').value = nombre;
    filtrarSelectVentas();
    document.getElementById('select-producto').value = fila;
}

function verCatalogo() { window.open(URL_CATALOGO, '_blank'); }

window.onload = cargarDesdeDrive;
