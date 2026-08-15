// Whiteboard — simplified script
const STORAGE_KEY = 'aj_whiteboards_v1';

// --- UI Elements ---
const addBtn = document.getElementById('addWf');
const searchInput = document.getElementById('wf-search');
const sortSelect = document.getElementById('sortSelect'); 
const grid = document.getElementById('workflowsGrid');
const emptyEl = document.getElementById('empty');
const yearEl = document.getElementById('year');
const themeToggle = document.getElementById('themeToggle');

// Name modal
const nameModal = document.getElementById('nameModal');
const workflowNameInput = document.getElementById('workflowNameInput');
const confirmNameBtn = document.getElementById('confirmNameBtn');
const cancelNameBtn = document.getElementById('cancelNameBtn');

// Canvas modal
const canvasModal = document.getElementById('canvasModal');
const drawingCanvas = document.getElementById('drawingCanvas');
const canvasTitle = document.getElementById('canvasTitle');
const saveCanvasBtn = document.getElementById('saveCanvasBtn');
const canvasWrapper = document.getElementById('canvasWrapper');

let currentWhiteboardId = null;

// --- Storage & Main Menu ---
function loadWhiteboards() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch(e) { return []; }
}

function saveWhiteboards(list) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

function listFiltered() {
    const q = ((searchInput && searchInput.value) || (sortSelect && sortSelect.value) || '').toLowerCase();
    return loadWhiteboards().filter(w => !q || w.title.toLowerCase().includes(q));
}

function render(list) {
    grid.innerHTML = '';
    if (!list || list.length === 0) {
        emptyEl.classList.remove('hidden');
        return;
    }
    emptyEl.classList.add('hidden');
    list.forEach(wf => grid.appendChild(makeCard(wf)));
}

function makeCard(wf) {
    const el = document.createElement('div');
    el.className = 'app-card workflow-card';
    const updated = wf.updatedAt ? new Date(wf.updatedAt).toLocaleDateString() : 'Just now';
    
    // Add visual thumbnail to the card
    const thumbHtml = wf.thumbnail 
        ? `<img src="${wf.thumbnail}" style="width:100%; height:120px; object-fit:contain; background:var(--card-bg); border-radius:8px; margin-bottom:10px; border:1px solid var(--border-color);">` 
        : `<div style="width:100%; height:120px; background:var(--card-bg); border-radius:8px; margin-bottom:10px; display:flex; align-items:center; justify-content:center; border:1px solid var(--border-color); color:var(--text-muted);">Blank Canvas</div>`;

    el.innerHTML = `
        ${thumbHtml}
        <div class="meta-row">
            <div class="tag">Whiteboard</div>
            <div style="display:flex;gap:8px;align-items:center">
                <button class="btn-edit small-muted" data-id="${wf.id}" title="Edit">✏️</button>
                <button class="btn-del small-muted" data-id="${wf.id}" title="Delete">🗑️</button>
            </div>
        </div>
        <h3 class="app-title">${wf.title}</h3>
        <p class="small-muted">Updated: ${updated}</p>
    `;

    el.querySelector('.btn-del').addEventListener('click', (ev) => { ev.stopPropagation(); removeWhiteboard(wf.id); });
    el.querySelector('.btn-edit').addEventListener('click', (ev) => { ev.stopPropagation(); openCanvasForEdit(wf.id); });
    el.addEventListener('click', () => openCanvasForEdit(wf.id));
    return el;
}

async function removeWhiteboard(id) {
    const confirmed = await showCustomConfirm('Delete this whiteboard? This cannot be undone.');
    if (!confirmed) return;
    
    const list = loadWhiteboards();
    const i = list.findIndex(x => x.id === id);
    if (i !== -1) { 
        list.splice(i, 1); 
        saveWhiteboards(list); 
        render(listFiltered()); 
    }
}

function createWhiteboard() {
    const title = workflowNameInput.value && workflowNameInput.value.trim();
    if (!title) return;
    const list = loadWhiteboards();
    const wf = { 
        id: 'wb_' + Date.now(), 
        title, 
        thumbnail: '', 
        createdAt: new Date().toISOString(), 
        updatedAt: null 
    };
    list.push(wf); 
    saveWhiteboards(list); 
    hideNameModal(); 
    openCanvasForEdit(wf.id);
}

function showModal(modal) { 
    if (!modal) return; 
    modal.classList.remove('hidden'); 
    if (workflowNameInput) { setTimeout(() => workflowNameInput.focus(), 50); } 
}

function hideNameModal() { 
    if (nameModal) nameModal.classList.add('hidden'); 
    if (workflowNameInput) workflowNameInput.value = ''; 
}

// Global Event Listeners
if (confirmNameBtn) confirmNameBtn.addEventListener('click', createWhiteboard);
if (cancelNameBtn) cancelNameBtn.addEventListener('click', hideNameModal);
if (addBtn) addBtn.addEventListener('click', () => showModal(nameModal));
if (searchInput) searchInput.addEventListener('input', () => render(listFiltered()));
if (sortSelect) sortSelect.addEventListener('input', () => render(listFiltered()));

// Theme
function setupTheme() { 
    const saved = localStorage.getItem('aj_theme') || 'dark'; 
    if (saved === 'light') document.body.classList.add('light'); 
    if (themeToggle) themeToggle.textContent = saved === 'light' ? '🌞' : '🌙'; 
}

if (themeToggle) {
    themeToggle.addEventListener('click', () => { 
        const isLight = document.body.classList.toggle('light'); 
        localStorage.setItem('aj_theme', isLight ? 'light' : 'dark'); 
        themeToggle.textContent = isLight ? '🌞' : '🌙'; 
    });
}

if (yearEl) yearEl.textContent = new Date().getFullYear();
setupTheme();
render(listFiltered());

// ==========================================
// CANVAS MANAGER (Drawing, Tools, History)
// ==========================================
let ctx = drawingCanvas.getContext('2d', { willReadFrequently: true });
let history = [];
let historyStep = -1;

// Drawing state
let isDrawing = false;
let startX = 0;
let startY = 0;
let snapshot; 

// Active settings
let currentTool = 'pen';
const colorPicker = document.getElementById('colorPicker');
const brushSize = document.getElementById('brushSize');

const tools = {
    pen: document.getElementById('toolPen'),
    eraser: document.getElementById('toolEraser'),
    line: document.getElementById('toolLine'),
    rect: document.getElementById('toolRect'),
    circle: document.getElementById('toolCircle'),
    fill: document.getElementById('toolFill'),
    text: document.getElementById('toolText')
};

// Tool Switching
Object.keys(tools).forEach(key => {
    if (tools[key]) {
        tools[key].addEventListener('click', () => {
            document.querySelector('.canvas-toolbar-bottom .active')?.classList.remove('active');
            tools[key].classList.add('active');
            currentTool = key;
        });
    }
});

// Canvas Actions
document.getElementById('undoBtn').addEventListener('click', undo);
document.getElementById('redoBtn').addEventListener('click', redo);
document.getElementById('clearBtn').addEventListener('click', clearCanvas);
saveCanvasBtn.addEventListener('click', closeAndSaveCanvas);

// Fixes boundary offsets by matching internal pixel map to CSS display dimensions
function resizeCanvas() {
    const rect = canvasWrapper.getBoundingClientRect();
    
    // Save current drawing to prevent clearing on resize
    let tempImg = null;
    if (drawingCanvas.width > 0 && drawingCanvas.height > 0) {
        tempImg = ctx.getImageData(0, 0, drawingCanvas.width, drawingCanvas.height);
    }

    drawingCanvas.width = rect.width;
    drawingCanvas.height = rect.height;

    if (tempImg) {
        ctx.putImageData(tempImg, 0, 0);
    }
}

window.addEventListener('resize', () => {
    if (!canvasModal.classList.contains('hidden')) resizeCanvas();
});

// Accurate Mouse Coordinate Translation
function getMousePos(evt) {
    const rect = drawingCanvas.getBoundingClientRect();
    return {
        x: evt.clientX - rect.left,
        y: evt.clientY - rect.top
    };
}

// History Management
function saveState() {
    if (historyStep < history.length - 1) {
        history = history.slice(0, historyStep + 1);
    }
    history.push(drawingCanvas.toDataURL());
    historyStep++;
}

function undo() {
    if (historyStep > 0) {
        historyStep--;
        restoreState();
    } else if (historyStep === 0) {
        historyStep--;
        ctx.clearRect(0, 0, drawingCanvas.width, drawingCanvas.height);
    }
}

function redo() {
    if (historyStep < history.length - 1) {
        historyStep++;
        restoreState();
    }
}

function restoreState() {
    let canvasPic = new Image();
    canvasPic.src = history[historyStep];
    canvasPic.onload = () => {
        ctx.clearRect(0, 0, drawingCanvas.width, drawingCanvas.height);
        ctx.drawImage(canvasPic, 0, 0);
    }
}

async function clearCanvas() {
    const confirmed = await showCustomConfirm('Are you sure you want to clear the entire whiteboard?');
    if (confirmed) {
        ctx.clearRect(0, 0, drawingCanvas.width, drawingCanvas.height);
        saveState();
    }
}

// Mouse Listeners
drawingCanvas.addEventListener('mousedown', startPosition);
drawingCanvas.addEventListener('mousemove', draw);
drawingCanvas.addEventListener('mouseup', endPosition);
drawingCanvas.addEventListener('mouseout', endPosition);

// Touch support for tablets/phones
drawingCanvas.addEventListener('touchstart', (e) => { e.preventDefault(); startPosition(e.touches[0]); }, { passive: false });
drawingCanvas.addEventListener('touchmove', (e) => { e.preventDefault(); draw(e.touches[0]); }, { passive: false });
drawingCanvas.addEventListener('touchend', endPosition);

function startPosition(e) {
    isDrawing = true;
    const pos = getMousePos(e);
    startX = pos.x;
    startY = pos.y;
    
    // Save snapshot so shapes render cleanly while dragging
    snapshot = ctx.getImageData(0, 0, drawingCanvas.width, drawingCanvas.height);

    ctx.beginPath();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = brushSize.value;
    ctx.strokeStyle = colorPicker.value;
    ctx.fillStyle = colorPicker.value;

    if (currentTool === 'pen' || currentTool === 'eraser') {
        ctx.moveTo(startX, startY);
        if (currentTool === 'eraser') {
            ctx.globalCompositeOperation = "destination-out";
            ctx.strokeStyle = "rgba(0,0,0,1)"; // Must be solid to erase properly
        } else {
            ctx.globalCompositeOperation = "source-over";
        }
        draw(e); 
    } 
    else if (currentTool === 'fill') {
        floodFill(Math.floor(startX), Math.floor(startY), ctx.fillStyle);
        saveState();
        isDrawing = false;
    } 
   else if (currentTool === 'text') {
        showCustomPrompt('Add text to whiteboard:').then(text => {
            if (text) {
                ctx.globalCompositeOperation = "source-over";
                ctx.font = `${parseInt(brushSize.value) + 16}px system-ui, sans-serif`;
                ctx.fillStyle = colorPicker.value;
                ctx.fillText(text, startX, startY);
                saveState();
            }
        });
        isDrawing = false;
    }
        });
        isDrawing = false;
    }
}

function draw(e) {
    if (!isDrawing) return;
    const pos = getMousePos(e);

    if (currentTool === 'pen' || currentTool === 'eraser') {
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
    } else {
        // For shapes and lines, continuously replace canvas with snapshot and draw on top
        ctx.putImageData(snapshot, 0, 0);
        ctx.globalCompositeOperation = "source-over";
        ctx.beginPath();
        
        if (currentTool === 'line') {
            ctx.moveTo(startX, startY);
            ctx.lineTo(pos.x, pos.y);
            ctx.stroke();
        } 
        else if (currentTool === 'rect') {
            ctx.strokeRect(startX, startY, pos.x - startX, pos.y - startY);
        } 
        else if (currentTool === 'circle') {
            let radius = Math.sqrt(Math.pow(pos.x - startX, 2) + Math.pow(pos.y - startY, 2));
            ctx.arc(startX, startY, radius, 0, 2 * Math.PI);
            ctx.stroke();
        }
    }
}

function endPosition() {
    if (!isDrawing) return;
    isDrawing = false;
    if (currentTool !== 'fill' && currentTool !== 'text') {
        saveState(); // Commit final shape/line to history
    }
    ctx.globalCompositeOperation = "source-over"; // Reset compositing
}

// Fast Bucket Fill Algorithm
function hexToRgba(hex) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return [r, g, b, 255];
}

function floodFill(x, y, fillColorHex) {
    const imageData = ctx.getImageData(0, 0, drawingCanvas.width, drawingCanvas.height);
    const data = imageData.data;
    const targetColor = hexToRgba(fillColorHex);
    
    const startPos = (y * drawingCanvas.width + x) * 4;
    const startR = data[startPos];
    const startG = data[startPos + 1];
    const startB = data[startPos + 2];
    const startA = data[startPos + 3];

    // Abort if color clicked is same as fill color
    if (startR === targetColor[0] && startG === targetColor[1] && 
        startB === targetColor[2] && startA === targetColor[3]) return;

    const pixelStack = [[x, y]];

    function matchStartColor(pos) {
        return data[pos] === startR && data[pos + 1] === startG && 
               data[pos + 2] === startB && data[pos + 3] === startA;
    }

    function colorPixel(pos) {
        data[pos] = targetColor[0];
        data[pos + 1] = targetColor[1];
        data[pos + 2] = targetColor[2];
        data[pos + 3] = targetColor[3];
    }

    while (pixelStack.length) {
        let newPos = pixelStack.pop();
        let currX = newPos[0];
        let currY = newPos[1];
        let pixelPos = (currY * drawingCanvas.width + currX) * 4;

        while (currY-- >= 0 && matchStartColor(pixelPos)) { pixelPos -= drawingCanvas.width * 4; }
        pixelPos += drawingCanvas.width * 4;
        ++currY;

        let reachLeft = false;
        let reachRight = false;

        while (currY++ < drawingCanvas.height - 1 && matchStartColor(pixelPos)) {
            colorPixel(pixelPos);

            if (currX > 0) {
                if (matchStartColor(pixelPos - 4)) {
                    if (!reachLeft) { pixelStack.push([currX - 1, currY]); reachLeft = true; }
                } else if (reachLeft) { reachLeft = false; }
            }

            if (currX < drawingCanvas.width - 1) {
                if (matchStartColor(pixelPos + 4)) {
                    if (!reachRight) { pixelStack.push([currX + 1, currY]); reachRight = true; }
                } else if (reachRight) { reachRight = false; }
            }
            pixelPos += drawingCanvas.width * 4;
        }
    }
    ctx.putImageData(imageData, 0, 0);
}

// Editor lifecycle logic
function openCanvasForEdit(id) {
    currentWhiteboardId = id;
    const wf = loadWhiteboards().find(w => w.id === id);
    if (!wf) return;
    
    if (canvasTitle) canvasTitle.textContent = wf.title;
    canvasModal.classList.remove('hidden');
    
    // Fit canvas correctly to modal screen
    resizeCanvas();

    // Reset history
    ctx.clearRect(0, 0, drawingCanvas.width, drawingCanvas.height);
    history = [];
    historyStep = -1;

    // Load saved drawing if it exists
    if (wf.thumbnail) {
        let img = new Image();
        img.onload = () => {
            ctx.drawImage(img, 0, 0);
            saveState(); // Anchor first state
        }
        img.src = wf.thumbnail;
    } else {
        saveState();
    }
}

function closeAndSaveCanvas() {
    if (!currentWhiteboardId) return;
    const list = loadWhiteboards();
    const idx = list.findIndex(w => w.id === currentWhiteboardId);
    
    if (idx !== -1) {
        // Save current canvas to data string
        list[idx].thumbnail = drawingCanvas.toDataURL('image/png');
        list[idx].updatedAt = new Date().toISOString();
        saveWhiteboards(list);
    }
    
    canvasModal.classList.add('hidden');
    render(listFiltered()); // Refresh grid
}


// --- Custom Modal Prompts ---
function showCustomPrompt(titleText) {
    return new Promise((resolve) => {
        const modal = document.getElementById('textModal');
        const input = document.getElementById('customTextInput');
        const titleEl = document.getElementById('textModalTitle');
        const confirmBtn = document.getElementById('confirmTextBtn');
        const cancelBtn = document.getElementById('cancelTextBtn');

        titleEl.textContent = titleText;
        input.value = '';
        modal.classList.remove('hidden');
        setTimeout(() => input.focus(), 50);

        function cleanup() {
            modal.classList.add('hidden');
            confirmBtn.removeEventListener('click', onConfirm);
            cancelBtn.removeEventListener('click', onCancel);
            input.removeEventListener('keydown', onKey);
        }

        function onConfirm() {
            const val = input.value.trim();
            cleanup();
            resolve(val || null);
        }

        function onCancel() {
            cleanup();
            resolve(null);
        }

        function onKey(e) {
            if (e.key === 'Enter') onConfirm();
            if (e.key === 'Escape') onCancel();
        }

        confirmBtn.addEventListener('click', onConfirm);
        cancelBtn.addEventListener('click', onCancel);
        input.addEventListener('keydown', onKey);
    });
}

function showCustomConfirm(message) {
    return new Promise((resolve) => {
        const modal = document.getElementById('confirmModal');
        const msgEl = document.getElementById('confirmMessage');
        const confirmBtn = document.getElementById('confirmConfirmBtn');
        const cancelBtn = document.getElementById('cancelConfirmBtn');

        msgEl.textContent = message;
        modal.classList.remove('hidden');

        function cleanup() {
            modal.classList.add('hidden');
            confirmBtn.removeEventListener('click', onConfirm);
            cancelBtn.removeEventListener('click', onCancel);
        }

        function onConfirm() {
            cleanup();
            resolve(true);
        }

        function onCancel() {
            cleanup();
            resolve(false);
        }

        confirmBtn.addEventListener('click', onConfirm);
        cancelBtn.addEventListener('click', onCancel);
    });
}
