// REEMPLAZA ESTA URL CON LA TUYA REAL (Asegúrate que empiece con https://)
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbz5JcXxlAZgQdgVP9LFHF4laDz2hwhv1d53Fd0OXUby4vB0xZFvltUHtNJzA_-Ixcqk3A/exec"; 
let inventario = [];
let historial = [];
let charts = {};

async function cargarDesdeDrive() {
    try {
        // Corregido: URL limpia sin carácteres extra
        const res = await fetch(SCRIPT_URL + "?t=" + new Date().getTime());
        const data = await res.json();
        inventario = data.inventario || [];
        historial = data.historial || [];
        renderInventario();
        calcularVentasTotales();
        actualizarSelect();
    } catch (e) { console.error("Error al cargar:", e); }
}

function calcularVentasTotales() {
    let suma = 0;
    inventario.forEach(p => {
        suma += (parseFloat(p.precio) || 0) * (parseFloat(p.vendidos) || 0);
    });
    document.getElementById('gran-total-dinero').innerText = `$${suma.toLocaleString('es-CO')}`;
}

function switchTab(t) {
    // Ocultar todas las secciones
    document.querySelectorAll('.tab-content').forEach(s => s.style.display = 'none');
    // Desactivar todos los botones
    document.querySelectorAll('.tabs button').forEach(b => b.classList.remove('active'));
    
    const sec = document.getElementById('sec-' + t);
    const btn = document.getElementById('tab-' + t);
    
    if (sec && btn) {
        sec.style.display = 'block';
        btn.classList.add('active');
        // Si es la pestaña de estadísticas, redibujamos
        if(t === 'stats') setTimeout(dibujarGraficos, 100);
    }
}

function dibujarGraficos() {
    const pink = '#d63384';
    
    // Gráfico de Métodos
    const ctxM = document.getElementById('canvasMetodos');
    if (ctxM) {
        if (charts.m) charts.m.destroy();
        const counts = historial.reduce((a, c) => (a[c.metodo] = (a[c.metodo] || 0) + 1, a), {});
        charts.m = new Chart(ctxM, {
            type: 'doughnut',
            data: {
                labels: Object.keys(counts),
                datasets: [{ data: Object.values(counts), backgroundColor: [pink, '#6610f2', '#fd7e14'] }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }

    // Gráfico Top 5
    const ctxP = document.getElementById('canvasTop5');
    if (ctxP) {
        if (charts.p) charts.p.destroy();
        const top5 = [...inventario].sort((a,b) => b.vendidos - a.vendidos).slice(0, 5);
        charts.p = new Chart(ctxP, {
            type: 'bar',
            data: {
                labels: top5.map(p => p.nombre.substring(0, 10)),
                datasets: [{ label: 'Ventas', data: top5.map(p => p.vendidos), backgroundColor: pink }]
            },
            options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false }
        });
    }
}

function renderInventario() {
    const lista = document.getElementById('lista-inventario');
    if (!lista) return;
    lista.innerHTML = inventario.map(p => `
        <li>
            <span>${p.nombre}</span>
            <strong>$${parseFloat(p.precio).toLocaleString()}</strong>
        </li>`).join('');
}

function actualizarSelect() {
    const s = document.getElementById('select-producto');
    if (s) s.innerHTML = inventario.map(p => `<option value="${p.filaOriginal}">${p.nombre}</option>`).join('');
}

window.onload = cargarDesdeDrive;
