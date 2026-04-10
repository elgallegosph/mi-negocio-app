const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwHr3BxHoFpYbZSIx-tMy0seC0TzML1iLNdEp7SxBfkBs_JwQF7EceHn-5UmuZ3FnMA/exec"; // Pega aquí la URL nueva
let inventario = [];

async function cargarDesdeDrive() {
    const syncBtn = document.getElementById('sync-btn');
    syncBtn.innerText = "⏳";
    
    try {
        // El "?t=" evita que el navegador use datos viejos guardados
        const res = await fetch(SCRIPT_URL + "?t=" + new Date().getTime());
        const data = await res.json();
        
        if (data && data.length > 0) {
            inventario = data;
            localStorage.setItem('inventario', JSON.stringify(inventario));
            renderInventario();
            console.log("Productos cargados:", inventario.length);
        }
        syncBtn.innerText = "🔄";
    } catch (e) {
        console.error("Error cargando inventario", e);
        syncBtn.innerText = "❌";
    }
}

function renderInventario() {
    const lista = document.getElementById('lista-inventario');
    lista.innerHTML = '';
    
    inventario.forEach(p => {
        const li = document.createElement('li');
        const stock = parseInt(p.stock) || 0;
        const sinStock = stock <= 0;
        
        li.innerHTML = `
            <div style="flex-grow:1">
                <strong>${p.nombre}</strong>
                <small>SKU: ${p.sku}</small>
            </div>
            <div style="text-align:right">
                <span class="stock-badge ${sinStock ? 'bg-empty' : 'bg-ok'}">
                    ${sinStock ? 'SIN STOCK' : 'Stock: ' + stock}
                </span><br>
                <strong>$${parseFloat(p.precio).toLocaleString()}</strong>
            </div>
        `;
        lista.appendChild(li);
    });
}

// Función para buscar productos en tiempo real
function filtrarProductos() {
    const texto = document.getElementById('busqueda').value.toLowerCase();
    const lista = document.getElementById('lista-inventario');
    const items = lista.getElementsByTagName('li');

    Array.from(items).forEach(item => {
        const nombre = item.textContent.toLowerCase();
        item.style.display = nombre.includes(texto) ? 'flex' : 'none';
    });
}

function switchTab(tab) {
    document.querySelectorAll('.tab-content').forEach(t => t.style.display = 'none');
    document.querySelectorAll('.tabs button').forEach(b => b.classList.remove('active'));
    
    if(tab === 'inventario') {
        document.getElementById('sec-inventario').style.display = 'block';
        document.getElementById('tab-inv').classList.add('active');
    } else {
        document.getElementById('sec-ventas').style.display = 'block';
        document.getElementById('tab-ven').classList.add('active');
        actualizarSelect();
    }
}

function actualizarSelect() {
    const select = document.getElementById('select-producto');
    // Solo mostrar productos que tengan stock para vender
    const disponibles = inventario.filter(p => p.stock > 0);
    select.innerHTML = disponibles.map(p => 
        `<option value="${p.filaOriginal}">${p.nombre} (${p.stock})</option>`
    ).join('');
}

async function registrarVenta() {
    const fila = document.getElementById('select-producto').value;
    const cantidad = parseInt(document.getElementById('cant-venta').value);
    
    if (!fila) return alert("Selecciona un producto");

    try {
        await fetch(SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            body: JSON.stringify({ action: "venta", fila: parseInt(fila), cantidad: cantidad })
        });
        alert("Venta registrada. Sincronizando...");
        cargarDesdeDrive(); 
    } catch (e) {
        alert("Error de conexión");
    }
}

window.onload = () => {
    const stored = localStorage.getItem('inventario');
    if(stored) {
        inventario = JSON.parse(stored);
        renderInventario();
    }
    cargarDesdeDrive();
};
