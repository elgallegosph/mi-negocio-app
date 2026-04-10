// CONFIGURACIÓN: Reemplaza con la URL de tu "Nueva implementación"
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzd_BeeJgPJFIgtQ3oElAKq5lPLj-A1MRYdbW5bdcsXnn7OXrDr2qbOgM9a6KhEKASoEw/exec";

let inventario = [];

/**
 * Carga los datos desde el Excel (Forzando actualización)
 */
async function cargarDesdeDrive() {
    const syncBtn = document.getElementById('sync-btn');
    if (syncBtn) syncBtn.innerText = "⏳";
    
    try {
        // El parámetro Math.random() asegura que NO use datos viejos
        const res = await fetch(SCRIPT_URL + "?t=" + Math.random());
        const data = await res.json();
        
        if (data && data.length > 0) {
            inventario = data;
            // Guardamos en el navegador
            localStorage.setItem('inventario', JSON.stringify(inventario));
            renderInventario();
            console.log("Datos frescos cargados desde el Excel");
        }
        if (syncBtn) syncBtn.innerText = "🔄";
    } catch (e) {
        console.error("Error al cargar:", e);
        if (syncBtn) syncBtn.innerText = "❌";
    }
}

/**
 * Muestra los productos con la cantidad de la Columna D
 */
function renderInventario() {
    const lista = document.getElementById('lista-inventario');
    if (!lista) return;
    
    lista.innerHTML = '';
    
    inventario.forEach(p => {
        const li = document.createElement('li');
        
        // Convertimos a número lo que viene del Excel (Columna D)
        const stockFisico = Number(p.stock); 
        
        // Si el número es mayor a 0, mostramos "Cant", si no "SIN STOCK"
        const tieneStock = !isNaN(stockFisico) && stockFisico > 0;
        
        li.innerHTML = `
            <div style="flex-grow:1">
                <strong>${p.nombre}</strong>
                <small>SKU: ${p.sku || 'N/A'}</small>
            </div>
            <div style="text-align:right">
                <span class="stock-badge ${tieneStock ? 'bg-ok' : 'bg-empty'}">
                    ${tieneStock ? 'Cant: ' + stockFisico : 'SIN STOCK'}
                </span><br>
                <strong>$${parseFloat(p.precio || 0).toLocaleString()}</strong>
            </div>
        `;
        lista.appendChild(li);
    });
}

/**
 * Buscador de productos
 */
function filtrarProductos() {
    const texto = document.getElementById('busqueda').value.toLowerCase();
    const items = document.querySelectorAll('#lista-inventario li');
    
    items.forEach(item => {
        const contenido = item.textContent.toLowerCase();
        item.style.display = contenido.includes(texto) ? 'flex' : 'none';
    });
}

/**
 * Navegación entre Inventario y Ventas
 */
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
        renderInventario(); // Refrescar lista al volver
    } else {
        secInv.style.display = 'none';
        secVen.style.display = 'block';
        btnInv.classList.remove('active');
        btnVen.classList.add('active');
        actualizarSelect();
    }
}

/**
 * Actualiza el selector de la pestaña de ventas
 */
function actualizarSelect() {
    const select = document.getElementById('select-producto');
    if (!select) return;
    
    select.innerHTML = inventario.map(p => 
        `<option value="${p.filaOriginal}">${p.nombre} (Disponibles: ${p.stock})</option>`
    ).join('');
}

/**
 * Registra la venta sumando a la Columna K
 */
async function registrarVenta() {
    const fila = document.getElementById('select-producto').value;
    const cantidad = parseInt(document.getElementById('cant-venta').value);
    const btnVenta = document.querySelector('.btn-save');
    
    if (!fila || isNaN(cantidad) || cantidad <= 0) {
        return alert("Selecciona un producto y cantidad.");
    }

    try {
        btnVenta.innerText = "ENVIANDO...";
        btnVenta.disabled = true;

        await fetch(SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            body: JSON.stringify({ 
                action: "venta", 
                fila: parseInt(fila), 
                cantidad: cantidad 
            })
        });

        alert("¡Venta registrada! Se sumó a la Columna K del Excel.");
        
        document.getElementById('cant-venta').value = 1;
        btnVenta.innerText = "REGISTRAR VENTA";
        btnVenta.disabled = false;
        
        // Recargar datos inmediatamente para ver el nuevo stock
        cargarDesdeDrive(); 
    } catch (e) {
        alert("Error de conexión con el Excel.");
        btnVenta.innerText = "REGISTRAR VENTA";
        btnVenta.disabled = false;
    }
}

/**
 * Al cargar la aplicación
 */
window.onload = () => {
    // Primero cargar lo que esté guardado para que no salga vacío
    const stored = localStorage.getItem('inventario');
    if(stored) {
        inventario = JSON.parse(stored);
        renderInventario();
    }
    
    // Luego buscar los datos reales del Drive
    cargarDesdeDrive();
};
