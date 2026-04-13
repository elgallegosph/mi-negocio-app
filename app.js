const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyJj-TZm_9__ZOWz_zQvi_ojC71mxAbjW_qBbn__9tpCTHIw8jG0AEqq6QKDSfCV0EFMg/exec"; 
const CODIGO_PAIS = "57";
const LOGO_URL = "./logo.png"; 
const URL_CATALOGO = "https://drive.google.com/file/d/1FMtOGvlYbLwSofqO3WCkqG4k65MSzccn/view?usp=drive_link"; 

let inventario = [];
let historial = [];
let listaClientes = []; 
let charts = {};

// Quitar portada al cargar
function ocultarSplash() {
    const splash = document.getElementById('splash-screen');
    if (splash) {
        splash.style.opacity = '0';
        setTimeout(() => {
            splash.style.visibility = 'hidden';
        }, 1000);
    }
}

function verCatalogo() {
    window.open(URL_CATALOGO, '_blank');
}

async function enviarMarketingMasivo() {
    if (listaClientes.length === 0) {
        alert("No hay clientes registrados con teléfono todavía.");
        return;
    }
    const confirmacion = confirm(`¿Quieres abrir los chats para enviar el catálogo a ${listaClientes.length} clientes?`);
    if (!confirmacion) return;

    const status = document.getElementById('status-marketing');
    status.innerText = "Abriendo chats...";

    for (let i = 0; i < listaClientes.length; i++) {
        const c = listaClientes[i];
        const mensaje = encodeURIComponent(`¡Hola ${c.nombre}! ✨ Te compartimos nuestro catálogo actualizado de Amare Beauty con muchas novedades para ti: ${URL_CATALOGO}`);
        window.open(`https://wa.me/${c.tel}?text=${mensaje}`, '_blank');
        await new Promise(r => setTimeout(r, 800));
    }
    status.innerText = "✅ Chats abiertos con éxito.";
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
        
        // Ocultar portada una vez cargado todo
        ocultarSplash();
    } catch (e) { 
        console.error(e); 
        if (syncBtn) syncBtn.innerText = "❌";
        ocultarSplash(); // Ocultar aunque falle para poder usar la app
    }
}

async function getBase64Image(url) {
    try {
        const response = await fetch(url);
        const blob = await response.blob();
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.readAsDataURL(blob);
        });
    } catch (e) { return null; }
}

function renderInventario() {
    const lista = document.getElementById('lista-inventario');
    if (!lista) return;
    lista.innerHTML = inventario.map(p => {
        const disp = (parseFloat(p.stock) || 0) - (parseFloat(p.vendidos) || 0);
        const agotado = disp <= 0;
        return `<li class="lista-item ${agotado ? 'sin-stock' : ''}" 
            onclick="${agotado ? "alert('Sin stock')" : `irAVenta('${p.filaOriginal}', '${p.nombre.replace(/'/g, "\\'")}')`}">
            <div class="product-info">
                <span class="product-name">${p.nombre}</span><br>
                <span style="font-size:0.85rem; color:#666;">Disponibles: ${disp}</span>
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
    const disp = (parseFloat(p.stock) || 0) - (parseFloat(p.vendidos) || 0);
    if (disp <= 0 || cantidad > disp) {
        btn.disabled = true; btn.classList.add('btn-disabled');
        btn.innerText = "STOCK INSUFICIENTE";
    } else {
        btn.disabled = false; btn.classList.remove('btn-disabled');
        btn.innerText = "REGISTRAR VENTA Y PDF";
    }
}

async function generarPDF(datos) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const imgData = await getBase64Image(LOGO_URL);
    if (imgData) {
        doc.setGState(new doc.GState({ opacity: 0.07 }));
        doc.addImage(imgData, 'PNG', 45, 85, 120, 120);
        doc.setGState(new doc.GState({ opacity: 1.0 }));
        doc.addImage(imgData, 'PNG', 15, 12, 35, 35);
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.setTextColor(214, 51, 132); 
    doc.text("AMARE BEAUTY", 195, 25, { align: "right" });
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text("Factura: #" + Date.now().toString().slice(-6), 195, 32, { align: "right" });
    doc.setDrawColor(214, 51, 132);
    doc.line(15, 50, 195, 50);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0);
    doc.setFontSize(11);
    doc.text(`Fecha: ${new Date().toLocaleDateString()}`, 15, 60);
    doc.text(`Cliente: ${datos.cliente}`, 15, 67);
    doc.text(`Pago: ${datos.metodo}`, 15, 74);
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
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("TOTAL:", 130, 130);
    doc.text(`$${datos.total.toLocaleString('es-CO')}`, 195, 130, { align: "right" });
    doc.save(`Factura_${datos.cliente}.pdf`);
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
        await generarPDF({ cliente, producto: nombreProd, cantidad, total: totalVenta, metodo });

        if (telFinal !== "N/A") {
            let mensajeWhatsApp = "";
            let enlaceCatalogo = `\n\n📖 Mira nuestro catálogo actualizado aquí: ${URL_CATALOGO}`;
            if (metodo === "Fiado" || metodo === "Separado") {
                mensajeWhatsApp = `¡Hola ${cliente}! ✨ Te envío el comprobante de tu producto: *${nombreProd}*. Recuerda que quedó pendiente de pago bajo la modalidad de *${metodo}*. ¡Gracias por confiar en Amare Beauty! ❤️` + enlaceCatalogo;
            } else {
                mensajeWhatsApp = `¡Hola ${cliente}! ✨ Gracias por tu compra de *${nombreProd}* en Amare Beauty. ❤️ Adjunto tu comprobante de pago por valor de $${totalVenta.toLocaleString('es-CO')}. ¡Que lo disfrutes!` + enlaceCatalogo;
            }
            window.open(`https://wa.me/${telFinal}?text=${encodeURIComponent(mensajeWhatsApp)}`, '_blank');
        }
        alert("Venta registrada con éxito.");
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
