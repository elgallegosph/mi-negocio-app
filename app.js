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
        
        renderInventario();
        renderTablasGestion();
        calcularVentasTotales(); 
        filtrarSelectVentas();
        
        if(!silencioso && icon) icon.classList.remove('loading');
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
                <div>
                    <strong>${p.nombre}</strong><br>
                    <small style="color:${agotado ? 'red' : '#666'}">${agotado ? 'AGOTADO' : 'Stock: ' + stockActual}</small><br>
                    <span style="color:var(--primary); font-weight:bold;">$${parseFloat(p.precio).toLocaleString()}</span>
                </div>
                <button onclick="irAVenta('${p.filaOriginal}', '${p.nombre.replace(/'/g, "\\'")}')" 
                style="background:${agotado ? '#ccc' : 'var(--primary)'}; color:white; border:none; padding:10px 15px; border-radius:12px; font-weight:bold;" ${agotado ? 'disabled' : ''}>
                    VENDER
                </button>
            </div>`;
    }).join('');
}

async function registrarVenta() {
    const btn = document.getElementById('btn-procesar');
    const fila = document.getElementById('select-producto').value;
    if(!fila) return alert("Selecciona un producto.");
    
    const p = inventario.find(item => item.filaOriginal == fila);
    const cantidad = parseInt(document.getElementById('cant-venta').value);
    const metodo = document.getElementById('metodo-pago').value;
    const cliente = document.getElementById('nombre-cliente').value || "Cliente";
    const tel = document.getElementById('tel-cliente').value.replace(/\D/g, '');

    btn.disabled = true;
    btn.innerText = "PROCESANDO...";

    try {
        // 1. Enviar a Google Sheets
        await fetch(SCRIPT_URL, { 
            method: 'POST', 
            mode: 'no-cors', 
            body: JSON.stringify({ action: "venta", fila: parseInt(fila), productoNombre: p.nombre, cantidad, metodo, cliente, telefono: tel }) 
        });

        // 2. Descargar Factura (Inicia la descarga)
        await generarFactura(cliente, p.nombre, cantidad, (p.precio * cantidad), metodo);

        // 3. WhatsApp (Usamos location.href al final para que los móviles no bloqueen el proceso)
        if (tel.length >= 10) {
            let msj = `Hola ${cliente} 🌸. Gracias por elegir *Amare Beauty*. Soporte de tu compra: *${p.nombre}*. ✨`;
            if (metodo.includes("Fiado")) msj = `Hola ${cliente} 🌸. Tu pedido de *${p.nombre}* ha sido registrado (Fiado). ✨`;
            if (metodo.includes("Separado")) msj = `¡Hola ${cliente}! ✨ Tu producto *${p.nombre}* ha sido SEPARADO en *Amare Beauty*. 🌸`;
            
            const urlWa = `https://wa.me/${CODIGO_PAIS}${tel}?text=${encodeURIComponent(msj)}`;
            
            // Esperar 1 seg para que el PDF inicie descarga antes de cambiar de app
            setTimeout(() => {
                window.location.href = urlWa;
            }, 1000);
        } else {
            alert("Venta registrada con éxito.");
            window.location.reload();
        }
    } catch (e) {
        alert("Error de conexión");
        btn.disabled = false;
        btn.innerText = "PROCESAR VENTA";
    }
}

async function generarFactura(c, prod, cant, tot, met) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const img = await getBase64(LOGO_URL);
    
    if(img) {
        doc.setGState(new doc.GState({opacity: 0.1}));
        doc.addImage(img, 'PNG', 45, 75, 120, 120);
        doc.setGState(new doc.GState({opacity: 1}));
        doc.addImage(img, 'PNG', 15, 15, 25, 25);
    }
    
    doc.setFont("helvetica", "bold"); doc.setTextColor(214, 51, 132); doc.setFontSize(22);
    doc.text("AMARE BEAUTY", 200, 25, {align:"right"});
    doc.setFontSize(10); doc.setTextColor(100); doc.text("COMPROBANTE DE VENTA", 200, 32, {align:"right"});
    doc.line(15, 45, 200, 45);
    doc.setTextColor(0); doc.setFontSize(12);
    doc.text(`CLIENTE: ${c.toUpperCase()}`, 15, 60);
    doc.text(`MÉTODO DE PAGO: ${met}`, 15, 68);
    doc.setFillColor(214, 51, 132); doc.rect(15, 80, 185, 10, 'F');
    doc.setTextColor(255); doc.text("PRODUCTO", 20, 87); doc.text("CANT", 130, 87); doc.text("TOTAL", 195, 87, {align:"right"});
    doc.setTextColor(0); doc.text(prod, 20, 100); doc.text(cant.toString(), 133, 100); doc.text(`$${tot.toLocaleString()}`, 195, 100, {align:"right"});
    doc.setFontSize(18); doc.setTextColor(214, 51, 132); doc.text(`TOTAL: $${tot.toLocaleString()}`, 200, 130, {align:"right"});
    
    doc.save(`Factura_Amare_${c.replace(/\s+/g, '_')}.pdf`);
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
    if(t === 'stats') setTimeout(dibujarGraficos, 300);
}

function dibujarGraficos() {
    const ctx = document.getElementById('canvasMetodos');
    if (charts.m) charts.m.destroy();
    const stats = historial.reduce((acc, curr) => (acc[curr.metodo] = (acc[curr.metodo] || 0) + 1, acc), {});
    charts.m = new Chart(ctx, { 
        type: 'doughnut', 
        data: { 
            labels: Object.keys(stats), 
            datasets: [{ data: Object.values(stats), backgroundColor: ['#d63384', '#3498db', '#f1c40f', '#2ecc71', '#9b59b6'] }] 
        } 
    });
}

function filtrarSelectVentas() {
    const txt = document.getElementById('busqueda-venta').value.toLowerCase();
    document.getElementById('select-producto').innerHTML = inventario
        .filter(p => p.nombre.toLowerCase().includes(txt))
        .map(p => {
            const stockActual = (parseFloat(p.stock) || 0) - (parseFloat(p.vendidos) || 0);
            return `<option value="${p.filaOriginal}" ${stockActual <= 0 ? 'disabled' : ''}>${p.nombre} - $${parseFloat(p.precio).toLocaleString()}</option>`;
        }).join('');
}

function filtrarProductos() {
    const txt = document.getElementById('busqueda').value.toLowerCase();
    document.querySelectorAll('.lista-item').forEach(it => it.style.display = it.innerText.toLowerCase().includes(txt) ? 'flex' : 'none');
}

function renderTablasGestion() {
    document.getElementById('lista-fiados').innerHTML = historial.filter(h => h.metodo.includes("Fiado")).map(h => `
        <div class="lista-item">
            <span><strong>${h.cliente}</strong><br><small>${h.producto}</small></span>
            <button onclick="window.location.href='https://wa.me/${CODIGO_PAIS}${h.tel}'" style="background:#25d366; color:white; border:none; padding:8px 12px; border-radius:10px;">Cobrar</button>
        </div>`).join('');

    document.getElementById('lista-separados').innerHTML = historial.filter(h => h.metodo.includes("Separado")).map(h => `
        <div class="lista-item">
            <span><strong>${h.cliente}</strong><br><small>${h.producto}</small></span>
            <span style="color:#f39c12; font-weight:bold;">PENDIENTE</span>
        </div>`).join('');
}

function marketingMasivo() {
    if(clientes.length === 0) return alert("No hay clientes registrados.");
    clientes.forEach((c, i) => {
        setTimeout(() => {
            const msj = `¡Hola ${c.nombre} ✨! Tenemos novedades en *Amare Beauty*. ¡Mira nuestro catálogo aquí! 🌸`;
            window.open(`https://wa.me/${CODIGO_PAIS}${c.tel}?text=${encodeURIComponent(msj)}`, '_blank');
        }, i * 3000);
    });
}

function irAVenta(f, n) { 
    switchTab('ventas'); 
    document.getElementById('busqueda-venta').value = n; 
    filtrarSelectVentas(); 
    document.getElementById('select-producto').value = f; 
}

window.onload = cargarDesdeDrive;
