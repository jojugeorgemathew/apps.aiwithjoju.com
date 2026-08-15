const form = document.getElementById('expenseForm');
const nameInput = document.getElementById('expenseName');
const priceInput = document.getElementById('expensePrice');
const notesInput = document.getElementById('expenseNotes');
const expenseList = document.getElementById('expenseList');
const totalAmountEl = document.getElementById('totalAmount');
const themeToggle = document.getElementById('themeToggle');
const yearEl = document.getElementById('year');

// 1. Fixed LocalStorage key and data loading
let expenses = [];
try {
    const saved = localStorage.getItem('aj_expenses');
    if (saved) {
        expenses = JSON.parse(saved);
    }
} catch (e) {
    console.error("Could not load expenses", e);
}

function saveAndRender() {
	localStorage.setItem('aj_expenses', JSON.stringify(expenses));
	renderExpenses();
}

function renderExpenses() {
	expenseList.innerHTML = '';
	if (expenses.length === 0) {
		expenseList.innerHTML = '<div class="empty-state">No expenses added yet. Click "+ Add Expense" to start!</div>';
		totalAmountEl.textContent = '$0.00';
		return;
	}

	let total = 0;
	expenses.forEach((item, index) => {
		total += Number(item.price);
		const div = document.createElement('div');
		div.className = 'expense-item';
		div.innerHTML = `
			<div class="expense-info">
				<h4>${escapeHTML(item.name)}</h4>
				${item.notes ? `<p>${escapeHTML(item.notes)}</p>` : ''}
			</div>
			<div class="expense-right">
				<span class="expense-price">$${Number(item.price).toFixed(2)}</span>
				<button class="delete-btn" onclick="deleteExpense(${index})" title="Delete">&times;</button>
			</div>
		`;
		expenseList.appendChild(div);
	});

	totalAmountEl.textContent = `$${total.toFixed(2)}`;
}

form.addEventListener('submit', (e) => {
	e.preventDefault();
	const name = nameInput.value.trim();
	const price = parseFloat(priceInput.value);
	const notes = notesInput.value.trim();

	if (!name || isNaN(price)) return;

	expenses.push({ name, price, notes });
	form.reset();
	saveAndRender();
});

window.deleteExpense = function(index) {
	expenses.splice(index, 1);
	saveAndRender();
};

function escapeHTML(str) {
	return str.replace(/[&<>'"]/g, 
		tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
	);
}

// 2. Fixed Theme Toggle logic to sync with main site
function setupTheme() {
	const saved = localStorage.getItem('aj_theme') || 'dark';
	if (saved === 'light') {
        document.body.classList.add('light');
        themeToggle.textContent = '🌞';
    } else {
        document.body.classList.remove('light');
        themeToggle.textContent = '🌙';
    }
}

themeToggle.addEventListener('click', () => {
	const isLight = document.body.classList.toggle('light');
	localStorage.setItem('aj_theme', isLight ? 'light' : 'dark');
	themeToggle.textContent = isLight ? '🌞' : '🌙';
});

if(yearEl) yearEl.textContent = new Date().getFullYear();

// Initialize app
setupTheme();
renderExpenses();
