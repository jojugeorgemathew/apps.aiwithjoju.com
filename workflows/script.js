// Workflows — simplified script
// - Keeps workflow CRUD, UI bindings and theme
// - Removes legacy flowchart and complex canvas code
// - Adds a small CanvasManager (pen/eraser/undo/redo/clear/color/save)

const STORAGE_KEY = 'aj_workflows_v2';

// UI elements
const addBtn = document.getElementById('addWf');
const searchInput = document.getElementById('wf-search');
const grid = document.getElementById('workflowsGrid');
const emptyEl = document.getElementById('empty');
const yearEl = document.getElementById('year');
const themeToggle = document.getElementById('themeToggle');

// Name modal
const nameModal = document.getElementById('nameModal');
const workflowNameInput = document.getElementById('workflowNameInput');
const confirmNameBtn = document.getElementById('confirmNameBtn');
const cancelNameBtn = document.getElementById('cancelNameBtn');

// Canvas modal + controls (UI unchanged)
const canvasModal = document.getElementById('canvasModal');
const drawingCanvas = document.getElementById('drawingCanvas');
const canvasTitle = document.getElementById('canvasTitle');
const saveCanvasBtn = document.getElementById('saveCanvasBtn');
const undoBtn = document.getElementById('undoBtn');
const redoBtn = document.getElementById('redoBtn');
const clearBtn = document.getElementById('clearBtn');
const colorPicker = document.getElementById('colorPicker');
const zoomLevel = document.getElementById('zoomLevel');
const canvasWrapper = document.querySelector('.canvas-wrapper');

let currentWorkflowId = null;

// Workflows storage
function loadWorkflows(){
  try{ return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }catch(e){ return []; }
}
function saveWorkflows(list){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

// Render helpers
function listFiltered(){
  const q = (searchInput && searchInput.value || '').toLowerCase();
  return loadWorkflows().filter(w => !q || w.title.toLowerCase().includes(q) || (w.tag && w.tag.toLowerCase().includes(q)));
}

function render(list){
  grid.innerHTML = '';
  if(!list || list.length === 0){
    emptyEl.classList.remove('hidden');
    return;
  }
  emptyEl.classList.add('hidden');
  list.forEach(wf => grid.appendChild(makeCard(wf)));
}

function makeCard(wf){
  const el = document.createElement('div');
  el.className = 'app-card workflow-card';
  const updated = wf.updatedAt ? new Date(wf.updatedAt).toLocaleDateString() : 'Never';
  el.innerHTML = `
    <div class="meta-row">
      <div class="tag">${wf.tag || 'Workflow'}</div>
      <div style="display:flex;gap:8px;align-items:center">
        <button class="btn-edit small-muted" data-id="${wf.id}" title="Edit">✏️</button>
        <button class="btn-del small-muted" data-id="${wf.id}" title="Delete">🗑️</button>
      </div>
    </div>
    <h3 class="app-title">${wf.title}</h3>
    <p class="app-desc">${wf.desc || ''}</p>
    <p class="small-muted">Updated: ${updated}</p>
  `;

  const delBtn = el.querySelector('.btn-del');
  const editBtn = el.querySelector('.btn-edit');
  delBtn.addEventListener('click', (ev) => { ev.stopPropagation(); removeWorkflow(wf.id); });
  editBtn.addEventListener('click', (ev) => { ev.stopPropagation(); openCanvasForEdit(wf.id); });

  el.addEventListener('click', () => openCanvasForEdit(wf.id));
  return el;
}

function removeWorkflow(id){
  if(!confirm('Delete this workflow?')) return;
  const list = loadWorkflows();
  const i = list.findIndex(x => x.id === id);
  if(i !== -1){ list.splice(i,1); saveWorkflows(list); render(listFiltered()); }
}

function createWorkflow(){
  const title = workflowNameInput.value && workflowNameInput.value.trim();
  if(!title) return;
  const list = loadWorkflows();
  const wf = { id: 'wf_'+Date.now(), title, desc:'', tag:'Workflow', thumbnail:'', createdAt:new Date().toISOString(), updatedAt:null };
  wf.textObjects = [];
  wf.imageObjects = [];
  list.push(wf); saveWorkflows(list); hideNameModal(); openCanvasForEdit(wf.id);
}

function showModal(modal){ if(!modal) return; modal.classList.remove('hidden'); if(workflowNameInput && typeof workflowNameInput.focus === 'function'){ try{ workflowNameInput.focus(); }catch(e){} } }
function hideNameModal(){ if(nameModal) nameModal.classList.add('hidden'); if(workflowNameInput) workflowNameInput.value = ''; }

// Open canvas - load thumbnail if present
function openCanvasForEdit(id){
  currentWorkflowId = id;
  const wf = loadWorkflows().find(w => w.id === id);
  if(!wf) return;
  if(canvasTitle) canvasTitle.textContent = wf.title;
  if(canvasModal) canvasModal.classList.remove('hidden');

  // load thumbnail into canvas if available
  if(drawingCanvas && drawingCanvas.getContext){
    const ctx = drawingCanvas.getContext('2d');
    // clear using backing pixel dimensions for accurate placement
    try{ ctx.clearRect(0,0,drawingCanvas.width || 800, drawingCanvas.height || 600); }catch(e){}
    const src = wf.thumbnail || wf.imageDataUrl || '';
    // draw any saved objects (texts/images) after the thumbnail loads
    if(src){
      const img2 = new Image(); img2.onload = () => {
        try{ ctx.drawImage(img2,0,0,drawingCanvas.width,drawingCanvas.height); baseSnapshot = drawingCanvas.toDataURL();
          // load stored objects if present
          try{ textObjects = wf.textObjects || []; imageObjects = wf.imageObjects || []; drawTextObjects(); }catch(e){}
        }catch(e){}
      };
      img2.src = src;
    } else {
      // no src - seed base snapshot
      try{ baseSnapshot = drawingCanvas.toDataURL(); textObjects = wf.textObjects || []; imageObjects = wf.imageObjects || []; drawTextObjects(); }catch(e){}
    }
    // let CanvasManager seed history if present
    if(window.CanvasManager && typeof window.CanvasManager.push === 'function'){ try{ window.CanvasManager.push(); }catch(e){} }
  }
}

function closeCanvas(){ saveCanvasData(); if(canvasModal) canvasModal.classList.add('hidden'); render(listFiltered()); }
function saveCanvasData(){ if(!currentWorkflowId) return; const list = loadWorkflows(); const idx = list.findIndex(w => w.id === currentWorkflowId); if(idx === -1) return; try{ if(drawingCanvas && drawingCanvas.toDataURL){ // merge text and image objects onto a temp canvas for thumbnail
      const tmp = document.createElement('canvas'); tmp.width = drawingCanvas.width; tmp.height = drawingCanvas.height; const tctx = tmp.getContext('2d'); const base = new Image(); base.onload = () => { try{ tctx.drawImage(base,0,0,tmp.width,tmp.height); // draw image objects
              (imageObjects||[]).forEach(io => { try{ const im = new Image(); im.onload = () => { try{ tctx.drawImage(im, io.x, io.y, io.w * (io.scale||1), io.h * (io.scale||1)); }catch(e){} }; im.src = io.dataUrl; }catch(e){} });
            // draw text objects
            const dpr = window.devicePixelRatio || 1;
            (textObjects||[]).forEach(to => { try{ tctx.fillStyle = to.color || '#000'; const size = (to.size||24) * dpr; tctx.font = `${size}px ${to.font||'sans-serif'}`; tctx.textBaseline = 'top'; tctx.fillText(to.text, to.x, to.y + (to.offsetY||0)); }catch(e){} });
            list[idx].thumbnail = tmp.toDataURL('image/png'); list[idx].textObjects = JSON.parse(JSON.stringify(textObjects || [])); list[idx].imageObjects = JSON.parse(JSON.stringify(imageObjects || [])); list[idx].updatedAt = new Date().toISOString(); saveWorkflows(list);
          }catch(e){ console.warn('saveCanvasData draw failed', e); list[idx].thumbnail = drawingCanvas.toDataURL('image/png'); list[idx].textObjects = textObjects || []; list[idx].imageObjects = imageObjects || []; list[idx].updatedAt = new Date().toISOString(); saveWorkflows(list); }
        }; base.src = drawingCanvas.toDataURL(); } }catch(e){ console.warn('saveCanvasData failed', e); } }

// Theme
function setupTheme(){ const saved = localStorage.getItem('aj_theme') || 'dark'; if(saved === 'light') document.body.classList.add('light'); if(themeToggle) themeToggle.textContent = saved === 'light' ? '🌞' : '🌙'; }
if(themeToggle) themeToggle.addEventListener('click', () => { const isLight = document.body.classList.toggle('light'); localStorage.setItem('aj_theme', isLight ? 'light' : 'dark'); themeToggle.textContent = isLight ? '🌞' : '🌙'; });

// Bind actions
if(confirmNameBtn) confirmNameBtn.addEventListener('click', createWorkflow);
if(cancelNameBtn) cancelNameBtn.addEventListener('click', hideNameModal);
if(saveCanvasBtn) saveCanvasBtn.addEventListener('click', closeCanvas);
if(addBtn) addBtn.addEventListener('click', () => { showModal(nameModal); });
if(searchInput) searchInput.addEventListener('input', () => render(listFiltered()));

// Init (guarded)
try{
  if(yearEl) yearEl.textContent = new Date().getFullYear();
  setupTheme();
  if(grid) render(listFiltered());
}catch(err){
  console.error('[Workflows] init failed', err);
}

// Small diagnostics to help if add button still doesn't work
(function diag(){ try{ console.log('[Workflows] diag:', { addBtn: !!addBtn, nameModal: !!nameModal, canvas: !!drawingCanvas }); }catch(e){} })();

// ===== CANVAS MANAGER =====
(function(){
  const canvas = document.getElementById('drawingCanvas');
  const wrapper = document.getElementById('canvasWrapper') || document.querySelector('.canvas-wrapper');
  const btnUndo = document.getElementById('undoBtn');
  const btnRedo = document.getElementById('redoBtn');
  const btnClear = document.getElementById('clearBtn');
  const btnEraser = document.getElementById('toolEraser');
  const btnDraw = document.getElementById('drawBtn');
  const btnPlay = document.getElementById('playBtn');
  const btnFlip = document.getElementById('flipBtn');
  const btnFill = document.getElementById('toolFill');
  const btnEyedropper = document.getElementById('toolEyedropper');
  const btnText = document.getElementById('toolText');
  const btnPen = document.getElementById('toolPen');
  const btnLine = document.getElementById('toolLine');
  const btnZoomIn = document.getElementById('zoomIn');
  const btnZoomOut = document.getElementById('zoomOut');
  const btnSelect = document.getElementById('toolSelect');
  const colorInput = document.getElementById('colorPicker');
  const btnSave = document.getElementById('saveCanvasBtn');

  // UI/behavior state
  let zoom = 1;
  let lineStart = null;
  let lineSnapshot = null;
  // selection and text object state
  let textObjects = [];
  let baseSnapshot = null;
  let selectedText = null;
  let selectionRect = null;

  if(!canvas || !canvas.getContext) { console.warn('[CanvasManager] no canvas found; skipping'); return; }

  const ctx = canvas.getContext('2d');
  let drawing = false; let tool = 'pen'; let brush = 4; let color = colorInput ? colorInput.value : '#000';
  const history = []; let historyStep = -1; const maxHistory = 40;
  const historyObjects = [];
  let imageObjects = [];
  function pushObjects(){ try{ const snapObj = { texts: (textObjects || []), images: (imageObjects || []) }; const snap = JSON.stringify(snapObj); if(historyStep < historyObjects.length -1) historyObjects.splice(historyStep+1); historyObjects.push(snap); if(historyObjects.length>maxHistory) historyObjects.shift(); }catch(e){} }
  function fit(){
    const w = Math.max(600, (wrapper && wrapper.clientWidth) || 800);
    const h = Math.max(400, (wrapper && wrapper.clientHeight) || 480);
    // preserve current content by copying backing pixels to a temp canvas
    const tmp = document.createElement('canvas'); tmp.width = canvas.width || Math.round(w * (window.devicePixelRatio || 1)); tmp.height = canvas.height || Math.round(h * (window.devicePixelRatio || 1)); const t = tmp.getContext('2d');
    try{ t.drawImage(canvas, 0, 0); }catch(e){}
    const dpr = window.devicePixelRatio || 1;
    // set backing store size for crisp drawing (no ctx.setTransform - we'll draw in backing pixels)
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.imageSmoothingEnabled = false;
    // restore previous content scaled into new backing size
    try{ ctx.clearRect(0,0,canvas.width,canvas.height); ctx.drawImage(tmp, 0, 0, canvas.width, canvas.height); }catch(e){}
  }

  function updateActiveToolUI(){
    // remove active from known buttons
    const allBtns = [btnDraw, btnPen, btnEraser, btnFill, btnEyedropper, btnText, btnLine, btnSelect];
    allBtns.forEach(b => { if(b && b.classList) b.classList.remove('active'); });
    // add active to current tool's button(s)
    if(tool === 'pen'){ if(btnDraw) btnDraw.classList.add('active'); if(btnPen) btnPen.classList.add('active'); }
    if(tool === 'eraser'){ if(btnEraser) btnEraser.classList.add('active'); }
    if(tool === 'fill'){ if(btnFill) btnFill.classList.add('active'); }
    if(tool === 'eyedropper'){ if(btnEyedropper) btnEyedropper.classList.add('active'); }
    if(tool === 'text'){ if(btnText) btnText.classList.add('active'); }
    if(tool === 'line'){ if(btnLine) btnLine.classList.add('active'); }
    if(tool === 'select'){ if(btnSelect) btnSelect.classList.add('active'); }
  }

  function hexToRgb(hex) {
    if(!hex) return null;
    const h = hex.replace('#','');
    if(h.length !== 6) return null;
    return [parseInt(h.substring(0,2),16), parseInt(h.substring(2,4),16), parseInt(h.substring(4,6),16)];
  }

  function drawTextObjects(){
    try{
      const dpr = window.devicePixelRatio || 1;
      // draw image objects first
      (imageObjects || []).forEach(imgObj => {
        try{
          const im = new Image(); im.onload = () => { try{ ctx.drawImage(im, imgObj.x, imgObj.y, imgObj.w * (imgObj.scale || 1), imgObj.h * (imgObj.scale || 1)); }catch(e){} }; im.src = imgObj.dataUrl;
        }catch(e){}
      });
      textObjects.forEach(t => {
        ctx.save();
        ctx.fillStyle = t.color || '#000';
        const size = (t.size || 24) * dpr;
        ctx.font = `${size}px ${t.font || 'sans-serif'}`;
        ctx.textBaseline = 'top';
        ctx.fillText(t.text, t.x, t.y + (t.offsetY||0));
        ctx.restore();
      });
    }catch(e){ /* ignore */ }
  }

  function showTextEditPanel(t){
    hideTextEditPanel();
    if(!t) return;
    const panel = document.createElement('div'); panel.id = 'text-edit-panel'; panel.style.position = 'absolute'; panel.style.zIndex = 9999; panel.style.background = 'rgba(255,255,255,0.95)'; panel.style.padding = '8px'; panel.style.border = '1px solid #ccc'; panel.style.borderRadius = '6px'; panel.style.display = 'flex'; panel.style.gap = '6px';
    const color = document.createElement('input'); color.type = 'color'; color.value = t.color || '#000000';
    const size = document.createElement('input'); size.type = 'number'; size.value = t.size || 24; size.min = 6; size.max = 200; size.style.width = '64px';
    const font = document.createElement('select'); ['sans-serif','serif','monospace'].forEach(f => { const o = document.createElement('option'); o.value = f; o.textContent = f; if(t.font === f) o.selected = true; font.appendChild(o); });
    const done = document.createElement('button'); done.textContent = 'Apply';
    const del = document.createElement('button'); del.textContent = 'Delete'; del.style.background = '#e74c3c'; del.style.color = '#fff';
    panel.appendChild(color); panel.appendChild(size); panel.appendChild(font); panel.appendChild(done); panel.appendChild(del);
    // position panel near text (map backing pixel to css)
    try{
      const rect = canvas.getBoundingClientRect(); const cssX = (t.x / canvas.width) * rect.width + rect.left; const cssY = (t.y / canvas.height) * rect.height + rect.top;
      panel.style.left = (cssX + 10) + 'px'; panel.style.top = (cssY + 10) + 'px';
    }catch(e){ panel.style.right = '12px'; panel.style.bottom = '12px'; }
    document.body.appendChild(panel);
    color.addEventListener('input', (ev) => { t.color = ev.target.value; try{ const img = new Image(); img.onload = () => { try{ ctx.clearRect(0,0,canvas.width,canvas.height); ctx.drawImage(img,0,0,canvas.width,canvas.height); drawTextObjects(); }catch(e){} }; img.src = baseSnapshot || canvas.toDataURL(); }catch(e){} });
    size.addEventListener('input', (ev) => { t.size = parseInt(ev.target.value,10) || 24; try{ const img = new Image(); img.onload = () => { try{ ctx.clearRect(0,0,canvas.width,canvas.height); ctx.drawImage(img,0,0,canvas.width,canvas.height); drawTextObjects(); }catch(e){} }; img.src = baseSnapshot || canvas.toDataURL(); }catch(e){} });
    font.addEventListener('change', (ev) => { t.font = ev.target.value; try{ const img = new Image(); img.onload = () => { try{ ctx.clearRect(0,0,canvas.width,canvas.height); ctx.drawImage(img,0,0,canvas.width,canvas.height); drawTextObjects(); }catch(e){} }; img.src = baseSnapshot || canvas.toDataURL(); }catch(e){} });
    done.addEventListener('click', () => { try{ push(); pushObjects(); }catch(e){} hideTextEditPanel(); selectedText = null; });
    del.addEventListener('click', () => { try{ const i = textObjects.indexOf(t); if(i!==-1) textObjects.splice(i,1); hideTextEditPanel(); const img = new Image(); img.onload = () => { try{ ctx.clearRect(0,0,canvas.width,canvas.height); ctx.drawImage(img,0,0,canvas.width,canvas.height); drawTextObjects(); push(); pushObjects(); }catch(e){} }; img.src = baseSnapshot || canvas.toDataURL(); }catch(e){} });
  }

  function hideTextEditPanel(){ const ex = document.getElementById('text-edit-panel'); if(ex && ex.parentNode) ex.parentNode.removeChild(ex); }

  function floodFill(sx, sy, newColor){
    try{
      // sx,sy are expected in backing-pixel coordinates
      const w = canvas.width;
      const h = canvas.height;
      const img = ctx.getImageData(0,0,w,h);
      const data = img.data;
      const startX = Math.floor(sx);
      const startY = Math.floor(sy);
      const idx = (startY * w + startX) * 4;
      const sr = data[idx], sg = data[idx+1], sb = data[idx+2], sa = data[idx+3];
      const rgb = hexToRgb(newColor);
      if(!rgb) return;
      const [nr,ng,nb] = rgb;
      if(sr === nr && sg === ng && sb === nb) return;
      const stack = [[startX, startY]];
      const visited = new Uint8Array(w * h);
      while(stack.length){
        const [x,y] = stack.pop();
        if(x < 0 || x >= w || y < 0 || y >= h) continue;
        const i = (y * w + x);
        if(visited[i]) continue;
        visited[i] = 1;
        const off = i * 4;
        if(data[off] === sr && data[off+1] === sg && data[off+2] === sb && data[off+3] === sa){
          data[off] = nr; data[off+1] = ng; data[off+2] = nb; data[off+3] = 255;
          stack.push([x+1,y],[x-1,y],[x,y+1],[x,y-1]);
        }
      }
      ctx.putImageData(img, 0, 0);
    }catch(e){ console.warn('floodFill failed', e); }
  }
  function push(){ try{ const d = canvas.toDataURL('image/png'); if(historyStep < history.length -1) history.splice(historyStep+1); history.push(d); if(history.length>maxHistory) history.shift(); historyStep = history.length-1; pushObjects(); baseSnapshot = d; }catch(e){} }
  // (baseSnapshot is updated inside push())
  function restore(){ if(historyStep<0 || historyStep>=history.length) return; const img = new Image(); img.onload = () => { try{ const bw = canvas.width || 800; const bh = canvas.height || 600; ctx.clearRect(0,0,bw,bh); ctx.drawImage(img,0,0,bw,bh); try{ const raw = historyObjects[historyStep]; if(raw){ const parsed = JSON.parse(raw); textObjects = parsed.texts || []; imageObjects = parsed.images || []; } else { textObjects = []; imageObjects = []; } }catch(e){ textObjects = []; imageObjects = []; } drawTextObjects(); }catch(e){ console.warn('restore draw failed', e); } }; img.src = history[historyStep]; }
  function undo(){ if(historyStep>0){ historyStep--; restore(); } }
  function redo(){ if(historyStep < history.length -1){ historyStep++; restore(); } }
  function clearAll(){ if(confirm('Clear the entire canvas?')){ const bw = canvas.width || 800; const bh = canvas.height || 600; ctx.clearRect(0,0,bw,bh); push(); } }
  function setTool(t){ tool = t; canvas.style.cursor = t === 'eraser' ? 'cell' : 'crosshair'; }
  
  // enhance setTool to update UI
  const _setTool = setTool;
  setTool = function(t){ _setTool(t); updateActiveToolUI(); };

  function getXY(e){ const rect = canvas.getBoundingClientRect(); const xRaw = e.clientX - rect.left; const yRaw = e.clientY - rect.top; // map to backing pixel coords
    const bx = xRaw * (canvas.width / rect.width); const by = yRaw * (canvas.height / rect.height); return {x: bx, y: by}; }

  function pointerDown(e){
    const {x,y} = getXY(e);
    // select tool: check for text objects under pointer first
    if(tool === 'select'){
      // hit-test text objects (top-down)
      for(let i = textObjects.length - 1; i >= 0; i--){
        const t = textObjects[i];
        try{
          const dpr = window.devicePixelRatio || 1;
          const size = (t.size || 24) * dpr;
          ctx.font = `${size}px ${t.font || 'sans-serif'}`;
          const w = ctx.measureText(t.text).width;
          const h = size;
          if(x >= t.x && x <= t.x + w && y >= t.y && y <= t.y + h){
            selectedText = t;
            selectedText._dragOffset = { x: x - t.x, y: y - t.y };
            drawing = true;
            // show edit panel for selected text
            try{ showTextEditPanel(selectedText); }catch(_){}
            return;
          }
        }catch(_){ }
      }
      // start selection rectangle for raster selection
      selectionRect = { startX: x, startY: y, x: x, y: y, w: 0, h: 0 };
      drawing = true;
      return;
    }
    // special-case line tool: capture snapshot for rubber-band preview
    if(tool === 'line'){
      lineStart = {x,y};
      try{ lineSnapshot = ctx.getImageData(0,0,canvas.width,canvas.height); }catch(ex){ lineSnapshot = null; }
      drawing = true;
      // set stroke state for line preview
      ctx.globalCompositeOperation = 'source-over';
      ctx.lineWidth = brush;
      ctx.lineCap = 'round';
      ctx.strokeStyle = colorInput ? colorInput.value : color;
      return;
    }
    if(tool === 'fill'){
      floodFill(Math.floor(x), Math.floor(y), colorInput ? colorInput.value : color);
      push();
      return;
    }
    if(tool === 'eyedropper'){
        try{ const px = Math.floor(x); const py = Math.floor(y); const p = ctx.getImageData(px, py,1,1).data; const hex = '#' + [p[0],p[1],p[2]].map(v=>v.toString(16).padStart(2,'0')).join(''); if(colorInput) colorInput.value = hex; color = hex; }catch(e){}
      return;
    }
    if(tool === 'text'){
      const txt = prompt('Enter text:');
      if(txt){
        const t = { type: 'text', text: txt, x: x, y: y, size: 24, font: 'sans-serif', color: colorInput ? colorInput.value : color };
        textObjects.push(t);
        // redraw overlay and push both raster and objects state
        try{ drawTextObjects(); }catch(e){}
        try{ push(); pushObjects(); }catch(e){}
      }
      return;
    }

    drawing = true;
    ctx.beginPath();
    // x,y are backing pixel coords
    ctx.moveTo(x,y);
    if(tool === 'eraser'){
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = 'rgba(0,0,0,1)';
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = colorInput ? colorInput.value : color;
    }
    const dpr = window.devicePixelRatio || 1;
    ctx.lineWidth = Math.max(1, Math.round(brush * dpr));
    ctx.lineCap = 'round';
  }

  function pointerMove(e){ if(!drawing) return; const {x,y} = getXY(e);
    if(tool === 'line'){
      // restore snapshot then draw preview line
      try{ if(lineSnapshot) ctx.putImageData(lineSnapshot,0,0); }catch(_){ }
      ctx.beginPath(); ctx.moveTo(lineStart.x, lineStart.y); ctx.lineTo(x,y);
      ctx.strokeStyle = colorInput ? colorInput.value : color; ctx.lineWidth = Math.max(1, Math.round(brush * (window.devicePixelRatio || 1))); ctx.stroke();
      return;
    }
    if(tool === 'select'){
      // moving text object
      if(selectedText){ selectedText.x = x - (selectedText._dragOffset ? selectedText._dragOffset.x : 0); selectedText.y = y - (selectedText._dragOffset ? selectedText._dragOffset.y : 0);
        // redraw base then text overlays
        try{ const img = new Image(); img.onload = () => { try{ ctx.clearRect(0,0,canvas.width,canvas.height); ctx.drawImage(img,0,0,canvas.width,canvas.height); drawTextObjects(); }catch(e){} }; img.src = baseSnapshot || canvas.toDataURL(); }catch(e){}
      } else if(selectionRect){ selectionRect.x = Math.min(selectionRect.startX, x); selectionRect.y = Math.min(selectionRect.startY, y); selectionRect.w = Math.abs(x - selectionRect.startX); selectionRect.h = Math.abs(y - selectionRect.startY);
        try{ const img = new Image(); img.onload = () => { try{ ctx.clearRect(0,0,canvas.width,canvas.height); ctx.drawImage(img,0,0,canvas.width,canvas.height); // draw selection frame
              ctx.save(); ctx.strokeStyle = '#00f'; ctx.lineWidth = Math.max(1,2); ctx.setLineDash([6,4]); ctx.strokeRect(selectionRect.x, selectionRect.y, selectionRect.w, selectionRect.h); ctx.restore(); drawTextObjects(); }catch(e){} }; img.src = baseSnapshot || canvas.toDataURL(); }catch(e){}
      }
      return;
    }
    ctx.lineTo(x,y); ctx.stroke(); }

  function pointerUp(e){ if(!drawing) return; const {x,y} = getXY(e);
    if(tool === 'select'){
      // finalize raster selection -> create an image object
      if(selectionRect && selectionRect.w > 0 && selectionRect.h > 0){
        try{
          const sx = Math.floor(selectionRect.x), sy = Math.floor(selectionRect.y), sw = Math.floor(selectionRect.w), sh = Math.floor(selectionRect.h);
          const tmp = document.createElement('canvas'); tmp.width = sw; tmp.height = sh; const tctx = tmp.getContext('2d');
          tctx.drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh);
          const data = tmp.toDataURL('image/png');
          const obj = { type: 'image', dataUrl: data, x: sx, y: sy, w: sw, h: sh, scale: 1 };
          imageObjects.push(obj);
          // clear original area and draw object back (so it appears unchanged)
          ctx.clearRect(sx, sy, sw, sh);
          const img = new Image(); img.onload = () => { try{ ctx.drawImage(img, sx, sy, sw, sh); push(); pushObjects(); }catch(e){ console.warn('draw image object failed', e); } }; img.src = data;
        }catch(e){ console.warn('selection finalize failed', e); }
        selectionRect = null; drawing = false; selectedText = null; return;
      }
      // finish moving text
      if(selectedText){ selectedText._dragOffset = null; drawing = false; try{ push(); pushObjects(); }catch(e){} selectedText = null; return; }
      drawing = false; return;
    }
    if(tool === 'line'){
      // finalize line
      try{ if(lineSnapshot) ctx.putImageData(lineSnapshot,0,0); }catch(_){ }
      ctx.beginPath(); ctx.moveTo(lineStart.x, lineStart.y); ctx.lineTo(x,y);
      ctx.strokeStyle = colorInput ? colorInput.value : color; ctx.lineWidth = Math.max(1, Math.round(brush * (window.devicePixelRatio || 1))); ctx.stroke();
      lineStart = null; lineSnapshot = null; drawing = false; push(); return;
    }
    drawing = false; // restore composite
    ctx.globalCompositeOperation = 'source-over'; push(); }

  canvas.addEventListener('pointerdown', pointerDown);
  window.addEventListener('pointermove', pointerMove);
  window.addEventListener('pointerup', pointerUp);

  if(btnUndo) btnUndo.addEventListener('click', undo);
  if(btnRedo) btnRedo.addEventListener('click', redo);
  if(btnClear) btnClear.addEventListener('click', clearAll);
  if(btnPlay) btnPlay.addEventListener('click', () => { console.log('[Canvas] play clicked — not implemented'); });
  if(btnFlip) btnFlip.addEventListener('click', () => {
    try{
      const tmp = document.createElement('canvas'); tmp.width = canvas.width; tmp.height = canvas.height; const t = tmp.getContext('2d'); t.drawImage(canvas,0,0);
      ctx.clearRect(0,0,canvas.width,canvas.height);
      ctx.save(); ctx.translate(canvas.width,0); ctx.scale(-1,1); ctx.drawImage(tmp,0,0,canvas.width,canvas.height); ctx.restore();
      push();
    }catch(e){ console.warn('flip failed', e); }
  });
  if(btnEraser) btnEraser.addEventListener('click', () => setTool('eraser'));
  if(btnDraw) btnDraw.addEventListener('click', () => setTool('pen'));
  if(btnLine) btnLine.addEventListener('click', () => setTool('line'));
  if(btnSelect) btnSelect.addEventListener('click', () => setTool('select'));
  if(btnPen) btnPen.addEventListener('click', () => setTool('pen'));
  if(btnFill) btnFill.addEventListener('click', () => setTool('fill'));
  if(btnEyedropper) btnEyedropper.addEventListener('click', () => setTool('eyedropper'));
  if(btnText) btnText.addEventListener('click', () => setTool('text'));
  if(btnZoomIn) btnZoomIn.addEventListener('click', () => { setZoom(zoom + 0.1); });
  if(btnZoomOut) btnZoomOut.addEventListener('click', () => { setZoom(zoom - 0.1); });
  const btnMore = document.getElementById('moreBtn');
  if(btnMore) btnMore.addEventListener('click', () => {
    // toggle visibility of the hidden tool buttons (show additional tools)
    const ids = ['toolPen','toolLine','toolRect','toolCircle','clearBtn','gridToggleBtn','gridSize','flowModeBtn'];
    ids.forEach(id => { const el = document.getElementById(id); if(!el) return; el.style.display = (el.style.display === 'none' || !el.style.display) ? 'inline-block' : 'none'; });
  });
  if(colorInput) colorInput.addEventListener('input', (e) => { color = e.target.value; });
  if(btnSave) btnSave.addEventListener('click', () => { try{ if(typeof saveCanvasData === 'function') saveCanvasData(); }catch(e){} });

  window.addEventListener('resize', () => { try{ fit(); }catch(e){} });
  fit(); // reapply zoom and UI
  try{ updateActiveToolUI(); }catch(e){}
  try{ setZoom(1); }catch(e){}
  try{ push(); }catch(e){}

  window.CanvasManager = { undo, redo, clearAll, setTool, push, ctx };
  console.log('[CanvasManager] ready');

  // Zoom helpers
  function setZoom(z){ zoom = Math.max(0.2, Math.min(3, Math.round(z*10)/10)); canvas.style.transform = `scale(${zoom})`; canvas.style.transformOrigin = '0 0'; if(zoomLevel) zoomLevel.textContent = Math.round(zoom*100) + '%'; }
})();

// Global error handler to surface runtime errors for debugging
window.addEventListener('error', (e) => {
  try{
    console.error('[Workflows][GlobalError]', e.error || e.message || e);
    // minimal on-page indicator (non-invasive)
    let d = document.getElementById('wf-error-indicator');
    if(!d){ d = document.createElement('div'); d.id = 'wf-error-indicator'; d.style.position='fixed'; d.style.right='12px'; d.style.bottom='12px'; d.style.background='#ff6b6b'; d.style.color='#fff'; d.style.padding='8px 10px'; d.style.zIndex='9999'; d.style.borderRadius='6px'; d.style.fontSize='12px'; d.style.boxShadow='0 2px 6px rgba(0,0,0,0.2)'; document.body.appendChild(d); }
    d.textContent = 'Workflow JS error — open console for details';
    setTimeout(()=>{ if(d && d.parentNode) d.parentNode.removeChild(d); }, 8000);
  }catch(_){ /* ignore */ }
});

// Also catch unhandled promise rejections
window.addEventListener('unhandledrejection', (ev) => { console.error('[Workflows][UnhandledRejection]', ev.reason); });