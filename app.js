const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwzTnb9-QYj1m9NlJeGCBv_1E9kde3q6i8rob8ltJnAnO9v_PTzRTDZrL1vbpKjoAXqZQ/exec"; 
let inventario = [];

async function cargarDesdeDrive() {
    const syncBtn = document.getElementById('sync-btn');
    if (syncBtn) syncBtn.innerText = "⏳";
    
    try {
        const res = await fetch(SCRIPT_URL + "?t=" + new Date().getTime());
        const data = await res.json();
        
        if (data && data.length > 0) {
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
    let unidadesVendidas = 0;

    inventario.forEach(p => {
        const cantVendida = parseFloat(p.vendidos) || 0;
        const precioUnitario = parseFloat(p.precio) || 0;
        
        dineroTotal += (cantVendida * precioUnitario);
        unidadesVendidas += cantVendida;
    });

    // Actualizar el banner principal
    document.getElementById('gran-total-dinero').innerText = `$${dineroTotal.toLocaleString()}`;
    
    // Actualizar resumen en la pestaña de ventas
    const resumen = document.getElementById('resumen-cantidades');
    if (resumen) {
        resumen.innerHTML = `Unidades totales vendidas: <strong>${unidadesVendidas}</strong>`;
    }
}

function renderInventario() {
    const lista = document.getElementById('lista-inventario');
    if (!lista) return;
    lista.innerHTML = '';
    
    inventario.forEach(p => {
        const li = document.createElement('li');
        const cantInicial = parseFloat(p.stock) || 0;
        const cantVendida = parseFloat(p.vendidos) || 0;
        const stockActual = cantInicial - cantVendida;
        const mostrarEstado = stockActual <= 0;

        li.innerHTML = `
            <div style="flex-grow:1">
                <strong>${p.nombre}</strong>
                <small>Vendidos: ${cantVendida}</small>
            </div>
            <div style="text-align:right">
                <span class="stock-badge ${mostrarEstado ? 'bg-empty' : 'bg-ok'}">
                    ${mostrarEstado ? "SIN STOCK" : 'Cant: ' + stockActual}
                </span><br>
                <strong>$${parseFloat(p.precio || 0).toLocaleString()}</strong>
            </div>
        `;
        lista.appendChild(li);
    });
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
        const disponible = (parseFloat(p.stock) || 0) - (parseFloat(p.vendidos) || 0);
        return `<option value="${p.filaOriginal}">${p.nombre} (${disponible} disp.)</option>`;
    }).join('');
}

async function registrarVenta() {
    const fila = document.getElementById('select-producto').value;
    const cantidad = parseInt(document.getElementById('cant-venta').value);
    const btn = document.querySelector('.btn-save');
    
    try {
        btn.innerText = "REGISTRANDO...";
        btn.disabled = true;
        await fetch(SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            body: JSON.stringify({ action: "venta", fila: parseInt(fila), cantidad: cantidad })
        });
        alert("Venta registrada");
        btn.innerText = "REGISTRAR VENTA";
        btn.disabled = false;
        cargarDesdeDrive(); 
    } catch (e) {
        alert("Error");
        btn.disabled = false;
    }
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
        calcularTotales();
        renderInventario();
    }
    cargarDesdeDrive();
};
