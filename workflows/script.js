// Workflows page script — moved from inline <script>
const STORAGE_KEY = 'aj_workflows_v1';
const grid = document.getElementById('workflowsGrid');
const emptyEl = document.getElementById('empty');
const addBtn = document.getElementById('addWf');
const searchInput = document.getElementById('wf-search');
const sortInput = document.getElementById('sortSelect');
const yearEl = document.getElementById('year');

function loadWorkflows(){
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch(e){ return [] }
}

function saveWorkflows(list){ localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); }

function makeCard(wf){
  const el = document.createElement('div');
  el.className = 'app-card workflow-card';
  el.innerHTML = `
    <div class="meta-row">
      <div class="tag">${wf.tag || 'Workflow'}</div>
      <div style="display:flex;gap:8px;align-items:center">
        <button class="btn-edit small-muted" data-id="${wf.id}" title="Edit">✎</button>
        <button class="btn-del small-muted" data-id="${wf.id}" title="Delete">🗑️</button>
      </div>
    </div>
    <h3 class="app-title">${wf.title}</h3>
    <p class="app-desc">${wf.desc || ''}</p>
  `;
  el.querySelector('.btn-del').addEventListener('click', ()=>{ removeWorkflow(wf.id) });
  el.querySelector('.btn-edit').addEventListener('click', ()=>{ editWorkflow(wf.id) });
  return el;
}

function render(list){
  grid.innerHTML = '';
  if(!list.length){ emptyEl.classList.remove('hidden'); return }
  emptyEl.classList.add('hidden');
  list.forEach(w=> grid.appendChild(makeCard(w)));
}

function addWorkflow(){
  const title = prompt('Workflow title')?.trim();
  if(!title) return;
  const desc = prompt('Short description (optional)') || '';
  const tag = prompt('Tag / category (e.g., Writing, Data)') || 'Workflow';
  const list = loadWorkflows();
  const wf = { id: Date.now().toString(36), title, desc, tag };
  list.unshift(wf);
  saveWorkflows(list);
  render(listFiltered());
}

function editWorkflow(id){
  const list = loadWorkflows();
  const found = list.find(x=>x.id===id); if(!found) return;
  const title = prompt('Edit title', found.title)?.trim(); if(!title) return;
  const desc = prompt('Edit description', found.desc) || '';
  const tag = prompt('Edit tag', found.tag) || 'Workflow';
  found.title = title; found.desc = desc; found.tag = tag;
  saveWorkflows(list); render(listFiltered());
}

function removeWorkflow(id){
  if(!confirm('Delete this workflow?')) return;
  let list = loadWorkflows(); list = list.filter(x=>x.id!==id); saveWorkflows(list); render(listFiltered());
}

function listFiltered(){
  const q = (searchInput.value || '').toLowerCase();
  const list = loadWorkflows();
  return list.filter(w => !q || w.title.toLowerCase().includes(q) || (w.desc||'').toLowerCase().includes(q) || (w.tag||'').toLowerCase().includes(q));
}

addBtn.addEventListener('click', addWorkflow);
searchInput.addEventListener('input', ()=> render(listFiltered()));
sortInput.addEventListener('input', ()=> render(listFiltered()));

// Theme toggle persistence (localStorage)
const themeToggle = document.getElementById('themeToggle');
function setupTheme(){
  const saved = localStorage.getItem('aj_theme') || 'dark';
  if(saved==='light') document.body.classList.add('light');
  themeToggle.textContent = saved==='light' ? '🌞' : '🌙';
}
themeToggle.addEventListener('click', ()=>{
  const isLight = document.body.classList.toggle('light');
  localStorage.setItem('aj_theme', isLight ? 'light' : 'dark');
  themeToggle.textContent = isLight ? '🌞' : '🌙';
});

// init
yearEl.textContent = new Date().getFullYear();
setupTheme();
render(listFiltered());
