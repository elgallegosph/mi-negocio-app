const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxUp8nBkTb9CE3D3l3p1P6UbyvCGpyzabpKhCbmszQpqx-uZqdAeEgHWb0gsRspisMZeQ/exec"; 
const CODIGO_PAIS = "57";
let inventario = [];
let historial = [];
let charts = {};

async function cargarDesdeDrive() {
    const syncBtn = document.getElementById('sync-btn');
    if (syncBtn) syncBtn.innerText = "⏳";
    try {
        const res = await fetch(SCRIPT_URL + "?t=" + new Date().getTime());
        const data = await res.json();
        inventario = data.inventario || [];
        historial = data.historial || [];
        renderInventario();
        calcularVentasTotales(); 
        actualizarSelect();
        if (syncBtn) syncBtn.innerText = "🔄";
    } catch (e) { console.error(e); if (syncBtn) syncBtn.innerText = "❌"; }
}

function calcularVentasTotales() {
    let sumaReal = 0;
    inventario.forEach(p => {
        const precio = parseFloat(p.precio) || 0;
        const unidadesVendidas = parseFloat(p.vendidos) || 0;
        if (precio > 0 && unidadesVendidas > 0) {
            sumaReal += (precio * unidadesVendidas);
        }
    });
    document.getElementById('gran-total-dinero').innerText = `$${sumaReal.toLocaleString('es-CO')}`;
}

function switchTab(t) {
    document.querySelectorAll('.tab-content').forEach(s => s.style.display = 'none');
    document.querySelectorAll('.tabs button').forEach(b => b.classList.remove('active'));
    const sec = document.getElementById('sec-' + t);
    const btn = document.getElementById('tab-' + t);
    if (sec && btn) {
        sec.style.display = 'block';
        btn.classList.add('active');
    }
    if(t === 'stats') generarGraficosPro();
}

function generarGraficosPro() {
    // 1. Configuración de colores Amare Beauty
    const colores = ['#d63384', '#fd7e14', '#6610f2', '#20c997', '#0dcaf0'];

    // 2. Gráfico de Métodos de Pago (Dona)
    const ctxM = document.getElementById('chartMetodos');
    if (ctxM) {
        if (charts.m) charts.m.destroy();
        const met = historial.reduce((a, c) => (a[c.metodo] = (a[c.metodo] || 0) + 1, a), {});
        charts.m = new Chart(ctxM, {
            type: 'doughnut',
            data: {
                labels: Object.keys(met),
                datasets: [{
                    data: Object.values(met),
                    backgroundColor: colores,
                    borderWidth: 2
                }]
            },
            options: { plugins: { legend: { position: 'bottom' } } }
        });
    }

    // 3. Gráfico de Top Productos (Barras Horizontales)
    const ctxP = document.getElementById('chartProductos');
    if (ctxP) {
        if (charts.p) charts.p.destroy();
        const pro = inventario
            .map(p => ({ nombre: p.nombre, ventas: parseFloat(p.vendidos) || 0 }))
            .sort((a, b) => b.ventas - a.ventas)
            .slice(0, 5);

        charts.p = new Chart(ctxP, {
            type: 'bar',
            data: {
                labels: pro.map(x => x.nombre),
                datasets: [{
                    label: 'Unidades Vendidas',
                    data: pro.map(x => x.ventas),
                    backgroundColor: '#d63384aa',
                    borderColor: '#d63384',
                    borderWidth: 1
                }]
            },
            options: {
                indexAxis: 'y',
                scales: { x: { beginAtZero: true } },
                plugins: { legend: { display: false } }
            }
        });
    }
}

// ... (Las funciones renderInventario, registrarVenta, filtrarProductos y actualizarSelect se mantienen igual a las anteriores)

window.onload = cargarDesdeDrive;
