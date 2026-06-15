// ── State ─────────────────────────────────────────────────────────────────────
const state = {
  conflicts: [],
  filteredConflicts: [],
  news: [],
  selectedId: null,
  map: null,
  clusterLayer: null,
  markers: {},
};

// ── Init ──────────────────────────────────────────────────────────────────────
async function init() {
  initMap();
  await Promise.allSettled([loadConflicts(), loadNews()]);
  document.getElementById('last-updated').textContent =
    'Updated ' + new Date().toLocaleTimeString();
}

// ── Map Setup ─────────────────────────────────────────────────────────────────
function initMap() {
  state.map = L.map('map', {
    center: [20, 10],
    zoom: 2,
    minZoom: 2,
    maxZoom: 10,
    zoomControl: true,
  });

  // CartoDB Dark Matter tiles (free, no API key)
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 19,
  }).addTo(state.map);

  state.clusterLayer = L.markerClusterGroup({
    showCoverageOnHover: false,
    maxClusterRadius: 40,
    iconCreateFunction(cluster) {
      const count = cluster.getChildCount();
      return L.divIcon({
        html: `<div class="cluster-inner">${count}</div>`,
        className: 'conflict-cluster',
        iconSize: L.point(36, 36),
      });
    },
  });

  state.map.addLayer(state.clusterLayer);
}

// ── Load Conflicts ────────────────────────────────────────────────────────────
async function loadConflicts() {
  try {
    const res = await fetch('/api/conflicts');
    const json = await res.json();

    state.conflicts = json.conflicts || [];
    state.filteredConflicts = [...state.conflicts];

    renderStats(json.stats);
    renderMap(state.conflicts);
    renderTable(state.filteredConflicts);
  } catch (err) {
    console.error('Failed to load conflicts:', err);
  }
}

// ── Stats ─────────────────────────────────────────────────────────────────────
function renderStats(stats) {
  if (!stats) return;
  document.getElementById('stat-total').textContent = stats.total || 0;
  document.getElementById('stat-critical').textContent = stats.byIntensity?.critical || 0;
  document.getElementById('stat-high').textContent = stats.byIntensity?.high || 0;
  document.getElementById('stat-regions').textContent = stats.regionsAffected || 0;
  document.getElementById('stat-africa').textContent = stats.byRegion?.Africa || 0;
  document.getElementById('stat-middle-east').textContent = stats.byRegion?.['Middle East'] || 0;
}

// ── Map Rendering ─────────────────────────────────────────────────────────────
function renderMap(conflicts) {
  state.clusterLayer.clearLayers();
  state.markers = {};

  conflicts.forEach(conflict => {
    const icon = L.divIcon({
      html: `<div class="conflict-marker ${conflict.intensity}"></div>`,
      className: '',
      iconSize: L.point(14, 14),
      iconAnchor: L.point(7, 7),
    });

    const marker = L.marker([conflict.lat, conflict.lng], { icon });

    marker.bindPopup(`
      <h4>${conflict.name}</h4>
      <p>${conflict.region} &bull; ${capitalise(conflict.intensity)} intensity</p>
    `, { maxWidth: 200, closeButton: false });

    marker.on('click', () => {
      openConflictDetail(conflict.id);
      marker.openPopup();
    });

    state.markers[conflict.id] = marker;
    state.clusterLayer.addLayer(marker);
  });
}

// ── Conflict Table ────────────────────────────────────────────────────────────
function renderTable(conflicts) {
  const tbody = document.getElementById('conflicts-tbody');

  if (!conflicts.length) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:32px;color:var(--text-muted)">No conflicts match the current filters.</td></tr>`;
    return;
  }

  tbody.innerHTML = conflicts.map(c => `
    <tr onclick="openConflictDetail('${c.id}')" data-id="${c.id}">
      <td style="font-weight:500">${c.name}</td>
      <td>${c.region}</td>
      <td><span class="type-badge">${c.type}</span></td>
      <td><span class="badge ${c.intensity}">${c.intensity}</span></td>
      <td style="color:var(--text-muted)">${formatDate(c.started)}</td>
      <td style="color:var(--critical);font-weight:500">${c.casualties.estimate}</td>
      <td>
        <button class="table-focus-btn" onclick="event.stopPropagation(); focusMapOn('${c.id}')">
          &#128269; Map
        </button>
      </td>
    </tr>
  `).join('');
}

// ── Detail Panel ──────────────────────────────────────────────────────────────
function openConflictDetail(id) {
  const conflict = state.conflicts.find(c => c.id === id);
  if (!conflict) return;

  state.selectedId = id;

  // Update table highlight
  document.querySelectorAll('#conflicts-tbody tr').forEach(tr => {
    tr.classList.toggle('active-row', tr.dataset.id === id);
  });

  // Populate panel
  document.getElementById('detail-empty').style.display = 'none';
  const content = document.getElementById('detail-content');
  content.style.display = 'flex';

  document.getElementById('detail-name').textContent = conflict.name;
  document.getElementById('detail-meta').textContent =
    `${conflict.countries.join(' · ')}`;

  const badge = document.getElementById('detail-intensity-badge');
  badge.textContent = capitalise(conflict.intensity);
  badge.className = `detail-badge ${conflict.intensity}`;

  document.getElementById('detail-region').textContent = conflict.region;
  document.getElementById('detail-type').textContent = capitalise(conflict.type);
  document.getElementById('detail-started').textContent = formatDateFull(conflict.started);
  document.getElementById('detail-countries').textContent = conflict.countries.join(', ');
  document.getElementById('detail-casualties').textContent =
    `${conflict.casualties.estimate} — ${conflict.casualties.source}`;

  document.getElementById('detail-description').textContent = conflict.description;

  document.getElementById('detail-tags').innerHTML =
    (conflict.tags || []).map(t => `<span class="detail-tag">#${t}</span>`).join('');

  // Reset AI box
  document.getElementById('detail-ai-box').style.display = 'none';
  document.getElementById('detail-ai-text').textContent = '';
  const btnAnalyze = document.getElementById('btn-analyze');
  btnAnalyze.disabled = false;
  btnAnalyze.textContent = '🤖 AI Situation Assessment';
}

function focusMapOn(id) {
  const conflict = state.conflicts.find(c => c.id === id);
  if (!conflict) return;
  state.map.flyTo([conflict.lat, conflict.lng], 5, { duration: 1.2 });
  openConflictDetail(id);
  const marker = state.markers[id];
  if (marker) {
    state.clusterLayer.zoomToShowLayer(marker, () => marker.openPopup());
  }
}

// ── Filters ───────────────────────────────────────────────────────────────────
function filterConflicts() {
  const region    = document.getElementById('filter-region').value;
  const intensity = document.getElementById('filter-intensity').value;
  const type      = document.getElementById('filter-type').value;

  state.filteredConflicts = state.conflicts.filter(c => {
    return (!region    || c.region    === region)
        && (!intensity || c.intensity === intensity)
        && (!type      || c.type      === type);
  });

  renderTable(state.filteredConflicts);

  // Show only matching markers on the map
  state.clusterLayer.clearLayers();
  state.filteredConflicts.forEach(c => {
    if (state.markers[c.id]) state.clusterLayer.addLayer(state.markers[c.id]);
  });
}

// ── AI: Conflict Analysis ─────────────────────────────────────────────────────
async function analyzeConflict() {
  if (!state.selectedId) return;
  const btn = document.getElementById('btn-analyze');
  btn.disabled = true;
  btn.textContent = '⏳ Analyzing…';

  try {
    const res = await fetch('/api/conflict-analysis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conflictId: state.selectedId }),
    });
    const json = await res.json();

    const aiBox = document.getElementById('detail-ai-box');
    document.getElementById('detail-ai-text').textContent = json.analysis || json.error;
    aiBox.style.display = 'block';

    btn.style.display = 'none';
  } catch (err) {
    btn.disabled = false;
    btn.textContent = '🤖 AI Situation Assessment';
    console.error('Analysis failed:', err);
  }
}

// ── AI: Global Briefing ───────────────────────────────────────────────────────
async function generateBriefing() {
  const btn = document.getElementById('btn-briefing');
  btn.disabled = true;
  btn.textContent = '⏳ Generating…';

  document.getElementById('modal-overlay').classList.add('open');
  document.getElementById('modal-briefing').classList.add('open');
  document.getElementById('briefing-spinner').style.display = 'block';
  document.getElementById('briefing-text').style.display = 'none';
  document.getElementById('briefing-timestamp').textContent = '';

  try {
    const res = await fetch('/api/generate-briefing', { method: 'POST' });
    const json = await res.json();

    document.getElementById('briefing-spinner').style.display = 'none';
    const textEl = document.getElementById('briefing-text');
    textEl.innerHTML = `<div class="ai-label">🤖 AI Global Briefing</div><p>${escapeHtml(json.briefing || json.error)}</p>`;
    textEl.style.display = 'block';

    if (json.generatedAt) {
      document.getElementById('briefing-timestamp').textContent =
        'Generated ' + new Date(json.generatedAt).toLocaleString();
    }
  } catch (err) {
    document.getElementById('briefing-spinner').style.display = 'none';
    document.getElementById('briefing-text').innerHTML =
      `<div class="ai-label" style="color:var(--critical)">Error</div><p>${err.message}</p>`;
    document.getElementById('briefing-text').style.display = 'block';
  } finally {
    btn.disabled = false;
    btn.textContent = '⚙ Generate Global Briefing';
  }
}

function closeBriefing() {
  document.getElementById('modal-overlay').classList.remove('open');
  document.getElementById('modal-briefing').classList.remove('open');
}

// ── News ──────────────────────────────────────────────────────────────────────
async function loadNews() {
  try {
    const res = await fetch('/api/conflict-news');
    const json = await res.json();
    state.news = json.articles || [];
    renderNews(state.news);
  } catch (err) {
    console.error('News load failed:', err);
  }
}

const REGION_ORDER = ['Europe', 'Middle East', 'Africa', 'Asia', 'Americas', 'Global'];

function renderNews(articles) {
  const container = document.getElementById('news-grid');
  if (!articles.length) {
    container.innerHTML = `<div style="padding:24px;color:var(--text-muted)">No news articles available.</div>`;
    return;
  }

  // Group by region, preserving display order
  const groups = {};
  REGION_ORDER.forEach(r => { groups[r] = []; });
  articles.forEach(a => {
    const r = a.region || 'Global';
    if (!groups[r]) groups[r] = [];
    groups[r].push(a);
  });

  container.innerHTML = REGION_ORDER
    .filter(r => groups[r].length > 0)
    .map(r => `
      <div class="news-region-section">
        <div class="news-region-header">
          <span class="news-region-label">${r}</span>
          <span class="news-region-count">${groups[r].length} article${groups[r].length !== 1 ? 's' : ''}</span>
        </div>
        <div class="news-region-grid">
          ${groups[r].map(a => `
            <div class="news-card">
              <div class="news-card-title">
                <a href="${a.url}" target="_blank" rel="noopener">${escapeHtml(a.title)}</a>
              </div>
              ${a.summary ? `<div class="news-card-summary">${escapeHtml(truncate(a.summary, 120))}</div>` : ''}
              <div class="news-card-meta">
                <span class="news-card-time">${relativeTime(a.publishedAt)}</span>
                ${a.byline ? `<span>· ${escapeHtml(a.byline)}</span>` : ''}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `).join('');
}

// ── Auto-Refresh ──────────────────────────────────────────────────────────────
setInterval(() => {
  loadConflicts();
  loadNews();
  document.getElementById('last-updated').textContent =
    'Updated ' + new Date().toLocaleTimeString();
}, 5 * 60 * 1000);

// ── Utilities ─────────────────────────────────────────────────────────────────
function capitalise(str) {
  return str ? str.charAt(0).toUpperCase() + str.slice(1) : '';
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
}

function formatDateFull(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function relativeTime(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function truncate(str, n) {
  return str.length > n ? str.slice(0, n) + '…' : str;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(str || ''));
  return div.innerHTML;
}

// ── Boot ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', init);
