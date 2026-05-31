/* ═══════════════════════════════════════════════════════════
   SENTINELLE-RDC — Leaflet Map Initialization & Static Layers
   Depends on: Leaflet 1.9.4, Leaflet.heat, CFG, data.js, utils.js
   ═══════════════════════════════════════════════════════════ */

/* ── Map instance ────────────────────────────────────────── */
var map = L.map('map', {
  zoomControl: true,
  attributionControl: false,
  zoomSnap: 0.5
}).setView(CFG.MAP_CENTER, CFG.MAP_ZOOM);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18 })
  .addTo(map);

/* ── Layer groups ────────────────────────────────────────── */
var ly = {
  acled:  L.layerGroup().addTo(map),
  firms:  L.layerGroup().addTo(map),
  heat:   L.layerGroup().addTo(map),
  drone:  L.layerGroup().addTo(map),
  mil:    L.layerGroup().addTo(map),
  zone:   L.layerGroup().addTo(map),
  ref:    L.layerGroup().addTo(map),
  routes: L.layerGroup().addTo(map),
  cop:    L.layerGroup()             // off by default
};

/* ── Drone ISR markers ───────────────────────────────────── */
function renderDrones() {
  ly.drone.clearLayers();
  var clMap = {
    movement: 'var(--drone)', camp: 'var(--amb)', naval: 'var(--blu)',
    logistics: 'var(--drone)', humanitarian: 'var(--grn)',
    installation: 'var(--mag)', artillery: 'var(--pur)',
    strike: 'var(--red)', strike_bda: 'var(--amb)'
  };
  DRONE_ISR.forEach(function(d) {
    var cl         = clMap[d.classification] || 'var(--drone)';
    var isStrike   = d.classification === 'strike';
    var isLive     = d.status === 'IN PROGRESS' || d.status === 'TRACKING — LIVE';
    var isConfirmed= (d.status || '').includes('CONFIRMED');
    var sym = isStrike ? '💥' : '◈';
    var sz  = isStrike ? 20 : 16;
    var inner =
      '<div style="width:' + sz + 'px;height:' + sz + 'px;' +
      'background:' + cl + (isStrike ? '25' : '15') + ';' +
      'border:' + (isStrike ? '2' : '1.5') + 'px solid ' + cl + ';' +
      'border-radius:' + (isStrike ? '2px' : '50%') + ';' +
      'display:grid;place-items:center;' +
      'font-size:' + (isStrike ? '11' : '8') + 'px;color:' + cl + ';' +
      'box-shadow:0 0 ' + (isStrike ? '14' : '10') + 'px ' + cl + (isStrike ? '80' : '40') + ';' +
      (isStrike || isLive ? 'animation:pu 1s infinite' : '') + '">' + sym + '</div>' +
      (isLive ? '<div style="position:absolute;top:-2px;right:-2px;width:6px;height:6px;background:var(--grn);border-radius:50%;animation:pu 1s infinite"></div>' : '') +
      (isStrike ? '<div style="position:absolute;top:50%;left:50%;width:36px;height:36px;border:1px solid ' + cl + ';border-radius:50%;transform:translate(-50%,-50%);opacity:.3;animation:blst 2s ease-out infinite"></div>' : '');
    var icon = L.divIcon({
      className: '',
      html: '<div style="position:relative">' + inner + '</div>',
      iconSize: [sz, sz],
      iconAnchor: [sz / 2, sz / 2]
    });
    var stColor = isConfirmed ? 'var(--red)' : isLive ? 'var(--grn)' : 'var(--t3)';
    L.marker([d.lat, d.lon], { icon: icon }).addTo(ly.drone).bindPopup(
      '<div style="font:400 7px/1.4 \'IBM Plex Mono\';max-width:260px">' +
      '<b style="color:' + cl + ';font-size:' + (isStrike ? '10' : '9') + 'px">' +
      sym + ' ' + escHtml(d.platform) + ' — ' + escHtml(d.type) + '</b><br>' +
      '<span style="color:var(--t3)">' + escHtml(d.id) + ' | ' + escHtml(d.time) +
      ' | Alt: ' + escHtml(d.alt) + ' | Base: ' + escHtml(d.base) + '</span><br>' +
      '<span style="color:' + stColor + ';font-weight:700">' + escHtml(d.status) + '</span><br><br>' +
      escHtml(d.desc) + '<br><br>' +
      '<span style="color:var(--t3)">' + d.lat.toFixed(4) + '°, ' + d.lon.toFixed(4) + '°E</span></div>',
      { className: 'tpop' }
    );
    if (isStrike && isConfirmed) {
      L.circle([d.lat, d.lon], {
        radius: 500, color: cl, fillColor: cl, fillOpacity: .04, weight: 1, dashArray: '3 3'
      }).addTo(ly.drone);
    }
    if (d.status === 'TRACKING — LIVE') {
      L.circle([d.lat, d.lon], {
        radius: 12000, color: cl, fillColor: 'transparent', weight: 1, dashArray: '8 4', opacity: .4
      }).addTo(ly.drone);
    }
  });
  document.getElementById('cD').textContent = DRONE_ISR.length;
}

/* ── Military positions ──────────────────────────────────── */
MIL.forEach(function(p) {
  var ic = L.divIcon({
    className: '',
    html: '<div style="width:16px;height:16px;background:' + p.c + '12;border:1.5px solid ' + p.c +
          ';border-radius:' + (p.t === 'hq' ? '50%' : '2px') +
          ';display:grid;place-items:center;font-size:9px;color:' + p.c +
          ';box-shadow:0 0 6px ' + p.c + '30">' + p.s + '</div>',
    iconSize: [16, 16],
    iconAnchor: [8, 8]
  });
  L.marker([p.lt, p.ln], { icon: ic }).addTo(ly.mil).bindPopup(
    '<div style="font:400 7px/1.4 \'IBM Plex Mono\';max-width:200px">' +
    '<b style="color:' + p.c + ';font-size:9px">' + p.s + ' ' + escHtml(p.n) + '</b><br><br>' +
    escHtml(p.d) + '</div>',
    { className: 'tpop' }
  );
});

/* ── M23-controlled territory polygon ───────────────────── */
L.polygon([
  [-0.9,28.9],[-0.9,29.6],[-1.3,29.55],[-1.7,29.4],[-2.1,29.3],
  [-2.6,29.1],[-2.6,28.8],[-2.3,28.6],[-1.8,28.55],[-1.4,28.65],[-1.1,28.8]
], {
  color: 'var(--red)', fillColor: 'var(--red)', fillOpacity: .025, weight: 1.5, dashArray: '8 4'
}).addTo(ly.zone);

/* ── Strategic routes ────────────────────────────────────── */
[
  { p: [[-1.19,29.45],[-1.40,29.38],[-1.55,29.33],[-1.68,29.22]], n: 'Rutshuru→Goma (RN2)',       c: 'var(--red)' },
  { p: [[-1.68,29.22],[-1.70,29.26]],                             n: 'Goma↔Gisenyi (Rwanda)',      c: 'var(--mag)' },
  { p: [[-1.68,29.22],[-1.56,29.05],[-1.87,28.95],[-2.51,28.86]], n: 'Goma→Sake→Bukavu',          c: 'var(--amb)' },
  { p: [[-1.28,29.49],[-1.40,29.38]],                             n: 'Bunagana→Rumangabo',         c: 'var(--red)' },
  { p: [[0.49,29.47],[0.05,29.72]],                               n: 'Beni→Kasindi',               c: 'var(--amb)' }
].forEach(function(r) {
  L.polyline(r.p, { color: r.c, weight: 2, opacity: .4, dashArray: '6 4' }).addTo(ly.routes);
});

/* ── Reference cities ────────────────────────────────────── */
[
  {n:"Goma",lt:-1.68,ln:29.22,c:"#ff3b4a",s:5},{n:"Bukavu",lt:-2.51,ln:28.86,c:"#ff3b4a",s:4},
  {n:"Bunagana",lt:-1.28,ln:29.49,c:"#ff3b4a",s:3},{n:"Sake",lt:-1.56,ln:29.05,c:"#ff3b4a",s:3},
  {n:"Rutshuru",lt:-1.19,ln:29.45,c:"#ff3b4a",s:3},{n:"Beni",lt:0.49,ln:29.47,c:"#ffa726",s:3},
  {n:"Bunia",lt:1.57,ln:30.25,c:"#ffa726",s:3},{n:"Uvira",lt:-3.39,ln:29.14,c:"#ffa726",s:3},
  {n:"Kalemie",lt:-5.95,ln:29.19,c:"#2196f3",s:3},{n:"Kinshasa",lt:-4.32,ln:15.31,c:"#00bcd4",s:5},
  {n:"Lubumbashi",lt:-11.67,ln:27.47,c:"#26d97f",s:3},{n:"Masisi",lt:-1.40,ln:28.80,c:"#ff3b4a",s:3},
  {n:"Kasindi",lt:0.05,ln:29.72,c:"#ffa726",s:3},{n:"Lubero",lt:-0.16,ln:29.24,c:"#ffa726",s:3}
].forEach(function(c) {
  L.circleMarker([c.lt,c.ln], {
    radius: c.s, color: c.c, fillColor: c.c, fillOpacity: .5, weight: 1
  }).addTo(ly.ref);
  L.marker([c.lt,c.ln], {
    icon: L.divIcon({
      className: '',
      html: '<div style="font:600 7px \'IBM Plex Mono\';color:' + c.c +
            ';text-shadow:0 0 5px #000;pointer-events:none;transform:translateY(-10px)">' +
            escHtml(c.n) + '</div>',
      iconSize: [0, 0]
    })
  }).addTo(ly.ref);
});

/* ── Map interaction handlers ────────────────────────────── */
map.on('mousemove', function(e) {
  var el = document.getElementById('mco');
  if (el) el.textContent = e.latlng.lat.toFixed(3) + '° | ' + e.latlng.lng.toFixed(3) + '°E';
});
map.on('zoomend', function() {
  var el = document.getElementById('mzm');
  if (el) el.textContent = 'Z' + map.getZoom();
});

/* ── Layer visibility toggles ────────────────────────────── */
document.querySelectorAll('.ch').forEach(function(c) {
  c.addEventListener('click', function() {
    c.classList.toggle('on');
    var l = c.dataset.ly;
    if (ly[l]) {
      if (c.classList.contains('on')) map.addLayer(ly[l]);
      else map.removeLayer(ly[l]);
    }
  });
});
