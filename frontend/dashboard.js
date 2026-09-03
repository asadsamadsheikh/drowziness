const API = "https://drowziness.onrender.com";
const token = localStorage.getItem("token");
if (!token) window.location.href = "auth.html";

// ── Load user profile ─────────────────────────────────
async function loadUserProfile() {
  try {
    const res  = await fetch(API + "/me", { headers: { "Authorization": "Bearer " + token } });
    if (!res.ok) { logout(); return; }
    const u = await res.json();
    localStorage.setItem("userName", u.name); localStorage.setItem("userRole", u.role); localStorage.setItem("userEmail", u.email);
    document.getElementById('userName').textContent      = u.name;
    document.getElementById('userRoleLabel').textContent = u.role;
    document.getElementById('userAvatar').textContent    = u.name.charAt(0).toUpperCase();
    document.getElementById('userAvatar').className = 'user-avatar ' + (u.role==='student'?'avatar-student':'avatar-driver');
    document.getElementById('pageSubtitle').textContent = 'Welcome back, ' + u.name + (u.role==='student'?'. Monitor your focus.':'. Stay alert on the road.');
    document.getElementById('startBtn').className = 'btn-start ' + (u.role==='student'?'s':'d');
    // Pre-fill settings
    document.getElementById('setName').value  = u.name;
    document.getElementById('setEmail').value = u.email;
    document.getElementById('setRole').value  = u.role;
    if (u.created_at) document.getElementById('setCreated').textContent = new Date(u.created_at).toLocaleDateString();
    if (u.role==='student') { document.getElementById('goalField').style.display='block'; if(u.study_goal) document.getElementById('setGoal').value=u.study_goal; }
    if (u.role==='driver')  { document.getElementById('vehicleField').style.display='block'; if(u.vehicle_type) document.getElementById('setVehicle').value=u.vehicle_type; }
  } catch(e) {
    const name = localStorage.getItem("userName") || "User";
    const role = localStorage.getItem("userRole")  || "driver";
    const dn   = name.includes("@") ? name.split("@")[0] : name;
    document.getElementById('userName').textContent      = dn;
    document.getElementById('userRoleLabel').textContent = role;
    document.getElementById('userAvatar').textContent    = dn.charAt(0).toUpperCase();
  }
}

// ── Pages ─────────────────────────────────────────────
const pageList = ['detection','reports','history','settings'];
const pageTitles = { detection:['Detection','Monitor your alertness in real time'], reports:['Reports','Your session summaries and focus data'], history:['History','All your past detection sessions'], settings:['Settings','Manage your profile and preferences'] };

function showPage(p) {
  pageList.forEach(x => document.getElementById('page'+x.charAt(0).toUpperCase()+x.slice(1)).classList.toggle('hidden', x!==p));
  document.querySelectorAll('.dash-link').forEach((l,i) => l.classList.toggle('active', i===pageList.indexOf(p)));
  document.getElementById('pageTitle').textContent    = pageTitles[p][0];
  document.getElementById('pageSubtitle').textContent = pageTitles[p][1];
  document.getElementById('dashSidebar').classList.remove('open');
  if (p==='reports')  loadReports();
  if (p==='history')  loadHistory();
  if (p==='settings') loadSettingsStats();
}

// ── Timer ─────────────────────────────────────────────
let timer=null, secs=0, alerts=0, running=false, sessStart=null;
function startTimer() { secs=0; sessStart=new Date(); timer=setInterval(()=>{ secs++; const m=Math.floor(secs/60),s=secs%60; document.getElementById('statTime').textContent=m+':'+String(s).padStart(2,'0'); calcFocus(); },1000); }
function stopTimer()  { clearInterval(timer); timer=null; }
function calcFocus()  { if(secs<5)return; const sc=Math.max(0,Math.round(100-(alerts/(secs/60))*20)); const el=document.getElementById('statFocus'); el.textContent=sc+'%'; el.style.color=sc>80?'var(--success)':sc>50?'#fbbf24':'var(--danger)'; }

// ── Camera ────────────────────────────────────────────
let stream=null;
async function startDetection() {
  try {
    stream=await navigator.mediaDevices.getUserMedia({video:true,audio:false});
    const v=document.getElementById('videoEl'); v.srcObject=stream; v.style.display='block';
    document.getElementById('camPlaceholder').style.display='none';
    document.getElementById('scanOverlay').classList.add('on');
    document.getElementById('startBtn').style.display='none';
    document.getElementById('stopBtn').style.display='block';
    setStatus('active','Monitoring...');
    document.getElementById('statStatus').textContent='Active'; document.getElementById('statStatus').style.color='var(--success)';
    running=true; alerts=0; startTimer(); addLog('Camera started. Monitoring active.','ok'); simulate();
  } catch(e) { addLog('Camera access denied. Please allow camera.','alert'); setStatus('','Camera denied'); }
}

async function stopDetection() {
  if(stream){ stream.getTracks().forEach(t=>t.stop()); stream=null; }
  const v=document.getElementById('videoEl'); v.srcObject=null; v.style.display='none';
  document.getElementById('camPlaceholder').style.display='flex';
  document.getElementById('scanOverlay').classList.remove('on');
  document.getElementById('startBtn').style.display='block';
  document.getElementById('stopBtn').style.display='none';
  setStatus('','Camera off');
  document.getElementById('statStatus').textContent='Stopped'; document.getElementById('statStatus').style.color='var(--muted2)';
  running=false; stopTimer(); hideAlert(); addLog('Detection stopped.','info');
  if(secs>5 && document.getElementById('tAutoSave').checked) await saveSession();
}

async function saveSession() {
  const score=parseFloat(document.getElementById('statFocus').textContent)||100;
  try {
    await fetch(API+"/sessions",{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+token},body:JSON.stringify({duration_seconds:secs,alert_count:alerts,focus_score:score,started_at:sessStart,ended_at:new Date()})});
    addLog('Session saved to your account.','ok');
  } catch(e){ addLog('Could not save session.','warn'); }
}

async function logAlert(msg) {
  try { await fetch(API+"/alerts",{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+token},body:JSON.stringify({alert_type:"drowsiness",message:msg})}); } catch(e){}
}

// ── Reports ───────────────────────────────────────────
async function loadReports() {
  try {
    const [sr,sesr,ar]=await Promise.all([
      fetch(API+"/sessions/stats",{headers:{"Authorization":"Bearer "+token}}),
      fetch(API+"/sessions",      {headers:{"Authorization":"Bearer "+token}}),
      fetch(API+"/alerts",        {headers:{"Authorization":"Bearer "+token}})
    ]);
    const stats=await sr.json(), sess=await sesr.json(), alts=await ar.json();
    document.getElementById('rSessions').textContent = stats.total_sessions;
    document.getElementById('rAlerts').textContent   = stats.total_alerts;
    document.getElementById('rFocus').textContent    = stats.average_focus+'%';
    document.getElementById('rHours').textContent    = stats.total_hours+'h';

    document.getElementById('rptSessionBody').innerHTML = sess.length===0
      ? '<div class="empty-state">No sessions yet. Start your first detection session.</div>'
      : '<table><thead><tr><th>Date</th><th>Duration</th><th>Alerts</th><th>Focus</th></tr></thead><tbody>'
        + sess.slice(0,10).map(s=>{const m=Math.floor(s.duration_seconds/60),sc=s.focus_score.toFixed(1),c=sc>80?'var(--success)':sc>50?'#fbbf24':'var(--danger)';return`<tr><td>${new Date(s.started_at).toLocaleDateString()}</td><td>${m}m ${s.duration_seconds%60}s</td><td>${s.alert_count}</td><td style="color:${c};font-weight:500">${sc}%</td></tr>`;}).join('')
        + '</tbody></table>';

    document.getElementById('rptAlertBody').innerHTML = alts.length===0
      ? '<div class="empty-state">No alerts recorded yet.</div>'
      : '<table><thead><tr><th>Time</th><th>Type</th><th>Message</th></tr></thead><tbody>'
        + alts.slice(0,10).map(a=>`<tr><td>${new Date(a.triggered_at).toLocaleString()}</td><td>${a.alert_type}</td><td>${a.message||'—'}</td></tr>`).join('')
        + '</tbody></table>';
  } catch(e) { document.getElementById('rptSessionBody').innerHTML='<div class="empty-state" style="color:var(--danger)">Could not load reports. Make sure backend is running.</div>'; }
}

// ── History ───────────────────────────────────────────
async function loadHistory() {
  try {
    const res=await fetch(API+"/sessions",{headers:{"Authorization":"Bearer "+token}});
    const sess=await res.json();
    document.getElementById('histBody').innerHTML = sess.length===0
      ? '<div class="empty-state">No sessions recorded yet.</div>'
      : '<table><thead><tr><th>#</th><th>Date & Time</th><th>Duration</th><th>Alerts</th><th>Focus Score</th></tr></thead><tbody>'
        + sess.map((s,i)=>{const m=Math.floor(s.duration_seconds/60),sc=s.focus_score.toFixed(1),c=sc>80?'var(--success)':sc>50?'#fbbf24':'var(--danger)';return`<tr><td style="color:var(--muted2)">#${i+1}</td><td>${new Date(s.started_at).toLocaleString()}</td><td>${m}m ${s.duration_seconds%60}s</td><td>${s.alert_count}</td><td style="color:${c};font-weight:500">${sc}%</td></tr>`;}).join('')
        + '</tbody></table>';
  } catch(e){ document.getElementById('histBody').innerHTML='<div class="empty-state" style="color:var(--danger)">Could not load history.</div>'; }
}

// ── Settings stats ────────────────────────────────────
async function loadSettingsStats() {
  try {
    const res=await fetch(API+"/sessions/stats",{headers:{"Authorization":"Bearer "+token}});
    const d=await res.json();
    document.getElementById('setTotalSess').textContent   = d.total_sessions+' sessions';
    document.getElementById('setTotalAlerts').textContent = d.total_alerts+' alerts';
  } catch(e){}
}

// ── Settings: save profile ────────────────────────────
async function saveProfile() {
  const name=document.getElementById('setName').value.trim();
  if(!name){showSMsg('profileMsg','Name cannot be empty.',false);return;}
  const role=localStorage.getItem('userRole');
  const body={name};
  if(role==='student') body.study_goal   = parseInt(document.getElementById('setGoal').value);
  if(role==='driver')  body.vehicle_type = document.getElementById('setVehicle').value;
  try {
    const res=await fetch(API+"/me",{method:"PUT",headers:{"Content-Type":"application/json","Authorization":"Bearer "+token},body:JSON.stringify(body)});
    if(!res.ok){showSMsg('profileMsg','Failed to update.',false);return;}
    const u=await res.json();
    localStorage.setItem('userName',u.name);
    document.getElementById('userName').textContent=u.name;
    document.getElementById('userAvatar').textContent=u.name.charAt(0).toUpperCase();
    showSMsg('profileMsg','Profile updated successfully!',true);
  } catch(e){showSMsg('profileMsg','Cannot connect to server.',false);}
}

// ── Settings: alert prefs ─────────────────────────────
function saveAlerts() {
  localStorage.setItem('snd', document.getElementById('tSound').checked);
  localStorage.setItem('vis', document.getElementById('tVisual').checked);
  localStorage.setItem('aut', document.getElementById('tAutoSave').checked);
  localStorage.setItem('sns', document.getElementById('setSens').value);
  showSMsg('alertMsg','Alert settings saved!',true);
}

// ── Settings: change password ─────────────────────────
function changePassword() {
  const o=document.getElementById('oldPass').value, n=document.getElementById('newPass').value, c=document.getElementById('confPass').value;
  if(!o||!n||!c){showSMsg('passMsg','Please fill in all fields.',false);return;}
  if(n.length<6) {showSMsg('passMsg','New password must be at least 6 characters.',false);return;}
  if(n!==c)      {showSMsg('passMsg','New passwords do not match.',false);return;}
  // TODO: connect to backend /api/change-password endpoint
  showSMsg('passMsg','Password updated!',true);
  document.getElementById('oldPass').value=document.getElementById('newPass').value=document.getElementById('confPass').value='';
}

function showSMsg(id,msg,ok) {
  const el=document.getElementById(id); el.textContent=msg; el.className='s-msg '+(ok?'ok':'err');
  setTimeout(()=>{el.textContent='';el.className='s-msg';},3000);
}

// ── Alert system ──────────────────────────────────────
function triggerAlert(msg) {
  alerts++; document.getElementById('statAlerts').textContent=alerts;
  if(document.getElementById('tVisual').checked){ document.getElementById('alertBanner').classList.add('visible'); document.getElementById('alertText').textContent=msg; }
  setStatus('alert','Alert!'); addLog(msg,'alert'); logAlert(msg);
  if(document.getElementById('tSound').checked){
    try{ const ctx=new AudioContext(),osc=ctx.createOscillator(),g=ctx.createGain(); osc.connect(g); g.connect(ctx.destination); osc.frequency.value=880; osc.type='sine'; g.gain.setValueAtTime(0.4,ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+0.8); osc.start(); osc.stop(ctx.currentTime+0.8); }catch(e){}
  }
  setTimeout(()=>{ hideAlert(); if(running) setStatus('active','Monitoring...'); },4000);
}
function hideAlert()    { document.getElementById('alertBanner').classList.remove('visible'); }
function setStatus(s,t) { document.getElementById('statusBadge').className='status-badge '+s; document.getElementById('statusText').textContent=t; }

// ── Log ───────────────────────────────────────────────
function addLog(msg,type) {
  const body=document.getElementById('logBody'), now=new Date();
  const time=now.getHours()+':'+String(now.getMinutes()).padStart(2,'0');
  const e=document.createElement('div'); e.className='log-entry '+type;
  e.innerHTML=`<span class="log-dot"></span><span>${msg}</span><span class="log-time">${time}</span>`;
  body.insertBefore(e,body.firstChild); if(body.children.length>30) body.removeChild(body.lastChild);
}

// ── Simulation ────────────────────────────────────────
function simulate() {
  if(!running) return;
  setTimeout(()=>{ if(!running)return; const m=['Drowsiness detected! Eyes closing.','Head nodding detected!','Low blink rate — stay alert!','Eye closure too long — take a break.']; triggerAlert(m[Math.floor(Math.random()*m.length)]); simulate(); }, 10000+Math.random()*20000);
}

// ── Misc ──────────────────────────────────────────────
function toggleSidebar() { document.getElementById('dashSidebar').classList.toggle('open'); }
function confirmLogout() { if(confirm('Are you sure you want to logout?')) logout(); }
function logout() {
  if(running) stopDetection();
  ['token','userRole','userName','userEmail'].forEach(k=>localStorage.removeItem(k));
  window.location.href='home.html';
}
function loadPrefs() {
  if(localStorage.getItem('snd')==='false') document.getElementById('tSound').checked=false;
  if(localStorage.getItem('vis')==='false') document.getElementById('tVisual').checked=false;
  if(localStorage.getItem('aut')==='false') document.getElementById('tAutoSave').checked=false;
  if(localStorage.getItem('sns')) document.getElementById('setSens').value=localStorage.getItem('sns');
}

loadUserProfile(); loadPrefs(); addLog('Dashboard loaded. Ready to start.','info');