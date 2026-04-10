let transactions = JSON.parse(localStorage.getItem('transactions')) || [];
let currentType = 'ingreso';

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

function saveTransaction() {
    const desc = document.getElementById('desc').value;
    const amount = document.getElementById('amount').value;

    if (desc === '' || amount === '') return alert('Llena todos los campos');

    const transaction = {
        id: Date.now(),
        desc,
        amount: parseFloat(amount),
        type: currentType
    };

    transactions.push(transaction);
    localStorage.setItem('transactions', JSON.stringify(transactions));
    
    updateUI();
    closeModal();
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
        const sign = t.type === 'ingreso' ? '+' : '-';
        li.innerHTML = `
            <span>${t.desc}</span>
            <span class="${t.type}">${sign} $${t.amount.toFixed(2)}</span>
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

    totalEl.innerText = `$${total.toFixed(2)}`;
    incomeEl.innerText = `$${inc.toFixed(2)}`;
    expenseEl.innerText = `$${exp.toFixed(2)}`;
}

// Cargar datos al iniciar
updateUI();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js')
    .then(reg => console.log('Service Worker registrado', reg))
    .catch(err => console.warn('Error al registrar Service Worker', err));
}
