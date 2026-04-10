const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwkn3oWKF_rLuSOga5ItHJPItZ5kPSfyfVKm9cPcPdvUQhZaGY28ZHAUTMzOAQWNHMmNQ/exec"; 
let inventario = [];

async function cargarDesdeDrive() {
    const syncBtn = document.getElementById('sync-btn');
    if (syncBtn) syncBtn.innerText = "⏳";
    try {
        const res = await fetch(SCRIPT_URL + "?t=" + new Date().getTime());
        const data = await res.json();
        if (data) {
            inventario = data;
            localStorage.setItem('inventario', JSON.stringify(inventario));
            calcularTotales();
            renderInventario();
        }
        if (syncBtn) syncBtn.innerText = "🔄";
    } catch (e) {
        if (syncBtn) syncBtn.innerText = "❌";
    }
}

function calcularTotales() {
    let dineroTotal = 0;
    inventario.forEach(p => {
        dineroTotal += ((parseFloat(p.vendidos) || 0) * (parseFloat(p.precio) || 0));
    });
    document.getElementById('gran-total-dinero').innerText = `$${dineroTotal.toLocaleString()}`;
}

function renderInventario() {
    const lista = document.getElementById('lista-inventario');
    if (!lista) return;
    lista.innerHTML = '';
    inventario.forEach(p => {
        const li = document.createElement('li');
        const stockActual = (parseFloat(p.stock) || 0) - (parseFloat(p.vendidos) || 0);
        const sinStock = stockActual <= 0;
        li.innerHTML = `
            <div style="flex-grow:1">
                <strong>${p.nombre}</strong>
                <small>Vendidos: ${p.vendidos || 0}</small>
            </div>
            <div style="text-align:right">
                <span class="stock-badge ${sinStock ? 'bg-empty' : 'bg-ok'}">
                    ${sinStock ? "SIN STOCK" : 'Cant: ' + stockActual}
                </span><br>
                <strong>$${parseFloat(p.precio || 0).toLocaleString()}</strong>
            </div>`;
        lista.appendChild(li);
    });
}

async function registrarVenta() {
    const fila = document.getElementById('select-producto').value;
    const cantidad = parseInt(document.getElementById('cant-venta').value);
    const metodo = document.getElementById('metodo-pago').value;
    const btn = document.querySelector('.btn-save');
    
    if (!fila || isNaN(cantidad)) return alert("Datos incompletos");

    try {
        btn.innerText = "PROCESANDO...";
        btn.disabled = true;
        await fetch(SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            body: JSON.stringify({ 
                action: "venta", 
                fila: parseInt(fila), 
                cantidad: cantidad,
                metodo: metodo 
            })
        });
        alert(`Venta registrada como ${metodo}`);
        btn.innerText = "REGISTRAR VENTA";
        btn.disabled = false;
        cargarDesdeDrive(); 
    } catch (e) {
        alert("Error al registrar");
        btn.disabled = false;
    }
}

function switchTab(tab) {
    document.getElementById('sec-inventario').style.display = tab === 'inventario' ? 'block' : 'none';
    document.getElementById('sec-ventas').style.display = tab === 'ventas' ? 'block' : 'none';
    document.getElementById('tab-inv').className = tab === 'inventario' ? 'active' : '';
    document.getElementById('tab-ven').className = tab === 'ventas' ? 'active' : '';
    if(tab === 'ventas') actualizarSelect();
}

function actualizarSelect() {
    const select = document.getElementById('select-producto');
    if (!select) return;
    select.innerHTML = inventario.map(p => {
        const disp = (parseFloat(p.stock) || 0) - (parseFloat(p.vendidos) || 0);
        return `<option value="${p.filaOriginal}">${p.nombre} (${disp} disp.)</option>`;
    }).join('');
}

function filtrarProductos() {
    const texto = document.getElementById('busqueda').value.toLowerCase();
    document.querySelectorAll('#lista-inventario li').forEach(item => {
        item.style.display = item.textContent.toLowerCase().includes(texto) ? 'flex' : 'none';
    });
}

window.onload = () => {
    const stored = localStorage.getItem('inventario');
    if(stored) {
        inventario = JSON.parse(stored);
        renderInventario();
        calcularTotales();
    }
    cargarDesdeDrive();
};
