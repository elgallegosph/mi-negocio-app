const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyIcI_BEDncLdCT9_Zh_7mMCKEcE_5quLGQzIrJT8BkSlmfX6STy2IHrIdIH0Y-xk0IOg/exec";

let transactions = JSON.parse(localStorage.getItem('transactions')) || [];
let currentType = 'ingreso';

async function cargarDesdeDrive() {
    const syncBtn = document.getElementById('sync-btn');
    syncBtn.innerText = "⏳";
    
    try {
        const respuesta = await fetch(SCRIPT_URL + "?t=" + new Date().getTime());
        const filas = await respuesta.json();
        
        if (filas.length > 0) {
            // Mapeamos los datos de tu imagen:
            // fila[0] es "NOMBRE Y REFERENCIA"
            // fila[4] es "PRECIO DE VENTA"
            transactions = filas.map(fila => ({
                id: Date.now() + Math.random(),
                fecha: "Inventario",
                desc: fila[0], 
                amount: parseFloat(fila[4]) || 0,
                type: 'ingreso' // Los cargamos como ingresos (inventario disponible)
            }));
            
            localStorage.setItem('transactions', JSON.stringify(transactions));
            updateUI();
        }
        syncBtn.innerText = "🔄";
    } catch (e) {
        console.error("Error:", e);
        syncBtn.innerText = "❌";
    }
}

function showModal(type) {
    currentType = type;
    document.getElementById('modal-title').innerText = type === 'ingreso' ? 'Nueva Venta' : 'Nuevo Gasto';
    document.getElementById('modal').style.display = 'flex';
}

function closeModal() {
    document.getElementById('modal').style.display = 'none';
    document.getElementById('desc').value = '';
    document.getElementById('amount').value = '';
}

async function saveTransaction() {
    const desc = document.getElementById('desc').value;
    const amount = document.getElementById('amount').value;
    if (!desc || !amount) return alert('Completa los datos');

    const nueva = {
        fecha: new Date().toLocaleDateString(),
        desc: desc,
        monto: parseFloat(amount),
        tipo: currentType
    };

    transactions.unshift({
        id: Date.now(),
        desc: nueva.desc,
        amount: nueva.monto,
        type: nueva.tipo,
        fecha: nueva.fecha
    });
    
    localStorage.setItem('transactions', JSON.stringify(transactions));
    updateUI();
    closeModal();

    try {
        await fetch(SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            body: JSON.stringify(nueva)
        });
    } catch (e) { console.log("Guardado local"); }
}

function confirmarLimpieza() {
    if (confirm("¿Borrar lista actual para recargar desde Drive?")) {
        transactions = [];
        localStorage.removeItem('transactions');
        updateUI();
    }
}

function eliminarUno(id) {
    transactions = transactions.filter(t => t.id !== id);
    localStorage.setItem('transactions', JSON.stringify(transactions));
    updateUI();
}

function updateUI() {
    const list = document.getElementById('transaction-list');
    const totalEl = document.getElementById('total-balance');
    const incomeEl = document.getElementById('total-income');
    const expenseEl = document.getElementById('total-expense');

    list.innerHTML = '';
    let total = 0, inc = 0, exp = 0;

    transactions.forEach(t => {
        const li = document.createElement('li');
        const isInc = t.type === 'ingreso';
        li.innerHTML = `
            <div style="flex-grow:1">
                <strong style="font-size: 14px;">${t.desc}</strong><br>
                <small style="color:#999">${t.fecha}</small>
            </div>
            <span class="${isInc ? 'income' : 'expense'}" style="white-space: nowrap;">${isInc ? '+' : '-'} $${t.amount.toLocaleString()}</span>
            <button class="btn-delete-item" onclick="eliminarUno(${t.id})">×</button>
        `;
        list.appendChild(li);
        if (isInc) { inc += t.amount; total += t.amount; }
        else { exp += t.amount; total -= t.amount; }
    });

    totalEl.innerText = `$${total.toLocaleString()}`;
    incomeEl.innerText = `$${inc.toLocaleString()}`;
    expenseEl.innerText = `$${exp.toLocaleString()}`;
}

window.onload = () => {
    updateUI();
    if (navigator.onLine) cargarDesdeDrive();
};
