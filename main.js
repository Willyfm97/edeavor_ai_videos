// ─────────────────────────────────────────────────────────────
// CONFIG
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
  goToPage(1);
}

// ─────────────────────────────────────────────────────────────
// TYPE PILLS
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
// VALIDATION
// ─────────────────────────────────────────────────────────────
function validateForm() {
  let valid = true;
  const checks = [
    { id: 'nombre',    err: 'err-nombre',    fn: v => v.trim().length >= 2,                          msg: 'Enter your full name.' },
    { id: 'email',     err: 'err-email',     fn: v => /^[^\s@]+@endeavor\.org$/i.test(v.trim()),     msg: 'Use your @endeavor.org email.' },
    { id: 'oficina',   err: 'err-oficina',   fn: v => !!v,                                           msg: 'Select your office.' },
    { id: 'audiencia', err: 'err-audiencia', fn: v => !!v,                                           msg: 'Select the target audience.' },
    { id: 'conceptos', err: 'err-conceptos', fn: v => v.trim().length >= 20,                         msg: 'Describe the key concepts (at least 20 characters).' },
    { id: 'documento_url', err: 'err-doc',   fn: v => v.trim().startsWith('http'),                   msg: 'Paste a valid document URL.' },
  ];
  checks.forEach(({ id, err, fn, msg }) => {
    const el = document.getElementById(id);
    if (!fn(el.value)) {
      showErr(err, el, msg);
      if (valid) el.focus();
      valid = false;
    } else {
      clearErr(err, el);
    }
  });
  return valid;
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

// ─────────────────────────────────────────────────────────────
// SUBMIT FORM → WEBHOOK 1 (synchronous — waits for script)
// ─────────────────────────────────────────────────────────────
async function submitForm() {
  setLoading('btn-submit', true, 'Generating script…');

  state.formData = {
    nombre:       document.getElementById('nombre').value.trim(),
    email:        document.getElementById('email').value.trim().toLowerCase(),
    oficina:      document.getElementById('oficina').value,
    equipo:       document.getElementById('equipo').value.trim(),
    tipo_video:   document.getElementById('tipo_video').value,
    audiencia:    document.getElementById('audiencia').value,
    duracion:     document.getElementById('duracion').value,
    conceptos:    document.getElementById('conceptos').value.trim(),
    documento_url:document.getElementById('documento_url').value.trim(),
    solicitud_id: 'SOL-' + Date.now(),
    timestamp:    new Date().toISOString(),
  };

  try {
    const res = await fetch(CONFIG.WEBHOOK_1, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: state.formData }),
    });

    if (!res.ok) throw new Error('Server error ' + res.status);

    const data = await res.json();
    if (!data.ok || !data.script) throw new Error('Invalid response from server');

    state.scriptData = data;
    renderScript(data);
    goToPage(2);

  } catch (err) {
    console.error(err);
    if (err.message.includes('fetch') || err.message.includes('NetworkError')) {
      toast('Could not reach the server. Check your connection.', 'error');
    } else {
      toast('An error occurred: ' + err.message, 'error');
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

  const summary = document.getElementById('exec-summary');
  summary.innerHTML = `
    <div class="exec-label">Claude's script summary</div>
    <div class="exec-text">${script.resumen} <strong>${script.duracion_total_seg} seconds total · ${script.escenas.length} scenes · Tone: ${script.tono}</strong></div>
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
// APPROVE → WEBHOOK 2 (fire and forget)
// ─────────────────────────────────────────────────────────────
async function approveScript() {
  setLoading('btn-approve', true, 'Starting production…');

  const payload = {
    body: {
      solicitud_id: state.formData.solicitud_id,
      nombre:       state.formData.nombre,
      email:        state.formData.email,
      feedback:     document.getElementById('feedback').value.trim(),
      script:       state.scriptData.script,
    }
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
function setLoading(btnId, loading, label) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  btn.disabled = loading;
  const lbl = btn.querySelector('.btn-label');
  const arr = btn.querySelector('.btn-arrow');
  const spin = btn.querySelector('.btn-spinner');
  if (lbl) lbl.textContent = label;
  if (arr) arr.hidden = loading;
  if (spin) spin.hidden = !loading;
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
