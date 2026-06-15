# CLAUDE.md — Global Conflict Monitor

## Commands

```bash
npm start        # production
npm run dev      # development with auto-reload (nodemon)
```

Port: **3001** (to avoid clash with market-dashboard on 3000).

To kill a stuck server on Windows:
```bash
netstat -ano | grep ":3001 "
taskkill //F //PID <PID>
```

## Environment

Copy `.env.example` to `.env`:

| Variable | Source |
|---|---|
| `GROQ_API_KEY` | console.groq.com — AI briefings and conflict analysis |
| `GUARDIAN_API_KEY` | open-platform.theguardian.com — conflict news feed |
| `PORT` | Default 3001 |

## Architecture

Single-file Express backend (`server.js`) + vanilla JS frontend (`public/`). No build step.

**Data flow:**

| Section | Source | Cache TTL |
|---|---|---|
| Conflicts list | Static `CONFLICTS` array in server.js | 3600s |
| Stats | Derived from CONFLICTS at request time | 3600s |
| Conflict news | Guardian API (world section, conflict keywords) | 1800s |
| AI briefing | Groq llama-3.3-70b-versatile | Not cached |
| AI analysis | Groq llama-3.3-70b-versatile | Not cached |

**Map:** Leaflet.js 1.9 + CartoDB Dark Matter tiles (no API key needed) + Leaflet.MarkerCluster. All via CDN.

## Updating Conflict Data

The `CONFLICTS` array in `server.js` (lines ~14–250) is the source of truth. Each entry has:
- `id`, `name`, `region`, `countries`, `type`, `intensity`
- `started` (ISO date), `lat`, `lng` (map position)
- `description`, `casualties`, `tags`, `status`, `lastUpdated`

Intensity levels: `critical | high | medium | low` — controls marker color and pulsing animation.

To add a new conflict: add an entry to the array and restart the server (cache clears on restart).

## Key Config

`CONFLICTS` in server.js — manually maintained. Update `intensity`, `description`, `casualties`, and `lastUpdated` as situations evolve.
