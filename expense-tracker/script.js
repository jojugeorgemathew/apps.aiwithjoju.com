// This structure guarantees the code runs only when the HTML is fully ready
document.addEventListener('DOMContentLoaded', () => {
    
    // 1. Grab all elements from the HTML
    const form = document.getElementById('expenseForm');
    const itemNameInput = document.getElementById('itemName');
    const itemPriceInput = document.getElementById('itemPrice');
    const itemNotesInput = document.getElementById('itemNotes');
    const expenseListContainer = document.getElementById('expenseList');
    const totalValueDisplay = document.getElementById('totalValue');
    const themeBtn = document.getElementById('themeToggle');

    // 2. Initialize Theme (Syncs with your main website's memory)
    let currentTheme = localStorage.getItem('aj_theme') || 'dark';
    if (currentTheme === 'light') {
        document.body.classList.add('light');
        themeBtn.textContent = '🌞';
    } else {
        document.body.classList.remove('light');
        themeBtn.textContent = '🌙';
    }

    themeBtn.addEventListener('click', () => {
        const isLight = document.body.classList.toggle('light');
        localStorage.setItem('aj_theme', isLight ? 'light' : 'dark');
        themeBtn.textContent = isLight ? '🌞' : '🌙';
    });

    // 3. Load Expenses Safely
    let expenses = [];
    try {
        const savedData = localStorage.getItem('aj_expenses');
        if (savedData) {
            expenses = JSON.parse(savedData);
        }
    } catch (error) {
        console.error("Error loading expenses:", error);
        expenses = [];
    }

    // Security function to prevent HTML injection in user notes
    function escapeHTML(str) {
        if (!str) return '';
        return str.replace(/[&<>'"]/g, 
            tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
        );
    }

    // 4. Function to Update the Screen
    function renderList() {
        expenseListContainer.innerHTML = ''; 
        let total = 0;

        if (expenses.length === 0) {
            expenseListContainer.innerHTML = '<div class="empty-state">No expenses added yet. Add one to get started!</div>';
            totalValueDisplay.textContent = '0.00';
            return;
        }

        expenses.forEach((expense, index) => {
            total += Number(expense.price);

            const div = document.createElement('div');
            div.className = 'expense-item';
            
            // Note: NO dollar signs used here to ensure currency neutrality
            div.innerHTML = `
                <div class="expense-info">
                    <h4>${escapeHTML(expense.name)}</h4>
                    ${expense.notes ? `<p>${escapeHTML(expense.notes)}</p>` : ''}
                </div>
                <div class="expense-right">
                    <span class="expense-price">${Number(expense.price).toFixed(2)}</span>
                    <button class="delete-btn" data-id="${index}" title="Delete Item">×</button>
                </div>
            `;
            expenseListContainer.appendChild(div);
        });

        // Update Total (No dollar sign)
        totalValueDisplay.textContent = total.toFixed(2);
    }

    // 5. Handle Form Submission (Clicking "+ Add Expense")
    form.addEventListener('submit', (e) => {
        e.preventDefault(); // Stops the page from refreshing
        
        const nameVal = itemNameInput.value.trim();
        const priceVal = parseFloat(itemPriceInput.value);
        const notesVal = itemNotesInput.value.trim();

        // Extra check to ensure data is valid
        if (nameVal !== '' && !isNaN(priceVal)) {
            // Save to memory array
            expenses.push({ 
                name: nameVal, 
                price: priceVal, 
                notes: notesVal 
            });
            
            // Save to browser storage
            localStorage.setItem('aj_expenses', JSON.stringify(expenses));
            
            // Reset form and update UI
            form.reset(); 
            itemNameInput.focus(); // Puts cursor back in the name box automatically
            renderList(); 
        }
    });

    // 6. Handle Deleting Items
    expenseListContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('delete-btn')) {
            const indexToDelete = e.target.getAttribute('data-id');
            expenses.splice(indexToDelete, 1); // Remove from array
            localStorage.setItem('aj_expenses', JSON.stringify(expenses)); // Save new array
            renderList(); // Update UI
        }
    });

    // 7. Initial Render when page loads
    renderList();
});
