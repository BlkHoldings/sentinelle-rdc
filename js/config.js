/* ═══════════════════════════════════════════════════════════
   SENTINELLE-RDC — Application Configuration
   ═══════════════════════════════════════════════════════════ */

var CFG = {
  REFRESH_SEC:        180,          // auto-refresh interval
  MAX_FEED:           150,          // maximum events rendered in feed
  MAP_CENTER:         [-1.2, 28.8], // eastern DRC, Lake Kivu region
  MAP_ZOOM:           8,
  SESSION_DURATION_MS: 24 * 60 * 60 * 1000, // 24h
  LOGIN_MAX_ATTEMPTS: 5,
  LOGIN_LOCKOUT_SEC:  30,
  ACLED_DAYS_BACK:    90,           // how far back to query ACLED

  // Copernicus OData bounding box (eastern DRC): W,S,E,N
  COP_BBOX: [27, -5, 31, 3],

  // NASA FIRMS API — CORS proxy fallback chain
  firmsUrls: function(key) {
    var base = 'https://firms.modaps.eosdis.nasa.gov/api/country/csv/' + key + '/VIIRS_SNPP_NRT/COD/2';
    return [
      base,
      'https://corsproxy.io/?url=' + encodeURIComponent(base),
      'https://api.allorigins.win/raw?url=' + encodeURIComponent(base)
    ];
  }
};
