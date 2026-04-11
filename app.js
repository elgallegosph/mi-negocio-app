const SCRIPT_URL = "https://script.google.com/macros/s/AKfycby6hShZ8dPGQpHvtechXGkQ_zlqng2y1SjCCnePK7ks3Xg64KuK6Ac0LWvd9JZDnOeTvw/exec";
const CODIGO_PAIS = "57";
let inventario = [];
let historial = [];
let charts = {};

async function cargarDesdeDrive() {
    try {
        const res = await fetch(SCRIPT_URL + "?t=" + new Date().getTime());
        const data = await res.json();
        inventario = data.inventario;
        historial = data.historial;
        renderInventario();
        actualizarSelect();
        if(document.getElementById('sec-stats').style.display === 'block') generarGraficos();
    } catch (e) { console.error("Error cargando datos"); }
}

function generarGraficos() {
    // 1. Destruir gráficos anteriores para recargar
    if (charts.metodos) charts.metodos.destroy();
    if (charts.prods) charts.prods.destroy();

    // 2. Procesar Datos de Métodos
    const metodosData = historial.reduce((acc, curr) => {
        acc[curr.metodo] = (acc[curr.metodo] || 0) + 1;
        return acc;
    }, {});

    charts.metodos = new Chart(document.getElementById('chartMetodos'), {
        type: 'doughnut',
        data: {
            labels: Object.keys(metodosData),
            datasets: [{
                label: 'Ventas por Método',
                data: Object.values(metodosData),
                backgroundColor: ['#ff6384', '#36a2eb', '#cc65fe', '#ffce56']
            }]
        },
        options: { plugins: { title: { display: true, text: 'Preferencia de Pago' } } }
    });

    // 3. Procesar Productos más vendidos
    const prodsData = historial.reduce((acc, curr) => {
        acc[curr.producto] = (acc[curr.producto] || 0) + curr.cantidad;
        return acc;
    }, {});

    const sortedProds = Object.entries(prodsData).sort((a,b) => b[1]-a[1]).slice(0, 5);

    charts.prods = new Chart(document.getElementById('chartProductos'), {
        type: 'bar',
        data: {
            labels: sortedProds.map(p => p[0]),
            datasets: [{
                label: 'Unidades Vendidas',
                data: sortedProds.map(p => p[1]),
                backgroundColor: '#d63384'
            }]
        },
        options: { 
            indexAxis: 'y',
            plugins: { title: { display: true, text: 'Top 5 Productos' } } 
        }
    });
}

// FUNCIONES DE VENTA Y NAVEGACIÓN
async function registrarVenta() {
    const fila = document.getElementById('select-producto').value;
    const nombreProd = document.getElementById('select-producto').options[document.getElementById('select-producto').selectedIndex].text;
    const cantidad = parseInt(document.getElementById('cant-venta').value);
    const metodo = document.getElementById('metodo-pago').value;
    const cliente = document.getElementById('nombre-cliente').value || "Cliente";
    let tel = document.getElementById('tel-cliente').value.replace(/\s+/g, '');
    
    if(!fila) return alert("Seleccione producto");
    
    const prod = inventario.find(p => p.filaOriginal == fila);
    if((prod.stock - prod.vendidos) < cantidad) return alert("Sin stock suficiente");

    const telFinal = tel ? (tel.startsWith(CODIGO_PAIS) ? tel : CODIGO_PAIS + tel) : "N/A";

    const btn = document.querySelector('.btn-save');
    btn.disabled = true;
    
    await fetch(SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        body: JSON.stringify({ action: "venta", fila: parseInt(fila), productoNombre: nombreProd, cantidad, metodo, cliente, telefono: telFinal })
    });

    alert("Venta Registrada");
    if(telFinal !== "N/A") {
        const msg = metodo === "Fiado" ? `Recordatorio de pago para ${cliente}` : `Gracias por tu compra ${cliente}`;
        window.open(`https://wa.me/${telFinal}?text=${encodeURIComponent(msg)}`, '_blank');
    }
    
    btn.disabled = false;
    cargarDesdeDrive();
}

function switchTab(t) {
    document.querySelectorAll('.tab-content').forEach(s => s.style.display = 'none');
    document.querySelectorAll('.tabs button').forEach(b => b.classList.remove('active'));
    document.getElementById('sec-' + t).style.display = 'block';
    document.getElementById('tab-' + t).classList.add('active');
    if(t === 'stats') generarGraficos();
}

function renderInventario() {
    const lista = document.getElementById('lista-inventario');
    lista.innerHTML = inventario.map(p => {
        const disp = p.stock - p.vendidos;
        return `<li><strong>${p.nombre}</strong> <span>Cant: ${disp}</span></li>`;
    }).join('');
}

function actualizarSelect() {
    const s = document.getElementById('select-producto');
    s.innerHTML = inventario.map(p => `<option value="${p.filaOriginal}">${p.nombre}</option>`).join('');
}

window.onload = cargarDesdeDrive;
