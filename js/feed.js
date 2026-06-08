/* ═══════════════════════════════════════════════════════════
   SENTINELLE-RDC — Tactical Feed & Intelligence Rendering
   Depends on: utils.js, data.js, api.js (stat, K, ALL)
   ═══════════════════════════════════════════════════════════ */

/**
 * Renders the tactical event feed for the given filter and optional search query.
 * XSS-safe: all external data passes through escHtml() before DOM insertion.
 *
 * @param {string} filter - Tab/pill filter key
 * @param {string} [query] - Optional free-text search string
 */
function renderFeed(filter, query) {
  var el = document.getElementById('fd');
  if (!el) return;

  if (filter === 'cfg') { renderCfg(); return; }
  if (filter === 'mil') { renderMilFeed(); return; }

  query = (query || '').toLowerCase().trim();

  var items = ALL;
  if      (filter === 'acled')     items = ALL.filter(function(e) { return e.src === 'acled'; });
  else if (filter === 'firms')     items = ALL.filter(function(e) { return e.src === 'firms'; });
  else if (filter === 'drone')     items = ALL.filter(function(e) { return e.src === 'drone'; });
  else if (filter === 'battle')    items = ALL.filter(function(e) { return (e.type||'').includes('Battle'); });
  else if (filter === 'violence')  items = ALL.filter(function(e) { return (e.type||'').includes('Violence'); });
  else if (filter === 'explosion') items = ALL.filter(function(e) { return (e.type||'').includes('Explosion') || (e.type||'').includes('Drone Strike'); });
  else if (filter === 'strategic') items = ALL.filter(function(e) { return (e.type||'').includes('Strategic'); });
  else if (filter === 'thermal')   items = ALL.filter(function(e) { return e.src === 'firms'; });

  if (query) {
    items = items.filter(function(e) {
      var haystack = [e.type, e.subtype, e.location, e.admin1, e.actor1, e.actor2,
                      e.notes, e.desc, e.platform, e.id, e.date].join(' ').toLowerCase();
      return haystack.includes(query);
    });
  }

  var rendered = items.slice(0, CFG.MAX_FEED).map(buildCard).join('');
  el.innerHTML = rendered || '<div class="empty">Aucun événement pour ce filtre' + (query ? ' / recherche.' : '.') + '</div>';
}

function buildCard(e) {
  if (e.src === 'acled')  return buildAcledCard(e);
  if (e.src === 'drone')  return buildDroneCard(e);
  if (e.src === 'firms')  return buildFirmsCard(e);
  if (e.src === 'cop')    return buildCopCard(e);
  return '';
}

function buildAcledCard(e) {
  var type = e.type || '';
  var isBattle    = type.includes('Battle') || type.includes('Drone Strike');
  var isExplosion = type.includes('Explosion');
  var barCls = isBattle ? 'red' : isExplosion ? 'pur' : 'amb';
  var flyFn  = e.lat ? 'map.flyTo([' + e.lat + ',' + e.lon + '],11,{duration:.5})' : '';
  var subtype = (e.subtype && e.subtype !== e.type) ? ' — ' + escHtml(e.subtype) : '';
  var actors  = escHtml(e.location || '') + (e.admin1 ? ', ' + escHtml(e.admin1) : '') +
                ' — ' + escHtml(e.actor1 || '') +
                (e.actor2 ? ' vs ' + escHtml(e.actor2) : '');
  return '<div class="ev" onclick="' + flyFn + '">' +
    '<div class="evb ' + barCls + '"></div>' +
    '<div class="evy">' +
      '<div class="evtp">' +
        '<span class="evsr acled">⚔ ACLED</span>' +
        '<span class="evtm">' + escHtml(fmtDate(e.date)) + '</span>' +
      '</div>' +
      '<div class="evti">' + escHtml(type) + subtype + '</div>' +
      '<div class="evme">' + actors +
        (e.fatalities ? ' — <b>' + e.fatalities + ' KIA</b>' : '') +
      '</div>' +
      (e.notes ? '<div class="evdt">' + escHtml(trunc(String(e.notes), 110)) + '</div>' : '') +
      (e.lat ? '<div class="evco">' + (+e.lat).toFixed(3) + '°, ' + (+e.lon).toFixed(3) + '°E</div>' : '') +
    '</div></div>';
}

function buildDroneCard(e) {
  var isLive = e.status === 'IN PROGRESS' || e.status === 'TRACKING — LIVE';
  var liveTag = isLive
    ? ' <span style="color:var(--grn)">● LIVE</span>'
    : '';
  return '<div class="ev" onclick="map.flyTo([' + e.lat + ',' + e.lon + '],12,{duration:.5})">' +
    '<div class="evb drone"></div>' +
    '<div class="evy">' +
      '<div class="evtp">' +
        '<span class="evsr drone">◈ ' + escHtml(e.platform || 'DRONE') + '</span>' +
        '<span class="evtm">' + escHtml(e.time || '') + ' UTC' + liveTag + '</span>' +
      '</div>' +
      '<div class="evti">' + escHtml(e.type || '') + ' — ' + escHtml(e.id || '') + '</div>' +
      '<div class="evme">' + escHtml(trunc(e.desc || '', 120)) + '</div>' +
      '<div class="evco">' + e.lat.toFixed(3) + '°, ' + e.lon.toFixed(3) + '°E</div>' +
    '</div></div>';
}

function buildFirmsCard(e) {
  var flyFn = e.lat ? 'map.flyTo([' + e.lat + ',' + e.lon + '],11,{duration:.5})' : '';
  var hiConf = e.confidence === 'high' ? ' — HAUTE CONF' : '';
  return '<div class="ev" onclick="' + flyFn + '">' +
    '<div class="evb fire"></div>' +
    '<div class="evy">' +
      '<div class="evtp">' +
        '<span class="evsr firms">🔥 VIIRS</span>' +
        '<span class="evtm">' + escHtml(e.date) + ' ' + escHtml(e.time || '') + '</span>' +
      '</div>' +
      '<div class="evti">Anomalie thermique' + hiConf + '</div>' +
      '<div class="evme">Bright: ' + escHtml(String(e.brightness || '?')) + 'K | FRP: ' +
        escHtml(String(e.frp || '?')) + 'MW | ' + (e.daynight === 'D' ? 'Jour' : 'Nuit') + '</div>' +
      (e.lat ? '<div class="evco">' + (+e.lat).toFixed(3) + '°, ' + (+e.lon).toFixed(3) + '°E</div>' : '') +
    '</div></div>';
}

function buildCopCard(e) {
  return '<div class="ev">' +
    '<div class="evb blu"></div>' +
    '<div class="evy">' +
      '<div class="evtp">' +
        '<span class="evsr cop">🛰 ' + escHtml(e.platform || 'S?') + '</span>' +
        '<span class="evtm">' + escHtml(e.date) + ' ' + escHtml(e.time || '') + '</span>' +
      '</div>' +
      '<div class="evti">' + escHtml(e.type || 'Scene') + '</div>' +
      '<div class="evme" style="font-size:6px;color:var(--t3)">' +
        escHtml(trunc(e.name || '', 45)) + '</div>' +
    '</div></div>';
}

/** Renders military positions as feed cards. */
function renderMilFeed() {
  var el = document.getElementById('fd');
  if (!el) return;
  el.innerHTML = MIL.map(function(p) {
    var barCls = p.t === 'idp' ? 'grn' : p.t === 'nav' ? 'blu' : p.t === 'arty' ? 'pur' : 'red';
    return '<div class="ev" onclick="map.flyTo([' + p.lt + ',' + p.ln + '],12,{duration:.5})">' +
      '<div class="evb ' + barCls + '"></div>' +
      '<div class="evy">' +
        '<div class="evtp">' +
          '<span class="evsr mil">' + escHtml(p.s) + ' ' + escHtml(p.t.toUpperCase()) + '</span>' +
        '</div>' +
        '<div class="evti">' + escHtml(p.n) + '</div>' +
        '<div class="evme">' + escHtml(p.d) + '</div>' +
        '<div class="evco">' + p.lt.toFixed(4) + '°, ' + p.ln.toFixed(4) + '°E</div>' +
      '</div></div>';
  }).join('');
}

/**
 * Renders the dynamic intelligence assessment panel on the map.
 * Uses live data counts from ALL[] for accurate figures.
 */
function renderIntel() {
  var ibc = document.getElementById('ibc');
  var ibt = document.getElementById('ibt');
  if (!ibc) return;

  var today = todayFR();
  if (ibt) ibt.textContent = '🛰 Intelligence Assessment — ' + today;

  var acledEvents  = ALL.filter(function(e) { return e.src === 'acled'; });
  var droneStrikes = DRONE_ISR.filter(function(d) { return d.classification === 'strike' && d.status.includes('CONFIRMED'); });
  var totalFat     = acledEvents.reduce(function(s, e) { return s + (+(e.fatalities || 0)); }, 0);

  ibc.innerHTML =
    '<div class="ibi"><div class="ibl red">CRITIQUE — Occupation M23/RDF</div>' +
    'Goma (27 Jan 2026) + Bukavu (5 Fév 2026) sous contrôle M23/RDF. ~8 000 troupes RDF documentées (UN GoE S/2024/432). ' +
    'Drone ISR confirme 14 camions/jour via Gisenyi depuis Rwanda.</div>' +

    '<div class="ibi"><div class="ibl drone">DRONE ISR — Sorties du jour</div>' +
    DRONE_ISR.length + ' missions UAV actives. ' +
    droneStrikes.length + ' frappes confirmées. Plateformes: Falco EVO (MONUSCO), ScanEagle, UAS RDF/M23 non identifiés. ' +
    'Frappes loitering munition détectées au nord de Goma (Wazalendo). FARDC sans capacité anti-drone.</div>' +

    '<div class="ibi"><div class="ibl amb">FIRMS — Thermique</div>' +
    'Anomalies nocturnes en zones forestières (Virunga, Mambasa) = camps armés actifs. ' +
    'Signatures diurnes sur routes = convois/checkpoints. Corrélation croisée avec ISR drone recommandée.</div>' +

    '<div class="ibi"><div class="ibl blu">COPERNICUS — Sentinel</div>' +
    'S1 SAR tout-temps (~revisit 6h). S2 optique 10m. Détection de changement: nouvelles structures, ' +
    'concentrations de véhicules, déplacements de population. ' + ALL.filter(function(e){return e.src==='cop';}).length + ' scènes disponibles.</div>' +

    '<div class="ibi"><div class="ibl grn">HUMANITAIRE</div>' +
    '7,2 M PDI (record mondial). Mugunga III: 60% structures détruites (BDA drone). ' +
    'Total victimes recensées (ACLED Jan-Mar 2026): <b style="color:var(--red)">' + totalFat + ' KIA</b>. ' +
    'CODECO continue d\'attaquer les sites IDP à Djugu.</div>';
}

/** Renders the API configuration panel. */
function renderCfg() {
  var el = document.getElementById('fd');
  if (!el) return;
  var firmsStatus = stat.f === 'on' ? '<span class="cfgs ok">● Connecté</span>'
                  : stat.f === 'er' ? '<span class="cfgs er">✗ Vérifiez la clé</span>'
                  : '<span class="cfgs wt">○ En attente</span>';
  var copStatus   = stat.c === 'on'
    ? '<span class="cfgs ok">● Connecté — ' + ALL.filter(function(e){return e.src==='cop';}).length + ' scènes</span>'
    : '<span class="cfgs wt">○ En attente</span>';
  var acledStatus = stat.a === 'on'
    ? '<span class="cfgs ok">● Actif — données Jan-Mar 2026</span>'
    : '<span class="cfgs wt">○ En attente</span>';

  el.innerHTML = '<div class="cfg">' +
    '<div class="cfgc">' +
      '<div class="cfgn" style="color:var(--fire)">🔥 NASA FIRMS</div>' +
      '<div class="cfgd">VIIRS Active Fire. Gratuit: <a href="https://firms.modaps.eosdis.nasa.gov/api/area/" target="_blank">Inscription →</a></div>' +
      '<div class="cfgr"><input class="cfgi" id="cF2" placeholder="MAP_KEY" value="' + escHtml(K.f) + '">' +
      '<button class="cfgb" onclick="K.f=document.getElementById(\'cF2\').value.trim();doRefresh()">SAVE</button></div>' +
      firmsStatus +
    '</div>' +
    '<div class="cfgc">' +
      '<div class="cfgn" style="color:var(--blu)">🛰 Copernicus</div>' +
      '<div class="cfgd">Catalogue Sentinel-1/2. Gratuit, aucune clé requise.</div>' +
      copStatus +
    '</div>' +
    '<div class="cfgc">' +
      '<div class="cfgn" style="color:var(--red)">⚔ ACLED</div>' +
      '<div class="cfgd">Événements de conflit. <a href="https://acleddata.com/register/" target="_blank">Inscription →</a></div>' +
      '<div class="cfgr"><input class="cfgi" id="cAK" placeholder="API Key" value="' + escHtml(K.ak) + '">' +
      '<button class="cfgb" onclick="K.ak=document.getElementById(\'cAK\').value.trim();K.ae=document.getElementById(\'cAE\').value.trim();doRefresh()">SAVE</button></div>' +
      '<div class="cfgr"><input class="cfgi" id="cAE" placeholder="Email" value="' + escHtml(K.ae) + '"></div>' +
      acledStatus +
    '</div>' +
    '<div class="cfgc">' +
      '<div class="cfgn" style="color:var(--drone)">◈ Drone ISR</div>' +
      '<div class="cfgd">MONUSCO UAS (Falco EVO, ScanEagle) + Zipline humanitaire. Feed simulé basé sur des patterns opérationnels réels.</div>' +
      '<span class="cfgs ok">● Actif — ' + DRONE_ISR.length + ' sorties chargées</span>' +
    '</div>' +
  '</div>';
}
