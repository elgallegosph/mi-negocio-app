const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyUnzIdsVbBE5sw0w5avtLpvJ1A7pGqRgqM32tSO7q0jcVVsqT1QWNmTMdQJVoAa6pxgw/exec";

let transactions = JSON.parse(localStorage.getItem('transactions')) || [];
let currentType = 'ingreso';

async function cargarDesdeDrive() {
    const syncBtn = document.getElementById('sync-btn');
    syncBtn.innerText = "⏳";
    try {
        const respuesta = await fetch(SCRIPT_URL);
        const filas = await respuesta.json();
        if (filas.length > 1) {
            transactions = filas.slice(1).map(fila => ({
                id: Date.now() + Math.random(),
                fecha: fila[0],
                desc: fila[1],
                amount: parseFloat(fila[2]) || 0,
                type: fila[3] ? fila[3].toLowerCase().trim() : 'ingreso'
            }));
            localStorage.setItem('transactions', JSON.stringify(transactions));
            updateUI();
        }
        syncBtn.innerText = "🔄";
    } catch (e) {
        syncBtn.innerText = "❌";
        setTimeout(() => syncBtn.innerText = "🔄", 3000);
    }
}

function showModal(type) {
    currentType = type;
    document.getElementById('modal-title').innerText = type === 'ingreso' ? 'Nuevo Ingreso' : 'Nuevo Gasto';
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
    } catch (e) { console.log("Offline: Guardado local"); }
}

function confirmarLimpieza() {
    if (confirm("¿Borrar todo el historial local? (No afecta al Excel)")) {
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
                <strong>${t.desc}</strong><br>
                <small style="color:#999">${t.fecha || ''}</small>
            </div>
            <span class="${isInc ? 'income' : 'expense'}">${isInc ? '+' : '-'} $${t.amount.toLocaleString()}</span>
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

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => { navigator.serviceWorker.register('./sw.js'); });
}

window.onload = () => {
    updateUI();
    if (navigator.onLine) cargarDesdeDrive();
};
