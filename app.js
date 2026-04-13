const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzzvIIK4wdcorlYlciZbCrBwVRaLyk--M8C0_LtjBhaD35TwGD-BKXSedQ5UyWkzdtkxQ/exec"; 
const CODIGO_PAIS = "57";
const LOGO_URL = "./logo.png"; 
const URL_CATALOGO = "https://drive.google.com/file/d/1FMtOGvlYbLwSofqO3WCkqG4k65MSzccn/view?usp=drive_link"; 

let inventario = [];
let historial = [];
let charts = {};

function ocultarSplash() {
    const splash = document.getElementById('splash-screen');
    if (splash) {
        splash.style.opacity = '0';
        setTimeout(() => splash.style.display = 'none', 800);
    }
}

async function cargarDesdeDrive() {
    try {
        const response = await fetch(`${SCRIPT_URL}?t=${Date.now()}`);
        const data = await response.json();
        inventario = data.inventario || [];
        historial = data.historial || [];
        renderInventario();
        calcularVentasTotales(); 
        filtrarSelectVentas();
        ocultarSplash();
    } catch (e) { console.error(e); ocultarSplash(); }
}

function renderInventario() {
    const lista = document.getElementById('lista-inventario');
    if (!lista) return;
    lista.innerHTML = inventario.map(p => {
        const disp = (parseFloat(p.stock) || 0) - (parseFloat(p.vendidos) || 0);
        return `<li class="lista-item" onclick="irAVenta('${p.filaOriginal}', '${p.nombre.replace(/'/g, "\\'")}')">
            <div>
                <span style="font-weight:bold;">${p.nombre}</span><br>
                <small>Disp: ${disp}</small>
                <div class="price-tag">$${parseFloat(p.precio || 0).toLocaleString('es-CO')}</div>
            </div>
            <button style="background:#d63384; color:white; border:none; padding:8px; border-radius:8px;">VENDER</button>
        </li>`;
    }).join('');
}

function irAVenta(fila, nombre) {
    switchTab('ventas');
    document.getElementById('busqueda-venta').value = nombre;
    filtrarSelectVentas();
    document.getElementById('select-producto').value = fila;
}

async function registrarVenta() {
    const select = document.getElementById('select-producto');
    const fila = select.value;
    if (!fila) return alert("Por favor, selecciona un producto de la lista.");

    // CORRECCIÓN: Obtener datos reales del objeto inventario
    const p = inventario.find(item => item.filaOriginal == fila);
    const nombreProd = p.nombre;
    const precioProd = parseFloat(p.precio);
    
    const cantidad = parseInt(document.getElementById('cant-venta').value);
    const metodo = document.getElementById('metodo-pago').value;
    const cliente = document.getElementById('nombre-cliente').value || "Cliente";
    let tel = document.getElementById('tel-cliente').value.replace(/\D/g, '');
    
    const totalVenta = precioProd * cantidad;

    try {
        // 1. Enviar a Google Sheets
        await fetch(SCRIPT_URL, {
            method: 'POST', mode: 'no-cors',
            body: JSON.stringify({ 
                action: "venta", 
                fila: parseInt(fila), 
                productoNombre: nombreProd, 
                cantidad: cantidad, 
                metodo: metodo, 
                cliente: cliente, 
                telefono: tel 
            })
        });

        // 2. Generar Factura PDF (Pasamos los datos corregidos)
        await generarPDF({ cliente, producto: nombreProd, cantidad, total: totalVenta, metodo });

        // 3. Enviar WhatsApp
        if (tel.length >= 10) {
            const mensaje = encodeURIComponent(`¡Hola ${cliente}! ✨ Gracias por elegir Amare Beauty. ❤️\n\n🛍️ *Compra:* ${nombreProd}\n🔢 *Cantidad:* ${cantidad}\n💰 *Total:* $${totalVenta.toLocaleString('es-CO')}\n💳 *Método:* ${metodo}\n\nTu pedido ha sido registrado con éxito. ¡Vuelve pronto!`);
            window.open(`https://wa.me/${CODIGO_PAIS}${tel}?text=${mensaje}`, '_blank');
        }

        alert("¡Venta registrada con éxito!");
        cargarDesdeDrive();
        switchTab('inventario');
    } catch (e) { alert("Error al procesar la venta."); }
}

async function generarPDF(datos) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    // Encabezado
    doc.setTextColor(214, 51, 132);
    doc.setFontSize(22);
    doc.text("AMARE BEAUTY", 105, 20, { align: "center" });
    
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text(`Fecha: ${new Date().toLocaleDateString()}`, 20, 40);
    doc.text(`Cliente: ${datos.cliente}`, 20, 50);
    
    doc.line(20, 55, 190, 55);
    
    // Detalle
    doc.text("Producto", 20, 65);
    doc.text("Cant.", 120, 65);
    doc.text("Total", 160, 65);
    
    doc.setFont("helvetica", "bold");
    doc.text(datos.producto, 20, 75);
    doc.text(datos.cantidad.toString(), 120, 75);
    doc.text(`$${datos.total.toLocaleString('es-CO')}`, 160, 75);
    
    doc.line(20, 80, 190, 80);
    doc.text(`Método de Pago: ${datos.metodo}`, 20, 90);
    
    doc.save(`Factura_${datos.cliente}.pdf`);
}

function filtrarSelectVentas() {
    const txt = document.getElementById('busqueda-venta').value.toLowerCase();
    const select = document.getElementById('select-producto');
    select.innerHTML = inventario
        .filter(p => p.nombre.toLowerCase().includes(txt))
        .map(p => `<option value="${p.filaOriginal}">${p.nombre} - $${parseFloat(p.precio).toLocaleString()}</option>`)
        .join('');
}

function switchTab(t) {
    document.querySelectorAll('.tab-content').forEach(s => s.style.display = 'none');
    document.querySelectorAll('.tabs button').forEach(b => b.classList.remove('active'));
    document.getElementById('sec-' + t).style.display = 'block';
    document.getElementById('tab-' + t).classList.add('active');
}

function calcularVentasTotales() {
    const total = inventario.reduce((sum, p) => sum + ((parseFloat(p.precio) || 0) * (parseFloat(p.vendidos) || 0)), 0);
    document.getElementById('gran-total-dinero').innerText = `$${total.toLocaleString('es-CO')}`;
}

window.onload = cargarDesdeDrive;
