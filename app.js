// CONFIGURACIÓN: Reemplaza con la URL de tu "Nueva implementación"
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzd_BeeJgPJFIgtQ3oElAKq5lPLj-A1MRYdbW5bdcsXnn7OXrDr2qbOgM9a6KhEKASoEw/exec";

let inventario = [];

/**
 * Carga los datos desde el Excel (Fila 3 en adelante)
 */
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
        console.error("Error al cargar:", e);
        if (syncBtn) syncBtn.innerText = "❌";
    }
}

/**
 * Lógica de visualización: Muestra cantidad física o estado de Columna M
 */
function renderInventario() {
    const lista = document.getElementById('lista-inventario');
    if (!lista) return;
    
    lista.innerHTML = '';
    
    inventario.forEach(p => {
        const li = document.createElement('li');
        
        // Datos del Excel
        const cantInicial = parseFloat(p.stock) || 0; // Columna D
        const cantVendida = parseFloat(p.vendidos) || 0; // Columna K
        const estadoStock = p.estado || "SIN STOCK"; // Columna M
        
        // CONDICIÓN: Si lo vendido alcanza o supera la cantidad inicial, mostrar Columna M
        // De lo contrario, mostrar la cantidad física disponible.
        const mostrarEstado = (cantVendida >= cantInicial);
        const stockActual = cantInicial - cantVendida;

        li.innerHTML = `
            <div style="flex-grow:1">
                <strong>${p.nombre}</strong>
                <small>SKU: ${p.sku || 'N/A'}</small>
            </div>
            <div style="text-align:right">
                <span class="stock-badge ${mostrarEstado ? 'bg-empty' : 'bg-ok'}">
                    ${mostrarEstado ? estadoStock : 'Cant: ' + stockActual}
                </span><br>
                <strong>$${parseFloat(p.precio || 0).toLocaleString()}</strong>
            </div>
        `;
        lista.appendChild(li);
    });
}

/**
 * Buscador en tiempo real
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
 * Control de navegación por pestañas
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
        renderInventario();
    } else {
        secInv.style.display = 'none';
        secVen.style.display = 'block';
        btnInv.classList.remove('active');
        btnVen.classList.add('active');
        actualizarSelect();
    }
}

/**
 * Llena el menú desplegable de ventas
 */
function actualizarSelect() {
    const select = document.getElementById('select-producto');
    if (!select) return;
    
    select.innerHTML = inventario.map(p => {
        const disponible = (parseFloat(p.stock) || 0) - (parseFloat(p.vendidos) || 0);
        return `<option value="${p.filaOriginal}">${p.nombre} (${disponible} disp.)</option>`;
    }).join('');
}

/**
 * Envía la venta al Excel (Suma a Columna K)
 */
async function registrarVenta() {
    const fila = document.getElementById('select-producto').value;
    const cantidad = parseInt(document.getElementById('cant-venta').value);
    const btnVenta = document.querySelector('.btn-save');
    
    if (!fila || isNaN(cantidad) || cantidad <= 0) {
        return alert("Selecciona un producto y cantidad válida.");
    }

    try {
        btnVenta.innerText = "REGISTRANDO...";
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

        alert("¡Venta registrada exitosamente!");
        document.getElementById('cant-venta').value = 1;
        btnVenta.innerText = "REGISTRAR VENTA";
        btnVenta.disabled = false;
        
        cargarDesdeDrive(); 
    } catch (e) {
        alert("Error al conectar con Excel.");
        btnVenta.innerText = "REGISTRAR VENTA";
        btnVenta.disabled = false;
    }
}

/**
 * Inicialización
 */
window.onload = () => {
    const stored = localStorage.getItem('inventario');
    if(stored) {
        inventario = JSON.parse(stored);
        renderInventario();
    }
    cargarDesdeDrive();
};
