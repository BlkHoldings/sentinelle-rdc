# SENTINELLE-RDC — Live Military Monitor

Satellite-based border monitoring platform for the DRC with real-time data from NASA FIRMS, Copernicus, and ACLED.

## Live Access

**URL:** https://blkholdings.github.io/sentinelle-rdc/

### Credentials

| ID | Key | Level |
|----|-----|-------|
| `deepq` | `sentinelle2026` | Analyst |
| `gedeon` | `deepq-admin` | Commander |
| `fardc-cmd` | `goma-secure` | Commander |
| `monusco` | `un-force-2026` | Operator |

## Real-Time Data Sources

- **NASA FIRMS** — VIIRS active fire/thermal data for DRC (free key: [register here](https://firms.modaps.eosdis.nasa.gov/api/area/))
- **Copernicus DataSpace** — Sentinel-1 SAR & Sentinel-2 MSI scenes (no key needed)
- **ACLED** — Armed conflict events (free key: [register here](https://acleddata.com/register/))

## Files

```
index.html   — Login portal
monitor.html — Live monitor with map & API feeds
```

Built by [DeepQ](https://deepq.io) — AI for Security & Trust
