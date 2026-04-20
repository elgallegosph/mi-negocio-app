const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzPHxtoqdx3vCw54PgZq67aIHgGSf0Z4tSu5ByilyT-4oBlfGxDTYrmpZh9o3yIL9TdNA/exec"; 
const CODIGO_PAIS = "57";
const LOGO_URL = "./logo.png"; 

let inventario = [];
let historial = [];
let clientes = [];
let carrito = [];
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
        if(icon) icon.classList.remove('loading');
        document.getElementById('splash-screen').style.display = 'none';
    } catch (e) { console.error(e); }
}

function renderInventario() {
    const busc = document.getElementById('busqueda').value.toLowerCase();
    const cont = document.getElementById('lista-inventario');
    cont.innerHTML = inventario.filter(p => p.nombre.toLowerCase().includes(busc)).map(p => {
        const stockActual = (parseFloat(p.stock) || 0) - (parseFloat(p.vendidos) || 0);
        const agotado = stockActual <= 0;
        return `
            <div class="lista-item ${agotado ? 'sin-stock' : ''}">
                <div><strong>${p.nombre}</strong><br><small>${agotado ? 'SIN DISPONIBILIDAD' : 'Stock: ' + stockActual}</small></div>
                <div style="text-align:right">
                    <div style="color:var(--primary); font-weight:bold; margin-bottom:5px;">$${p.precio.toLocaleString()}</div>
                    <button onclick="agregarAlCarrito(${p.filaOriginal})" 
                    style="background:${agotado ? '#ccc' : 'var(--primary)'}; color:white; border:none; padding:8px 12px; border-radius:10px;"
                    ${agotado ? 'disabled' : ''}>+ Añadir</button>
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
        <div class="lista-item" style="font-size:0.9rem;">
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
    if (carrito.length === 0) return alert("El carrito está vacío");
    const btn = document.getElementById('btn-procesar');
    const cliente = document.getElementById('nombre-cliente').value || "Cliente";
    const tel = document.getElementById('tel-cliente').value.replace(/\D/g, '');
    const metodo = document.getElementById('metodo-pago').value;
    const totalVenta = carrito.reduce((sum, item) => sum + (item.precio * item.cantidad), 0);

    btn.disabled = true; btn.innerText = "PROCESANDO...";

    try {
        await fetch(SCRIPT_URL, { 
            method: 'POST', mode: 'no-cors', 
            body: JSON.stringify({ action: "venta_multiple", productos: carrito, cliente, telefono: tel, metodo }) 
        });

        await generarFacturaPDF(cliente, totalVenta, metodo);

        if (tel.length >= 10) {
            let detalle = carrito.map(c => `• ${c.cantidad}x ${c.nombre}`).join('%0A');
            let msj = `Hola ${cliente} 🌸, gracias por tu compra en *Amare Beauty*:%0A%0A${detalle}%0A%0A*Total: $${totalVenta.toLocaleString()}*%0A✨ Factura adjunta.`;
            setTimeout(() => { window.location.href = `https://wa.me/${CODIGO_PAIS}${tel}?text=${msj}`; }, 1200);
        } else {
            alert("Venta registrada con éxito.");
            window.location.reload();
        }
    } catch (e) { alert("Error de red"); btn.disabled = false; }
}

async function generarFacturaPDF(cliente, total, metodo) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const img = await getBase64(LOGO_URL);

    if(img) {
        doc.setGState(new doc.GState({opacity: 0.08}));
        doc.addImage(img, 'PNG', 40, 70, 130, 130);
        doc.setGState(new doc.GState({opacity: 1}));
        doc.addImage(img, 'PNG', 15, 15, 25, 25);
    }
    
    doc.setFont("helvetica", "bold"); doc.setTextColor(214, 51, 132); doc.setFontSize(22);
    doc.text("AMARE BEAUTY", 200, 25, {align:"right"});
    doc.setDrawColor(214, 51, 132); doc.line(15, 45, 200, 45);
    doc.setTextColor(0); doc.setFontSize(12);
    doc.text(`CLIENTE: ${cliente.toUpperCase()}`, 15, 55);
    doc.text(`MÉTODO: ${metodo}`, 15, 62);
    
    let y = 80;
    doc.setFillColor(245); doc.rect(15, y, 185, 8, 'F');
    doc.text("PRODUCTO", 20, y+6); doc.text("CANT", 140, y+6); doc.text("SUBTOTAL", 195, y+6, {align:"right"});
    
    y += 15; doc.setFont("helvetica", "normal");
    carrito.forEach(p => {
        doc.text(p.nombre.substring(0, 35), 20, y);
        doc.text(p.cantidad.toString(), 143, y);
        doc.text(`$${(p.precio * p.cantidad).toLocaleString()}`, 195, y, {align:"right"});
        y += 8;
    });

    doc.setFont("helvetica", "bold"); doc.setFontSize(16);
    doc.text(`TOTAL: $${total.toLocaleString()}`, 195, y+10, {align:"right"});
    doc.save(`Factura_Amare_${cliente}.pdf`);
}

function getBase64(url) {
    return new Promise(r => {
        const i = new Image(); i.crossOrigin='Anonymous';
        i.onload = () => { const c=document.createElement('canvas'); c.width=i.width; c.height=i.height; c.getContext('2d').drawImage(i,0,0); r(c.toDataURL()); };
        i.src = url;
    });
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
    if (charts.m) charts.m.destroy();
    const stats = historial.reduce((acc, curr) => (acc[curr.metodo] = (acc[curr.metodo] || 0) + 1, acc), {});
    charts.m = new Chart(ctx, { type: 'doughnut', data: { labels: Object.keys(stats), datasets: [{ data: Object.values(stats), backgroundColor: ['#d63384', '#3498db', '#f1c40f', '#2ecc71'] }] } });
}

function calcularVentasTotales() {
    const total = inventario.reduce((sum, p) => sum + (parseFloat(p.precio) * (parseFloat(p.vendidos) || 0)), 0);
    document.getElementById('gran-total-dinero').innerText = `$${total.toLocaleString('es-CO')}`;
}

function marketingMasivo() {
    clientes.forEach((c, i) => {
        setTimeout(() => {
            const msj = `¡Hola ${c.nombre}! ✨ Tenemos nuevos productos en *Amare Beauty*. Mira nuestro catálogo aquí: hhttps://canva.link/6efvhh4xah3pndl`;
            window.open(`https://wa.me/${CODIGO_PAIS}${c.tel}?text=${encodeURIComponent(msj)}`, '_blank');
        }, i * 3500);
    });
}

function renderTablasGestion() {
    document.getElementById('lista-gestion').innerHTML = historial.filter(h => h.metodo.includes("Fiado") || h.metodo.includes("Separado")).map(h => `
        <div class="lista-item">
            <span><strong>${h.cliente}</strong><br><small>${h.producto}</small></span>
            <button onclick="window.location.href='https://wa.me/${CODIGO_PAIS}${h.tel}'" style="background:#25d366; color:white; border:none; padding:8px; border-radius:10px;">Cobrar</button>
        </div>`).join('');
}

window.onload = cargarDesdeDrive;
