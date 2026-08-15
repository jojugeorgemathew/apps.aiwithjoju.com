// Basic app data and UI interaction for Apps By Joju
const apps = [

	{id:'1',title:'Workflow Management',desc:'Create Workflows & flowcharts',tag:'Utility',url:'https://apps.aiwithjoju.com/workflows/'},
	{id:'2',title:'Expense Tracker',desc:'Track your daily expenses',tag:'Productivity',url:'https://apps.aiwithjoju.com/expense-tracker/'},

];

const grid = document.getElementById('appsGrid');
const searchInput = document.getElementById('search');
const themeToggle = document.getElementById('themeToggle');
const yearEl = document.getElementById('year');

function renderApps(list){
	grid.innerHTML = '';
	if(!list.length){
		grid.innerHTML = '<p style="color:var(--muted)">No apps match your search.</p>';
		return;
	}
	list.forEach(app => {
		const card = document.createElement('article');
		card.className = 'app-card';
		card.tabIndex = 0;
		card.innerHTML = `
			<div style="display:flex;justify-content:space-between;align-items:center">
				<h3 class="app-title">${app.title}</h3>
				<div class="tag">${app.tag}</div>
			</div>
			<p class="app-desc">${app.desc}</p>
			<div class="app-meta">
				<span>Open</span>
			</div>
		`;
		card.addEventListener('click', ()=> openApp(app));
		card.addEventListener('keypress', (e)=>{ if(e.key==='Enter') openApp(app)});
		grid.appendChild(card);
	})
}

function openApp(app){
	// For now, open placeholder or navigate if url provided
	if(app.url && app.url !== '#') window.location.href = app.url;
	else alert(`${app.title} — placeholder link`);
}

function handleSearch(){
	const q = searchInput.value.trim().toLowerCase();
	const filtered = apps.filter(a=> a.title.toLowerCase().includes(q) || a.desc.toLowerCase().includes(q) || a.tag.toLowerCase().includes(q));
	renderApps(filtered);
}

function setupTheme(){
	const saved = localStorage.getItem('aj_theme') || 'dark';
	if(saved === 'light') document.body.classList.add('light');
	themeToggle.textContent = saved === 'light' ? '🌞' : '🌙';
}

themeToggle.addEventListener('click', ()=>{
	const isLight = document.body.classList.toggle('light');
	localStorage.setItem('aj_theme', isLight ? 'light' : 'dark');
	themeToggle.textContent = isLight ? '🌞' : '🌙';
});

searchInput.addEventListener('input', handleSearch);

// initialize
yearEl.textContent = new Date().getFullYear();
setupTheme();
renderApps(apps);

