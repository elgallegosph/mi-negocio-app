const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwdYr3aID0rwjye9JnUJ2tk3JIr-NCNvLHSzWQj0ZkwqtXqKHAcUAk2IYwhLniVAE9j5Q/exec"; 
const CODIGO_PAIS = "57";
const LOGO_URL = "./logo.png"; 

let inventario = [];
let historial = [];
let clientes = [];
let charts = {};

async function cargarDesdeDrive(silencioso = false) {
    const icon = document.getElementById('btn-sync-icon');
    if(!silencioso && icon) icon.classList.add('loading');
    try {
        const response = await fetch(`${SCRIPT_URL}?t=${Date.now()}`);
        const data = await response.json();
        inventario = data.inventario || [];
        historial = data.historial || [];
        clientes = data.clientes || [];
        
        actualizarTodasLasSecciones();
        
        if(!silencioso && icon) icon.classList.remove('loading');
        document.getElementById('splash-screen').style.display = 'none';
    } catch (e) { console.error("Error de sincronización:", e); }
}

function actualizarTodasLasSecciones() {
    renderInventario();
    renderTablasGestion();
    calcularVentasTotales(); 
    filtrarSelectVentas();
}

function calcularVentasTotales() {
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
                    <strong style="font-size:1.1rem">${p.nombre}</strong><br>
                    <small style="color:${agotado ? 'red' : '#7f8c8d'}">${agotado ? '⚠ SIN EXISTENCIAS' : 'Stock: ' + stockActual + ' unidades'}</small><br>
                    <span style="color:var(--primary); font-weight:800; font-size:1.1rem;">$${parseFloat(p.precio).toLocaleString()}</span>
                </div>
                <button onclick="irAVenta('${p.filaOriginal}', '${p.nombre.replace(/'/g, "\\'")}')" 
                style="background:${agotado ? '#bdc3c7' : 'var(--primary)'}; color:white; border:none; padding:10px 18px; border-radius:12px; font-weight:bold; cursor:pointer;" ${agotado ? 'disabled' : ''}>
                    ${agotado ? 'N/A' : 'VENDER'}
                </button>
            </div>`;
    }).join('');
}

function renderTablasGestion() {
    const fiados = historial.filter(h => h.metodo.includes("Fiado"));
    const separados = historial.filter(h => h.metodo.includes("Separado"));

    document.getElementById('lista-fiados').innerHTML = fiados.map(h => `
        <tr>
            <td><strong>${h.cliente}</strong><br><small>${h.producto} (x${h.cantidad})</small></td>
            <td><button onclick="recordarPago('${h.tel}', '${h.cliente}', '${h.producto}')" style="background:#25d366; color:white; border:none; padding:8px 12px; border-radius:10px; cursor:pointer;">📲 Cobrar</button></td>
        </tr>`).join('');

    document.getElementById('lista-separados').innerHTML = separados.map(h => `
        <tr>
            <td><strong>${h.cliente}</strong><br><small>${h.producto}</small></td>
            <td><button onclick="cancelarVenta(${h.filaLog}, ${h.filaOrig}, ${h.cantidad})" style="background:#e74c3c; color:white; border:none; padding:8px 12px; border-radius:10px; cursor:pointer;">❌ Anular</button></td>
        </tr>`).join('');
}

async function cancelarVenta(filaLog, filaOriginal, cantidad) {
    if(!confirm("¿Deseas anular este separado? El producto volverá al inventario.")) return;
    try {
        await fetch(SCRIPT_URL, { method: 'POST', mode: 'no-cors', body: JSON.stringify({ action: "cancelar", filaLog, filaOriginal, cantidad }) });
        alert("Separado anulado correctamente.");
        await cargarDesdeDrive();
    } catch(e) { alert("Error al anular."); }
}

function recordarPago(tel, nombre, producto) {
    const msj = `Hola ${nombre} ✨, pasamos a saludarte de *Amare Beauty* y recordarte el pago pendiente de: *${producto}*. ¡Feliz día! 🌸`;
    window.open(`https://wa.me/${CODIGO_PAIS}${tel}?text=${encodeURIComponent(msj)}`, '_blank');
}

function switchTab(t) {
    document.querySelectorAll('.tab-content').forEach(s => s.style.display = 'none');
    document.querySelectorAll('.tabs button').forEach(b => b.classList.remove('active'));
    document.getElementById('sec-' + t).style.display = 'block';
    document.getElementById('tab-' + t).classList.add('active');
    
    // Actualización automática al cambiar de pestaña
    cargarDesdeDrive(true);
    if(t === 'stats') setTimeout(dibujarGraficos, 400);
}

function dibujarGraficos() {
    const ctx = document.getElementById('canvasMetodos');
    if (charts.m) charts.m.destroy();
    const stats = historial.reduce((acc, curr) => (acc[curr.metodo] = (acc[curr.metodo] || 0) + 1, acc), {});
    charts.m = new Chart(ctx, {
        type: 'doughnut',
        data: { labels: Object.keys(stats), datasets: [{ data: Object.values(stats), backgroundColor: ['#d63384', '#3498db', '#f1c40f', '#2ecc71', '#9b59b6'], borderWidth: 0 }] },
        options: { maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
    });
}

async function registrarVenta() {
    const fila = document.getElementById('select-producto').value;
    if(!fila) return alert("Por favor, selecciona un producto.");
    
    const p = inventario.find(item => item.filaOriginal == fila);
    const cantidad = parseInt(document.getElementById('cant-venta').value);
    const metodo = document.getElementById('metodo-pago').value;
    const cliente = document.getElementById('nombre-cliente').value || "Cliente";
    const tel = document.getElementById('tel-cliente').value.replace(/\D/g, '');

    // Bloqueo final de seguridad en cantidad
    const stockDisponible = (parseFloat(p.stock) || 0) - (parseFloat(p.vendidos) || 0);
    if(cantidad > stockDisponible) return alert("No hay suficiente stock para esta cantidad.");

    try {
        await fetch(SCRIPT_URL, { method: 'POST', mode: 'no-cors', body: JSON.stringify({ action: "venta", fila: parseInt(fila), productoNombre: p.nombre, cantidad, metodo, cliente, telefono: tel }) });
        await generarFactura(cliente, p.nombre, cantidad, (p.precio * cantidad), metodo, p.precio);
        alert("¡Venta procesada con éxito!");
        await cargarDesdeDrive();
        switchTab('inventario');
    } catch (e) { alert("Error al registrar."); }
}

async function generarFactura(c, prod, cant, tot, met, pu) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const img = await getBase64(LOGO_URL);
    
    if(img) {
        // Marca de agua en PDF
        doc.setGState(new doc.GState({opacity: 0.05}));
        doc.addImage(img, 'PNG', 40, 70, 130, 130);
        doc.setGState(new doc.GState({opacity: 1}));
        doc.addImage(img, 'PNG', 15, 15, 25, 25);
    }

    doc.setFont("helvetica", "bold"); doc.setTextColor(214, 51, 132); doc.setFontSize(24);
    doc.text("AMARE BEAUTY", 200, 25, {align:"right"});
    doc.setFontSize(10); doc.setTextColor(100); doc.text("COMPROBANTE ELECTRÓNICO", 200, 32, {align:"right"});
    
    doc.setDrawColor(214, 51, 132); doc.line(15, 45, 200, 45);
    
    doc.setFontSize(11); doc.setTextColor(50);
    doc.text(`CLIENTE: ${c.toUpperCase()}`, 15, 60);
    doc.text(`FECHA: ${new Date().toLocaleString()}`, 15, 67);
    doc.text(`MÉTODO DE PAGO: ${met}`, 15, 74);
    
    doc.setFillColor(214, 51, 132); doc.rect(15, 85, 185, 10, 'F');
    doc.setTextColor(255); doc.text("PRODUCTO", 20, 92); doc.text("CANT", 130, 92); doc.text("SUBTOTAL", 195, 92, {align:"right"});
    
    doc.setTextColor(0); doc.setFont("helvetica", "normal");
    doc.text(prod, 20, 105); doc.text(cant.toString(), 133, 105); doc.text(`$${tot.toLocaleString()}`, 195, 105, {align:"right"});
    
    doc.setFontSize(18); doc.setFont("helvetica", "bold"); doc.setTextColor(214, 51, 132);
    doc.text(`TOTAL: $${tot.toLocaleString()}`, 200, 130, {align:"right"});
    
    doc.setFontSize(9); doc.setTextColor(150); doc.text("Gracias por elegir Amare Beauty. ¡Vuelve pronto!", 105, 150, {align:"center"});
    
    doc.save(`Amare_${c}_Factura.pdf`);
}

function getBase64(url) {
    return new Promise(r => {
        const i = new Image(); i.crossOrigin='Anonymous';
        i.onload = () => { const c=document.createElement('canvas'); c.width=i.width; c.height=i.height; c.getContext('2d').drawImage(i,0,0); r(c.toDataURL()); };
        i.src = url;
    });
}

function filtrarSelectVentas() {
    const txt = document.getElementById('busqueda-venta').value.toLowerCase();
    document.getElementById('select-producto').innerHTML = inventario
        .filter(p => p.nombre.toLowerCase().includes(txt))
        .map(p => {
            const stockActual = (parseFloat(p.stock) || 0) - (parseFloat(p.vendidos) || 0);
            const agotado = stockActual <= 0;
            return `<option value="${p.filaOriginal}" ${agotado ? 'disabled' : ''} style="color:${agotado ? '#ccc' : '#000'}">
                ${p.nombre} ${agotado ? '(AGOTADO)' : '- $' + parseFloat(p.precio).toLocaleString()}
            </option>`;
        }).join('');
}

function filtrarProductos() {
    const txt = document.getElementById('busqueda').value.toLowerCase();
    document.querySelectorAll('.lista-item').forEach(it => it.style.display = it.innerText.toLowerCase().includes(txt) ? 'flex' : 'none');
}

function marketingMasivo() {
    if(!confirm("Se abrirán pestañas de WhatsApp para todos tus clientes registrados. ¿Continuar?")) return;
    clientes.forEach((c, i) => setTimeout(() => {
        const msj = `¡Hola ${c.nombre}! ✨ Te invitamos a conocer las novedades en *Amare Beauty*. Mira nuestro catálogo aquí: https://drive.google.com/file/d/1FMtOGvlYbLwSofqO3WCkqG4k65MSzccn/view?usp=sharing`;
        window.open(`https://wa.me/${CODIGO_PAIS}${c.tel}?text=${encodeURIComponent(msj)}`, '_blank');
    }, i * 2500));
}

function irAVenta(f, n) { switchTab('ventas'); document.getElementById('busqueda-venta').value = n; filtrarSelectVentas(); document.getElementById('select-producto').value = f; }

window.onload = cargarDesdeDrive;
