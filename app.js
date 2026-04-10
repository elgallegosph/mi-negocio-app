// CONFIGURACIÓN: Reemplaza con la URL de tu "Nueva implementación"
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzH1ytMMinKFumQx9mOM2U5xOiTXdT2PEW95wk_GMPrKUu9cjSfztMvfggiL_Zl--4Bug/exec";

let inventario = [];

/**
 * Carga los datos desde el Excel (Fila 3 en adelante)
 */
async function cargarDesdeDrive() {
    const syncBtn = document.getElementById('sync-btn');
    if (syncBtn) syncBtn.innerText = "⏳";
    
    try {
        // El parámetro ?t= evita que el navegador cargue datos viejos (caché)
        const res = await fetch(SCRIPT_URL + "?t=" + new Date().getTime());
        const data = await res.json();
        
        if (data && data.length > 0) {
            inventario = data;
            localStorage.setItem('inventario', JSON.stringify(inventario));
            renderInventario();
            console.log("Inventario cargado exitosamente.");
        }
        if (syncBtn) syncBtn.innerText = "🔄";
    } catch (e) {
        console.error("Error al cargar inventario:", e);
        if (syncBtn) syncBtn.innerText = "❌";
        setTimeout(() => { if (syncBtn) syncBtn.innerText = "🔄"; }, 3000);
    }
}

/**
 * Dibuja la lista de productos en la pestaña de Inventario
 */
function renderInventario() {
    const lista = document.getElementById('lista-inventario');
    if (!lista) return;
    
    lista.innerHTML = '';
    
    inventario.forEach(p => {
        const li = document.createElement('li');
        // Ahora usamos p.stock que viene directamente de la columna D
        const stockActual = parseInt(p.stock) || 0;
        const sinStock = stockActual <= 0;
        
        li.innerHTML = `
            <div style="flex-grow:1">
                <strong>${p.nombre}</strong>
                <small>SKU: ${p.sku || 'N/A'}</small>
            </div>
            <div style="text-align:right">
                <span class="stock-badge ${sinStock ? 'bg-empty' : 'bg-ok'}">
                    ${sinStock ? 'SIN STOCK' : 'Cant: ' + stockActual}
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
    } else {
        secInv.style.display = 'none';
        secVen.style.display = 'block';
        btnInv.classList.remove('active');
        btnVen.classList.add('active');
        actualizarSelect();
    }
}

/**
 * Llena el menú desplegable de ventas con los productos del inventario
 */
function actualizarSelect() {
    const select = document.getElementById('select-producto');
    if (!select) return;
    
    // Generar opciones basadas en el inventario actual
    select.innerHTML = inventario.map(p => 
        `<option value="${p.filaOriginal}">${p.nombre} ($${parseFloat(p.precio).toLocaleString()})</option>`
    ).join('');
}

/**
 * Envía la venta al Excel para que se sume a la Columna K (Cantidad Vendida)
 */
async function registrarVenta() {
    const fila = document.getElementById('select-producto').value;
    const cantidad = parseInt(document.getElementById('cant-venta').value);
    const btnVenta = document.querySelector('.btn-save');
    
    if (!fila || isNaN(cantidad) || cantidad <= 0) {
        return alert("Por favor selecciona un producto y una cantidad válida.");
    }

    try {
        // Bloquear botón para evitar doble clic
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

        alert("¡Venta registrada! Se ha sumado a la columna 'Cantidad Vendida' en tu Excel.");
        
        // Resetear formulario y recargar datos
        document.getElementById('cant-venta').value = 1;
        btnVenta.innerText = "REGISTRAR VENTA";
        btnVenta.disabled = false;
        
        cargarDesdeDrive(); 
    } catch (e) {
        alert("Hubo un error al conectar con el servidor.");
        btnVenta.innerText = "REGISTRAR VENTA";
        btnVenta.disabled = false;
        console.error(e);
    }
}

/**
 * Al cargar la página
 */
window.onload = () => {
    // Cargar datos locales de respaldo
    const stored = localStorage.getItem('inventario');
    if(stored) {
        inventario = JSON.parse(stored);
        renderInventario();
    }
    
    // Intentar sincronizar con Google Drive de inmediato
    if (navigator.onLine) {
        cargarDesdeDrive();
    }
};
