// Wait for the HTML to fully load before running ANY JavaScript
document.addEventListener('DOMContentLoaded', () => {
    
    // 1. Get Elements
    const form = document.getElementById('expenseForm');
    const itemName = document.getElementById('itemName');
    const itemPrice = document.getElementById('itemPrice');
    const itemNotes = document.getElementById('itemNotes');
    const listContainer = document.getElementById('expenseList');
    const totalValue = document.getElementById('totalValue');
    const themeBtn = document.getElementById('themeToggle');

    // 2. Setup Theme (Checks saved preference)
    let currentTheme = localStorage.getItem('aj_theme') || 'dark';
    if (currentTheme === 'light') {
        document.body.classList.add('light');
        themeBtn.textContent = '🌞';
    } else {
        document.body.classList.remove('light');
        themeBtn.textContent = '🌙';
    }

    // Toggle Theme Button
    themeBtn.addEventListener('click', () => {
        const isLight = document.body.classList.toggle('light');
        localStorage.setItem('aj_theme', isLight ? 'light' : 'dark');
        themeBtn.textContent = isLight ? '🌞' : '🌙';
    });

    // 3. Load Expenses from Local Storage safely
    let expenses = [];
    try {
        const savedData = localStorage.getItem('aj_expenses');
        if (savedData) {
            expenses = JSON.parse(savedData);
        }
    } catch (error) {
        expenses = [];
    }

    // 4. Render Expenses to screen
    function renderList() {
        listContainer.innerHTML = ''; // Clear current list
        let total = 0;

        if (expenses.length === 0) {
            listContainer.innerHTML = '<p style="text-align:center; color:var(--text-muted);">No expenses yet.</p>';
            totalValue.textContent = '0.00';
            return;
        }

        expenses.forEach((expense, index) => {
            total += expense.price;

            // Create item div
            const div = document.createElement('div');
            div.className = 'expense-item';
            div.innerHTML = `
                <div class="expense-info">
                    <h4>${expense.name}</h4>
                    <p>${expense.notes}</p>
                </div>
                <div class="expense-right">
                    <span class="expense-price">$${expense.price.toFixed(2)}</span>
                    <button class="delete-btn" data-id="${index}">&times;</button>
                </div>
            `;
            listContainer.appendChild(div);
        });

        // Update total
        totalValue.textContent = total.toFixed(2);
    }

    // 5. Add New Expense
    form.addEventListener('submit', (e) => {
        e.preventDefault(); // Prevent page reload
        
        const nameVal = itemName.value.trim();
        const priceVal = parseFloat(itemPrice.value);
        const notesVal = itemNotes.value.trim();

        if (nameVal !== '' && !isNaN(priceVal)) {
            expenses.push({ name: nameVal, price: priceVal, notes: notesVal });
            localStorage.setItem('aj_expenses', JSON.stringify(expenses));
            form.reset(); // Clear form
            renderList(); // Update UI
        }
    });

    // 6. Delete Expense (Using Event Delegation so it always works)
    listContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('delete-btn')) {
            const indexToDelete = e.target.getAttribute('data-id');
            expenses.splice(indexToDelete, 1);
            localStorage.setItem('aj_expenses', JSON.stringify(expenses));
            renderList(); // Update UI
        }
    });

    // 7. Initial Load
    renderList();
});
