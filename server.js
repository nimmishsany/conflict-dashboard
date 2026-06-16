require('dotenv').config();
const express = require('express');
const axios = require('axios');
const NodeCache = require('node-cache');
const Groq = require('groq-sdk');

const app = express();
const cache = new NodeCache({ stdTTL: 300 });
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

app.use(express.json());
app.use(express.static('public'));

// ─── Conflict Dataset ────────────────────────────────────────────────────────

const CONFLICTS = [
  {
    id: 'russia-ukraine',
    name: 'Russia-Ukraine War',
    region: 'Europe',
    countries: ['Russia', 'Ukraine'],
    type: 'interstate',
    intensity: 'critical',
    started: '2022-02-24',
    lat: 49.4, lng: 31.2,
    description: 'Full-scale Russian invasion of Ukraine launched on 24 February 2022. The largest conventional war in Europe since World War II. Russia continues striking civilian and cultural infrastructure — including the deliberate targeting of the UNESCO-listed Pechersk Lavra monastery in Kyiv in June 2026. G7 allies are pushing for a negotiated peace at their June 2026 summit in France, though no ceasefire has been agreed.',
    casualties: { estimate: '500,000+', source: 'UN/media estimates (military + civilian combined)' },
    status: 'active',
    tags: ['nato', 'nuclear-risk', 'territorial', 'europe', 'g7-peace-push'],
    lastUpdated: '2026-06-16'
  },
  {
    id: 'gaza-israel',
    name: 'Gaza–Israel War',
    region: 'Middle East',
    countries: ['Israel', 'Palestine (Hamas)', 'Lebanon (Hezbollah)'],
    type: 'interstate',
    intensity: 'critical',
    started: '2023-10-07',
    lat: 31.5, lng: 34.5,
    description: 'Conflict sparked by Hamas attacks on Israel on 7 October 2023. Israeli military operations in Gaza have caused massive destruction with tens of thousands of civilian casualties. Concerns are mounting that thousands of bodies remain buried under rubble and may never be recovered. The broader regional picture has shifted following the signed US-Iran ceasefire deal, though Gaza operations continue independently of that agreement.',
    casualties: { estimate: '45,000+ (Gaza civilian)', source: 'Gaza Health Ministry / UN' },
    status: 'active',
    tags: ['humanitarian', 'middle-east', 'occupation', 'blockade', 'rubble-crisis'],
    lastUpdated: '2026-06-16'
  },
  {
    id: 'sudan-civil-war',
    name: 'Sudan Civil War',
    region: 'Africa',
    countries: ['Sudan (SAF)', 'Sudan (RSF)'],
    type: 'civil',
    intensity: 'critical',
    started: '2023-04-15',
    lat: 15.5, lng: 32.5,
    description: 'Armed conflict between the Sudanese Armed Forces (SAF) and the paramilitary Rapid Support Forces (RSF), erupting in April 2023. Has triggered one of the world\'s largest humanitarian crises with millions displaced.',
    casualties: { estimate: '150,000+', source: 'UN/ACLED estimates' },
    status: 'active',
    tags: ['humanitarian', 'famine', 'displacement', 'africa'],
    lastUpdated: '2026-06-01'
  },
  {
    id: 'myanmar-civil-war',
    name: 'Myanmar Civil War',
    region: 'Asia',
    countries: ['Myanmar (Military Junta)', 'Resistance Forces (PDFs/EAOs)'],
    type: 'civil',
    intensity: 'high',
    started: '2021-02-01',
    lat: 19.7, lng: 96.1,
    description: 'Civil war following the February 2021 military coup. Pro-democracy People\'s Defence Forces (PDFs) and ethnic armed organizations fight the Tatmadaw across multiple fronts. Resistance forces have made significant territorial gains.',
    casualties: { estimate: '50,000+', source: 'Assistance Association for Political Prisoners' },
    status: 'active',
    tags: ['coup', 'humanitarian', 'southeast-asia', 'ethnic-conflict'],
    lastUpdated: '2026-06-01'
  },
  {
    id: 'yemen-conflict',
    name: 'Yemen War / Houthi Conflict',
    region: 'Middle East',
    countries: ['Yemen (Houthis)', 'Yemen (Government/STC)', 'Saudi Arabia', 'US/UK'],
    type: 'hybrid',
    intensity: 'high',
    started: '2015-03-26',
    lat: 15.3, lng: 44.2,
    description: 'Long-running civil war with Saudi-led coalition intervention. Houthi forces control much of northern Yemen and have conducted drone/missile attacks on Saudi Arabia and Red Sea shipping, drawing US/UK strikes in 2024.',
    casualties: { estimate: '150,000+', source: 'ACLED (includes famine deaths)' },
    status: 'active',
    tags: ['proxy-war', 'shipping', 'red-sea', 'humanitarian', 'iran-backed'],
    lastUpdated: '2026-06-01'
  },
  {
    id: 'drc-conflict',
    name: 'DRC / M23 Conflict',
    region: 'Africa',
    countries: ['DR Congo (FARDC)', 'M23 Rebels', 'Rwanda'],
    type: 'hybrid',
    intensity: 'high',
    started: '2022-11-01',
    lat: -1.7, lng: 29.2,
    description: 'Renewed M23 rebel offensive in eastern DRC with alleged Rwandan military backing. M23 captured Goma and Bukavu in early 2025, triggering regional diplomatic crisis and massive displacement.',
    casualties: { estimate: '7,000,000 displaced', source: 'UNHCR 2025' },
    status: 'active',
    tags: ['africa', 'proxy', 'minerals', 'displacement', 'humanitarian'],
    lastUpdated: '2026-06-01'
  },
  {
    id: 'haiti-gang-war',
    name: 'Haiti Gang War',
    region: 'Americas',
    countries: ['Haiti'],
    type: 'civil',
    intensity: 'high',
    started: '2021-07-01',
    lat: 18.9, lng: -72.3,
    description: 'Armed gangs, particularly the G9 and Viv Ansanm coalition, control large swaths of Port-au-Prince. State collapse accelerated after assassination of President Moïse in 2021. A Kenyan-led multinational security support mission deployed in 2024.',
    casualties: { estimate: '5,000+ (2023–2025)', source: 'UN Integrated Office in Haiti' },
    status: 'active',
    tags: ['state-collapse', 'americas', 'humanitarian', 'gang-violence'],
    lastUpdated: '2026-06-01'
  },
  {
    id: 'ethiopia-conflict',
    name: 'Ethiopia Internal Conflicts',
    region: 'Africa',
    countries: ['Ethiopia (ENDF)', 'Amhara Fano', 'OLA (Oromo)'],
    type: 'civil',
    intensity: 'high',
    started: '2023-04-01',
    lat: 9.0, lng: 38.7,
    description: 'Following the Tigray peace deal (Nov 2022), new insurgencies erupted in Amhara and Oromia regions. Fano militias fight federal forces in Amhara while OLA (Oromo Liberation Army) continues operations in Oromia.',
    casualties: { estimate: '10,000+ (2023–2025)', source: 'ACLED / media estimates' },
    status: 'active',
    tags: ['africa', 'post-tigray', 'amhara', 'oromo', 'humanitarian'],
    lastUpdated: '2026-06-01'
  },
  {
    id: 'mali-insurgency',
    name: 'Mali / Sahel Jihadist Insurgency',
    region: 'Africa',
    countries: ['Mali (Junta/Wagner)', 'JNIM', 'ISGS'],
    type: 'insurgency',
    intensity: 'medium',
    started: '2012-01-01',
    lat: 17.6, lng: -4.0,
    description: 'Jihadist insurgency by JNIM (al-Qaeda affiliate) and ISGS (ISIS) across the Sahel. Mali expelled French/UN forces in 2022 and relies on Russian Wagner mercenaries. Violence continues to spread into Burkina Faso and Niger.',
    casualties: { estimate: '40,000+ (2012–2025)', source: 'ACLED' },
    status: 'active',
    tags: ['sahel', 'jihadist', 'al-qaeda', 'wagner', 'france-withdrawal'],
    lastUpdated: '2026-06-01'
  },
  {
    id: 'burkina-faso-insurgency',
    name: 'Burkina Faso Insurgency',
    region: 'Africa',
    countries: ['Burkina Faso (Junta)', 'JNIM', 'ISGS'],
    type: 'insurgency',
    intensity: 'high',
    started: '2015-01-01',
    lat: 12.3, lng: -1.6,
    description: 'Junta-led government (post-2022 coup) faces severe jihadist insurgency. Large swaths of the north and east are under militant control. Government expelled French forces and invited Russian instructors. Humanitarian situation critical.',
    casualties: { estimate: '20,000+ displaced internally', source: 'UNHCR 2025' },
    status: 'active',
    tags: ['sahel', 'jihadist', 'coup', 'humanitarian', 'africa'],
    lastUpdated: '2026-06-01'
  },
  {
    id: 'somalia-al-shabaab',
    name: 'Somalia – Al-Shabaab Insurgency',
    region: 'Africa',
    countries: ['Somalia (Federal Government)', 'Al-Shabaab', 'AU Mission'],
    type: 'insurgency',
    intensity: 'medium',
    started: '2006-01-01',
    lat: 5.1, lng: 46.2,
    description: 'Al-Shabaab (al-Qaeda affiliate) controls rural areas despite 2022–2023 military offensive gains. Regular attacks on government targets and civilians. AU Transition Mission (ATMIS) underway with US airstrikes supporting Somali forces.',
    casualties: { estimate: '5,000+/year', source: 'ACLED / UN Somalia' },
    status: 'active',
    tags: ['al-qaeda', 'horn-of-africa', 'insurgency', 'au-mission'],
    lastUpdated: '2026-06-01'
  },
  {
    id: 'south-sudan',
    name: 'South Sudan Conflict',
    region: 'Africa',
    countries: ['South Sudan (SPLM-IG)', 'SPLM-IO', 'Other factions'],
    type: 'civil',
    intensity: 'medium',
    started: '2013-12-15',
    lat: 6.9, lng: 31.3,
    description: 'Intermittent civil war since 2013, with a fragile peace deal in place. Armed clashes continue between government and opposition forces amid a humanitarian crisis. Inter-communal violence is widespread.',
    casualties: { estimate: '400,000+ (since 2013)', source: 'UN' },
    status: 'active',
    tags: ['africa', 'humanitarian', 'oil', 'ethnic-conflict', 'peace-deal-fragile'],
    lastUpdated: '2026-06-01'
  },
  {
    id: 'mozambique-cabo-delgado',
    name: 'Mozambique – Cabo Delgado',
    region: 'Africa',
    countries: ['Mozambique', 'ISIS-Mozambique (Ansar al-Sunna)', 'SADC Mission', 'Rwanda'],
    type: 'insurgency',
    intensity: 'medium',
    started: '2017-10-05',
    lat: -12.3, lng: 39.8,
    description: 'ISIS-affiliated insurgency in northern Cabo Delgado province. Attacks on civilians and energy infrastructure. Rwandan and SADC forces intervened in 2021. LNG projects (TotalEnergies) remain halted.',
    casualties: { estimate: '5,000+ killed, 1M displaced', source: 'ACLED / UNHCR' },
    status: 'active',
    tags: ['africa', 'isis', 'lng', 'mozambique', 'sadc'],
    lastUpdated: '2026-06-01'
  },
  {
    id: 'cameroon-anglophone',
    name: 'Cameroon Anglophone Crisis',
    region: 'Africa',
    countries: ['Cameroon (Government)', 'Ambazonian Separatists'],
    type: 'civil',
    intensity: 'low',
    started: '2017-10-01',
    lat: 5.9, lng: 10.4,
    description: 'Armed separatist insurgency in English-speaking Northwest and Southwest regions seeking independence as "Ambazonia." Government forces and armed groups both accused of human rights abuses.',
    casualties: { estimate: '6,000+ killed, 700K displaced', source: 'ACLED / Crisis Group' },
    status: 'active',
    tags: ['africa', 'separatism', 'ambazonia', 'cameroon'],
    lastUpdated: '2026-06-01'
  },
  {
    id: 'syria-conflict',
    name: 'Syria (Post-Assad Transition)',
    region: 'Middle East',
    countries: ['Syria (HTS/New Govt)', 'ISIS remnants', 'SDF (Kurds)', 'Turkey'],
    type: 'civil',
    intensity: 'medium',
    started: '2011-03-15',
    lat: 34.8, lng: 38.9,
    description: 'After Assad regime collapsed in December 2024, HTS-led forces formed a transitional government. Ongoing ISIS insurgency in the Syrian desert, Turkish operations against SDF in northeast, and fragile stabilization efforts continue.',
    casualties: { estimate: '500,000+ (since 2011)', source: 'UN' },
    status: 'active',
    tags: ['middle-east', 'isis', 'hts', 'kurds', 'turkey', 'post-war'],
    lastUpdated: '2026-06-01'
  },
  {
    id: 'iraq-isis',
    name: 'Iraq – ISIS Insurgency',
    region: 'Middle East',
    countries: ['Iraq (ISF)', 'ISIS remnants', 'PMF', 'US Coalition'],
    type: 'insurgency',
    intensity: 'low',
    started: '2017-12-09',
    lat: 33.2, lng: 43.7,
    description: 'Following the territorial defeat of ISIS in 2017, an insurgency continues in rural and desert areas of Iraq. ISIS conducts hit-and-run attacks, assassinations and IED attacks, particularly in Kirkuk, Diyala and Anbar provinces.',
    casualties: { estimate: '1,000+/year', source: 'ACLED' },
    status: 'active',
    tags: ['isis', 'middle-east', 'iraq', 'coalition'],
    lastUpdated: '2026-06-01'
  },
  {
    id: 'lebanon-conflict',
    name: 'Lebanon Post-War Instability',
    region: 'Middle East',
    countries: ['Lebanon', 'Israel', 'Hezbollah'],
    type: 'hybrid',
    intensity: 'medium',
    started: '2024-09-17',
    lat: 33.8, lng: 35.9,
    description: 'Major Israeli military campaign against Hezbollah in Lebanon (Sept–Nov 2024) led to a ceasefire. Hezbollah severely degraded. The June 2026 US-Iran peace deal has further reduced Iranian support for Hezbollah. However, Israel has declared it will not withdraw from Lebanese territory, drawing cautious reactions from the Lebanese public and government. Truce holds but the political situation remains unresolved.',
    casualties: { estimate: '4,000+ killed (2024 campaign)', source: 'Lebanese Health Ministry' },
    status: 'active',
    tags: ['middle-east', 'hezbollah', 'israel', 'ceasefire', 'reconstruction', 'no-withdrawal'],
    lastUpdated: '2026-06-16'
  },
  {
    id: 'colombia-farc',
    name: 'Colombia – FARC Dissidents',
    region: 'Americas',
    countries: ['Colombia', 'FARC-EP (EMC)', 'ELN'],
    type: 'insurgency',
    intensity: 'medium',
    started: '2016-11-24',
    lat: 3.9, lng: -73.1,
    description: 'Despite the 2016 FARC peace deal, dissident factions (EMC/FARC-EP) and ELN continue armed operations. Peace talks with ELN have stalled. Coca production and trafficking drive ongoing violence in rural regions.',
    casualties: { estimate: '1,500+/year', source: 'ACLED / INDEPAZ' },
    status: 'active',
    tags: ['americas', 'latin-america', 'farc', 'eln', 'narco', 'peace-process'],
    lastUpdated: '2026-06-01'
  },
  {
    id: 'mexico-cartel-war',
    name: 'Mexico Cartel War',
    region: 'Americas',
    countries: ['Mexico', 'CJNG', 'Sinaloa Cartel', 'Other TCOs'],
    type: 'non-state',
    intensity: 'high',
    started: '2006-12-11',
    lat: 24.0, lng: -104.7,
    description: 'Ongoing conflict between rival drug trafficking organizations and the Mexican state. CJNG and Sinaloa Cartel (now fractured since Guzmán arrest) fight for territorial control. Averaging 30,000+ homicides annually.',
    casualties: { estimate: '30,000+/year', source: 'INEGI / Secretariat of Security' },
    status: 'active',
    tags: ['americas', 'cartels', 'narco', 'mexico', 'transnational'],
    lastUpdated: '2026-06-01'
  },
  {
    id: 'niger-insurgency',
    name: 'Niger – Jihadist Insurgency',
    region: 'Africa',
    countries: ['Niger (Junta/CNSP)', 'JNIM', 'ISGS'],
    type: 'insurgency',
    intensity: 'medium',
    started: '2015-06-01',
    lat: 14.5, lng: 8.1,
    description: 'Post-2023 coup junta faces intensifying jihadist attacks in Tillabéri and Tahoua regions bordering Mali and Burkina Faso. Expelled French and US forces. Negotiating security cooperation with Russia. Terrorist violence at all-time high.',
    casualties: { estimate: '5,000+ (2017–2025)', source: 'ACLED' },
    status: 'active',
    tags: ['sahel', 'jihadist', 'coup', 'africa', 'isis', 'al-qaeda'],
    lastUpdated: '2026-06-01'
  },
  {
    id: 'us-iran-conflict',
    name: 'US–Iran Military Conflict',
    region: 'Middle East',
    countries: ['United States', 'Iran'],
    type: 'interstate',
    intensity: 'medium',
    started: '2025-06-13',
    lat: 27.0, lng: 54.0,
    description: 'Direct military confrontation between the US and Iran involving US strikes on Iranian nuclear facilities and IRGC infrastructure, met with Iranian ballistic missile and drone retaliation. A peace deal was signed in June 2026 — Trump declared it "all signed" and Iran agreed to never pursue nuclear weapons. Implementation details covering shipping lanes, sanctions relief, and deferred nuclear talks remain under negotiation. Iranian hardliners have expressed anger at the terms. JD Vance cautioned the deal is "very general" with many details still to be finalised.',
    casualties: { estimate: 'Hundreds (military, both sides)', source: 'US DoD / Iranian state media / Reuters' },
    status: 'active',
    tags: ['nuclear', 'middle-east', 'persian-gulf', 'ceasefire-signed', 'sanctions', 'irgc', 'deal-implementation'],
    lastUpdated: '2026-06-16'
  }
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function computeStats(conflicts) {
  const active = conflicts.filter(c => c.status === 'active');
  const byRegion = {};
  const byIntensity = { critical: 0, high: 0, medium: 0, low: 0 };
  const byType = {};

  active.forEach(c => {
    byRegion[c.region] = (byRegion[c.region] || 0) + 1;
    byIntensity[c.intensity] = (byIntensity[c.intensity] || 0) + 1;
    byType[c.type] = (byType[c.type] || 0) + 1;
  });

  return {
    total: active.length,
    byRegion,
    byIntensity,
    byType,
    regionsAffected: Object.keys(byRegion).length,
    critical: byIntensity.critical,
  };
}

async function fetchConflictNews() {
  const key = 'conflict_news';
  if (cache.has(key)) return cache.get(key);

  const CONFLICT_KEYWORDS = [
    'war', 'conflict', 'ceasefire', 'offensive', 'battle', 'invasion',
    'airstrike', 'insurgency', 'militia', 'rebel', 'peacekeeping', 'siege',
    'military operation', 'coup', 'sanctions'
  ];

  const q = CONFLICT_KEYWORDS.slice(0, 8).join(' OR ');

  try {
    const { data } = await axios.get('https://content.guardianapis.com/search', {
      params: {
        q,
        'api-key': process.env.GUARDIAN_API_KEY,
        'show-fields': 'headline,trailText,thumbnail,byline,wordcount',
        'page-size': 30,
        'order-by': 'newest',
        section: 'world',
      },
      timeout: 8000,
    });

    const articles = (data.response?.results || [])
      .filter(a => isConflictNews(a))
      .slice(0, 18)
      .map(a => ({
        id: a.id,
        title: a.webTitle,
        summary: a.fields?.trailText || '',
        thumbnail: a.fields?.thumbnail || null,
        url: a.webUrl,
        byline: a.fields?.byline || '',
        publishedAt: a.webPublicationDate,
        section: a.sectionName,
        region: assignRegion(a),
      }));

    const result = { articles, fetchedAt: new Date().toISOString(), source: 'The Guardian' };
    cache.set(key, result, 1800);
    return result;
  } catch (err) {
    return { articles: [], error: err.message, fetchedAt: new Date().toISOString() };
  }
}

function isConflictNews(article) {
  const EXCLUDE = ['cricket', 'football', 'sport', 'premier league', 'transfer', 'film', 'music', 'recipe', 'fashion', 'travel'];
  const text = (article.webTitle + ' ' + (article.fields?.trailText || '')).toLowerCase();
  return !EXCLUDE.some(w => text.includes(w));
}

const REGION_KEYWORDS = [
  { region: 'Europe', words: ['ukraine', 'russia', 'kyiv', 'moscow', 'nato', 'crimea', 'donbas', 'donetsk', 'kharkiv', 'zaporizhzhia', 'zelenskyy', 'zelensky', 'putin', 'belarus', 'moldova', 'kursk', 'kherson'] },
  { region: 'Middle East', words: ['israel', 'gaza', 'hamas', 'hezbollah', 'lebanon', 'beirut', 'iran', 'tehran', 'iraq', 'baghdad', 'syria', 'damascus', 'yemen', 'houthi', 'saudi', 'west bank', 'palestine', 'red sea', 'netanyahu', 'tel aviv', 'jordan', 'sinwar'] },
  { region: 'Africa', words: ['sudan', 'mali', 'burkina', 'somalia', 'al-shabaab', 'niger', 'congo', 'drc', 'kinshasa', 'ethiopia', 'mozambique', 'cameroon', 'south sudan', 'sahel', 'rwanda', 'm23', 'jnim', 'boko haram', 'nigeria', 'africain', 'african union', 'khartoum', 'rsf', 'darfur'] },
  { region: 'Asia', words: ['myanmar', 'burma', 'afghanistan', 'kabul', 'taliban', 'pakistan', 'kashmir', 'taiwan', 'south china sea', 'philippines', 'nagorno', 'karabakh'] },
  { region: 'Americas', words: ['haiti', 'colombia', 'mexico', 'cartel', 'farc', 'venezuela', 'nicaragua', 'el salvador'] },
];

function assignRegion(article) {
  const text = (article.webTitle + ' ' + (article.fields?.trailText || '')).toLowerCase();
  for (const { region, words } of REGION_KEYWORDS) {
    if (words.some(w => text.includes(w))) return region;
  }
  return 'Global';
}

// ─── Routes ──────────────────────────────────────────────────────────────────

app.get('/api/conflicts', (req, res) => {
  const cacheKey = 'conflicts_all';
  if (cache.has(cacheKey)) return res.json(cache.get(cacheKey));

  const stats = computeStats(CONFLICTS);
  const result = {
    conflicts: CONFLICTS,
    stats,
    fetchedAt: new Date().toISOString(),
  };
  cache.set(cacheKey, result, 3600);
  res.json(result);
});

app.get('/api/conflict-news', async (req, res) => {
  try {
    const result = await fetchConflictNews();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/stats', (req, res) => {
  const cacheKey = 'conflict_stats';
  if (cache.has(cacheKey)) return res.json(cache.get(cacheKey));
  const stats = computeStats(CONFLICTS);
  cache.set(cacheKey, stats, 3600);
  res.json(stats);
});

app.post('/api/generate-briefing', async (req, res) => {
  const stats = computeStats(CONFLICTS);
  const conflictSummaries = CONFLICTS.map(c =>
    `${c.name} (${c.region}, ${c.intensity} intensity): ${c.description.slice(0, 120)}...`
  ).join('\n');

  // Pull latest news to ground the briefing in current events
  const newsData = await fetchConflictNews().catch(() => ({ articles: [] }));
  const newsDigest = newsData.articles.slice(0, 15).map((a, i) =>
    `${i + 1}. [${a.region || 'Global'}] ${a.title}${a.summary ? ' — ' + a.summary.slice(0, 100) : ''}`
  ).join('\n');

  const prompt = `You are a senior geopolitical analyst at an international security think tank.
Write a concise 300-word global conflict situation report for today (${new Date().toDateString()}).

ACTIVE CONFLICT TRACKER (${stats.total} conflicts, ${stats.critical} critical, ${stats.regionsAffected} regions):
${conflictSummaries}

LATEST NEWS REPORTS (use these to ground your analysis in current developments):
${newsDigest}

Based on the above live news and conflict data, provide:
1. A one-paragraph global overview reflecting the most current developments
2. The 3 most dangerous hotspots right now and why (cite specific news where relevant)
3. Key trends or escalation risks emerging from today's reports
4. A brief concluding assessment

Use professional security analyst tone. No bullet lists — write in paragraphs.`;

  try {
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 700,
      temperature: 0.4,
    });
    res.json({ briefing: completion.choices[0].message.content, generatedAt: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/conflict-analysis', async (req, res) => {
  const { conflictId } = req.body;
  const conflict = CONFLICTS.find(c => c.id === conflictId);
  if (!conflict) return res.status(404).json({ error: 'Conflict not found' });

  const prompt = `You are a senior geopolitical analyst. Provide a concise 200-word situation assessment for:

Conflict: ${conflict.name}
Region: ${conflict.region}
Type: ${conflict.type}
Intensity: ${conflict.intensity}
Started: ${conflict.started}
Countries involved: ${conflict.countries.join(', ')}
Background: ${conflict.description}
Estimated casualties: ${conflict.casualties.estimate}

Write a focused assessment covering:
- Current military/political situation
- Key drivers and stakeholders
- Near-term outlook (escalation or de-escalation likelihood)

Professional tone, 2–3 paragraphs, no headers.`;

  try {
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 400,
      temperature: 0.4,
    });
    res.json({ analysis: completion.choices[0].message.content, conflictId, generatedAt: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Start ────────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Conflict Monitor running on http://localhost:${PORT}`);
});
