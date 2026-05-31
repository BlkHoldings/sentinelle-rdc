# SENTINELLE-RDC

> Système de surveillance en temps réel — Est de la République Démocratique du Congo

C2 intelligence dashboard integrating real-time satellite imagery, drone ISR, and conflict event data for eastern DRC monitoring. Built for humanitarian and peacekeeping intelligence analysis.

**Live:** https://blkholdings.github.io/sentinelle-rdc/

---

## Features

| Feature | Description |
|---------|-------------|
| **ACLED Integration** | Armed conflict events via ACLED API (Jan–present) |
| **NASA FIRMS** | VIIRS active fire / thermal anomaly detection |
| **Copernicus Sentinel** | S1 SAR + S2 optical scene catalog (72h window) |
| **Drone ISR** | MONUSCO UAV sorties, drone strikes, BDA |
| **Tactical Feed** | Searchable, filterable, exportable event stream |
| **CSV Export** | One-click export of current filtered view |
| **Live Map** | Leaflet map with 9 overlay layers and heatmap |
| **Intel Assessment** | Dynamic assessment panel updated on each refresh |
| **Auto-refresh** | Configurable polling (default: 3-minute cycle) |
| **Login rate-limiting** | 5 failed attempts → 30-second lockout |

---

## Quick Start

The project is a static website — no build step required.

```bash
# Serve locally (any static server works)
npx serve .
# or
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

### Demo credentials

| Identifier | Key | Level |
|------------|-----|-------|
| `deepq` | `sentinelle2026` | Analyst |
| `gbk-ops` | `kivu-watch` | Operator |
| `gedeon` | `deepq-admin` | Commander |
| `monusco` | `un-force-2026` | Operator |
| `fardc-cmd` | `goma-secure` | Commander |

---

## API Keys

All APIs are optional. Without keys, the application loads a verified static dataset (Jan–Mar 2026).

### NASA FIRMS (thermal anomalies)
1. Register at https://firms.modaps.eosdis.nasa.gov/api/area/
2. Copy your MAP_KEY
3. Open the dashboard → ⚙ tab → paste under **NASA FIRMS** → SAVE

### ACLED (conflict events)
1. Register at https://acleddata.com/register/
2. Copy your API key and email
3. Open the dashboard → ⚙ tab → paste under **ACLED** → SAVE

### Copernicus (Sentinel imagery)
No key required. The catalog API is public.

---

## Project Structure

```
sentinelle-rdc/
├── index.html          # Login portal
├── monitor.html        # C2 dashboard
├── css/
│   ├── base.css        # Design tokens, resets, toast styles
│   ├── login.css       # Login page styles
│   └── monitor.css     # Dashboard styles
├── js/
│   ├── config.js       # Application constants
│   ├── utils.js        # escHtml, parseCSV, exportCSV, date helpers
│   ├── toast.js        # Toast notification system
│   ├── data.js         # Static data: DRONE_ISR, MIL, ACLED fallback
│   ├── api.js          # FIRMS, Copernicus, ACLED API clients
│   ├── map.js          # Leaflet map, layers, markers
│   ├── feed.js         # Tactical feed & intel panel rendering
│   ├── monitor.js      # Main app controller (refresh, search, export)
│   └── auth.js         # Authentication with rate-limiting
└── .github/
    └── workflows/
        └── deploy.yml  # GitHub Pages CI/CD pipeline
```

---

## Data Sources

| Source | Coverage | Update frequency |
|--------|----------|-----------------|
| [NASA FIRMS](https://firms.modaps.eosdis.nasa.gov/) | DRC thermal anomalies | ~3h (satellite pass) |
| [Copernicus DataSpace](https://dataspace.copernicus.eu/) | Sentinel-1/2 scenes, eastern DRC | 6h revisit |
| [ACLED](https://acleddata.com/) | Armed conflict events, DRC (ISO 180) | Daily |
| Drone ISR | MONUSCO UAV ops (simulated feed) | Static / session |
| Military positions | UN GoE reports, OSINT | Static / updated per release |

---

## Security Notes

This application uses **client-side authentication only**, suitable for:
- Demo and training environments
- Access-controlled intranet deployments
- Development and testing

For production deployments requiring real access control, implement server-side authentication (OAuth2, JWT, LDAP) before exposing to untrusted networks.

Current client-side security mitigations:
- Login rate-limiting: 5 failed attempts → 30-second lockout
- 24-hour session expiry with auto-logout
- XSS prevention: all external API data is HTML-escaped via `escHtml()` before DOM insertion
- No credentials stored in localStorage (API keys only)

---

## Deployment

Push to `main` → GitHub Actions validates HTML/JS → deploys to GitHub Pages automatically.

Manual deploy:
```bash
git push origin main
```

See `.github/workflows/deploy.yml` for the full pipeline.

---

## Coverage Area

Eastern DRC focus: North Kivu, South Kivu, Ituri provinces.  
Key locations monitored: Goma, Bukavu, Beni, Bunia, Rutshuru, Masisi, Uvira, Kasindi.

---

## Context

Built for intelligence analysis support in the context of the M23/RDF occupation of Goma (27 Jan 2026) and Bukavu (5 Feb 2026), ongoing ADF-ISCAP insurgency in Beni territory, and CODECO militia activity in Djugu (Ituri).

Data reflects conflict dynamics documented by MONUSCO, OCHA, ACLED, HRW, and the UN Group of Experts.

---

*DeepQ Intelligence Division — CONFIDENTIEL DÉFENSE*
