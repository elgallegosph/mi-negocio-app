const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwdYr3aID0rwjye9JnUJ2tk3JIr-NCNvLHSzWQj0ZkwqtXqKHAcUAk2IYwhLniVAE9j5Q/exec"; 
const CODIGO_PAIS = "57";
const LOGO_URL = "./logo.png"; 

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
        renderTablasGestion();
        calcularVentasTotales(); 
        filtrarSelectVentas();
        if(icon) icon.classList.remove('loading');
        document.getElementById('splash-screen').style.display = 'none';
    } catch (e) { console.error(e); }
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
                <div><strong>${p.nombre}</strong><br><small>${agotado ? '❌ AGOTADO' : 'Stock: ' + stockActual}</small><br>
                <span style="color:#d63384; font-weight:bold;">$${parseFloat(p.precio).toLocaleString()}</span></div>
                <button onclick="irAVenta('${p.filaOriginal}', '${p.nombre.replace(/'/g, "\\'")}')" 
                style="background:${agotado ? '#ccc' : '#d63384'}; color:white; border:none; padding:8px 12px; border-radius:10px; cursor:pointer;" ${agotado ? 'disabled' : ''}>VENDER</button>
            </div>`;
    }).join('');
}

function renderTablasGestion() {
    document.getElementById('lista-fiados').innerHTML = historial.filter(h => h.metodo.includes("Fiado")).map(h => `
        <tr><td><strong>${h.cliente}</strong><br><small>${h.producto}</small></td>
        <td><button onclick="recordarPago('${h.tel}', '${h.cliente}', '${h.producto}')" style="background:#25d366; color:white; border:none; padding:5px; border-radius:5px;">Cobrar</button></td></tr>`).join('');

    document.getElementById('lista-separados').innerHTML = historial.filter(h => h.metodo.includes("Separado")).map(h => `
        <tr><td><strong>${h.cliente}</strong><br><small>${h.producto}</small></td>
        <td><button onclick="cancelarVenta(${h.filaLog}, ${h.filaOrig}, ${h.cantidad})" style="background:#e74c3c; color:white; border:none; padding:5px; border-radius:5px;">Anular</button></td></tr>`).join('');
}

function recordarPago(tel, nombre, producto) {
    const msj = `Hola ${nombre} 🌸, recordatorio de pago pendiente en Amare Beauty por: *${producto}*. ✨`;
    window.open(`https://wa.me/${CODIGO_PAIS}${tel}?text=${encodeURIComponent(msj)}`, '_blank');
}

async function cancelarVenta(filaLog, filaOriginal, cantidad) {
    if(!confirm("¿Anular y devolver stock?")) return;
    await fetch(SCRIPT_URL, { method: 'POST', mode: 'no-cors', body: JSON.stringify({ action: "cancelar", filaLog, filaOriginal, cantidad }) });
    alert("¡Anulado!"); cargarDesdeDrive();
}

function switchTab(t) {
    document.querySelectorAll('.tab-content').forEach(s => s.style.display = 'none');
    document.querySelectorAll('.tabs button').forEach(b => b.classList.remove('active'));
    document.getElementById('sec-' + t).style.display = 'block';
    document.getElementById('tab-' + t).classList.add('active');
    if(t === 'stats') setTimeout(dibujarGraficos, 400);
}

function dibujarGraficos() {
    const ctx = document.getElementById('canvasMetodos');
    if (charts.m) charts.m.destroy();
    const stats = historial.reduce((acc, curr) => (acc[curr.metodo] = (acc[curr.metodo] || 0) + 1, acc), {});
    charts.m = new Chart(ctx, { type: 'pie', data: { labels: Object.keys(stats), datasets: [{ data: Object.values(stats), backgroundColor: ['#d63384', '#3498db', '#f1c40f', '#2ecc71'] }] } });
}

async function registrarVenta() {
    const fila = document.getElementById('select-producto').value;
    if(!fila) return alert("Selecciona producto");
    const p = inventario.find(item => item.filaOriginal == fila);
    const cantidad = parseInt(document.getElementById('cant-venta').value);
    const metodo = document.getElementById('metodo-pago').value;
    const cliente = document.getElementById('nombre-cliente').value || "Cliente";
    const tel = document.getElementById('tel-cliente').value.replace(/\D/g, '');

    await fetch(SCRIPT_URL, { method: 'POST', mode: 'no-cors', body: JSON.stringify({ action: "venta", fila: parseInt(fila), productoNombre: p.nombre, cantidad, metodo, cliente, telefono: tel }) });
    await generarFactura(cliente, p.nombre, cantidad, (p.precio * cantidad), metodo, p.precio);
    alert("¡Venta registrada!"); cargarDesdeDrive(); switchTab('inventario');
}

async function generarFactura(c, prod, cant, tot, met, pu) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const img = await getBase64(LOGO_URL);
    if(img) {
        doc.setGState(new doc.GState({opacity: 0.08}));
        doc.addImage(img, 'PNG', 45, 80, 120, 120);
        doc.setGState(new doc.GState({opacity: 1}));
        doc.addImage(img, 'PNG', 15, 12, 25, 25);
    }
    doc.setFont("helvetica", "bold"); doc.setTextColor(214, 51, 132); doc.setFontSize(22); doc.text("AMARE BEAUTY", 200, 25, {align:"right"});
    doc.setFontSize(10); doc.setTextColor(100); doc.text("SOPORTE DE VENTA", 200, 32, {align:"right"});
    doc.line(15, 45, 200, 45);
    doc.setTextColor(0); doc.text(`Cliente: ${c}`, 15, 60); doc.text(`Pago: ${met}`, 15, 74);
    doc.setFillColor(214, 51, 132); doc.rect(15, 85, 185, 10, 'F');
    doc.setTextColor(255); doc.text("PRODUCTO", 20, 92); doc.text("CANT", 130, 92); doc.text("TOTAL", 195, 92, {align:"right"});
    doc.setTextColor(0); doc.text(prod, 20, 105); doc.text(cant.toString(), 133, 105); doc.text(`$${tot.toLocaleString()}`, 195, 105, {align:"right"});
    doc.setFontSize(16); doc.setTextColor(214, 51, 132); doc.text(`TOTAL: $${tot.toLocaleString()}`, 200, 130, {align:"right"});
    doc.save(`Factura_${c}.pdf`);
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
            return `<option value="${p.filaOriginal}" ${agotado ? 'disabled' : ''}>${p.nombre} ${agotado ? '(AGOTADO)' : '($' + parseFloat(p.precio).toLocaleString() + ')'}</option>`;
        }).join('');
}

function filtrarProductos() {
    const txt = document.getElementById('busqueda').value.toLowerCase();
    document.querySelectorAll('.lista-item').forEach(it => it.style.display = it.innerText.toLowerCase().includes(txt) ? 'flex' : 'none');
}

function marketingMasivo() {
    clientes.forEach((c, i) => setTimeout(() => {
        const msj = `Hola ${c.nombre} ✨! Mira nuestro catálogo actualizado: https://drive.google.com/file/d/1FMtOGvlYbLwSofqO3WCkqG4k65MSzccn/view?usp=sharing`;
        window.open(`https://wa.me/${CODIGO_PAIS}${c.tel}?text=${encodeURIComponent(msj)}`, '_blank');
    }, i * 2000));
}

function irAVenta(f, n) { switchTab('ventas'); document.getElementById('busqueda-venta').value = n; filtrarSelectVentas(); document.getElementById('select-producto').value = f; }

window.onload = cargarDesdeDrive;
