const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzG4Yhneh_gNNrvdsOdPXW9vXuapez3DMRZfOedmUji44g-T5aix8wHxwaNvxwuqc4I/exec"; 
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

function calcularVentasTotales() {
    // Cálculo seguro del total real
    const total = inventario.reduce((sum, p) => {
        const precio = parseFloat(p.precio) || 0;
        const vendidos = parseFloat(p.vendidos) || 0;
        return sum + (precio * vendidos);
    }, 0);
    document.getElementById('gran-total-dinero').innerText = `$${total.toLocaleString('es-CO')}`;
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
                    style="background:${agotado ? '#ccc' : '#d63384'}; color:white; border:none; padding:10px 15px; border-radius:12px; cursor:pointer;">
                    ${agotado ? 'AGOTADO' : 'VENDER'}
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
    
    cargarDesdeDrive(); 
    if(t === 'stats') setTimeout(dibujarGraficos, 600);
}

function dibujarGraficos() {
    const ctx = document.getElementById('canvasMetodos');
    if (!ctx) return;
    if (charts.m) charts.m.destroy();
    
    const stats = historial.reduce((acc, curr) => {
        const m = curr.metodo || "Efectivo";
        acc[m] = (acc[m] || 0) + 1;
        return acc;
    }, {});

    charts.m = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(stats),
            datasets: [{
                data: Object.values(stats),
                backgroundColor: ['#d63384', '#3498db', '#f1c40f', '#2ecc71', '#9b59b6'],
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom' } }
        }
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
            const msj = `✨ *AMARE BEAUTY* ✨\n¡Hola ${cliente}! Gracias por tu compra.\n\n📦 *Detalle:* ${p.nombre} (x${cantidad})\n💰 *Total:* $${totalVenta.toLocaleString()}`;
            window.open(`https://wa.me/${CODIGO_PAIS}${tel}?text=${encodeURIComponent(msj)}`, '_blank');
        }

        alert("¡Venta exitosa!");
        switchTab('inventario');
    } catch (e) { alert("Error de registro"); }
}

async function generarFacturaProfesional(datos) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const imgData = await getBase64Image(LOGO_URL);
    
    // Configuración de Marca de Agua Centrada
    if (imgData) {
        doc.saveGraphicsState();
        doc.setGState(new doc.GState({opacity: 0.08}));
        doc.addImage(imgData, 'PNG', 45, 80, 120, 120); 
        doc.restoreGraphicsState();
        doc.addImage(imgData, 'PNG', 15, 12, 25, 25); // Mini logo arriba
    }

    // Cabecera Profesional
    doc.setFont("helvetica", "bold");
    doc.setTextColor(214, 51, 132); // Rosa Amare
    doc.setFontSize(24);
    doc.text("AMARE BEAUTY", 200, 25, { align: "right" });
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.setFont("helvetica", "normal");
    doc.text("RECIBO OFICIAL DE VENTA", 200, 31, { align: "right" });
    doc.text("📍 San José, Caldas", 200, 36, { align: "right" });

    // Línea divisoria
    doc.setDrawColor(214, 51, 132);
    doc.setLineWidth(0.5);
    doc.line(15, 45, 200, 45);

    // Información del Cliente
    doc.setTextColor(50);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("DATOS DE LA VENTA", 15, 55);
    
    doc.setFont("helvetica", "normal");
    doc.text(`Fecha: ${new Date().toLocaleDateString()}`, 15, 62);
    doc.text(`Cliente: ${datos.cliente}`, 15, 68);
    doc.text(`Método de Pago: ${datos.metodo}`, 15, 74);

    // Tabla de Productos con Estilo Profesional
    doc.setFillColor(214, 51, 132);
    doc.rect(15, 85, 185, 10, 'F');
    doc.setTextColor(255);
    doc.setFont("helvetica", "bold");
    doc.text("DESCRIPCIÓN DEL PRODUCTO", 20, 92);
    doc.text("CANT", 130, 92);
    doc.text("PRECIO UNIT.", 150, 92);
    doc.text("TOTAL", 185, 92, { align: "right" });

    // Fila de producto
    doc.setTextColor(0);
    doc.setFont("helvetica", "normal");
    doc.text(datos.producto, 20, 105);
    doc.text(datos.cantidad.toString(), 133, 105);
    doc.text(`$${parseFloat(datos.precioU).toLocaleString()}`, 150, 105);
    doc.text(`$${datos.total.toLocaleString()}`, 195, 105, { align: "right" });

    // Línea de Cierre y Total
    doc.setDrawColor(200);
    doc.line(15, 115, 200, 115);
    
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(214, 51, 132);
    doc.text(`TOTAL A PAGAR: $${datos.total.toLocaleString()}`, 200, 128, { align: "right" });

    // Pie de página
    doc.setFontSize(9);
    doc.setTextColor(150);
    doc.setFont("helvetica", "italic");
    doc.text("¡Gracias por preferir Amare Beauty!", 107, 160, { align: "center" });
    doc.text("Este documento es un soporte de pago virtual.", 107, 165, { align: "center" });

    doc.save(`Recibo_Amare_${datos.cliente.replace(/\s/g, '_')}.pdf`);
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
        <div style="display:flex; justify-content:space-between; align-items:center; padding:10px; border-bottom:1px solid #eee;">
            <span>${c.nombre}</span>
            <button onclick="marketingIndividual('${c.tel}', '${c.nombre}')" style="background:#25d366; color:white; border:none; padding:5px 10px; border-radius:8px;">WhatsApp</button>
        </div>
    `).join('');
}

function marketingIndividual(tel, nombre) {
    const msj = `¡Hola ${nombre}! ✨ Te compartimos nuestro catálogo de *Amare Beauty*: ${URL_CATALOGO}`;
    window.open(`https://wa.me/${CODIGO_PAIS}${tel}?text=${encodeURIComponent(msj)}`, '_blank');
}

function marketingMasivo() {
    if (clientes.length === 0) return alert("Sin clientes registrados.");
    clientes.forEach((c, i) => setTimeout(() => marketingIndividual(c.tel, c.nombre), i * 1800));
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
