const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbw6_7DQLfpxqg2JIe-EPulXmx5-Zw6PLFEhLQR-mA7Rwcr-lFoN71AdJdgZtAPsSUodXQ/exec"; 
const CODIGO_PAIS = "57";
// Enlace directo a la imagen del logo (usando el ID de tu drive para visualización directa)
const LOGO_URL = "https://lh3.googleusercontent.com/u/0/d/1Xl200lK2Ww5Z66pLpxZ8YF4H7Vq_mBvY"; 

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
    } catch (e) { console.error(e); if (syncBtn) syncBtn.innerText = "❌"; }
}

function renderInventario() {
    const lista = document.getElementById('lista-inventario');
    if (!lista) return;
    lista.innerHTML = inventario.map(p => {
        const disponible = (parseFloat(p.stock) || 0) - (parseFloat(p.vendidos) || 0);
        const agotado = disponible <= 0;
        return `<li class="lista-item ${agotado ? 'sin-stock' : ''}" 
            onclick="${agotado ? "alert('Sin stock')" : `irAVenta('${p.filaOriginal}', '${p.nombre.replace(/'/g, "\\'")}')`}">
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

function validarStockSeleccionado() {
    const select = document.getElementById('select-producto');
    const btn = document.getElementById('btn-registrar-final');
    const cantInput = document.getElementById('cant-venta');
    const cantidad = parseInt(cantInput.value) || 0;
    if (!select.value) return;
    const p = inventario.find(item => item.filaOriginal == select.value);
    const disponible = (parseFloat(p.stock) || 0) - (parseFloat(p.vendidos) || 0);
    if (disponible <= 0 || cantidad > disponible) {
        btn.disabled = true; btn.classList.add('btn-disabled');
        btn.innerText = disponible <= 0 ? "SIN STOCK" : "REBASA STOCK";
    } else {
        btn.disabled = false; btn.classList.remove('btn-disabled');
        btn.innerText = "REGISTRAR VENTA Y FACTURA";
    }
}

async function generarPDF(datos) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const fecha = new Date().toLocaleDateString();

    // 1. Marca de Agua (Imagen en el centro con transparencia)
    try {
        doc.setGState(new doc.GState({ opacity: 0.1 })); // Transparencia baja
        doc.addImage(LOGO_URL, 'PNG', 40, 80, 130, 130);
        doc.setGState(new doc.GState({ opacity: 1.0 })); // Restaurar opacidad
    } catch(e) { console.log("Error cargando marca de agua"); }

    // 2. Logo en la parte superior izquierda
    try {
        doc.addImage(LOGO_URL, 'PNG', 20, 10, 30, 30);
    } catch(e) { console.log("Error cargando logo superior"); }

    // Cabecera Texto
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.setTextColor(214, 51, 132); // Rosa Amare
    doc.text("AMARE BEAUTY", 190, 25, { align: "right" });
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text("Factura de Venta No. " + Date.now().toString().slice(-6), 190, 32, { align: "right" });
    
    doc.setDrawColor(214, 51, 132);
    doc.line(20, 45, 190, 45);

    // Datos del Cliente
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0);
    doc.setFontSize(11);
    doc.text(`Fecha: ${fecha}`, 20, 55);
    doc.text(`Cliente: ${datos.cliente}`, 20, 62);
    doc.text(`Método de Pago: ${datos.metodo}`, 20, 69);

    // Tabla de Productos
    doc.setFillColor(245, 245, 245);
    doc.rect(20, 80, 170, 10, 'F');
    doc.setFont("helvetica", "bold");
    doc.text("Descripción", 25, 87);
    doc.text("Cant.", 120, 87);
    doc.text("Precio Unit.", 145, 87);
    doc.text("Total", 175, 87);

    doc.setFont("helvetica", "normal");
    doc.text(datos.producto, 25, 100);
    doc.text(datos.cantidad.toString(), 125, 100);
    doc.text(`$${datos.precioUnit.toLocaleString()}`, 145, 100);
    doc.text(`$${datos.total.toLocaleString()}`, 175, 100);

    doc.line(20, 110, 190, 110);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("TOTAL PAGADO:", 110, 125);
    doc.text(`$${datos.total.toLocaleString('es-CO')}`, 190, 125, { align: "right" });

    // Pie de página
    doc.setFontSize(10);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(150);
    doc.text("¡Gracias por resaltar tu belleza con nosotros!", 105, 150, { align: "center" });

    doc.save(`Amare_Factura_${datos.cliente}.pdf`);
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

    const p = inventario.find(item => item.filaOriginal == fila);
    const totalVenta = (parseFloat(p.precio) || 0) * cantidad;

    btn.disabled = true;
    try {
        let telFinal = telInput ? (telInput.startsWith(CODIGO_PAIS) ? telInput : CODIGO_PAIS + telInput) : "N/A";
        await fetch(SCRIPT_URL, {
            method: 'POST', mode: 'no-cors',
            body: JSON.stringify({
                action: "venta", fila: parseInt(fila), productoNombre: nombreProd,
                cantidad, metodo, cliente, telefono: telFinal
            })
        });

        // Generar Factura PDF con Logo
        await generarPDF({ cliente, producto: nombreProd, cantidad, precioUnit: parseFloat(p.precio), total: totalVenta, metodo });

        // Enviar WhatsApp
        if (telFinal !== "N/A") {
            let msg = (metodo === "Efectivo" || metodo === "Transferencia") 
                ? `¡Hola ${cliente}! ✨ Gracias por tu compra en Amare Beauty. ❤️`
                : (metodo === "Separado") ? `¡Hola ${cliente}! ✨ Producto separado en Amare Beauty. 📦` 
                : `¡Hola ${cliente}! ✨ Tu pedido queda pendiente por pagar en Amare Beauty. 📝`;
            window.open(`https://wa.me/${telFinal}?text=${encodeURIComponent(msg)}`, '_blank');
        }

        alert("¡Venta Exitosa y Factura Generada!");
        document.getElementById('busqueda-venta').value = "";
        btn.disabled = false;
        cargarDesdeDrive();
        switchTab('inventario');
    } catch (e) { alert("Error"); btn.disabled = false; }
}

// ... Resto de funciones (switchTab, calcularVentasTotales, filtrarSelectVentas, filtrarProductos, actualizarSelect, dibujarGraficos) se mantienen igual a la versión anterior.

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

window.onload = cargarDesdeDrive;
