// ─────────────────────────────────────────────────────────────────────────────
// CONFIG — reemplazá N8N_WEBHOOK_URL con la URL real de tu webhook en n8n
// ─────────────────────────────────────────────────────────────────────────────
const CONFIG = {
  N8N_WEBHOOK_URL: 'https://urbanassembly.app.n8n.cloud/webhook/video-request',
  MAX_FILE_MB: 20,
  ALLOWED_TYPES: ['application/pdf', 'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain'],
  ALLOWED_EXTS: ['.pdf', '.doc', '.docx', '.txt'],
};

// ─────────────────────────────────────────────────────────────────────────────
// STATE
// ─────────────────────────────────────────────────────────────────────────────
let selectedFile = null;
let isSubmitting = false;

// ─────────────────────────────────────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initTipoPills();
  initUploadZone();
  initFormSubmit();
  initRealtimeValidation();
});

// ─────────────────────────────────────────────────────────────────────────────
// TIPO VIDEO PILLS
// ─────────────────────────────────────────────────────────────────────────────
function initTipoPills() {
  const pills = document.querySelectorAll('.tipo-pill');
  const hidden = document.getElementById('tipo_video');

  pills.forEach(pill => {
    pill.addEventListener('click', () => {
      pills.forEach(p => {
        p.classList.remove('active');
        p.setAttribute('aria-pressed', 'false');
      });
      pill.classList.add('active');
      pill.setAttribute('aria-pressed', 'true');
      hidden.value = pill.dataset.value;
    });

    // Keyboard support
    pill.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        pill.click();
      }
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// UPLOAD ZONE
// ─────────────────────────────────────────────────────────────────────────────
function initUploadZone() {
  const zone     = document.getElementById('upload-zone');
  const input    = document.getElementById('archivo');
  const preview  = document.getElementById('upload-preview');
  const content  = zone.querySelector('.upload-content');
  const nameSpan = document.getElementById('upload-filename');
  const removeBtn = document.getElementById('upload-remove');

  // File input change
  input.addEventListener('change', () => {
    if (input.files[0]) handleFileSelect(input.files[0]);
  });

  // Drag and drop
  zone.addEventListener('dragover', e => {
    e.preventDefault();
    zone.classList.add('drag-over');
  });

  zone.addEventListener('dragleave', e => {
    if (!zone.contains(e.relatedTarget)) zone.classList.remove('drag-over');
  });

  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  });

  // Remove file
  removeBtn.addEventListener('click', e => {
    e.stopPropagation();
    clearFile();
  });

  // Keyboard on zone
  zone.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      input.click();
    }
  });

  function handleFileSelect(file) {
    const ext = '.' + file.name.split('.').pop().toLowerCase();
    const sizeMB = file.size / 1024 / 1024;

    if (!CONFIG.ALLOWED_EXTS.includes(ext)) {
      toast('Unsupported format. Please use PDF, Word or TXT.', 'error');
      return;
    }

    if (sizeMB > CONFIG.MAX_FILE_MB) {
      toast(`File exceeds ${CONFIG.MAX_FILE_MB} MB limit.`, 'error');
      return;
    }

    selectedFile = file;
    zone.classList.add('has-file');
    content.hidden = true;
    preview.hidden = false;
    nameSpan.textContent = `${file.name} (${sizeMB.toFixed(1)} MB)`;
    clearError('err-doc');
  }

  function clearFile() {
    selectedFile = null;
    input.value = '';
    zone.classList.remove('has-file');
    content.hidden = false;
    preview.hidden = true;
    nameSpan.textContent = '';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// REAL-TIME VALIDATION (on blur)
// ─────────────────────────────────────────────────────────────────────────────
function initRealtimeValidation() {
  const rules = {
    nombre:   v => v.trim().length >= 2 ? null : 'Enter your full name.',
    email:    v => /^[^\s@]+@endeavor\.org$/i.test(v.trim()) ? null : 'Use your @endeavor.org email.',
    oficina:  v => v ? null : 'Select your office.',
    audiencia:v => v ? null : 'Select the target audience.',
    conceptos:v => v.trim().length >= 20 ? null : 'Describe the key concepts (at least 20 characters).',
  };

  Object.entries(rules).forEach(([id, validate]) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('blur', () => {
      const err = validate(el.value);
      if (err) showError(`err-${id}`, el, err);
      else clearError(`err-${id}`, el);
    });
    el.addEventListener('input', () => {
      if (!validate(el.value)) clearError(`err-${id}`, el);
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// FORM SUBMIT
// ─────────────────────────────────────────────────────────────────────────────
function initFormSubmit() {
  const form = document.getElementById('video-form');
  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!validateAll()) return;
    await submitToN8N();
  });
}

function validateAll() {
  let valid = true;

  const checks = [
    { id: 'nombre',    errId: 'err-nombre',    fn: v => v.trim().length >= 2,           msg: 'Enter your full name.' },
    { id: 'email',     errId: 'err-email',     fn: v => /^[^\s@]+@endeavor\.org$/i.test(v.trim()), msg: 'Use your @endeavor.org email.' },
    { id: 'oficina',   errId: 'err-oficina',   fn: v => !!v,                            msg: 'Select your office.' },
    { id: 'audiencia', errId: 'err-audiencia', fn: v => !!v,                            msg: 'Select the target audience.' },
    { id: 'conceptos', errId: 'err-conceptos', fn: v => v.trim().length >= 20,          msg: 'Describe the key concepts (at least 20 characters).' },
  ];

  checks.forEach(({ id, errId, fn, msg }) => {
    const el = document.getElementById(id);
    if (!fn(el.value)) {
      showError(errId, el, msg);
      if (valid) el.focus();
      valid = false;
    } else {
      clearError(errId, el);
    }
  });

  const url = document.getElementById('documento_url').value.trim();
  if (!selectedFile && !url) {
    showError('err-doc', null, 'Attach a document or paste a link.');
    valid = false;
  } else {
    clearError('err-doc');
  }

  return valid;
}

async function submitToN8N() {
  isSubmitting = true;
  setLoadingState(true);

  try {
    // Build payload
    const payload = new FormData();
    payload.append('nombre',       document.getElementById('nombre').value.trim());
    payload.append('email',        document.getElementById('email').value.trim().toLowerCase());
    payload.append('oficina',      document.getElementById('oficina').value);
    payload.append('equipo',       document.getElementById('equipo').value.trim());
    payload.append('tipo_video',   document.getElementById('tipo_video').value);
    payload.append('audiencia',    document.getElementById('audiencia').value);
    payload.append('duracion',     document.getElementById('duracion').value);
    payload.append('conceptos',    document.getElementById('conceptos').value.trim());
    payload.append('documento_url',document.getElementById('documento_url').value.trim());
    payload.append('timestamp',    new Date().toISOString());
    payload.append('solicitud_id', 'SOL-' + Date.now());

    if (selectedFile) {
      payload.append('archivo', selectedFile, selectedFile.name);
    }

    const res = await fetch(CONFIG.N8N_WEBHOOK_URL, {
      method: 'POST',
      body: payload,
      // No Content-Type header — browser sets it with boundary for FormData
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Error ${res.status}: ${errText || res.statusText}`);
    }

    const data = await res.json().catch(() => ({}));
    const solId = data.solicitud_id || payload.get('solicitud_id');
    showSuccess(solId);

  } catch (err) {
    console.error('[Endeavor Form] Submit error:', err);

    if (err.name === 'TypeError' && err.message.includes('fetch')) {
      toast('Could not reach the server. Check your connection.', 'error');
    } else if (err.message.startsWith('Error 4')) {
      toast('Invalid data. Review the form and try again.', 'error');
    } else {
      toast('An unexpected error occurred. Please try again.', 'error');
    }
  } finally {
    isSubmitting = false;
    setLoadingState(false);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// UI HELPERS
// ─────────────────────────────────────────────────────────────────────────────
function setLoadingState(loading) {
  const btn    = document.getElementById('btn-submit');
  const label  = btn.querySelector('.btn-label');
  const arrow  = btn.querySelector('.btn-arrow');
  const spinner = btn.querySelector('.btn-spinner');

  btn.disabled = loading;
  label.textContent = loading ? 'Sending…' : 'Submit request';
  arrow.hidden  = loading;
  spinner.hidden = !loading;
}

function showSuccess(solicitudId) {
  document.getElementById('video-form').hidden = true;
  const card = document.getElementById('success-card');
  const idEl  = document.getElementById('success-id');
  idEl.textContent = 'Request ID: ' + solicitudId;
  card.hidden = false;
  card.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function resetForm() {
  document.getElementById('video-form').reset();
  document.getElementById('video-form').hidden = false;
  document.getElementById('success-card').hidden = true;
  selectedFile = null;

  // Reset upload zone visuals
  const zone = document.getElementById('upload-zone');
  zone.classList.remove('has-file');
  zone.querySelector('.upload-content').hidden = false;
  document.getElementById('upload-preview').hidden = true;

  // Reset tipo pills
  document.querySelectorAll('.tipo-pill').forEach((p, i) => {
    p.classList.toggle('active', i === 0);
    p.setAttribute('aria-pressed', i === 0 ? 'true' : 'false');
  });
  document.getElementById('tipo_video').value = 'avatar';

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showError(errId, inputEl, msg) {
  const errEl = document.getElementById(errId);
  if (errEl) errEl.textContent = msg;
  if (inputEl) inputEl.classList.add('invalid');
}

function clearError(errId, inputEl) {
  const errEl = document.getElementById(errId);
  if (errEl) errEl.textContent = '';
  if (inputEl) inputEl.classList.remove('invalid');
}

function toast(msg, type = '') {
  const wrap = document.getElementById('toast-wrap');
  const el = document.createElement('div');
  el.className = 'toast' + (type ? ' ' + type : '');
  el.textContent = msg;
  el.setAttribute('role', 'alert');
  wrap.appendChild(el);

  setTimeout(() => {
    el.style.animation = 'toastOut .2s ease forwards';
    setTimeout(() => el.remove(), 200);
  }, 4000);
}

// Expose for inline onclick
window.resetForm = resetForm;
