const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwgwc9J_FfTLk82xkcx5PEQSm4Vp9Ktc8do7sziVoWq1c_xicVssarvkssZvB92O7daFA/exec"; 
let inventario = [];

async function cargarDesdeDrive() {
    const syncBtn = document.getElementById('sync-btn');
    syncBtn.innerText = "⏳";
    
    try {
        const res = await fetch(SCRIPT_URL + "?t=" + new Date().getTime());
        const data = await res.json();
        
        if (data) {
            inventario = data;
            localStorage.setItem('inventario', JSON.stringify(inventario));
            renderInventario();
        }
        syncBtn.innerText = "🔄";
    } catch (e) {
        console.error("Error:", e);
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

function filtrarProductos() {
    const texto = document.getElementById('busqueda').value.toLowerCase();
    const items = document.querySelectorAll('#lista-inventario li');

    items.forEach(item => {
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
    // Mostramos todos para poder seleccionar, indicando stock
    select.innerHTML = inventario.map(p => 
        `<option value="${p.filaOriginal}">${p.nombre} (${p.stock} disp.)</option>`
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
            body: JSON.stringify({ 
                action: "venta", 
                fila: parseInt(fila), 
                cantidad: cantidad 
            })
        });
        alert("¡Venta exitosa! El stock en el Excel se está actualizando.");
        cargarDesdeDrive(); 
    } catch (e) {
        alert("Error al registrar venta");
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
