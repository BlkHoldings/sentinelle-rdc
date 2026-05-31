/* ═══════════════════════════════════════════════════════════
   SENTINELLE-RDC — Authentication Logic
   NOTE: Client-side only — suitable for access-controlled
   demo environments. Not a substitute for server-side auth.
   Depends on: utils.js, toast.js
   ═══════════════════════════════════════════════════════════ */

/* ── Credentials store ───────────────────────────────────── */
var CREDS = {
  deepq:      { pwd: 'sentinelle2026', level: 'analyst',   name: 'DeepQ Analyst',        clearance: 'NIVEAU 3' },
  'gbk-ops':  { pwd: 'kivu-watch',     level: 'operator',  name: 'Opérateur Satellite',  clearance: 'NIVEAU 4' },
  'fardc-cmd':{ pwd: 'goma-secure',    level: 'commander', name: 'FARDC Commandement',   clearance: 'NIVEAU 5' },
  monusco:    { pwd: 'un-force-2026',  level: 'operator',  name: 'MONUSCO JMAC',         clearance: 'NIVEAU 4' },
  anr:        { pwd: 'securite-nat',   level: 'commander', name: 'ANR Direction',        clearance: 'NIVEAU 5' },
  gedeon:     { pwd: 'deepq-admin',    level: 'commander', name: 'Gedeon Baleke — VP',   clearance: 'NIVEAU 5' }
};

var RANK = { analyst: 1, operator: 2, commander: 3 };

/* ── Rate-limiting state ─────────────────────────────────── */
var loginAttempts = 0;
var lockoutUntil  = 0;

/* ── Redirect if already authenticated ──────────────────── */
(function checkExisting() {
  var raw = sessionStorage.getItem('sentinelle_session');
  if (!raw) return;
  try {
    var s = JSON.parse(raw);
    if (s.token && s.loginTime) {
      var age = Date.now() - new Date(s.loginTime).getTime();
      // Only auto-redirect if session is fresh (< 24h)
      if (age < 24 * 3600e3) {
        window.location.href = 'monitor.html';
      } else {
        sessionStorage.removeItem('sentinelle_session');
      }
    }
  } catch (e) { sessionStorage.removeItem('sentinelle_session'); }
})();

/* ── Level selector ──────────────────────────────────────── */
var selLevel = 'analyst';
document.querySelectorAll('.lv').forEach(function(b) {
  b.addEventListener('click', function() {
    document.querySelectorAll('.lv').forEach(function(x) { x.classList.remove('act'); });
    b.classList.add('act');
    selLevel = b.dataset.l;
  });
});

/* ── Enter key submits form ──────────────────────────────── */
document.getElementById('pwd').addEventListener('keydown', function(e) {
  if (e.key === 'Enter') doLogin();
});
document.getElementById('uid').addEventListener('keydown', function(e) {
  if (e.key === 'Enter') document.getElementById('pwd').focus();
});

/**
 * Handles login form submission.
 * Enforces rate-limiting: 5 failed attempts triggers a 30-second lockout.
 */
function doLogin() {
  var uid = document.getElementById('uid').value.trim().toLowerCase();
  var pwd = document.getElementById('pwd').value;
  var btn = document.getElementById('loginBtn');
  var err = document.getElementById('errMsg');
  var lk  = document.getElementById('lockoutMsg');

  err.style.display = 'none';
  if (lk) lk.style.display = 'none';

  // Enforce lockout
  if (Date.now() < lockoutUntil) {
    var remaining = Math.ceil((lockoutUntil - Date.now()) / 1000);
    if (lk) {
      lk.textContent = '⚠ Trop de tentatives. Veuillez attendre ' + remaining + 's.';
      lk.style.display = 'block';
    }
    return;
  }

  if (!uid || !pwd) {
    err.textContent = 'Identifiant et clé d\'accès requis.';
    err.style.display = 'block';
    return;
  }

  btn.classList.add('load');
  btn.disabled = true;

  // Simulate network latency (client-side auth realism)
  setTimeout(function() {
    btn.classList.remove('load');
    btn.disabled = false;

    var u = CREDS[uid];
    if (!u || u.pwd !== pwd) {
      loginAttempts++;
      var remaining = 5 - loginAttempts;
      if (loginAttempts >= 5) {
        lockoutUntil = Date.now() + 30 * 1000;
        loginAttempts = 0;
        if (lk) {
          lk.textContent = '⚠ Compte verrouillé pendant 30 secondes suite à ' + loginAttempts + ' tentatives échouées.';
          lk.style.display = 'block';
        }
        startLockoutCountdown(30);
      } else {
        err.textContent = 'Identifiant ou clé d\'accès incorrect.' +
                          (remaining > 0 ? ' (' + remaining + ' tentative(s) restante(s))' : '');
        err.style.display = 'block';
      }
      return;
    }

    if (RANK[selLevel] > RANK[u.level]) {
      err.textContent = 'Niveau insuffisant. ' + escHtml(u.name) + ' — ' + escHtml(u.clearance) + '.';
      err.style.display = 'block';
      return;
    }

    // Successful login
    loginAttempts = 0;
    var token = crypto.getRandomValues(new Uint8Array(32))
                      .reduce(function(s, b) { return s + b.toString(16).padStart(2,'0'); }, '');
    sessionStorage.setItem('sentinelle_session', JSON.stringify({
      token:     token,
      user:      u.name,
      clearance: u.clearance,
      level:     u.level,
      loginTime: new Date().toISOString()
    }));

    document.getElementById('authOk').classList.add('show');
    setTimeout(function() { window.location.href = 'monitor.html'; }, 2400);
  }, 900);
}

/** Displays a countdown in the lockout message and re-enables login on expiry. */
function startLockoutCountdown(sec) {
  var lk  = document.getElementById('lockoutMsg');
  var btn = document.getElementById('loginBtn');
  if (btn) btn.disabled = true;
  var timer = setInterval(function() {
    sec--;
    var remaining2 = Math.max(0, Math.ceil((lockoutUntil - Date.now()) / 1000));
    if (lk && lk.style.display !== 'none') {
      lk.textContent = '⚠ Compte verrouillé. Réessayez dans ' + remaining2 + 's.';
    }
    if (remaining2 <= 0) {
      clearInterval(timer);
      if (lk) lk.style.display = 'none';
      if (btn) btn.disabled = false;
    }
  }, 1000);
}

/** Copies the external access link to clipboard. */
function copyLnk() {
  var lnk = document.getElementById('extLnk');
  if (!lnk) return;
  navigator.clipboard.writeText(lnk.textContent).then(function() {
    var cpBtn = document.getElementById('cpBtn');
    cpBtn.textContent = '✓ COPIÉ';
    cpBtn.classList.add('ok');
    setTimeout(function() { cpBtn.textContent = 'COPIER'; cpBtn.classList.remove('ok'); }, 2000);
  }).catch(function() {
    toast('Impossible de copier — navigateur non supporté.', 'warn');
  });
}

/* ── External link generation ────────────────────────────── */
(function generateExtLink() {
  var tk  = crypto.getRandomValues(new Uint8Array(8))
                  .reduce(function(s,b){ return s+b.toString(16).padStart(2,'0'); }, '');
  var base = location.origin + location.pathname.replace(/[^/]*$/, '');
  var el   = document.getElementById('extLnk');
  if (el) el.textContent = base + '?token=' + tk;
})();

/* ── URL token auto-login ────────────────────────────────── */
(function checkUrlToken() {
  var p = new URLSearchParams(location.search);
  var token = p.get('token');
  if (!token) return;
  sessionStorage.setItem('sentinelle_session', JSON.stringify({
    token:     escHtml(token),
    user:      'External Operator',
    clearance: 'NIVEAU 3',
    level:     'analyst',
    loginTime: new Date().toISOString()
  }));
  setTimeout(function() {
    document.getElementById('authOk').classList.add('show');
    setTimeout(function() { window.location.href = 'monitor.html'; }, 2000);
  }, 500);
})();
