const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbws_mR6bAfwDnXdCOGtbqDVCc7pXo41d7zk9euRrTBL0JfaUuUGMLuHB-ghJXrszRN-_w/exec"; 
const CODIGO_PAIS = "57"; // Cambia esto si usas otro país
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
    } catch (e) { if (syncBtn) syncBtn.innerText = "❌"; }
}

async function registrarVenta() {
    const productoSelect = document.getElementById('select-producto');
    const fila = productoSelect.value;
    const nombreProd = productoSelect.options[productoSelect.selectedIndex].text;
    const cantidadVenta = parseInt(document.getElementById('cant-venta').value);
    const metodo = document.getElementById('metodo-pago').value;
    const cliente = document.getElementById('nombre-cliente').value || "Cliente";
    let telInput = document.getElementById('tel-cliente').value.replace(/\s+/g, ''); // Quitar espacios
    const btn = document.querySelector('.btn-save');

    if (!fila) return alert("Selecciona un producto");

    // Validar Stock
    const productoData = inventario.find(p => p.filaOriginal == fila);
    const stockDisponible = (parseFloat(productoData.stock) || 0) - (parseFloat(productoData.vendidos) || 0);

    if (stockDisponible < cantidadVenta) {
        return alert(`Stock insuficiente. Solo quedan ${stockDisponible} unidades.`);
    }

    // FORMATEAR TELÉFONO AUTOMÁTICAMENTE
    let telefonoFinal = "N/A";
    if (telInput) {
        // Si el usuario no puso el código de país, se lo ponemos nosotros
        telefonoFinal = telInput.startsWith(CODIGO_PAIS) ? telInput : CODIGO_PAIS + telInput;
    }

    try {
        btn.innerText = "PROCESANDO...";
        btn.disabled = true;

        await fetch(SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            body: JSON.stringify({ 
                action: "venta", 
                fila: parseInt(fila), 
                productoNombre: nombreProd,
                cantidad: cantidadVenta,
                metodo: metodo,
                cliente: cliente,
                telefono: telefonoFinal
            })
        });

        alert("¡Venta registrada!");

        // Envío de WhatsApp
        if (telefonoFinal !== "N/A") {
            let mensaje = "";
            if (metodo === "Efectivo" || metodo === "Transferencia") {
                mensaje = `¡Hola ${cliente}! ✨ Muchas gracias por tu compra de ${nombreProd} en Amare Beauty. ❤️`;
            } else {
                const estado = (metodo === "Fiado") ? "pendiente de pago" : "como separado";
                mensaje = `Hola ${cliente}, confirmamos tu pedido de ${nombreProd} en Amare Beauty ${estado}. ✨`;
            }
            window.open(`https://wa.me/${telefonoFinal}?text=${encodeURIComponent(mensaje)}`, '_blank');
        }

        document.getElementById('nombre-cliente').value = "";
        document.getElementById('tel-cliente').value = "";
        btn.innerText = "REGISTRAR VENTA";
        btn.disabled = false;
        cargarDesdeDrive();

    } catch (e) {
        alert("Error al conectar");
        btn.disabled = false;
    }
}

function calcularTotales() {
    let t = 0;
    inventario.forEach(p => t += (parseFloat(p.vendidos)||0) * (parseFloat(p.precio)||0));
    const banner = document.getElementById('gran-total-dinero');
    if(banner) banner.innerText = `$${t.toLocaleString()}`;
}

function renderInventario() {
    const lista = document.getElementById('lista-inventario');
    if (!lista) return;
    lista.innerHTML = '';
    inventario.forEach(p => {
        const li = document.createElement('li');
        const disp = (parseFloat(p.stock)||0) - (parseFloat(p.vendidos)||0);
        li.innerHTML = `<div style="flex-grow:1"><strong>${p.nombre}</strong><br><small>Vendidos: ${p.vendidos||0}</small></div>
            <div style="text-align:right"><span class="stock-badge ${disp<=0?'bg-empty':'bg-ok'}">${disp<=0?'SIN STOCK':'Cant: '+disp}</span><br>
            <strong>$${parseFloat(p.precio||0).toLocaleString()}</strong></div>`;
        lista.appendChild(li);
    });
}

function switchTab(t) {
    document.getElementById('sec-inventario').style.display = t==='inventario'?'block':'none';
    document.getElementById('sec-ventas').style.display = t==='ventas'?'block':'none';
    document.getElementById('tab-inv').className = t==='inventario'?'active':'';
    document.getElementById('tab-ven').className = t==='ventas'?'active':'';
    if(t==='ventas') actualizarSelect();
}

function actualizarSelect() {
    const s = document.getElementById('select-producto');
    s.innerHTML = inventario.map(p => {
        const disp = (parseFloat(p.stock)||0) - (parseFloat(p.vendidos)||0);
        return `<option value="${p.filaOriginal}">${p.nombre} (${disp} disp.)</option>`;
    }).join('');
}

function filtrarProductos() {
    const txt = document.getElementById('busqueda').value.toLowerCase();
    document.querySelectorAll('#lista-inventario li').forEach(i => i.style.display = i.textContent.toLowerCase().includes(txt)?'flex':'none');
}

window.onload = () => {
    if(localStorage.getItem('inventario')) {
        inventario = JSON.parse(localStorage.getItem('inventario'));
        renderInventario(); calcularTotales();
    }
    cargarDesdeDrive();
};
