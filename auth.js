const params = new URLSearchParams(window.location.search);
let role = params.get('role') || localStorage.getItem('selectedRole') || 'driver';
let tab  = 'login';

function init() { applyRole(); setTab('login'); }

function applyRole() {
  const card     = document.getElementById('formCard');
  const pill     = document.getElementById('rolePill');
  const pillText = document.getElementById('pillText');
  const loginBtn = document.getElementById('loginBtn');
  const signupBtn= document.getElementById('signupBtn');
  card.className = 'form-card fade-up delay-1 mode-' + role;
  if (role === 'driver') {
    pill.className = 'role-pill pill-driver'; pillText.textContent = 'Driver Mode';
    loginBtn.className = 'submit-btn driver-btn'; signupBtn.className = 'submit-btn driver-btn';
    document.getElementById('studentFields').classList.add('hidden');
    document.getElementById('driverFields').classList.remove('hidden');
  } else {
    pill.className = 'role-pill pill-student'; pillText.textContent = 'Student Mode';
    loginBtn.className = 'submit-btn student-btn'; signupBtn.className = 'submit-btn student-btn';
    document.getElementById('driverFields').classList.add('hidden');
    document.getElementById('studentFields').classList.remove('hidden');
  }
  updateText();
}

function setTab(t) {
  tab = t;
  document.getElementById('loginSection').classList.toggle('hidden', t !== 'login');
  document.getElementById('signupSection').classList.toggle('hidden', t !== 'signup');
  document.getElementById('tabLogin').classList.toggle('active',  t === 'login');
  document.getElementById('tabSignup').classList.toggle('active', t === 'signup');
  clearError(); updateText();
}

function updateText() {
  const s = role === 'student', l = tab === 'login';
  document.getElementById('formTitle').textContent =
    l ? 'Welcome back' : (s ? 'Join as Student' : 'Register as Driver');
  document.getElementById('formSub').textContent =
    l ? (s ? 'Login to your student account' : 'Login to your driver account')
      : (s ? 'Create your free student account' : 'Create your driver account');
}

function showError(m) { document.getElementById('errorMsg').textContent = m; }
function clearError()  { document.getElementById('errorMsg').textContent = ''; }
function validEmail(e) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e); }

function doLogin() {
  const email = document.getElementById('loginEmail').value.trim();
  const pass  = document.getElementById('loginPass').value;
  if (!email || !pass)    { showError('Please fill in all fields.'); return; }
  if (!validEmail(email)) { showError('Enter a valid email address.'); return; }
  clearError();
  // TODO: POST /api/login  { email, pass, role }
  localStorage.setItem('userRole', role);
  localStorage.setItem('userEmail', email);
  window.location.href = 'dashboard.html';
}

function doSignup() {
  const name  = document.getElementById('signupName').value.trim();
  const email = document.getElementById('signupEmail').value.trim();
  const pass  = document.getElementById('signupPass').value;
  if (!name || !email || !pass) { showError('Please fill in all fields.'); return; }
  if (!validEmail(email))       { showError('Enter a valid email address.'); return; }
  if (pass.length < 6)          { showError('Password must be at least 6 characters.'); return; }
  if (role === 'student') {
    if (!document.getElementById('signupRoll').value.trim() ||
        !document.getElementById('signupClass').value.trim() ||
        !document.getElementById('signupGoal').value)
      { showError('Please complete all student fields.'); return; }
  }
  if (role === 'driver') {
    if (!document.getElementById('signupVehicle').value ||
        !document.getElementById('signupLicense').value.trim())
      { showError('Please complete all driver fields.'); return; }
  }
  clearError();
  // TODO: POST /api/register  { name, email, pass, role, ...role-specific fields }
  localStorage.setItem('userRole', role);
  localStorage.setItem('userName', name);
  localStorage.setItem('userEmail', email);
  window.location.href = 'dashboard.html';
}

init();