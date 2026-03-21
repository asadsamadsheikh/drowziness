// ── Load user info ───────────────────────────────────
const role  = localStorage.getItem('userRole')  || 'driver';
const name  = localStorage.getItem('userName')  || localStorage.getItem('userEmail') || 'User';
const email = localStorage.getItem('userEmail') || '';

document.getElementById('userName').textContent    = name;
document.getElementById('userRoleLabel').textContent = role;
document.getElementById('userAvatar').textContent  = name.charAt(0).toUpperCase();
document.getElementById('userAvatar').className    =
  'user-avatar ' + (role === 'student' ? 'avatar-student' : 'avatar-driver');

// Style start button for role
const startBtn = document.getElementById('startBtn');
startBtn.className = 'btn-start ' + (role === 'student' ? 'student-start' : 'driver-start');

// ── Page navigation ──────────────────────────────────
const pages = { detection: 'pageDetection', reports: 'pageReports', history: 'pageHistory', settings: 'pageSettings' };
const titles = {
  detection: ['Detection',  role === 'student' ? 'Monitor your focus in real time' : 'Monitor your alertness in real time'],
  reports:   ['Reports',    'Your session summaries and focus trends'],
  history:   ['History',    'Past detection sessions'],
  settings:  ['Settings',   'Profile and preferences'],
};

function showPage(page) {
  Object.keys(pages).forEach(p => {
    document.getElementById(pages[p]).classList.toggle('hidden', p !== page);
  });
  document.querySelectorAll('.dash-link').forEach((l, i) => l.classList.remove('active'));
  document.querySelectorAll('.dash-link')[['detection','reports','history','settings'].indexOf(page)]?.classList.add('active');
  document.getElementById('pageTitle').textContent    = titles[page][0];
  document.getElementById('pageSubtitle').textContent = titles[page][1];
  document.getElementById('dashSidebar').classList.remove('open');
}

// ── Session timer ────────────────────────────────────
let timerInterval = null;
let sessionSeconds = 0;
let alertCount = 0;
let isRunning  = false;

function startTimer() {
  sessionSeconds = 0;
  timerInterval  = setInterval(() => {
    sessionSeconds++;
    const m = Math.floor(sessionSeconds / 60);
    const s = sessionSeconds % 60;
    document.getElementById('statTime').textContent = m + ':' + String(s).padStart(2,'0');
    updateFocusScore();
  }, 1000);
}

function stopTimer() {
  clearInterval(timerInterval);
  timerInterval = null;
}

function updateFocusScore() {
  if (sessionSeconds < 5) return;
  const alertRate = alertCount / (sessionSeconds / 60);
  const score = Math.max(0, Math.round(100 - alertRate * 20));
  document.getElementById('statFocus').textContent = score + '%';
  document.getElementById('statFocus').style.color =
    score > 80 ? 'var(--success)' : score > 50 ? '#fbbf24' : 'var(--danger)';
}

// ── Camera ───────────────────────────────────────────
let stream = null;

async function startDetection() {
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    const video = document.getElementById('videoEl');
    video.srcObject = stream;
    video.style.display = 'block';
    document.getElementById('camPlaceholder').style.display = 'none';
    document.getElementById('scanOverlay').classList.add('visible');
    document.getElementById('startBtn').style.display = 'none';
    document.getElementById('stopBtn').style.display  = 'block';

    setStatus('active', 'Monitoring...');
    document.getElementById('statStatus').textContent = 'Active';
    document.getElementById('statStatus').style.color = 'var(--success)';

    isRunning = true;
    startTimer();
    addLog('Camera started. Monitoring active.', 'ok');
    simulateDetection(); // remove when real AI is integrated
  } catch (err) {
    addLog('Camera access denied. Please allow camera.', 'alert');
    setStatus('', 'Camera denied');
  }
}

function stopDetection() {
  if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
  const video = document.getElementById('videoEl');
  video.srcObject = null; video.style.display = 'none';
  document.getElementById('camPlaceholder').style.display = 'flex';
  document.getElementById('scanOverlay').classList.remove('visible');
  document.getElementById('startBtn').style.display = 'block';
  document.getElementById('stopBtn').style.display  = 'none';

  setStatus('', 'Camera off');
  document.getElementById('statStatus').textContent = 'Stopped';
  document.getElementById('statStatus').style.color = 'var(--muted2)';

  isRunning = false;
  stopTimer();
  hideAlert();
  addLog('Detection stopped. Session ended.', 'info');
}

// ── Status badge ─────────────────────────────────────
function setStatus(state, text) {
  const badge = document.getElementById('statusBadge');
  badge.className = 'status-badge ' + state;
  document.getElementById('statusText').textContent = text;
}

// ── Alert ────────────────────────────────────────────
function triggerAlert(msg) {
  alertCount++;
  document.getElementById('statAlerts').textContent = alertCount;
  document.getElementById('alertBanner').classList.add('visible');
  document.getElementById('alertText').textContent  = msg;
  setStatus('alert', 'Alert!');
  addLog(msg, 'alert');
  // play beep
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.frequency.value = 880; osc.type = 'sine';
    gain.gain.setValueAtTime(0.4, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
    osc.start(); osc.stop(ctx.currentTime + 0.8);
  } catch(e) {}
  setTimeout(() => { hideAlert(); setStatus('active','Monitoring...'); }, 4000);
}

function hideAlert() {
  document.getElementById('alertBanner').classList.remove('visible');
}

// ── Log ───────────────────────────────────────────────
function addLog(msg, type) {
  const body = document.getElementById('logBody');
  const now  = new Date();
  const time = now.getHours() + ':' + String(now.getMinutes()).padStart(2,'0');
  const entry = document.createElement('div');
  entry.className = 'log-entry ' + type;
  entry.innerHTML = `<span class="log-dot"></span><span>${msg}</span><span class="log-time">${time}</span>`;
  body.insertBefore(entry, body.firstChild);
  if (body.children.length > 30) body.removeChild(body.lastChild);
}

// ── Simulated detection (replace with real AI model) ─
let simTimeout = null;
function simulateDetection() {
  if (!isRunning) return;
  const delay = 8000 + Math.random() * 20000;
  simTimeout  = setTimeout(() => {
    if (!isRunning) return;
    const msgs = [
      'Drowsiness detected! Eyes closing.',
      'Head nodding detected!',
      'Low blink rate — stay alert!',
      'Eye closure too long — take a break.',
    ];
    triggerAlert(msgs[Math.floor(Math.random() * msgs.length)]);
    simulateDetection();
  }, delay);
}

// ── Sidebar toggle (mobile) ──────────────────────────
function toggleSidebar() {
  document.getElementById('dashSidebar').classList.toggle('open');
}

// ── Logout ───────────────────────────────────────────
function logout() {
  stopDetection();
  localStorage.removeItem('userRole');
  localStorage.removeItem('userName');
  localStorage.removeItem('userEmail');
  window.location.href = 'home.html';
}

// ── Init ─────────────────────────────────────────────
addLog('Dashboard loaded. Ready to start.', 'info');