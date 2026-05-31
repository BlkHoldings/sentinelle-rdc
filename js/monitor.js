/* ═══════════════════════════════════════════════════════════
   SENTINELLE-RDC — Main Application Controller
   Depends on: all other modules loaded before this file
   ═══════════════════════════════════════════════════════════ */

/* ── Global application state ────────────────────────────── */
var ALL        = [];          // merged event array from all sources
var autoOn     = true;
var cd         = CFG.REFRESH_SEC;
var activeTab  = 'all';
var activePill = 'all';
var searchQuery= '';

/* ── Primary data refresh ────────────────────────────────── */
async function doRefresh() {
  var lov  = document.getElementById('lov');
  var rBtn = document.getElementById('rBtn');
  var ltx  = document.getElementById('ltx');

  if (lov)  lov.classList.remove('off');
  if (rBtn) rBtn.textContent = '⟳ ...';

  if (ltx) ltx.textContent = 'ACLED: Chargement des événements...';
  var aD = await fetchACLED();

  if (ltx) ltx.textContent = 'FIRMS: Chargement des données thermiques...';
  var fD = await fetchFIRMS();

  if (ltx) ltx.textContent = 'Copernicus: Chargement des scènes Sentinel...';
  var cD = await fetchCOP();

  if (ltx) ltx.textContent = 'Drone ISR: Chargement des sorties...';
  renderDrones();
  var drD = DRONE_ISR.map(function(d) {
    return {
      src: 'drone', type: 'Drone ' + d.type, date: todayISO(),
      time: d.time.replace(' UTC',''), lat: d.lat, lon: d.lon,
      platform: d.platform, desc: d.desc, status: d.status,
      classification: d.classification, id: d.id
    };
  });

  // Merge and sort: newest date first, ACLED before drone before firms before cop
  ALL = [].concat(aD, drD, fD, cD).sort(function(a, b) {
    var d = (b.date||'').localeCompare(a.date||'');
    if (d) return d;
    var p = { acled:0, drone:1, firms:2, cop:3 };
    return (p[a.src]||9) - (p[b.src]||9);
  });

  // Update stats counters
  var battles = aD.filter(function(e){ return (e.type||'').includes('Battle')||((e.type||'').includes('Drone Strike')); });
  var violence= aD.filter(function(e){ return (e.type||'').includes('Violence'); });
  var totalFat= aD.reduce(function(s,e){ return s+(+(e.fatalities||0)); }, 0);

  var el = function(id){ return document.getElementById(id); };
  if (el('nB'))  el('nB').textContent  = battles.length;
  if (el('nV'))  el('nV').textContent  = violence.length;
  if (el('nFi')) el('nFi').textContent = fD.length;
  if (el('nDr')) el('nDr').textContent = DRONE_ISR.length;
  if (el('nSa')) el('nSa').textContent = cD.length;
  if (el('nFt')) el('nFt').textContent = totalFat;
  if (el('tBdg'))el('tBdg').textContent= ALL.length + ' events';

  renderFeed(activeTab, searchQuery);
  renderIntel();

  var now = new Date().toLocaleTimeString();
  if (el('upd')) el('upd').textContent = 'MAJ ' + now;
  if (lov)  lov.classList.add('off');
  if (rBtn) rBtn.textContent = '↻ REFRESH ALL';
  cd = CFG.REFRESH_SEC;
}

/* ── Auto-refresh toggle ─────────────────────────────────── */
function tgAuto() {
  autoOn = !autoOn;
  var btn = document.getElementById('aBtn');
  if (btn) {
    btn.textContent = autoOn ? 'AUTO 3 MIN' : 'AUTO OFF';
    btn.classList.toggle('on', autoOn);
  }
}

/* ── Search handler ──────────────────────────────────────── */
function searchFeed(q) {
  searchQuery = q || '';
  renderFeed(activeTab, searchQuery);
}

/**
 * Returns the current visible events based on active tab/pill/search.
 * Used by the CSV export button.
 */
function filteredEvents() {
  var base = ALL;
  if      (activeTab === 'acled') base = ALL.filter(function(e){ return e.src === 'acled'; });
  else if (activeTab === 'firms') base = ALL.filter(function(e){ return e.src === 'firms'; });
  else if (activeTab === 'drone') base = ALL.filter(function(e){ return e.src === 'drone'; });
  else if (activeTab === 'mil')   base = MIL.map(function(p){
    return { src:'mil', type:p.t, location:p.n, lat:p.lt, lon:p.ln, notes:p.d };
  });
  else if (activePill === 'battle')   base = ALL.filter(function(e){ return (e.type||'').includes('Battle'); });
  else if (activePill === 'violence') base = ALL.filter(function(e){ return (e.type||'').includes('Violence'); });
  else if (activePill === 'explosion')base = ALL.filter(function(e){ return (e.type||'').includes('Explosion')||((e.type||'').includes('Drone Strike')); });
  else if (activePill === 'strategic')base = ALL.filter(function(e){ return (e.type||'').includes('Strategic'); });
  else if (activePill === 'thermal')  base = ALL.filter(function(e){ return e.src === 'firms'; });
  else if (activePill === 'drone')    base = ALL.filter(function(e){ return e.src === 'drone'; });

  if (searchQuery) {
    var q = searchQuery.toLowerCase();
    base = base.filter(function(e){
      return [e.type,e.subtype,e.location,e.admin1,e.actor1,e.actor2,e.notes,e.desc,e.platform,e.id]
        .join(' ').toLowerCase().includes(q);
    });
  }
  return base;
}

/* ── Tab navigation ──────────────────────────────────────── */
document.querySelectorAll('.tb').forEach(function(t) {
  t.addEventListener('click', function() {
    document.querySelectorAll('.tb').forEach(function(x){ x.classList.remove('on'); });
    t.classList.add('on');
    activeTab  = t.dataset.t;
    activePill = 'all';
    document.querySelectorAll('.pl').forEach(function(p){ p.classList.remove('on'); });
    var allPill = document.querySelector('.pl[data-f="all"]');
    if (allPill) allPill.classList.add('on');
    renderFeed(activeTab, searchQuery);

    // Show/hide filter pills for non-cfg tabs
    var plsEl = document.getElementById('pls');
    if (plsEl) plsEl.style.display = (activeTab === 'cfg') ? 'none' : '';
  });
});

/* ── Filter pills ────────────────────────────────────────── */
document.getElementById('pls').addEventListener('click', function(e) {
  if (!e.target.classList.contains('pl')) return;
  document.querySelectorAll('.pl').forEach(function(p){ p.classList.remove('on'); });
  e.target.classList.add('on');
  activePill = e.target.dataset.f;
  activeTab  = 'all';
  document.querySelectorAll('.tb').forEach(function(x){ x.classList.remove('on'); });
  var allTab = document.querySelector('.tb[data-t="all"]');
  if (allTab) allTab.classList.add('on');
  renderFeed(activePill, searchQuery);
});

/* ── Clock, countdown, progress bar ─────────────────────── */
setInterval(function() {
  var n   = new Date();
  var ckEl = document.getElementById('ck');
  if (ckEl) {
    var utc  = n.toISOString().replace('T',' ').substring(0,19);
    var goma = new Date(n.getTime() + 2 * 3600e3).toISOString().substring(11,19);
    ckEl.textContent = utc + ' UTC | GOMA ' + goma;
  }
  if (autoOn) {
    cd--;
    var rftEl = document.getElementById('rft');
    var rffEl = document.getElementById('rff');
    if (rftEl) rftEl.textContent = Math.floor(cd/60) + ':' + String(cd%60).padStart(2,'0');
    if (rffEl) rffEl.style.width = ((cd / CFG.REFRESH_SEC) * 100) + '%';
    if (cd <= 0) doRefresh();
  }
}, 1000);

/* ── Session status bar ──────────────────────────────────── */
(function initSession() {
  var raw = sessionStorage.getItem('sentinelle_session');
  if (!raw) return;
  try {
    var s = JSON.parse(raw);

    // Check session expiry
    if (s.loginTime) {
      var age = Date.now() - new Date(s.loginTime).getTime();
      if (age > CFG.SESSION_DURATION_MS) {
        sessionStorage.removeItem('sentinelle_session');
        toast('Session expirée — veuillez vous reconnecter.', 'warn', 5000);
        setTimeout(function(){ window.location.href = 'index.html'; }, 4000);
        return;
      }
    }

    var bar = document.createElement('div');
    bar.className = 'sess';
    bar.innerHTML =
      '<div class="sess-l">' +
        '<span class="sess-g">● ' + escHtml(s.user || 'Opérateur') + '</span>' +
        '<span class="sess-c">' + escHtml(s.clearance || '') + '</span>' +
        '<span style="color:var(--t3)">' + escHtml(s.level || '') + '</span>' +
      '</div>' +
      '<div class="sess-o" id="logoutBtn">LOGOUT ✕</div>';
    document.body.appendChild(bar);

    document.getElementById('logoutBtn').onclick = function() {
      sessionStorage.removeItem('sentinelle_session');
      window.location.href = 'index.html';
    };

    // Shrink map area to accommodate session bar
    var wrap = document.querySelector('.wrap');
    if (wrap) wrap.style.height = 'calc(100vh - 38px - 20px)';
  } catch (e) { /* corrupt session data — ignore */ }
})();

/* ── Boot ────────────────────────────────────────────────── */
doRefresh();
