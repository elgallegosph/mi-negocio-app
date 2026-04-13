const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwT8PCPJYsOoUBBeJbiHWZeDHRUPn3QQOKCqWzLY37EC_SjL1VpMKttV68RGQ1oh_SkvQ/exec"; 
const CODIGO_PAIS = "57";
const LOGO_URL = "./logo.png"; 
const URL_CATALOGO = "https://drive.google.com/file/d/1FMtOGvlYbLwSofqO3WCkqG4k65MSzccn/view?usp=sharing"; 

let inventario = [];
let clientes = [];
let charts = {};

async function cargarDesdeDrive() {
    const icon = document.getElementById('btn-sync-icon');
    if(icon) icon.classList.add('loading');
    try {
        const response = await fetch(`${SCRIPT_URL}?t=${Date.now()}`);
        const data = await response.json();
        inventario = data.inventario || [];
        clientes = data.clientes || [];
        
        renderInventario();
        renderClientes();
        calcularVentasTotales(); 
        filtrarSelectVentas();
        
        if(icon) icon.classList.remove('loading');
        document.getElementById('splash-screen').style.opacity = '0';
        setTimeout(() => document.getElementById('splash-screen').style.display = 'none', 500);
    } catch (e) { 
        console.error(e);
        if(icon) icon.classList.remove('loading');
    }
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
                    <small>${agotado ? '❌ AGOTADO' : '✅ Stock: ' + stockActual}</small>
                    <div style="color:#d63384; font-weight:bold;">$${parseFloat(p.precio).toLocaleString()}</div>
                </div>
                <button onclick="${agotado ? '' : `irAVenta('${p.filaOriginal}', '${p.nombre.replace(/'/g, "\\'")}')`}" 
                    style="background:${agotado ? '#ccc' : '#d63384'}; color:white; border:none; padding:10px 15px; border-radius:10px; cursor:${agotado ? 'not-allowed' : 'pointer'};">
                    ${agotado ? 'SIN STOCK' : 'VENDER'}
                </button>
            </div>
        `;
    }).join('');
}

function renderClientes() {
    const contenedor = document.getElementById('lista-clientes-marketing');
    contenedor.innerHTML = clientes.map(c => `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:10px; border-bottom:1px solid #eee;">
            <span style="font-size:0.9rem;">${c.nombre}</span>
            <button onclick="marketingIndividual('${c.tel}', '${c.nombre}')" style="background:#25d366; color:white; border:none; padding:5px 10px; border-radius:5px;">📲</button>
        </div>
    `).join('');
}

function marketingIndividual(tel, nombre) {
    const msj = `¡Hola ${nombre}! ✨ Mira nuestro catálogo de *Amare Beauty* aquí: ${URL_CATALOGO}`;
    window.open(`https://wa.me/${CODIGO_PAIS}${tel}?text=${encodeURIComponent(msj)}`, '_blank');
}

function marketingMasivo() {
    if (clientes.length === 0) return alert("No hay clientes registrados.");
    alert(`Se abrirán los chats de ${clientes.length} clientes. Envía el catálogo en cada uno.`);
    clientes.forEach((c, index) => {
        setTimeout(() => marketingIndividual(c.tel, c.nombre), index * 1500);
    });
}

async function registrarVenta() {
    const select = document.getElementById('select-producto');
    const fila = select.value;
    if (!fila) return alert("Selecciona producto");

    const p = inventario.find(item => item.filaOriginal == fila);
    const stockActual = (parseFloat(p.stock) || 0) - (parseFloat(p.vendidos) || 0);
    const cantidad = parseInt(document.getElementById('cant-venta').value);

    if (cantidad > stockActual) return alert("Error: No hay suficiente stock.");

    const metodo = document.getElementById('metodo-pago').value;
    const cliente = document.getElementById('nombre-cliente').value || "Cliente";
    let tel = document.getElementById('tel-cliente').value.replace(/\D/g, '');
    const totalVenta = parseFloat(p.precio) * cantidad;

    try {
        await fetch(SCRIPT_URL, {
            method: 'POST', mode: 'no-cors',
            body: JSON.stringify({ action: "venta", fila: parseInt(fila), productoNombre: p.nombre, cantidad, metodo, cliente, telefono: tel })
        });

        if (tel.length >= 10) {
            const msj = `✨ *AMARE BEAUTY* ✨\n¡Hola ${cliente}! Gracias por tu compra.\n📦 *Producto:* ${p.nombre}\n💰 *Total:* $${totalVenta.toLocaleString()}`;
            window.open(`https://wa.me/${CODIGO_PAIS}${tel}?text=${encodeURIComponent(msj)}`, '_blank');
        }

        await generarPDF({ cliente, producto: p.nombre, cantidad, total: totalVenta, metodo });
        cargarDesdeDrive(); 
        switchTab('inventario');
    } catch (e) { alert("Error al registrar venta"); }
}

async function generarPDF(datos) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.setTextColor(214, 51, 132);
    doc.text("AMARE BEAUTY", 195, 25, { align: "right" });
    doc.setFontSize(12); doc.setTextColor(0);
    doc.text(`Cliente: ${datos.cliente}`, 15, 60);
    doc.text(`Producto: ${datos.producto}`, 15, 70);
    doc.text(`Total: $${datos.total.toLocaleString()}`, 15, 80);
    doc.save(`Recibo_${datos.cliente}.pdf`);
}

function calcularVentasTotales() {
    const total = inventario.reduce((sum, p) => sum + (parseFloat(p.precio) * (parseFloat(p.vendidos) || 0)), 0);
    document.getElementById('gran-total-dinero').innerText = `$${total.toLocaleString('es-CO')}`;
}

function switchTab(t) {
    document.querySelectorAll('.tab-content').forEach(s => s.style.display = 'none');
    document.querySelectorAll('.tabs button').forEach(b => b.classList.remove('active'));
    document.getElementById('sec-' + t).style.display = 'block';
    document.getElementById('tab-' + t).classList.add('active');
}

function filtrarProductos() {
    const txt = document.getElementById('busqueda').value.toLowerCase();
    document.querySelectorAll('.lista-item').forEach(it => {
        it.style.display = it.innerText.toLowerCase().includes(txt) ? 'flex' : 'none';
    });
}

function filtrarSelectVentas() {
    const txt = document.getElementById('busqueda-venta').value.toLowerCase();
    document.getElementById('select-producto').innerHTML = inventario
        .filter(p => p.nombre.toLowerCase().includes(txt))
        .map(p => {
            const stockActual = (parseFloat(p.stock) || 0) - (parseFloat(p.vendidos) || 0);
            return `<option value="${p.filaOriginal}" ${stockActual <= 0 ? 'disabled' : ''}>${p.nombre} (${stockActual <= 0 ? 'AGOTADO' : '$' + parseFloat(p.precio).toLocaleString()})</option>`;
        }).join('');
}

function irAVenta(fila, nombre) {
    switchTab('ventas');
    document.getElementById('busqueda-venta').value = nombre;
    filtrarSelectVentas();
    document.getElementById('select-producto').value = fila;
}

function verCatalogo() { window.open(URL_CATALOGO, '_blank'); }

window.onload = cargarDesdeDrive;
