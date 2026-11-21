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

// ── Camera + MediaPipe detection ───────────────────────
// Inference is kept in the browser. The backend receives only alert/session metadata.
const MEDIAPIPE_VERSION = '0.10.14';
const MEDIAPIPE_CDN = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}`;
const FACE_MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';
const TARGET_INFERENCE_MS = 100; // approximately 10 inference frames per second
const EAR_THRESHOLD = 0.21;      // starting value; calibrate using your own test data
const ALERT_COOLDOWN_MS = 8000;
const EYE_LEFT = [362, 385, 387, 263, 373, 380];
const EYE_RIGHT = [33, 160, 158, 133, 153, 144];
// MediaPipe Face Mesh mouth landmarks (normalized coordinates).
const MOUTH_UPPER = 13;
const MOUTH_LOWER = 14;
const MOUTH_LEFT = 61;
const MOUTH_RIGHT = 291;
const YAWN_MAR_THRESHOLD = 0.55; // initial threshold; calibrate with labelled data
const YAWN_HOLD_MS = 800;
const YAWN_COOLDOWN_MS = 10000;
const MOUTH_ACTIVITY_DELTA = 0.035;
// Head-direction thresholds are offsets from the user's neutral, forward-facing pose.
// These are starting values; validate and tune with your camera and participants.
const LOOK_AWAY_HOLD_MS = 1200;
const LOOK_AWAY_COOLDOWN_MS = 8000;
const YAW_DIRECTION_THRESHOLD = 0.10;
const PITCH_DIRECTION_THRESHOLD = 0.055;
const DIRECTION_CALIBRATION_FRAMES = 30;

let stream = null;
let faceLandmarker = null;
let modelPromise = null;
let inferenceFrame = null;
let lastInferenceAt = 0;
let lastVideoTime = -1;
let smoothedEAR = null;
let eyesClosedSince = null;
let alertLatched = false;
let lastDetectionAlertAt = 0;
let lastInferenceDuration = 0;
let inferenceSamples = 0;
let fpsWindowStart = 0;
let measuredFPS = 0;
let smoothedMAR = null;
let mouthOpenSince = null;
let lastYawnAlertAt = 0;
let previousMAR = null;
let mouthActivity = 'Not measured';
let directionSince = null;
let currentDirection = 'Forward';
let lastDirectionAlertAt = 0;
let smoothedYawProxy = null;
let smoothedPitchProxy = null;
let directionCalibration = [];
let neutralYaw = null;
let neutralPitch = null;
let directionCalibrated = false;

function euclideanDistance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function calculateEAR(landmarks, indexes) {
  const [p1, p2, p3, p4, p5, p6] = indexes.map(i => landmarks[i]);
  const horizontal = euclideanDistance(p1, p4);
  if (!horizontal) return 0;
  return (euclideanDistance(p2, p6) + euclideanDistance(p3, p5)) / (2 * horizontal);
}

function calculateMAR(landmarks) {
  const upper = landmarks[MOUTH_UPPER];
  const lower = landmarks[MOUTH_LOWER];
  const left = landmarks[MOUTH_LEFT];
  const right = landmarks[MOUTH_RIGHT];
  const width = euclideanDistance(left, right);
  if (!width) return 0;
  return euclideanDistance(upper, lower) / width;
}

// Build pose proxies from the nose position relative to the eye line and face height.
// Calibrating a neutral baseline avoids assuming every face has identical proportions.
function estimateHeadDirection(landmarks) {
  const nose = landmarks[1];
  const leftEye = landmarks[33];
  const rightEye = landmarks[263];
  const forehead = landmarks[10];
  const chin = landmarks[152];
  if (!nose || !leftEye || !rightEye || !forehead || !chin) return null;

  const eyeMidX = (leftEye.x + rightEye.x) / 2;
  const eyeMidY = (leftEye.y + rightEye.y) / 2;
  const eyeWidth = Math.max(Math.abs(rightEye.x - leftEye.x), 0.001);
  const faceHeight = Math.max(Math.abs(chin.y - forehead.y), 0.001);
  return {
    yaw: (nose.x - eyeMidX) / eyeWidth,
    pitch: (nose.y - eyeMidY) / faceHeight
  };
}

function resetDirectionCalibration() {
  directionCalibration = [];
  neutralYaw = null;
  neutralPitch = null;
  directionCalibrated = false;
  directionSince = null;
  currentDirection = 'Calibrating';
  smoothedYawProxy = null;
  smoothedPitchProxy = null;
  const el = document.getElementById('directionValue');
  if (el) { el.textContent = 'Calibrating — look straight'; el.style.color = '#fbbf24'; }
  addLog('Head-direction calibration started. Face forward and keep your head still.', 'info');
}

function calibrateHeadDirection() {
  if (!running) {
    addLog('Start the camera before calibrating head direction.', 'warn');
    return;
  }
  resetDirectionCalibration();
}

function updateDirectionDetection(landmarks, now) {
  const estimate = estimateHeadDirection(landmarks);
  if (!estimate) return;

  if (!directionCalibrated) {
    directionCalibration.push(estimate);
    const el = document.getElementById('directionValue');
    if (el) el.textContent = `Calibrating ${directionCalibration.length}/${DIRECTION_CALIBRATION_FRAMES} — look straight`;
    if (directionCalibration.length >= DIRECTION_CALIBRATION_FRAMES) {
      neutralYaw = directionCalibration.reduce((sum, p) => sum + p.yaw, 0) / directionCalibration.length;
      neutralPitch = directionCalibration.reduce((sum, p) => sum + p.pitch, 0) / directionCalibration.length;
      directionCalibrated = true;
      smoothedYawProxy = 0;
      smoothedPitchProxy = 0;
      currentDirection = 'Forward';
      directionSince = null;
      if (el) { el.textContent = 'Forward'; el.style.color = 'var(--success)'; }
      addLog('Head-direction calibration complete.', 'ok');
    }
    return;
  }

  const yawOffset = estimate.yaw - neutralYaw;
  const pitchOffset = estimate.pitch - neutralPitch;
  smoothedYawProxy = smoothedYawProxy === null ? yawOffset : 0.65 * smoothedYawProxy + 0.35 * yawOffset;
  smoothedPitchProxy = smoothedPitchProxy === null ? pitchOffset : 0.65 * smoothedPitchProxy + 0.35 * pitchOffset;

  let direction = 'Forward';
  if (smoothedYawProxy <= -YAW_DIRECTION_THRESHOLD) direction = 'Turned image-left';
  else if (smoothedYawProxy >= YAW_DIRECTION_THRESHOLD) direction = 'Turned image-right';
  else if (smoothedPitchProxy <= -PITCH_DIRECTION_THRESHOLD) direction = 'Looking up';
  else if (smoothedPitchProxy >= PITCH_DIRECTION_THRESHOLD) direction = 'Looking down';

  const el = document.getElementById('directionValue');
  if (el) {
    el.textContent = direction;
    el.style.color = direction === 'Forward' ? 'var(--success)' : '#fbbf24';
  }

  if (direction === 'Forward') {
    directionSince = null;
    currentDirection = 'Forward';
    return;
  }
  if (direction !== currentDirection) {
    currentDirection = direction;
    directionSince = now;
    return;
  }
  if (directionSince === null) directionSince = now;
  if (now - directionSince >= LOOK_AWAY_HOLD_MS && Date.now() - lastDirectionAlertAt >= LOOK_AWAY_COOLDOWN_MS) {
    lastDirectionAlertAt = Date.now();
    directionSince = now;
    triggerAlert(`Looking away detected: ${direction}.`, 'looking_away');
    addLog(`Head direction alert: ${direction}.`, 'warn');
  }
}

function isMouthOnlyMode() {
  return Boolean(document.getElementById('mouthOnlyMode')?.checked);
}

function getClosureDurationMs() {
  const sensitivity = document.getElementById('setSens')?.value || localStorage.getItem('sns') || 'medium';
  return ({ low: 5000, medium: 3000, high: 1000 })[sensitivity] || 3000;
}

async function loadFaceLandmarker() {
  if (faceLandmarker) return faceLandmarker;
  if (modelPromise) return modelPromise;

  modelPromise = (async () => {
    addLog('Loading MediaPipe face landmark model…', 'info');
    const { FaceLandmarker, FilesetResolver } = await import(`${MEDIAPIPE_CDN}/vision_bundle.mjs`);
    const vision = await FilesetResolver.forVisionTasks(`${MEDIAPIPE_CDN}/wasm`);
    const options = {
      baseOptions: { modelAssetPath: FACE_MODEL_URL, delegate: 'GPU' },
      runningMode: 'VIDEO',
      numFaces: 1,
      outputFaceBlendshapes: true,
      outputFacialTransformationMatrixes: false
    };

    try {
      faceLandmarker = await FaceLandmarker.createFromOptions(vision, options);
      addLog('MediaPipe loaded with GPU delegate.', 'ok');
    } catch (gpuError) {
      console.warn('MediaPipe GPU initialization failed; trying CPU.', gpuError);
      options.baseOptions.delegate = 'CPU';
      faceLandmarker = await FaceLandmarker.createFromOptions(vision, options);
      addLog('MediaPipe loaded with CPU fallback.', 'warn');
    }
    return faceLandmarker;
  })();

  try {
    return await modelPromise;
  } catch (error) {
    modelPromise = null;
    faceLandmarker = null;
    throw error;
  }
}

function updateDetectionMetrics(left, right, avg, inferenceMs) {
  const leftEl = document.getElementById('leftEARValue');
  const rightEl = document.getElementById('rightEARValue');
  const avgEl = document.getElementById('avgEARValue');
  const fpsEl = document.getElementById('detectionFPS');
  if (leftEl) leftEl.textContent = left.toFixed(3);
  if (rightEl) rightEl.textContent = right.toFixed(3);
  if (avgEl) avgEl.textContent = avg.toFixed(3);
  lastInferenceDuration = inferenceMs;
  inferenceSamples++;
  const now = performance.now();
  if (!fpsWindowStart) fpsWindowStart = now;
  if (now - fpsWindowStart >= 2000) {
    measuredFPS = inferenceSamples / ((now - fpsWindowStart) / 1000);
    inferenceSamples = 0;
    fpsWindowStart = now;
    if (fpsEl) fpsEl.textContent = `${measuredFPS.toFixed(1)} FPS`;
  }
}

function setEyeStatus(message, color) {
  const el = document.getElementById('eyeStateValue');
  if (el) {
    el.textContent = message;
    el.style.color = color || 'var(--text)';
  }
}

function resetEyeClosure() {
  eyesClosedSince = null;
  smoothedEAR = null;
  alertLatched = false;
  hideAlert();
}

function processFaceResult(result, inferenceMs) {
  const faces = result.faceLandmarks;
  if (!faces || !faces.length) {
    resetEyeClosure();
    mouthOpenSince = null;
    smoothedMAR = null;
    previousMAR = null;
    directionSince = null; currentDirection = 'Unknown'; smoothedYawProxy = null; smoothedPitchProxy = null; directionCalibration = []; neutralYaw = null; neutralPitch = null; directionCalibrated = false;
    const directionEl = document.getElementById('directionValue'); if (directionEl) directionEl.textContent = 'Face not detected';
    setEyeStatus('Face not detected', '#fbbf24');
    const mouthEl = document.getElementById('mouthActivityValue');
    if (mouthEl) mouthEl.textContent = 'Face not detected';
    return;
  }

  const landmarks = faces[0];
  const now = performance.now();
  updateDirectionDetection(landmarks, now);
  const leftEAR = calculateEAR(landmarks, EYE_LEFT);
  const rightEAR = calculateEAR(landmarks, EYE_RIGHT);
  const rawEAR = (leftEAR + rightEAR) / 2;
  smoothedEAR = smoothedEAR === null ? rawEAR : (0.65 * smoothedEAR + 0.35 * rawEAR);
  updateDetectionMetrics(leftEAR, rightEAR, smoothedEAR, inferenceMs);

  // Mouth opening is monitored in every mode, including sunglasses mode.
  const rawMAR = calculateMAR(landmarks);
  smoothedMAR = smoothedMAR === null ? rawMAR : (0.7 * smoothedMAR + 0.3 * rawMAR);
  const marEl = document.getElementById('marValue');
  if (marEl) marEl.textContent = smoothedMAR.toFixed(3);

  const delta = previousMAR === null ? 0 : Math.abs(smoothedMAR - previousMAR);
  previousMAR = smoothedMAR;
  mouthActivity = delta >= MOUTH_ACTIVITY_DELTA ? 'Moving' : 'Stable';
  const activityEl = document.getElementById('mouthActivityValue');
  if (activityEl) activityEl.textContent = mouthActivity;

  // A yawn candidate requires a wide mouth opening sustained over time.
  if (smoothedMAR >= YAWN_MAR_THRESHOLD) {
    if (mouthOpenSince === null) mouthOpenSince = now;
    const openFor = now - mouthOpenSince;
    if (openFor >= YAWN_HOLD_MS && Date.now() - lastYawnAlertAt >= YAWN_COOLDOWN_MS) {
      lastYawnAlertAt = Date.now();
      triggerAlert('Possible yawn detected from sustained mouth opening.', 'yawn');
      addLog(`Yawn candidate detected (MAR ${smoothedMAR.toFixed(2)}).`, 'warn');
    }
  } else {
    mouthOpenSince = null;
  }

  // In sunglasses / eye-obstruction mode, do not rely on EAR for alerting.
  if (isMouthOnlyMode()) {
    eyesClosedSince = null;
    alertLatched = false;
    setEyeStatus('Mouth monitoring mode (eyes obstructed)', '#60a5fa');
    return;
  }

  if (smoothedEAR < EAR_THRESHOLD) {
    if (eyesClosedSince === null) eyesClosedSince = now;
    const closedFor = now - eyesClosedSince;
    setEyeStatus(`Eyes closed · ${(closedFor / 1000).toFixed(1)}s`, '#f87171');
    if (!alertLatched && closedFor >= getClosureDurationMs()) {
      alertLatched = true;
      if (Date.now() - lastDetectionAlertAt >= ALERT_COOLDOWN_MS) {
        lastDetectionAlertAt = Date.now();
        triggerAlert('Possible drowsiness detected: sustained eye closure.', 'eye_closure');
      }
    }
  } else {
    const wasClosed = eyesClosedSince !== null;
    eyesClosedSince = null;
    alertLatched = false;
    setEyeStatus('Eyes open', 'var(--success)');
    if (wasClosed) {
      hideAlert();
      if (running) setStatus('active', 'Monitoring…');
    }
  }
}

function detectionLoop(now) {
  if (!running || !stream) return;
  inferenceFrame = requestAnimationFrame(detectionLoop);
  const video = document.getElementById('videoEl');
  if (!video || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
  if (now - lastInferenceAt < TARGET_INFERENCE_MS || video.currentTime === lastVideoTime) return;

  lastInferenceAt = now;
  lastVideoTime = video.currentTime;
  try {
    const started = performance.now();
    const result = faceLandmarker.detectForVideo(video, now);
    processFaceResult(result, performance.now() - started);
  } catch (error) {
    console.error('MediaPipe inference error:', error);
    setEyeStatus('Detection error', 'var(--danger)');
    addLog('AI inference error. Check browser console.', 'alert');
    stopDetection();
  }
}

async function startDetection() {
  const startBtn = document.getElementById('startBtn');
  startBtn.disabled = true;
  startBtn.textContent = 'Loading AI…';
  try {
    // Load the model before opening the camera so failures are clearly reported.
    await loadFaceLandmarker();
    stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: 'user',
        width: { ideal: 640, max: 960 },
        height: { ideal: 480, max: 720 },
        frameRate: { ideal: 15, max: 24 }
      }
    });

    const video = document.getElementById('videoEl');
    video.srcObject = stream;
    await video.play();
    video.style.display = 'block';
    document.getElementById('camPlaceholder').style.display = 'none';
    document.getElementById('scanOverlay').classList.add('on');
    startBtn.style.display = 'none';
    startBtn.textContent = 'Start Detection';
    startBtn.disabled = false;
    document.getElementById('stopBtn').style.display = 'block';

    running = true;
    alerts = 0;
    lastInferenceAt = 0;
    lastVideoTime = -1;
    fpsWindowStart = 0;
    inferenceSamples = 0;
    measuredFPS = 0;
    resetEyeClosure();
    smoothedMAR = null; mouthOpenSince = null; previousMAR = null; lastYawnAlertAt = 0;
    directionSince = null; currentDirection = 'Calibrating'; lastDirectionAlertAt = 0; smoothedYawProxy = null; smoothedPitchProxy = null; directionCalibration = []; neutralYaw = null; neutralPitch = null; directionCalibrated = false;
    document.getElementById('statAlerts').textContent = '0';
    document.getElementById('statStatus').textContent = 'Active';
    document.getElementById('statStatus').style.color = 'var(--success)';
    setStatus('active', 'AI monitoring…');
    startTimer();
    addLog('Camera started. MediaPipe eye monitoring is active.', 'ok');
    inferenceFrame = requestAnimationFrame(detectionLoop);
  } catch (error) {
    console.error(error);
    if (stream) stream.getTracks().forEach(track => track.stop());
    stream = null;
    startBtn.disabled = false;
    startBtn.textContent = 'Start Detection';
    setStatus('alert', 'Detection unavailable');
    addLog(`Could not start detection: ${error.message || error}`, 'alert');
  }
}

async function stopDetection() {
  running = false;
  if (inferenceFrame) cancelAnimationFrame(inferenceFrame);
  inferenceFrame = null;
  if (stream) {
    stream.getTracks().forEach(track => track.stop());
    stream = null;
  }
  const video = document.getElementById('videoEl');
  video.pause();
  video.srcObject = null;
  video.style.display = 'none';
  document.getElementById('camPlaceholder').style.display = 'flex';
  document.getElementById('scanOverlay').classList.remove('on');
  document.getElementById('startBtn').style.display = 'block';
  document.getElementById('startBtn').disabled = false;
  document.getElementById('stopBtn').style.display = 'none';
  document.getElementById('statStatus').textContent = 'Stopped';
  document.getElementById('statStatus').style.color = 'var(--muted2)';
  setStatus('', 'Camera off');
  setEyeStatus('Monitoring stopped', 'var(--muted2)');
  const marEl = document.getElementById('marValue'); if (marEl) marEl.textContent = '—';
  const mouthEl = document.getElementById('mouthActivityValue'); if (mouthEl) mouthEl.textContent = '—';
  const directionEl = document.getElementById('directionValue'); if (directionEl) directionEl.textContent = '—';
  stopTimer();
  resetEyeClosure();
  if (secs > 5 && document.getElementById('tAutoSave').checked) await saveSession();
  addLog('Detection stopped.', 'info');
}

async function saveSession() {
  const score = parseFloat(document.getElementById('statFocus').textContent) || 100;
  try {
    const response = await fetch(API + '/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({ duration_seconds: secs, alert_count: alerts, focus_score: score, started_at: sessStart, ended_at: new Date() })
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    addLog('Session saved to your account.', 'ok');
  } catch (e) {
    addLog('Could not save session. Check backend connection.', 'warn');
  }
}

async function logAlert(msg, type = 'eye_closure') {
  try {
    const response = await fetch(API + '/alerts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({ alert_type: type, message: msg })
    });
    if (!response.ok) console.warn('Alert could not be stored:', response.status);
  } catch (e) {
    console.warn('Alert API unavailable:', e);
  }
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
function triggerAlert(msg, type = 'eye_closure') {
  alerts++; document.getElementById('statAlerts').textContent=alerts;
  if(document.getElementById('tVisual').checked){ document.getElementById('alertBanner').classList.add('visible'); document.getElementById('alertText').textContent=msg; }
  setStatus('alert','Alert!'); addLog(msg,'alert'); logAlert(msg, type);
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

// Random alert simulation removed: alerts now come from MediaPipe EAR analysis.

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