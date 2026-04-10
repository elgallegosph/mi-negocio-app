let transactions = JSON.parse(localStorage.getItem('transactions')) || [];

function addTransaction(type, amount, note) {
    const transaction = {
        id: Date.now(),
        type,
        amount: parseFloat(amount),
        note,
        date: new Date().toLocaleDateString()
    };
    
    transactions.push(transaction);
    localStorage.setItem('transactions', JSON.stringify(transactions));
    updateUI();
}
