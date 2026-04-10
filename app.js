// CONFIGURACIÓN: Pega aquí la URL que te dio Google Apps Script
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyUnzIdsVbBE5sw0w5avtLpvJ1A7pGqRgqM32tSO7q0jcVVsqT1QWNmTMdQJVoAa6pxgw/exec";

// Estado de la aplicación
let transactions = JSON.parse(localStorage.getItem('transactions')) || [];
let currentType = 'ingreso';

/**
 * Función para cargar datos desde Google Sheets al abrir la app
 */
async function cargarDesdeDrive() {
    console.log("Sincronizando con Google Drive...");
    try {
        const respuesta = await fetch(SCRIPT_URL);
        const filas = await respuesta.json();
        
        // Asumiendo que el Excel tiene: Fecha (0), Descripción (1), Monto (2), Tipo (3)
        // Saltamos la fila 0 si son los encabezados
        if (filas.length > 1) {
            transactions = filas.slice(1).map(fila => ({
                id: Date.now() + Math.random(),
                fecha: fila[0],
                desc: fila[1],
                amount: parseFloat(fila[2]) || 0,
                type: fila[3] ? fila[3].toLowerCase() : 'ingreso'
            }));

            localStorage.setItem('transactions', JSON.stringify(transactions));
            updateUI();
            console.log("Datos del Drive cargados con éxito");
        }
    } catch (e) {
        console.warn("No se pudo conectar con Drive. Usando datos locales.", e);
    }
}

/**
 * Mostrar el modal de registro
 */
function showModal(type) {
    currentType = type;
    document.getElementById('modal-title').innerText = type === 'ingreso' ? 'Nuevo Ingreso' : 'Nuevo Gasto';
    document.getElementById('modal').style.display = 'flex';
}

/**
 * Cerrar el modal y limpiar inputs
 */
function closeModal() {
    document.getElementById('modal').style.display = 'none';
    document.getElementById('desc').value = '';
    document.getElementById('amount').value = '';
}

/**
 * Guardar transacción (Local + Google Drive)
 */
async function saveTransaction() {
    const desc = document.getElementById('desc').value;
    const amount = document.getElementById('amount').value;

    if (desc === '' || amount === '') {
        alert('Por favor, completa todos los campos.');
        return;
    }

    const nuevaTransaccion = {
        fecha: new Date().toLocaleDateString(),
        desc: desc,
        monto: parseFloat(amount),
        tipo: currentType
    };

    // 1. Actualizar Interfaz y LocalStorage de inmediato (Offline First)
    const localData = {
        id: Date.now(),
        desc: nuevaTransaccion.desc,
        amount: nuevaTransaccion.monto,
        type: nuevaTransaccion.tipo,
        fecha: nuevaTransaccion.fecha
    };

    transactions.unshift(localData); // Agrega al inicio de la lista
    localStorage.setItem('transactions', JSON.stringify(transactions));
    updateUI();
    closeModal();

    // 2. Enviar datos a Google Sheets
    try {
        await fetch(SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors', 
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(nuevaTransaccion)
        });
        console.log("Enviado a Google Drive correctamente.");
    } catch (e) {
        console.error("Error al sincronizar con Drive:", e);
        alert("Guardado localmente, pero no se pudo subir al Drive.");
    }
}

/**
 * Actualizar la interfaz de usuario (Totales y Lista)
 */
function updateUI() {
    const list = document.getElementById('transaction-list');
    const totalEl = document.getElementById('total-balance');
    const incomeEl = document.getElementById('total-income');
    const expenseEl = document.getElementById('total-expense');

    list.innerHTML = '';
    let total = 0, inc = 0, exp = 0;

    transactions.forEach(t => {
        const li = document.createElement('li');
        const sign = t.type === 'ingreso' ? '+' : '-';
        const colorClass = t.type === 'ingreso' ? 'income' : 'expense';

        li.innerHTML = `
            <div>
                <strong>${t.desc}</strong><br>
                <small style="color: #888;">${t.fecha || ''}</small>
            </div>
            <span class="${colorClass}">${sign} $${t.amount.toLocaleString()}</span>
        `;
        list.appendChild(li);

        if (t.type === 'ingreso') {
            inc += t.amount;
            total += t.amount;
        } else {
            exp += t.amount;
            total -= t.amount;
        }
    });

    totalEl.innerText = `$${total.toLocaleString()}`;
    incomeEl.innerText = `$${inc.toLocaleString()}`;
    expenseEl.innerText = `$${exp.toLocaleString()}`;
}

/**
 * Registro del Service Worker para PWA
 */
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('PWA Lista'))
            .catch(err => console.log('Error PWA', err));
    });
}

// Inicialización al cargar la página
window.onload = () => {
    updateUI();
    cargarDesdeDrive(); // Intenta traer datos frescos del Drive al abrir
};
