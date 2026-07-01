// ─────────────────────────────────────────────────────────────
// CONFIG — only webhook URLs here, Cloudinary is in n8n
// ─────────────────────────────────────────────────────────────
const CONFIG = {
  WEBHOOK_1: 'https://urbanassembly.app.n8n.cloud/webhook/video-request',
  WEBHOOK_2: 'https://urbanassembly.app.n8n.cloud/webhook/video-approve',
};

// ─────────────────────────────────────────────────────────────
// STATE
// ─────────────────────────────────────────────────────────────
let state = {
  currentPage: 1,
  scriptData: null,
  formData: null,
};

// ─────────────────────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initTipoPills();
  initFileUpload();
  document.getElementById('video-form').addEventListener('submit', e => {
    e.preventDefault();
    if (validateForm()) submitForm();
  });
});

// ─────────────────────────────────────────────────────────────
// NAVIGATION
// ─────────────────────────────────────────────────────────────
function goToPage(n) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-' + n).classList.add('active');
  document.querySelectorAll('.step').forEach(s => {
    s.classList.toggle('active', parseInt(s.dataset.step) === n);
  });
  state.currentPage = n;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
function goBack() { goToPage(1); }
function startOver() {
  state = { currentPage: 1, scriptData: null, formData: null };
  document.getElementById('video-form').reset();
  document.querySelectorAll('.tipo-pill').forEach((p, i) => {
    p.classList.toggle('active', i === 0);
    p.setAttribute('aria-pressed', i === 0 ? 'true' : 'false');
  });
  document.getElementById('tipo_video').value = 'avatar';
  clearFile();
  goToPage(1);
}

// ─────────────────────────────────────────────────────────────
// TIPO VIDEO PILLS
// ─────────────────────────────────────────────────────────────
function initTipoPills() {
  document.querySelectorAll('.tipo-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('.tipo-pill').forEach(p => {
        p.classList.remove('active');
        p.setAttribute('aria-pressed', 'false');
      });
      pill.classList.add('active');
      pill.setAttribute('aria-pressed', 'true');
      document.getElementById('tipo_video').value = pill.dataset.value;
    });
  });
}

// ─────────────────────────────────────────────────────────────
// FILE UPLOAD — sends file as multipart to n8n
// ─────────────────────────────────────────────────────────────
function initFileUpload() {
  const zone    = document.getElementById('upload-zone');
  const input   = document.getElementById('archivo');
  const preview = document.getElementById('upload-preview');
  const content = document.getElementById('upload-content');
  const nameSpan = document.getElementById('upload-filename');
  const removeBtn = document.getElementById('upload-remove');

  if (!zone) return;

  input.addEventListener('change', () => {
    if (input.files[0]) handleFileSelect(input.files[0]);
  });

  zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag-over'); });
  zone.addEventListener('dragleave', e => { if (!zone.contains(e.relatedTarget)) zone.classList.remove('drag-over'); });
  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    if (e.dataTransfer.files[0]) handleFileSelect(e.dataTransfer.files[0]);
  });
  zone.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } });
  removeBtn.addEventListener('click', e => { e.stopPropagation(); clearFile(); });
}

function handleFileSelect(file) {
  const allowed = ['.pdf', '.doc', '.docx', '.txt'];
  const ext = '.' + file.name.split('.').pop().toLowerCase();
  if (!allowed.includes(ext)) { toast('Unsupported format. Use PDF, Word or TXT.', 'error'); return; }
  if (file.size > 100 * 1024 * 1024) { toast('File exceeds 100 MB.', 'error'); return; }
  document.getElementById('upload-zone')._file = file;
  document.getElementById('upload-zone').classList.add('has-file');
  document.getElementById('upload-content').hidden = true;
  document.getElementById('upload-preview').hidden = false;
  document.getElementById('upload-filename').textContent = file.name;
  document.getElementById('upload-filesize').textContent = formatBytes(file.size);
  clearErr('err-doc');
}

function clearFile() {
  const zone = document.getElementById('upload-zone');
  zone._file = null;
  document.getElementById('archivo').value = '';
  zone.classList.remove('has-file');
  document.getElementById('upload-content').hidden = false;
  document.getElementById('upload-preview').hidden = true;
  document.getElementById('upload-filename').textContent = '';
  document.getElementById('upload-filesize').textContent = '';
}

// ─────────────────────────────────────────────────────────────
// VALIDATION
// ─────────────────────────────────────────────────────────────
function validateForm() {
  let valid = true;
  const checks = [
    { id:'nombre',    err:'err-nombre',    fn: v => v.trim().length >= 2,                        msg:'Enter your full name.' },
    { id:'email',     err:'err-email',     fn: v => /^[^\s@]+@endeavor\.org$/i.test(v.trim()),   msg:'Use your @endeavor.org email.' },
    { id:'oficina',   err:'err-oficina',   fn: v => !!v,                                         msg:'Select your office.' },
    { id:'audiencia', err:'err-audiencia', fn: v => !!v,                                         msg:'Select the target audience.' },
    { id:'conceptos', err:'err-conceptos', fn: v => v.trim().length >= 20,                       msg:'Describe the key concepts (at least 20 characters).' },
  ];
  checks.forEach(({ id, err, fn, msg }) => {
    const el = document.getElementById(id);
    if (!fn(el.value)) { showErr(err, el, msg); if (valid) el.focus(); valid = false; }
    else clearErr(err, el);
  });
  const zone = document.getElementById('upload-zone');
  if (!zone._file) {
    showErr('err-doc', null, 'Please upload a document (PDF, Word, or TXT).');
    valid = false;
  } else {
    clearErr('err-doc');
  }
  return valid;
}

// ─────────────────────────────────────────────────────────────
// SUBMIT — sends multipart/form-data (file + fields) to n8n
// n8n handles Cloudinary upload and OpenAI Files API internally
// ─────────────────────────────────────────────────────────────
async function submitForm() {
  setLoading('btn-submit', true, 'Uploading & generating script…');

  const zone = document.getElementById('upload-zone');
  const file = zone._file;

  // Build multipart payload — n8n receives file + all form fields
  const fd = new FormData();
  fd.append('archivo', file, file.name);
  fd.append('nombre',     document.getElementById('nombre').value.trim());
  fd.append('email',      document.getElementById('email').value.trim().toLowerCase());
  fd.append('oficina',    document.getElementById('oficina').value);
  fd.append('equipo',     document.getElementById('equipo').value.trim());
  fd.append('tipo_video', document.getElementById('tipo_video').value);
  fd.append('audiencia',  document.getElementById('audiencia').value);
  fd.append('duracion',   document.getElementById('duracion').value);
  fd.append('conceptos',  document.getElementById('conceptos').value.trim());
  fd.append('solicitud_id', 'SOL-' + Date.now());
  fd.append('timestamp',  new Date().toISOString());

  state.formData = {
    nombre:   document.getElementById('nombre').value.trim(),
    email:    document.getElementById('email').value.trim().toLowerCase(),
    oficina:  document.getElementById('oficina').value,
    solicitud_id: fd.get('solicitud_id'),
  };

  try {
    // POST multipart to n8n — n8n uploads to Cloudinary then calls OpenAI
    const res = await fetch(CONFIG.WEBHOOK_1, {
      method: 'POST',
      body: fd,
      // No Content-Type header — browser sets it with correct boundary for FormData
    });

    if (!res.ok) throw new Error('Server error ' + res.status);
    const data = await res.json();
    if (!data.ok || !data.script) throw new Error(data.error || 'Invalid response from server');

    state.scriptData = data;
    renderScript(data);
    goToPage(2);

  } catch (err) {
    console.error(err);
    if (err.message.includes('fetch') || err.message.includes('NetworkError')) {
      toast('Could not reach the server. Check your connection.', 'error');
    } else {
      toast('Error: ' + err.message, 'error');
    }
  } finally {
    setLoading('btn-submit', false, 'Generate script');
  }
}

// ─────────────────────────────────────────────────────────────
// RENDER SCRIPT ON PAGE 2
// ─────────────────────────────────────────────────────────────
function renderScript(data) {
  const { script } = data;
  document.getElementById('script-title').textContent = script.titulo;
  document.getElementById('script-summary').textContent = script.resumen;

  document.getElementById('exec-summary').innerHTML = `
    <div class="exec-label">Script generated by GPT-4o</div>
    <div class="exec-text">${script.resumen} <strong>${script.duracion_total_seg}s total · ${script.escenas.length} scenes · Tone: ${script.tono}</strong></div>
  `;

  const list = document.getElementById('scenes-list');
  list.innerHTML = '';
  script.escenas.forEach(scene => {
    const badgeClass = 'badge-' + (scene.tipo || 'avatar');
    list.innerHTML += `
      <div class="scene-card">
        <div class="scene-hdr">
          <span class="scene-num">SCENE ${scene.numero}</span>
          <span class="scene-badge ${badgeClass}">${scene.tipo} · ${scene.duracion_seg}s</span>
          <span class="scene-dur">${scene.titulo}</span>
        </div>
        <div class="scene-body">
          <div class="scene-narr">"${scene.narracion}"</div>
          <div class="scene-vis">Visual: ${scene.descripcion_visual}</div>
        </div>
      </div>
    `;
  });
}

// ─────────────────────────────────────────────────────────────
// APPROVE — fire and forget to Webhook 2
// ─────────────────────────────────────────────────────────────

// Trim combined narration to ~30 seconds (~85 words at 2.8 words/sec).
// Trims at the nearest sentence boundary so it doesn't cut mid-sentence.
function trimNarrationTo30s(escenas) {
  const MAX_WORDS = 85;
  let wordCount = 0;
  return escenas.map(scene => {
    if (wordCount >= MAX_WORDS) return { ...scene, narracion: '' };
    const sentences = scene.narracion.match(/[^.!?]+[.!?]*/g) || [scene.narracion];
    const kept = [];
    for (const sentence of sentences) {
      const w = sentence.trim().split(/\s+/).length;
      if (wordCount + w > MAX_WORDS) break;
      kept.push(sentence);
      wordCount += w;
    }
    return { ...scene, narracion: kept.join(' ').trim() };
  }).filter(s => s.narracion.length > 0);
}

async function approveScript() {
  setLoading('btn-approve', true, 'Starting production…');

  const trimmedScript = {
    ...state.scriptData.script,
    escenas: trimNarrationTo30s(state.scriptData.script.escenas),
  };

  const payload = {
    solicitud_id: state.formData.solicitud_id,
    nombre:       state.formData.nombre,
    email:        state.formData.email,
    feedback:     document.getElementById('feedback').value.trim(),
    script:       trimmedScript,
  };

  try {
    const res = await fetch(CONFIG.WEBHOOK_2, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('Server error ' + res.status);

    document.getElementById('done-email').textContent = state.formData.email;
    document.getElementById('done-id').textContent = 'Request ID: ' + state.formData.solicitud_id;
    goToPage(3);

  } catch (err) {
    console.error(err);
    toast('Could not start production. Please try again.', 'error');
  } finally {
    setLoading('btn-approve', false, 'Approve & produce');
  }
}

// ─────────────────────────────────────────────────────────────
// UI HELPERS
// ─────────────────────────────────────────────────────────────
function formatBytes(b) {
  if (b < 1024) return b + ' B';
  if (b < 1024 * 1024) return (b / 1024).toFixed(1) + ' KB';
  return (b / (1024 * 1024)).toFixed(1) + ' MB';
}
function setLoading(btnId, loading, label) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  btn.disabled = loading;
  const lbl  = btn.querySelector('.btn-label');
  const arr  = btn.querySelector('.btn-arrow');
  const spin = btn.querySelector('.btn-spinner');
  if (lbl)  lbl.textContent = label;
  if (arr)  arr.hidden = loading;
  if (spin) spin.hidden = !loading;
}

function showErr(errId, el, msg) {
  const e = document.getElementById(errId);
  if (e) e.textContent = msg;
  if (el) el.classList.add('invalid');
}
function clearErr(errId, el) {
  const e = document.getElementById(errId);
  if (e) e.textContent = '';
  if (el) el.classList.remove('invalid');
}

function toast(msg, type) {
  const wrap = document.getElementById('toasts');
  const el = document.createElement('div');
  el.className = 'toast' + (type ? ' ' + type : '');
  el.textContent = msg;
  el.setAttribute('role', 'alert');
  wrap.appendChild(el);
  setTimeout(() => {
    el.style.animation = 'tOut .2s ease forwards';
    setTimeout(() => el.remove(), 200);
  }, 4500);
}

window.goBack = goBack;
window.approveScript = approveScript;
window.startOver = startOver;
