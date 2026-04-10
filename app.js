const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyiGlBgcrLkuoXCXKTAiJx-k283AQkrkW_SXJQgBDfKzZNKV0kaKPMHCF1S52nTG78PIA/exec"; 
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

function verificarFiado() {
    const metodo = document.getElementById('metodo-pago').value;
    const campos = document.getElementById('campos-fiado');
    campos.style.display = (metodo === "Fiado") ? "block" : "none";
}

async function registrarVenta() {
    const productoSelect = document.getElementById('select-producto');
    const fila = productoSelect.value;
    const nombreProd = productoSelect.options[productoSelect.selectedIndex].text;
    const cantidad = document.getElementById('cant-venta').value;
    const metodo = document.getElementById('metodo-pago').value;
    const cliente = document.getElementById('nombre-cliente').value;
    const telefono = document.getElementById('tel-cliente').value;
    const btn = document.querySelector('.btn-save');

    if (!fila) return alert("Selecciona un producto");
    if (metodo === "Fiado" && (!cliente || !telefono)) return alert("Faltan datos del cliente");

    try {
        btn.innerText = "REGISTRANDO...";
        btn.disabled = true;

        await fetch(SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            body: JSON.stringify({ 
                action: "venta", 
                fila: parseInt(fila), 
                cantidad: parseInt(cantidad),
                metodo: metodo,
                cliente: cliente 
            })
        });

        alert("Venta registrada en el Excel");

        if (metodo === "Fiado") {
            const mensaje = `Hola ${cliente}, te escribo de Amare Beauty. Este es un recordatorio de tu compra de: ${nombreProd} por un valor total de $... pendiente de pago. ✨`;
            const wsLink = `https://wa.me/${telefono}?text=${encodeURIComponent(mensaje)}`;
            window.open(wsLink, '_blank');
        }

        // Resetear
        document.getElementById('nombre-cliente').value = "";
        document.getElementById('tel-cliente').value = "";
        document.getElementById('campos-fiado').style.display = "none";
        btn.innerText = "REGISTRAR VENTA";
        btn.disabled = false;
        cargarDesdeDrive();

    } catch (e) {
        alert("Error de conexión");
        btn.disabled = false;
    }
}

// FUNCIONES BASE SE MANTIENEN IGUAL
function calcularTotales() {
    let t = 0;
    inventario.forEach(p => t += (parseFloat(p.vendidos)||0) * (parseFloat(p.precio)||0));
    document.getElementById('gran-total-dinero').innerText = `$${t.toLocaleString()}`;
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
    s.innerHTML = inventario.map(p => `<option value="${p.filaOriginal}">${p.nombre}</option>`).join('');
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
