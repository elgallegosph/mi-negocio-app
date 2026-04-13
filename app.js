const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbw6sieUtBXpjZ15opdUl1gBJrPFXM6rRCmD6fHHyY6GRB5nV7JFgN0PWf0k8_tkG7Nqag/exec"; 
const CODIGO_PAIS = "57";
const LOGO_URL = "./logo.png"; 
const URL_CATALOGO = "https://drive.google.com/file/d/1FMtOGvlYbLwSofqO3WCkqG4k65MSzccn/view?usp=sharing"; 

let inventario = [];
let historial = [];
let charts = {};

// FUNCIÓN DE CARGA PRINCIPAL (Auto-ejecutable al inicio)
async function cargarDesdeDrive() {
    const btnSync = document.getElementById('btn-sync-main');
    if(btnSync) btnSync.style.animation = "rotate 1s linear infinite";
    
    try {
        const response = await fetch(`${SCRIPT_URL}?t=${Date.now()}`);
        const data = await response.json();
        inventario = data.inventario || [];
        historial = data.historial || [];
        
        renderInventario();
        calcularVentasTotales(); // ESTO CALCULA EL DINERO REAL VENDIDO
        filtrarSelectVentas();
        
        document.getElementById('splash-screen').style.opacity = '0';
        setTimeout(() => document.getElementById('splash-screen').style.display = 'none', 500);
        if(btnSync) btnSync.style.animation = "none";
    } catch (e) { 
        console.error(e);
        if(btnSync) btnSync.style.animation = "none";
    }
}

// CÁLCULO DE VENTA REAL (Solo multiplica precio x cantidad ya vendida en Excel)
function calcularVentasTotales() {
    const dineroReal = inventario.reduce((sum, p) => {
        const vendidos = parseFloat(p.vendidos) || 0;
        const precio = parseFloat(p.precio) || 0;
        return sum + (vendidos * precio);
    }, 0);
    
    document.getElementById('gran-total-dinero').innerText = `$${dineroReal.toLocaleString('es-CO')}`;
}

function renderInventario() {
    const contenedor = document.getElementById('lista-inventario');
    contenedor.innerHTML = inventario.map(p => {
        const stockActual = (parseFloat(p.stock) || 0) - (parseFloat(p.vendidos) || 0);
        return `
            <div class="lista-item">
                <div>
                    <strong>${p.nombre}</strong><br>
                    <small>Disponibles: ${stockActual}</small>
                    <div class="price-tag">$${parseFloat(p.precio).toLocaleString()}</div>
                </div>
                <button onclick="irAVenta('${p.filaOriginal}', '${p.nombre.replace(/'/g, "\\'")}')" style="background:#d63384; color:white; border:none; padding:10px; border-radius:10px; font-weight:bold;">VENDER</button>
            </div>
        `;
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
    if (!fila) return alert("Selecciona un producto");

    const p = inventario.find(item => item.filaOriginal == fila);
    const cantidad = parseInt(document.getElementById('cant-venta').value);
    const metodo = document.getElementById('metodo-pago').value;
    const cliente = document.getElementById('nombre-cliente').value || "Cliente";
    let tel = document.getElementById('tel-cliente').value.replace(/\D/g, '');
    const totalVenta = parseFloat(p.precio) * cantidad;

    try {
        // Enviar a Drive
        await fetch(SCRIPT_URL, {
            method: 'POST', mode: 'no-cors',
            body: JSON.stringify({ action: "venta", fila: parseInt(fila), productoNombre: p.nombre, cantidad, metodo, cliente, telefono: tel })
        });

        // WhatsApp Inteligente
        if (tel.length >= 10) {
            let msj = (metodo === "Fiado" || metodo === "Separado") 
                ? `¡Hola ${cliente}! ✨ Tu pedido de *${p.nombre}* ha sido registrado. 📝 Total: $${totalVenta.toLocaleString()}. Queda pendiente por (${metodo}). ¡Gracias!`
                : `¡Hola ${cliente}! ✨ Gracias por tu compra de *${p.nombre}*. ❤️ Total: $${totalVenta.toLocaleString()}. Pagado con (${metodo}). ¡Vuelve pronto!`;
            
            window.open(`https://wa.me/${CODIGO_PAIS}${tel}?text=${encodeURIComponent(msj)}`, '_blank');
        }

        await generarPDF({ cliente, producto: p.nombre, cantidad, total: totalVenta, metodo });
        
        // ACTUALIZACIÓN AUTOMÁTICA DESPUÉS DE VENDER
        alert("Venta registrada. Actualizando datos...");
        cargarDesdeDrive(); 
        switchTab('inventario');
    } catch (e) { alert("Error al registrar venta"); }
}

async function getBase64Image(url) {
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.onload = function() {
            const canvas = document.createElement('canvas');
            canvas.width = this.width; canvas.height = this.height;
            canvas.getContext('2d').drawImage(this, 0, 0);
            resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = () => resolve(null);
        img.src = url;
    });
}

async function generarPDF(datos) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const imgData = await getBase64Image(LOGO_URL);

    if (imgData) doc.addImage(imgData, 'PNG', 15, 10, 30, 30);
    
    doc.setTextColor(214, 51, 132);
    doc.setFontSize(22);
    doc.text("AMARE BEAUTY", 195, 25, { align: "right" });
    
    doc.setFontSize(12); doc.setTextColor(0);
    doc.text(`Fecha: ${new Date().toLocaleDateString()}`, 15, 50);
    doc.text(`Cliente: ${datos.cliente}`, 15, 60);
    doc.text(`Producto: ${datos.producto}`, 15, 70);
    doc.text(`Cantidad: ${datos.cantidad}`, 15, 80);
    doc.setFontSize(16);
    doc.text(`TOTAL: $${datos.total.toLocaleString()}`, 15, 95);
    doc.setFontSize(12);
    doc.text(`Método: ${datos.metodo}`, 15, 105);

    doc.save(`Factura_${datos.cliente}.pdf`);
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
    charts.m = new Chart(ctx, {
        type: 'doughnut',
        data: { labels: Object.keys(stats), datasets: [{ data: Object.values(stats), backgroundColor: ['#d63384', '#3498db', '#f1c40f', '#2ecc71'] }] }
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
    document.querySelectorAll('.lista-item').forEach(it => {
        it.style.display = it.innerText.toLowerCase().includes(txt) ? 'flex' : 'none';
    });
}

function verCatalogo() { window.open(URL_CATALOGO, '_blank'); }
function enviarMarketingMasivo() {
    window.open(`https://wa.me/?text=${encodeURIComponent('✨ ¡Hola! Mira nuestro catálogo de Amare Beauty aquí: ' + URL_CATALOGO)}`, '_blank');
}

// INICIO AUTOMÁTICO
window.onload = cargarDesdeDrive;
