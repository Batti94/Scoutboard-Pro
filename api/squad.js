export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'URL fehlt' });

  // Only allow transfermarkt URLs
  if (!url.includes('transfermarkt.')) {
    return res.status(400).json({ error: 'Nur Transfermarkt URLs erlaubt' });
  }

  // Build kader URL from any TM club URL
  let kaderUrl = url;
  if (!url.includes('/kader/')) {
    kaderUrl = url
      .replace('/startseite/', '/kader/')
      .replace(/\/saison_id\/\d+/, '');
  }
  if (!kaderUrl.includes('/plus/1')) kaderUrl += '/plus/1';

  try {
    const response = await fetch(kaderUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'de-DE,de;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'Referer': 'https://www.transfermarkt.de/',
      },
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: 'Transfermarkt nicht erreichbar: ' + response.status });
    }

    const html = await response.text();

    // Parse players from HTML
    const players = [];

    // Match player rows in the squad table
    // TM format: <td class="posrela"><table>...<td>NUM</td>...<a class="spielprofil_tooltip">NAME</a>...position...
    const rowRegex = /<tr[^>]*class="[^"]*(?:odd|even)[^"]*"[^>]*>([\s\S]*?)<\/tr>/g;
    let rowMatch;

    while ((rowMatch = rowRegex.exec(html)) !== null) {
      const row = rowMatch[1];

      // Extract jersey number
      const numMatch = row.match(/<td[^>]*class="zentriert"[^>]*>(\d{1,2})<\/td>/);
      const num = numMatch ? numMatch[1] : '?';

      // Extract player name
      const nameMatch = row.match(/class="(?:spielprofil_tooltip|hauptlink)[^"]*"[^>]*>([^<]+)<\/a>/);
      if (!nameMatch) continue;
      const name = nameMatch[1].trim();
      if (!name || name.length < 2) continue;

      // Extract position
      const posMatch = row.match(/<td[^>]*>([^<]*(?:Torwart|Innenverteidiger|Verteidiger|Mittelfeld|Stürmer|außen|Spitze|Forward|Back|Keeper|Midfield|Winger)[^<]*)<\/td>/i);
      let pos = '–';
      if (posMatch) {
        const rawPos = posMatch[1].trim();
        const posMap = {
          'Torwart': 'TW', 'Goalkeeper': 'TW',
          'Innenverteidiger': 'IV', 'Centre-Back': 'IV',
          'Linker Verteidiger': 'LV', 'Left-Back': 'LV',
          'Rechter Verteidiger': 'RV', 'Right-Back': 'RV',
          'Defensives Mittelfeld': 'DM', 'Defensive Midfield': 'DM',
          'Zentrales Mittelfeld': 'ZM', 'Central Midfield': 'ZM',
          'Offensives Mittelfeld': 'OM', 'Attacking Midfield': 'OM',
          'Linksaußen': 'LA', 'Left Winger': 'LA',
          'Rechtsaußen': 'RA', 'Right Winger': 'RA',
          'Hängende Spitze': 'HS', 'Second Striker': 'HS',
          'Mittelstürmer': 'ST', 'Centre-Forward': 'ST',
        };
        pos = posMap[rawPos] || rawPos.substring(0, 3);
      }

      // Avoid duplicates
      if (!players.find(p => p.name === name)) {
        players.push({ num, name, pos });
      }
    }

    // Extract team name
    const teamMatch = html.match(/<h1[^>]*class="[^"]*data-header__headline-wrapper[^"]*"[^>]*>\s*(?:<span[^>]*>[^<]*<\/span>\s*)?([^<\n]+)/);
    const team = teamMatch ? teamMatch[1].trim() : 'Unbekannt';

    if (players.length === 0) {
      return res.status(404).json({ error: 'Keine Spieler gefunden. Bitte überprüfe die URL.' });
    }

    res.status(200).json({ team, players, count: players.length });

  } catch (err) {
    res.status(500).json({ error: 'Fehler: ' + err.message });
  }
}
