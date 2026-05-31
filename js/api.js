/* ═══════════════════════════════════════════════════════════
   SENTINELLE-RDC — External API Clients
   APIs: NASA FIRMS, Copernicus DataSpace, ACLED
   Depends on: CFG (config.js), utils.js, data.js
   ═══════════════════════════════════════════════════════════ */

/* ── Persistent API key storage (localStorage) ──────────── */
var K = {
  get f()   { return localStorage.getItem('S_FK') || ''; },
  set f(v)  { localStorage.setItem('S_FK', v); },
  get ak()  { return localStorage.getItem('S_AK') || ''; },
  set ak(v) { localStorage.setItem('S_AK', v); },
  get ae()  { return localStorage.getItem('S_AE') || ''; },
  set ae(v) { localStorage.setItem('S_AE', v); }
};

/* ── API connection state ────────────────────────────────── */
var stat = { f: 'idle', c: 'idle', a: 'idle', d: 'on' };

/**
 * Updates the API status dot indicator in the header.
 * @param {string} k   - API key: 'f' (FIRMS) | 'c' (Copernicus) | 'a' (ACLED) | 'd' (Drone)
 * @param {string} s   - Status: 'on' | 'ld' (loading) | 'er' (error) | 'idle'
 */
function setSt(k, s) {
  stat[k] = s;
  var ids = { f: 'dF', c: 'dC', a: 'dA', d: 'dD' };
  var el = document.getElementById(ids[k]);
  if (!el) return;
  el.style.background = s === 'on'  ? 'var(--grn)' :
                         s === 'ld'  ? 'var(--amb)' :
                         s === 'er'  ? 'var(--red)' : 'var(--t3)';
}

/* ── NASA FIRMS ─────────────────────────────────────────────
   VIIRS SNPP Near-Real-Time active fire data for DRC.
   Free API — register at https://firms.modaps.eosdis.nasa.gov/api/area/
   Tries direct URL first, then two CORS proxies on failure. */
async function fetchFIRMS() {
  setSt('f', 'ld');
  var key = K.f;
  if (!key) {
    setSt('f', 'er');
    toast('FIRMS: Clé API manquante. Configurez-la dans l\'onglet ⚙.', 'warn', 5000);
    return [];
  }
  var urls = CFG.firmsUrls(key);
  for (var i = 0; i < urls.length; i++) {
    try {
      var res = await fetch(urls[i], { signal: AbortSignal.timeout(15000) });
      if (!res.ok) continue;
      var csv = await res.text();
      if (!csv.includes('latitude')) continue;
      var data = parseCSV(csv);
      if (data.length > 0) {
        setSt('f', 'on');
        renderFIRMS(data);
        toast('FIRMS: ' + data.length + ' anomalies thermiques chargées.', 'success');
        return data.map(function(f) {
          return {
            src: 'firms', type: 'Thermal Anomaly',
            date: f.acq_date || '', time: f.acq_time || '',
            lat: +f.latitude, lon: +f.longitude,
            brightness: +(f.bright_ti4 || 0),
            confidence: f.confidence || '',
            frp: +(f.frp || 0),
            daynight: f.daynight || ''
          };
        });
      }
    } catch (e) { /* try next proxy */ }
  }
  setSt('f', 'er');
  toast('FIRMS: Impossible de charger les données thermiques.', 'error');
  return [];
}

function renderFIRMS(data) {
  ly.firms.clearLayers();
  ly.heat.clearLayers();
  var hp = [];
  data.forEach(function(f) {
    var lt = +f.latitude, ln = +f.longitude;
    if (!lt || !ln) return;
    var frp = +(f.frp || 5);
    hp.push([lt, ln, frp / 50 + 0.3]);
    L.circleMarker([lt, ln], {
      radius: Math.max(3, Math.min(7, frp / 8 + 2)),
      color: '#ff5722', fillColor: '#ff5722', fillOpacity: .5, weight: 1
    }).addTo(ly.firms).bindPopup(
      '<div style="font:400 7px/1.3 \'IBM Plex Mono\'">' +
      '<b style="color:#ff5722">🔥 VIIRS Active Fire</b><br>' +
      escHtml(f.acq_date) + ' ' + escHtml(f.acq_time || '') + '<br>' +
      'Bright: ' + escHtml(f.bright_ti4 || '?') + 'K | FRP: ' + escHtml(f.frp || '?') + 'MW<br>' +
      'Conf: ' + escHtml(f.confidence || '?') + ' | ' + (f.daynight === 'D' ? 'Jour' : 'Nuit') + '<br>' +
      lt.toFixed(4) + '°, ' + ln.toFixed(4) + '°E</div>',
      { className: 'tpop' }
    );
  });
  if (hp.length) {
    L.heatLayer(hp, {
      radius: 18, blur: 14, maxZoom: 10,
      gradient: { 0.2: 'blue', 0.4: 'cyan', 0.6: 'lime', 0.8: 'yellow', 1: 'red' }
    }).addTo(ly.heat);
  }
  document.getElementById('cF').textContent = data.length;
}

/* ── Copernicus DataSpace ────────────────────────────────────
   Sentinel-1 (SAR) and Sentinel-2 (optical) scene catalog.
   Free, no authentication required.
   OData API: https://catalogue.dataspace.copernicus.eu */
async function fetchCOP() {
  setSt('c', 'ld');
  var start = new Date(Date.now() - 3 * 864e5).toISOString().split('.')[0] + 'Z';
  var bbox = CFG.COP_BBOX; // [W, S, E, N]
  var poly = bbox[0]+' '+bbox[1]+','+bbox[2]+' '+bbox[1]+','+bbox[2]+' '+bbox[3]+','+bbox[0]+' '+bbox[3]+','+bbox[0]+' '+bbox[1];
  var results = [];
  for (var i = 0; i < ['SENTINEL-1','SENTINEL-2'].length; i++) {
    var col = ['SENTINEL-1','SENTINEL-2'][i];
    try {
      var filter = "Collection/Name eq '" + col + "' and OData.CSC.Intersects(area=geography'SRID=4326;POLYGON((" + poly + "))') and ContentDate/Start gt " + start;
      var url = 'https://catalogue.dataspace.copernicus.eu/odata/v1/Products?$filter=' +
                encodeURIComponent(filter) + '&$top=30&$orderby=ContentDate/Start desc';
      var res = await fetch(url, { signal: AbortSignal.timeout(20000) });
      if (!res.ok) continue;
      var j = await res.json();
      (j.value || []).forEach(function(p) {
        results.push({
          src: 'cop',
          type: (p.Name || '').substring(0,2) + ' ' + ((p.Name || '').includes('GRD') ? 'SAR' : 'MSI'),
          date: (p.ContentDate && p.ContentDate.Start || '').split('T')[0],
          time: (p.ContentDate && p.ContentDate.Start || '').substring(11, 16),
          name: p.Name || '',
          platform: (p.Name || '').substring(0, 2)
        });
      });
    } catch (e) { /* continue */ }
  }
  setSt('c', results.length ? 'on' : 'er');
  if (results.length) {
    toast('Copernicus: ' + results.length + ' scènes Sentinel disponibles.', 'success');
  } else {
    toast('Copernicus: Aucune scène récente ou service indisponible.', 'warn');
  }
  return results;
}

/* ── ACLED (Armed Conflict Location & Event Data) ───────────
   Comprehensive conflict event database. Free with registration.
   Register at: https://acleddata.com/register/
   Falls back to verified Jan-Mar 2026 static dataset if no key. */
async function fetchACLED() {
  setSt('a', 'ld');
  var key = K.ak, email = K.ae;
  if (key && email) {
    try {
      var startDate = daysAgoISO(CFG.ACLED_DAYS_BACK);
      var endDate   = todayISO();
      var url = 'https://api.acleddata.com/acled/read' +
                '?iso=180&limit=200' +
                '&event_date=' + startDate + '|' + endDate +
                '&event_date_where=BETWEEN' +
                '&key=' + encodeURIComponent(key) +
                '&email=' + encodeURIComponent(email);
      var res = await fetch(url, { signal: AbortSignal.timeout(15000) });
      var j   = await res.json();
      if (j.success && j.data && j.data.length) {
        setSt('a', 'on');
        renderACLED(j.data);
        toast('ACLED: ' + j.data.length + ' événements chargés (live).', 'success');
        return j.data.map(function(e) {
          return {
            src: 'acled', type: e.event_type, subtype: e.sub_event_type,
            date: e.event_date, location: e.location, admin1: e.admin1,
            lat: +e.latitude, lon: +e.longitude, fatalities: +e.fatalities,
            actor1: e.actor1, actor2: e.actor2 || '', notes: e.notes || ''
          };
        });
      }
    } catch (e) { /* fall through to static data */ }
  }
  // Static fallback
  setSt('a', 'on');
  var fallback = getACLED2026();
  renderACLED(fallback);
  if (!key) {
    toast('ACLED: Données vérifiées Jan-Mar 2026 (configurez une clé API pour les données live).', 'info', 6000);
  }
  return fallback.map(function(e) { return Object.assign({ src: 'acled' }, e); });
}

function renderACLED(data) {
  ly.acled.clearLayers();
  data.forEach(function(e) {
    var lt = +(e.latitude || e.lat), ln = +(e.longitude || e.lon);
    if (!lt || !ln) return;
    var type = e.event_type || e.type || '';
    var isBattle = type.includes('Battle') || type.includes('Drone Strike');
    var c = isBattle ? '#ff3b4a' : '#ffa726';
    var fat = +(e.fatalities || 0);
    L.circleMarker([lt, ln], {
      radius: Math.max(4, Math.min(12, fat * 0.8 + 4)),
      color: c, fillColor: c, fillOpacity: .4, weight: 1.5
    }).addTo(ly.acled).bindPopup(
      '<div style="font:400 7px/1.3 \'IBM Plex Mono\';max-width:200px">' +
      '<b style="color:' + c + '">' + escHtml(type) + '</b><br>' +
      escHtml(e.event_date || e.date || '') + ' — ' + escHtml(e.location || '') + '<br>' +
      escHtml(e.actor1 || '') + (e.actor2 ? ' vs ' + escHtml(e.actor2) : '') +
      (fat ? '<br><b style="color:var(--red)">' + fat + ' KIA</b>' : '') +
      (e.notes ? '<br>' + escHtml(trunc(String(e.notes), 120)) : '') +
      '</div>',
      { className: 'tpop' }
    );
  });
  document.getElementById('cA').textContent = data.length;
}
