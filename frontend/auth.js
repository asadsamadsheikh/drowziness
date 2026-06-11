const API    = "http://127.0.0.1:8000";
const params = new URLSearchParams(window.location.search);
let role = params.get('role') || localStorage.getItem('selectedRole') || 'driver';
let tab  = 'login';

function init() { applyRole(); setTab('login'); }

function applyRole() {
  const card = document.getElementById('formCard');
  const pill = document.getElementById('rolePill');
  card.className = 'form-card fade-up delay-1 mode-' + role;
  if (role === 'driver') {
    pill.className = 'role-pill pill-driver';
    document.getElementById('pillText').textContent = 'Driver Mode';
    document.getElementById('loginBtn').className   = 'submit-btn driver-btn';
    document.getElementById('signupBtn').className  = 'submit-btn driver-btn';
    document.getElementById('studentFields').classList.add('hidden');
    document.getElementById('driverFields').classList.remove('hidden');
  } else {
    pill.className = 'role-pill pill-student';
    document.getElementById('pillText').textContent = 'Student Mode';
    document.getElementById('loginBtn').className   = 'submit-btn student-btn';
    document.getElementById('signupBtn').className  = 'submit-btn student-btn';
    document.getElementById('driverFields').classList.add('hidden');
    document.getElementById('studentFields').classList.remove('hidden');
  }
  updateText();
}

function setTab(t) {
  tab = t;
  document.getElementById('loginSection').classList.toggle('hidden',  t !== 'login');
  document.getElementById('signupSection').classList.toggle('hidden', t !== 'signup');
  document.getElementById('tabLogin').classList.toggle('active',  t === 'login');
  document.getElementById('tabSignup').classList.toggle('active', t === 'signup');
  clearMsgs(); updateText();
}

function updateText() {
  const s = role === 'student', l = tab === 'login';
  document.getElementById('formTitle').textContent =
    l ? 'Welcome back' : (s ? 'Join as Student' : 'Register as Driver');
  document.getElementById('formSub').textContent =
    l ? (s ? 'Login to your student account' : 'Login to your driver account')
      : (s ? 'Create your free student account' : 'Create your driver account');
}

function showError(m)   { document.getElementById('errorMsg').textContent = m; document.getElementById('successMsg').classList.add('hidden'); }
function showSuccess(m) { document.getElementById('successMsg').textContent = m; document.getElementById('successMsg').classList.remove('hidden'); document.getElementById('errorMsg').textContent = ''; }
function clearMsgs()    { document.getElementById('errorMsg').textContent = ''; document.getElementById('successMsg').classList.add('hidden'); }
function validEmail(e)  { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e); }

function setLoading(btnId, loading, text) {
  const btn = document.getElementById(btnId);
  btn.textContent = loading ? text : (btnId === 'loginBtn' ? 'Login' : 'Create Account');
  btn.disabled    = loading;
}

async function doLogin() {
  const email = document.getElementById('loginEmail').value.trim();
  const pass  = document.getElementById('loginPass').value;
  if (!email || !pass)    { showError('Please fill in all fields.'); return; }
  if (!validEmail(email)) { showError('Enter a valid email address.'); return; }
  clearMsgs(); setLoading('loginBtn', true, 'Logging in...');
  try {
    const res  = await fetch(API + "/login", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: pass })
    });
    const data = await res.json();
    if (!res.ok) { showError(data.detail || "Incorrect email or password."); setLoading('loginBtn', false); return; }
    localStorage.setItem("token",     data.access_token);
    localStorage.setItem("userRole",  data.role);
    localStorage.setItem("userName",  data.name);
    localStorage.setItem("userEmail", email);
    window.location.href = "dashboard.html";
  } catch(err) {
    showError("Cannot connect to server. Make sure the backend is running.");
    setLoading('loginBtn', false);
  }
}

async function doSignup() {
  const name  = document.getElementById('signupName').value.trim();
  const email = document.getElementById('signupEmail').value.trim();
  const pass  = document.getElementById('signupPass').value;
  if (!name || !email || !pass) { showError('Please fill in all fields.'); return; }
  if (!validEmail(email))       { showError('Enter a valid email address.'); return; }
  if (pass.length < 6)          { showError('Password must be at least 6 characters.'); return; }

  let body = { name, email, password: pass, role };
  if (role === 'student') {
    const roll = document.getElementById('signupRoll').value.trim();
    const grade= document.getElementById('signupClass').value.trim();
    const goal = document.getElementById('signupGoal').value;
    if (!roll || !grade || !goal) { showError('Please complete all student fields.'); return; }
    body.roll_number = roll; body.grade = grade; body.study_goal = parseInt(goal);
  }
  if (role === 'driver') {
    const vehicle = document.getElementById('signupVehicle').value;
    const license = document.getElementById('signupLicense').value.trim();
    if (!vehicle || !license) { showError('Please complete all driver fields.'); return; }
    body.vehicle_type = vehicle; body.license_number = license;
  }

  clearMsgs(); setLoading('signupBtn', true, 'Creating account...');
  try {
    const res  = await fetch(API + "/register", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (!res.ok) { showError(data.detail || "Registration failed. Try again."); setLoading('signupBtn', false); return; }
    showSuccess("Account created successfully! Please login.");
    setLoading('signupBtn', false);
    setTimeout(() => setTab('login'), 1800);
  } catch(err) {
    showError("Cannot connect to server. Make sure the backend is running.");
    setLoading('signupBtn', false);
  }
}

init();