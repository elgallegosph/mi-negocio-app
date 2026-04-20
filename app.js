const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzPHxtoqdx3vCw54PgZq67aIHgGSf0Z4tSu5ByilyT-4oBlfGxDTYrmpZh9o3yIL9TdNA/exec"; 
const CODIGO_PAIS = "57";
const LOGO_URL = "./logo.png"; 

let inventario = [];
let historial = [];
let clientes = [];
let carrito = [];
let charts = {};

async function switchTab(t) {
    document.querySelectorAll('.tab-content').forEach(s => s.style.display = 'none');
    document.querySelectorAll('.tabs button').forEach(b => b.classList.remove('active'));
    document.getElementById('sec-' + t).style.display = 'block';
    document.getElementById('tab-' + t).classList.add('active');
    
    await cargarDesdeDrive(); 
    if(t === 'stats') dibujarGraficos();
}

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
        if(icon) icon.classList.remove('loading');
        document.getElementById('splash-screen').style.display = 'none';
    } catch (e) { console.error(e); if(icon) icon.classList.remove('loading'); }
}

function renderInventario() {
    const busc = document.getElementById('busqueda').value.toLowerCase();
    const cont = document.getElementById('lista-inventario');
    cont.innerHTML = inventario.filter(p => p.nombre.toLowerCase().includes(busc)).map(p => {
        const stockActual = (parseFloat(p.stock) || 0) - (parseFloat(p.vendidos) || 0);
        const agotado = stockActual <= 0;
        return `
            <div class="lista-item ${agotado ? 'sin-stock' : ''}">
                <div><strong>${p.nombre}</strong><br><small>${agotado ? 'AGOTADO' : 'Disponibles: ' + stockActual}</small></div>
                <div style="text-align:right">
                    <div style="color:var(--primary); font-weight:bold;">$${p.precio.toLocaleString()}</div>
                    <button onclick="agregarAlCarrito(${p.filaOriginal})" 
                    style="background:${agotado ? '#ccc' : 'var(--accent)'}; color:white; border:none; padding:8px 12px; border-radius:10px;"
                    ${agotado ? 'disabled' : ''}>+ Agregar</button>
                </div>
            </div>`;
    }).join('');
}

function agregarAlCarrito(fila) {
    const p = inventario.find(i => i.filaOriginal == fila);
    const item = carrito.find(c => c.fila == fila);
    if (item) item.cantidad++;
    else carrito.push({ fila: p.filaOriginal, nombre: p.nombre, precio: p.precio, cantidad: 1 });
    actualizarCarritoUI();
}

function actualizarCarritoUI() {
    document.getElementById('carrito-conteo').innerText = carrito.length;
    const cont = document.getElementById('items-en-carrito');
    cont.innerHTML = carrito.map((c, i) => `
        <div class="lista-item" style="font-size:0.9rem; border-left-color:var(--accent);">
            <span>${c.cantidad}x ${c.nombre}</span>
            <span>$${(c.precio * c.cantidad).toLocaleString()} 
            <button onclick="quitarDelCarrito(${i})" style="color:red; border:none; background:none; font-weight:bold; margin-left:10px;">✕</button></span>
        </div>
    `).join('');
}

function quitarDelCarrito(i) {
    carrito.splice(i, 1);
    actualizarCarritoUI();
}

async function registrarVentaMultiple() {
    if (carrito.length === 0) return alert("Selecciona productos primero");
    const btn = document.getElementById('btn-procesar');
    const clienteInput = document.getElementById('nombre-cliente');
    const telInput = document.getElementById('tel-cliente');
    
    const cliente = clienteInput.value || "Cliente";
    const tel = telInput.value.replace(/\D/g, '');
    const metodo = document.getElementById('metodo-pago').value;
    const totalVenta = carrito.reduce((sum, item) => sum + (item.precio * item.cantidad), 0);

    btn.disabled = true; 
    btn.innerText = "REGISTRANDO...";

    try {
        // 1. Enviamos a Google Sheets
        await fetch(SCRIPT_URL, { 
            method: 'POST', mode: 'no-cors', 
            body: JSON.stringify({ action: "venta_multiple", productos: carrito, cliente, telefono: tel, metodo }) 
        });

        // 2. Generamos el PDF
        await generarFacturaPDF(cliente, totalVenta, metodo);

        // 3. Preparamos Mensaje de WhatsApp
        let detalleWA = carrito.map(c => `• ${c.cantidad}x ${c.nombre}`).join('%0A');
        let textoMsj = "";
        if (metodo.includes("Fiado")) {
            textoMsj = `Hola ${cliente} 🌸, aquí tienes el detalle de tu compra a crédito en *Amare Beauty*:%0A%0A${detalleWA}%0A%0A*Total Deuda: $${totalVenta.toLocaleString()}*%0A📌 Quedo atenta a la fecha de pago.`;
        } else if (metodo.includes("Separado")) {
            textoMsj = `Hola ${cliente} 🌸, tus productos han sido separados en *Amare Beauty*:%0A%0A${detalleWA}%0A%0A*Valor: $${totalVenta.toLocaleString()}*%0A✨ ¡Te aviso cuando estén listos!`;
        } else {
            textoMsj = `Hola ${cliente} 🌸, confirmamos tu compra en *Amare Beauty*:%0A%0A${detalleWA}%0A%0A*Total: $${totalVenta.toLocaleString()}*%0A✨ ¡Gracias por preferirnos!`;
        }

        // 4. LIMPIEZA TOTAL PARA NUEVA VENTA
        carrito = [];
        actualizarCarritoUI();
        clienteInput.value = "";
        telInput.value = "";
        btn.disabled = false;
        btn.innerText = "FINALIZAR VENTA";

        // 5. ABRIR WHATSAPP EN PESTAÑA NUEVA
        if (tel.length >= 10) {
            window.open(`https://wa.me/${CODIGO_PAIS}${tel}?text=${textoMsj}`, '_blank');
        } else {
            alert("Venta registrada con éxito.");
        }
        
        // Volver al inicio
        switchTab('inventario');

    } catch (e) { 
        alert("Error al registrar"); 
        btn.disabled = false; 
        btn.innerText = "FINALIZAR VENTA";
    }
}

async function generarFacturaPDF(cliente, total, metodo) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const img = await getBase64(LOGO_URL);

    if(img) {
        doc.setGState(new doc.GState({opacity: 0.08}));
        doc.addImage(img, 'PNG', 40, 70, 130, 130);
        doc.setGState(new doc.GState({opacity: 1}));
        doc.addImage(img, 'PNG', 15, 10, 25, 25);
    }
    
    doc.setFont("helvetica", "bold"); doc.setTextColor(11, 60, 93); doc.setFontSize(22);
    doc.text("AMARE BEAUTY", 200, 25, {align:"right"});
    doc.setDrawColor(212, 160, 23); doc.setLineWidth(1); doc.line(15, 40, 200, 40);
    
    doc.setTextColor(0); doc.setFontSize(11);
    doc.text(`CLIENTE: ${cliente.toUpperCase()}`, 15, 50);
    doc.text(`FECHA: ${new Date().toLocaleDateString()}`, 15, 57);
    doc.text(`MÉTODO DE PAGO: ${metodo}`, 15, 64);
    
    let y = 75;
    doc.setFillColor(11, 60, 93); doc.rect(15, y, 185, 8, 'F');
    doc.setTextColor(255); doc.text("PRODUCTO", 20, y+6); doc.text("CANT", 140, y+6); doc.text("TOTAL", 195, y+6, {align:"right"});
    
    y += 15; doc.setTextColor(0); doc.setFont("helvetica", "normal");
    carrito.forEach(p => {
        doc.text(p.nombre.substring(0, 35), 20, y);
        doc.text(p.cantidad.toString(), 143, y);
        doc.text(`$${(p.precio * p.cantidad).toLocaleString()}`, 195, y, {align:"right"});
        y += 8;
    });

    doc.setDrawColor(244, 96, 54); doc.line(140, y+2, 200, y+2);
    doc.setFont("helvetica", "bold"); doc.setFontSize(14); doc.setTextColor(244, 96, 54);
    doc.text(`TOTAL: $${total.toLocaleString()}`, 195, y+10, {align:"right"});
    
    doc.save(`Amare_Beauty_${cliente}.pdf`);
}

function getBase64(url) {
    return new Promise(r => {
        const i = new Image(); i.crossOrigin='Anonymous';
        i.onload = () => { const c=document.createElement('canvas'); c.width=i.width; c.height=i.height; c.getContext('2d').drawImage(i,0,0); r(c.toDataURL()); };
        i.src = url;
    });
}

function dibujarGraficos() {
    const ctx = document.getElementById('canvasMetodos');
    if (charts.m) charts.m.destroy();
    const stats = historial.reduce((acc, curr) => (acc[curr.metodo] = (acc[curr.metodo] || 0) + 1, acc), {});
    charts.m = new Chart(ctx, { type: 'doughnut', data: { labels: Object.keys(stats), datasets: [{ data: Object.values(stats), backgroundColor: ['#0B3C5D', '#F46036', '#D4A017', '#2ecc71'] }] } });
}

function calcularVentasTotales() {
    const total = inventario.reduce((sum, p) => sum + (parseFloat(p.precio) * (parseFloat(p.vendidos) || 0)), 0);
    document.getElementById('gran-total-dinero').innerText = `$${total.toLocaleString('es-CO')}`;
}

function marketingMasivo() {
    clientes.forEach((c, i) => {
        setTimeout(() => {
            const msj = `¡Hola ${c.nombre}! ✨ Mira las novedades de *Amare Beauty* aquí: https://canva.link/6efvhh4xah3pndl`;
            window.open(`https://wa.me/${CODIGO_PAIS}${c.tel}?text=${encodeURIComponent(msj)}`, '_blank');
        }, i * 3500);
    });
}

function renderTablasGestion() {
    document.getElementById('lista-gestion').innerHTML = historial.filter(h => h.metodo.includes("Fiado") || h.metodo.includes("Separado")).map(h => `
        <div class="lista-item">
            <span><strong>${h.cliente}</strong><br><small>${h.producto}</small></span>
            <button onclick="window.open('https://wa.me/${CODIGO_PAIS}${h.tel}', '_blank')" style="background:#25d366; color:white; border:none; padding:8px; border-radius:10px;">COBRAR</button>
        </div>`).join('');
}

window.onload = cargarDesdeDrive;
