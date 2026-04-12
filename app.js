const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbw6_7DQLfpxqg2JIe-EPulXmx5-Zw6PLFEhLQR-mA7Rwcr-lFoN71AdJdgZtAPsSUodXQ/exec"; 
const CODIGO_PAIS = "57";

// ID del logo corregido y URL con Proxy para saltar el bloqueo CORS
const LOGO_ID = "1X12001K2W8G3_p8NRE2fGvWJ-4l7bYw-";
const LOGO_URL = `https://images1-focus-opensocial.googleusercontent.com/gadgets/proxy?container=focus&refresh=2592000&url=https://drive.google.com/uc?id=${LOGO_ID}`;

let inventario = [];
let historial = [];
let charts = {};

// Función para convertir imagen a formato procesable sin errores de CORS
async function getBase64Image(url) {
    try {
        const response = await fetch(url);
        const blob = await response.blob();
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.readAsDataURL(blob);
        });
    } catch (e) {
        console.error("Error al procesar logo:", e);
        return null;
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
        btn.innerText = disponible <= 0 ? "SIN STOCK" : "STOCK EXCEDIDO";
    } else {
        btn.disabled = false; btn.classList.remove('btn-disabled');
        btn.innerText = "REGISTRAR VENTA Y PDF";
    }
}

async function generarPDF(datos) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const fecha = new Date().toLocaleDateString();
    
    // Obtener la imagen base64 de forma segura
    const imgBase64 = await getBase64Image(LOGO_URL);

    if (imgBase64) {
        // Marca de agua central transparente
        doc.setGState(new doc.GState({ opacity: 0.08 }));
        doc.addImage(imgBase64, 'PNG', 45, 80, 120, 120);
        doc.setGState(new doc.GState({ opacity: 1.0 }));
        // Logo superior
        doc.addImage(imgBase64, 'PNG', 15, 10, 35, 35);
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.setTextColor(214, 51, 132); // Rosa Amare
    doc.text("AMARE BEAUTY", 195, 25, { align: "right" });
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text("Factura de Venta No. " + Date.now().toString().slice(-6), 195, 32, { align: "right" });
    
    doc.setDrawColor(214, 51, 132);
    doc.line(15, 48, 195, 48);

    doc.setFont("helvetica", "normal");
    doc.setTextColor(0);
    doc.setFontSize(11);
    doc.text(`Fecha: ${fecha}`, 15, 58);
    doc.text(`Cliente: ${datos.cliente}`, 15, 65);
    doc.text(`Método: ${datos.metodo}`, 15, 72);

    doc.setFillColor(245, 245, 245);
    doc.rect(15, 85, 180, 10, 'F');
    doc.setFont("helvetica", "bold");
    doc.text("Producto", 20, 92);
    doc.text("Cant.", 130, 92);
    doc.text("Total", 175, 92);

    doc.setFont("helvetica", "normal");
    doc.text(datos.producto, 20, 105);
    doc.text(datos.cantidad.toString(), 135, 105);
    doc.text(`$${datos.total.toLocaleString()}`, 175, 105, { align: "right" });

    doc.line(15, 115, 195, 115);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("TOTAL PAGADO:", 110, 130);
    doc.text(`$${datos.total.toLocaleString('es-CO')}`, 195, 130, { align: "right" });

    doc.setFontSize(10);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(150);
    doc.text("¡Gracias por elegir Amare Beauty!", 105, 160, { align: "center" });

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

        // Primero generamos el PDF (esto tarda un poco por la imagen)
        await generarPDF({ cliente, producto: nombreProd, cantidad, total: totalVenta, metodo });

        // Luego WhatsApp
        if (telFinal !== "N/A") {
            let msg = `¡Hola ${cliente}! ✨ Gracias por tu compra en Amare Beauty. ❤️`;
            window.open(`https://wa.me/${telFinal}?text=${encodeURIComponent(msg)}`, '_blank');
        }

        alert("Venta registrada y factura lista.");
        document.getElementById('busqueda-venta').value = "";
        btn.disabled = false;
        cargarDesdeDrive();
        switchTab('inventario');
    } catch (e) { alert("Error al registrar"); btn.disabled = false; }
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
