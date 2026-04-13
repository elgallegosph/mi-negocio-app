const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbypdlxNsaoHZywW--g1eTg4a094ZProKjIDhBSbqhNtyDl0P-MZO6B4fdXVcGKDb9_ezg/exec"; 
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
    } catch (e) { console.error("Error al cargar:", e); }
}

function calcularVentasTotales() {
    // Calcula el total real basado en los productos vendidos en la hoja
    const total = inventario.reduce((sum, p) => sum + (parseFloat(p.precio) * (parseFloat(p.vendidos) || 0)), 0);
    document.getElementById('gran-total-dinero').innerText = `$${total.toLocaleString('es-CO')}`;
}

function renderInventario() {
    const contenedor = document.getElementById('lista-inventario');
    contenedor.innerHTML = inventario.map(p => {
        const stockActual = (parseFloat(p.stock) || 0) - (parseFloat(p.vendidos) || 0);
        return `
            <div class="lista-item ${stockActual <= 0 ? 'opacity:0.5' : ''}">
                <div><strong>${p.nombre}</strong><br><small>Disponible: ${stockActual}</small><br>
                <span style="color:#d63384; font-weight:bold;">$${parseFloat(p.precio).toLocaleString()}</span></div>
                <button onclick="irAVenta('${p.filaOriginal}', '${p.nombre.replace(/'/g, "\\'")}')" style="background:#d63384; color:white; border:none; padding:8px 12px; border-radius:10px; cursor:pointer;">VENDER</button>
            </div>`;
    }).join('');
}

function renderTablasGestion() {
    const listaFiados = document.getElementById('lista-fiados');
    const listaSeparados = document.getElementById('lista-separados');
    
    const fiados = historial.filter(h => h.metodo.includes("Fiado"));
    const separados = historial.filter(h => h.metodo.includes("Separado"));

    listaFiados.innerHTML = fiados.map(h => `
        <tr>
            <td><strong>${h.cliente}</strong><br><small>${h.producto} (x${h.cantidad})</small></td>
            <td><button onclick="recordarPago('${h.tel}', '${h.cliente}', '${h.producto}')" class="btn-accion" style="background:#25d366;">Recordar</button></td>
        </tr>`).join('');

    listaSeparados.innerHTML = separados.map(h => `
        <tr>
            <td><strong>${h.cliente}</strong><br><small>${h.producto}</small></td>
            <td><button onclick="cancelarVenta(${h.filaLog}, ${h.filaOrig}, ${h.cantidad})" class="btn-accion" style="background:#e74c3c;">Anular</button></td>
        </tr>`).join('');
}

function recordarPago(tel, nombre, producto) {
    const msj = `Hola ${nombre} ✨, te saludamos de *Amare Beauty* para recordarte el pago pendiente de: *${producto}*. ¡Muchas gracias! 🌸`;
    window.open(`https://wa.me/${CODIGO_PAIS}${tel}?text=${encodeURIComponent(msj)}`, '_blank');
}

async function cancelarVenta(filaLog, filaOriginal, cantidad) {
    if(!confirm("¿Deseas anular esta venta y devolver el stock?")) return;
    try {
        await fetch(SCRIPT_URL, {
            method: 'POST', mode: 'no-cors',
            body: JSON.stringify({ action: "cancelar", filaLog, filaOriginal, cantidad })
        });
        alert("¡Venta anulada y stock devuelto!");
        cargarDesdeDrive();
    } catch(e) { alert("Error al cancelar"); }
}

function switchTab(t) {
    document.querySelectorAll('.tab-content').forEach(s => s.style.display = 'none');
    document.querySelectorAll('.tabs button').forEach(b => b.classList.remove('active'));
    document.getElementById('sec-' + t).style.display = 'block';
    document.getElementById('tab-' + t).classList.add('active');
    if(t === 'stats') setTimeout(dibujarGraficos, 500);
}

function dibujarGraficos() {
    const ctx = document.getElementById('canvasMetodos');
    if (charts.m) charts.m.destroy();
    const stats = historial.reduce((acc, curr) => {
        const m = curr.metodo || "Efectivo";
        acc[m] = (acc[m] || 0) + 1;
        return acc;
    }, {});
    charts.m = new Chart(ctx, {
        type: 'pie',
        data: { labels: Object.keys(stats), datasets: [{ data: Object.values(stats), backgroundColor: ['#d63384', '#3498db', '#f1c40f', '#2ecc71', '#9b59b6'] }] },
        options: { responsive: true, maintainAspectRatio: false }
    });
}

async function registrarVenta() {
    const fila = document.getElementById('select-producto').value;
    if(!fila) return alert("Selecciona un producto");
    const p = inventario.find(item => item.filaOriginal == fila);
    const cantidad = parseInt(document.getElementById('cant-venta').value);
    const metodo = document.getElementById('metodo-pago').value;
    const cliente = document.getElementById('nombre-cliente').value || "Cliente General";
    const tel = document.getElementById('tel-cliente').value.replace(/\D/g, '');

    try {
        await fetch(SCRIPT_URL, {
            method: 'POST', mode: 'no-cors',
            body: JSON.stringify({ action: "venta", fila: parseInt(fila), productoNombre: p.nombre, cantidad, metodo, cliente, telefono: tel })
        });
        
        await generarFacturaPDF(cliente, p.nombre, cantidad, (p.precio * cantidad), metodo, p.precio);
        
        if (tel.length >= 10) {
            const msj = `✨ *AMARE BEAUTY* ✨\n¡Hola ${cliente}! Gracias por tu compra.\n\n📦 *Pedido:* ${p.nombre}\n💰 *Total:* $${(p.precio * cantidad).toLocaleString()}`;
            window.open(`https://wa.me/${CODIGO_PAIS}${tel}?text=${encodeURIComponent(msj)}`, '_blank');
        }
        alert("¡Venta registrada!");
        switchTab('inventario');
    } catch (e) { alert("Error al registrar venta"); }
}

async function generarFacturaPDF(c, prod, cant, tot, met, pu) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const img = await getBase64(LOGO_URL);
    
    if(img) {
        doc.setGState(new doc.GState({opacity: 0.08}));
        doc.addImage(img, 'PNG', 45, 80, 120, 120);
        doc.restoreGraphicsState();
        doc.addImage(img, 'PNG', 15, 12, 25, 25);
    }

    doc.setFont("helvetica", "bold"); doc.setTextColor(214, 51, 132); doc.setFontSize(22);
    doc.text("AMARE BEAUTY", 200, 25, { align: "right" });
    doc.setFontSize(10); doc.setTextColor(100); doc.text("SOPORTE DE VENTA", 200, 31, { align: "right" });
    
    doc.setDrawColor(214, 51, 132); doc.line(15, 45, 200, 45);
    doc.setTextColor(50); doc.text(`Cliente: ${c}`, 15, 60); doc.text(`Fecha: ${new Date().toLocaleDateString()}`, 15, 66);
    doc.text(`Pago: ${met}`, 15, 72);

    doc.setFillColor(214, 51, 132); doc.rect(15, 85, 185, 10, 'F');
    doc.setTextColor(255); doc.text("PRODUCTO", 20, 92); doc.text("CANT", 130, 92); doc.text("TOTAL", 195, 92, { align: "right" });

    doc.setTextColor(0); doc.text(prod, 20, 105); doc.text(cant.toString(), 133, 105); doc.text(`$${tot.toLocaleString()}`, 195, 105, { align: "right" });
    doc.setFontSize(16); doc.setTextColor(214, 51, 132); doc.text(`TOTAL: $${tot.toLocaleString()}`, 200, 130, { align: "right" });

    doc.save(`Factura_Amare_${c}.pdf`);
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
        .map(p => `<option value="${p.filaOriginal}">${p.nombre} ($${parseFloat(p.precio).toLocaleString()})</option>`).join('');
}

function filtrarProductos() {
    const txt = document.getElementById('busqueda').value.toLowerCase();
    document.querySelectorAll('.lista-item').forEach(it => it.style.display = it.innerText.toLowerCase().includes(txt) ? 'flex' : 'none');
}

function marketingMasivo() {
    if (clientes.length === 0) return alert("Sin clientes registrados.");
    clientes.forEach((c, i) => setTimeout(() => {
        const msj = `¡Hola ${c.nombre}! ✨ Te enviamos nuestro catálogo de *Amare Beauty*: https://drive.google.com/open?id=1rU759f0_bJVyNa_AM-shqBVrImPWHsOC`;
        window.open(`https://wa.me/${CODIGO_PAIS}${c.tel}?text=${encodeURIComponent(msj)}`, '_blank');
    }, i * 2000));
}

function irAVenta(f, n) { switchTab('ventas'); document.getElementById('busqueda-venta').value = n; filtrarSelectVentas(); document.getElementById('select-producto').value = f; }

window.onload = cargarDesdeDrive;
