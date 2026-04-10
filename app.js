const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbz4NEE2kGN5svjAvnnkXuBWjvFf23hLlr_IrI87zhhjngYrpL9tcB9ugiK8AclpNY4iiA/exec"; // REEMPLAZA ESTO
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
            renderInventario();
        }
        if (syncBtn) syncBtn.innerText = "🔄";
    } catch (e) {
        console.error("Error cargando datos:", e);
        if (syncBtn) syncBtn.innerText = "❌";
    }
}

function renderInventario() {
    const lista = document.getElementById('lista-inventario');
    if (!lista) return;
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
        const contenido = item.textContent.toLowerCase();
        item.style.display = contenido.includes(texto) ? 'flex' : 'none';
    });
}

function switchTab(tab) {
    const secInv = document.getElementById('sec-inventario');
    const secVen = document.getElementById('sec-ventas');
    const btnInv = document.getElementById('tab-inv');
    const btnVen = document.getElementById('tab-ven');

    if (tab === 'inventario') {
        secInv.style.display = 'block';
        secVen.style.display = 'none';
        btnInv.classList.add('active');
        btnVen.classList.remove('active');
    } else {
        secInv.style.display = 'none';
        secVen.style.display = 'block';
        btnInv.classList.remove('active');
        btnVen.classList.add('active');
        actualizarSelect();
    }
}

function actualizarSelect() {
    const select = document.getElementById('select-producto');
    if (!select) return;
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
            body: JSON.stringify({ action: "venta", fila: parseInt(fila), cantidad: cantidad })
        });
        alert("Venta enviada al Excel correctamente.");
        cargarDesdeDrive(); 
    } catch (e) {
        alert("Error al conectar con el servidor.");
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
