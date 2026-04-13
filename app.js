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
    } catch (e) { 
        console.error("Error cargando datos:", e);
        if(icon) icon.classList.remove('loading');
    }
}

function calcularVentasTotales() {
    // Calcula el total real basado en los productos vendidos multiplicados por su precio
    const total = inventario.reduce((sum, p) => sum + (parseFloat(p.precio) * (parseFloat(p.vendidos) || 0)), 0);
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
                    <small>${agotado ? '❌ SIN EXISTENCIAS' : '✅ Stock: ' + stockActual}</small>
                    <div style="color:#d63384; font-weight:bold; font-size:1.1rem;">$${parseFloat(p.precio).toLocaleString()}</div>
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
    
    // Actualización automática al navegar
    cargarDesdeDrive(); 
    if(t === 'stats') setTimeout(dibujarGraficos, 600);
}

function dibujarGraficos() {
    const ctx = document.getElementById('canvasMetodos');
    if (!ctx) return;
    if (charts.m) charts.m.destroy();
    
    // Agrupar datos reales del historial
    const stats = historial.reduce((acc, curr) => {
        const m = curr.metodo || "Otro";
        acc[m] = (acc[m] || 0) + 1;
        return acc;
    }, {});

    charts.m = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: Object.keys(stats),
            datasets: [{
                data: Object.values(stats),
                backgroundColor: ['#d63384', '#3498db', '#f1c40f', '#2ecc71', '#9b59b6'],
                borderWidth: 2,
                borderColor: '#ffffff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom' }
            }
        }
    });
}

async function registrarVenta() {
    const select = document.getElementById('select-producto');
    const fila = select.value;
    if (!fila) return alert("Por favor, selecciona un producto.");

    const p = inventario.find(item => item.filaOriginal == fila);
    const stockActual = (parseFloat(p.stock) || 0) - (parseFloat(p.vendidos) || 0);
    const cantidad = parseInt(document.getElementById('cant-venta').value);

    if (cantidad > stockActual) return alert("Lo sentimos, no hay stock suficiente.");

    const metodo = document.getElementById('metodo-pago').value;
    const cliente = document.getElementById('nombre-cliente').value || "Cliente General";
    let tel = document.getElementById('tel-cliente').value.replace(/\D/g, '');
    const totalVenta = parseFloat(p.precio) * cantidad;

    try {
        await fetch(SCRIPT_URL, {
            method: 'POST', mode: 'no-cors',
            body: JSON.stringify({ action: "venta", fila: parseInt(fila), productoNombre: p.nombre, cantidad, metodo, cliente, telefono: tel })
        });

        // Generar Factura con Marca de Agua
        await generarFacturaProfesional({ cliente, producto: p.nombre, cantidad, total: totalVenta, metodo, precioU: p.precio });
        
        // Enviar WhatsApp si hay número
        if (tel.length >= 10) {
            const msj = `✨ *AMARE BEAUTY* ✨\n¡Hola ${cliente}! Muchas gracias por tu compra.\n\n📦 *Detalle:* ${p.nombre} (x${cantidad})\n💰 *Total:* $${totalVenta.toLocaleString()}\n💳 *Pago:* ${metodo}`;
            window.open(`https://wa.me/${CODIGO_PAIS}${tel}?text=${encodeURIComponent(msj)}`, '_blank');
        }

        alert("¡Venta registrada exitosamente!");
        switchTab('inventario');
    } catch (e) { alert("Error al conectar con la base de datos."); }
}

async function generarFacturaProfesional(datos) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const imgData = await getBase64Image(LOGO_URL);
    
    // Marca de Agua Central
    if (imgData) {
        doc.saveGraphicsState();
        doc.setGState(new doc.GState({opacity: 0.08}));
        doc.addImage(imgData, 'PNG', 45, 80, 120, 120);
        doc.restoreGraphicsState();
        doc.addImage(imgData, 'PNG', 15, 15, 25, 25);
    }

    doc.setFont("helvetica", "bold");
    doc.setTextColor(214, 51, 132);
    doc.setFontSize(22);
    doc.text("AMARE BEAUTY", 195, 25, { align: "right" });
    
    doc.setFontSize(10);
    doc.setTextColor(80);
    doc.text("COMPROBANTE DE PAGO", 195, 32, { align: "right" });

    doc.setDrawColor(214, 51, 132);
    doc.line(15, 45, 195, 45);

    doc.setTextColor(0);
    doc.setFontSize(11);
    doc.text(`Fecha: ${new Date().toLocaleDateString()}`, 15, 55);
    doc.text(`Cliente: ${datos.cliente}`, 15, 62);
    doc.text(`Forma de Pago: ${datos.metodo}`, 15, 69);

    // Encabezado de Tabla
    doc.setFillColor(245, 245, 245);
    doc.rect(15, 80, 180, 10, 'F');
    doc.setFont("helvetica", "bold");
    doc.text("Producto", 20, 87);
    doc.text("Cant.", 110, 87);
    doc.text("Precio Unit.", 140, 87);
    doc.text("Total", 175, 87);

    // Contenido
    doc.setFont("helvetica", "normal");
    doc.text(datos.producto, 20, 98);
    doc.text(datos.cantidad.toString(), 115, 98);
    doc.text(`$${parseFloat(datos.precioU).toLocaleString()}`, 140, 98);
    doc.text(`$${datos.total.toLocaleString()}`, 175, 98);

    doc.setDrawColor(200);
    doc.line(15, 110, 195, 110);
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text(`TOTAL A PAGAR: $${datos.total.toLocaleString()}`, 195, 120, { align: "right" });

    doc.setFontSize(9);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(120);
    doc.text("Gracias por apoyar nuestro emprendimiento.", 105, 150, { align: "center" });

    doc.save(`Amare_Factura_${datos.cliente.replace(/\s/g, '_')}.pdf`);
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
            <span style="font-weight:500;">${c.nombre}</span>
            <button onclick="marketingIndividual('${c.tel}', '${c.nombre}')" style="background:#25d366; color:white; border:none; padding:6px 12px; border-radius:8px; font-size:14px;">WhatsApp</button>
        </div>
    `).join('');
}

function marketingIndividual(tel, nombre) {
    const msj = `¡Hola ${nombre}! ✨ Te enviamos nuestro catálogo actualizado de *Amare Beauty* para que no te pierdas nada: ${URL_CATALOGO}`;
    window.open(`https://wa.me/${CODIGO_PAIS}${tel}?text=${encodeURIComponent(msj)}`, '_blank');
}

function marketingMasivo() {
    if (clientes.length === 0) return alert("No hay clientes en el historial.");
    if(confirm(`Se abrirán ${clientes.length} chats. ¿Continuar?`)) {
        clientes.forEach((c, i) => setTimeout(() => marketingIndividual(c.tel, c.nombre), i * 1800));
    }
}

function filtrarSelectVentas() {
    const txt = document.getElementById('busqueda-venta').value.toLowerCase();
    document.getElementById('select-producto').innerHTML = inventario
        .filter(p => p.nombre.toLowerCase().includes(txt))
        .map(p => {
            const stockActual = (parseFloat(p.stock) || 0) - (parseFloat(p.vendidos) || 0);
            return `<option value="${p.filaOriginal}" ${stockActual <= 0 ? 'disabled' : ''}>${p.nombre} (${stockActual <= 0 ? 'SIN STOCK' : '$' + parseFloat(p.precio).toLocaleString()})</option>`;
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
