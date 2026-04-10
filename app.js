const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyLyFRYq8cVUhNZsL5w2J5wj9wtSa1ERXzby1YViKRDoeklxIELmZuHCknOCtYN75jKKg/exec";
let inventario = [];
let ventasRealizadas = JSON.parse(localStorage.getItem('ventas')) || [];

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

async function cargarDesdeDrive() {
    try {
        const res = await fetch(SCRIPT_URL + "?t=" + new Date().getTime());
        inventario = await res.json();
        localStorage.setItem('inventario', JSON.stringify(inventario));
        renderInventario();
    } catch (e) { console.error("Error cargando inventario"); }
}

function renderInventario() {
    const lista = document.getElementById('lista-inventario');
    lista.innerHTML = '';
    
    inventario.forEach(p => {
        const li = document.createElement('li');
        const sinStock = p.stock <= 0;
        li.innerHTML = `
            <div style="flex-grow:1">
                <strong>${p.nombre}</strong><br>
                <small>SKU: ${p.sku}</small>
            </div>
            <div style="text-align:right">
                <span class="stock-badge ${sinStock ? 'bg-empty' : 'bg-ok'}">
                    ${sinStock ? 'SIN STOCK' : 'Stock: ' + p.stock}
                </span><br>
                <strong>$${p.precio.toLocaleString()}</strong>
            </div>
        `;
        lista.appendChild(li);
    });
}

function actualizarSelect() {
    const select = document.getElementById('select-producto');
    select.innerHTML = inventario.map(p => 
        `<option value="${p.filaOriginal}">${p.nombre} (${p.stock} disp.)</option>`
    ).join('');
}

async function registrarVenta() {
    const fila = document.getElementById('select-producto').value;
    const cantidad = parseInt(document.getElementById('cant-venta').value);
    const producto = inventario.find(p => p.filaOriginal == fila);

    if (producto.stock < cantidad) return alert("No hay suficiente stock");

    // 1. Actualizar localmente
    producto.stock -= cantidad;
    renderInventario();

    // 2. Enviar a Excel
    try {
        await fetch(SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            body: JSON.stringify({ action: "venta", fila: fila, cantidad: cantidad })
        });
        alert("¡Venta registrada y Excel actualizado!");
        cargarDesdeDrive(); // Recargamos para confirmar datos frescos
    } catch (e) {
        alert("Error al conectar con Excel");
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
