const { Resend } = require('resend');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!process.env.RESEND_API_KEY || !process.env.USER_EMAIL) {
    return res.status(200).json({ skipped: true, reason: 'RESEND_API_KEY or USER_EMAIL not configured' });
  }

  const oddsApiKey = process.env.ODDS_API_KEY;
  if (!oddsApiKey) {
    return res.status(200).json({ skipped: true, reason: 'ODDS_API_KEY not configured' });
  }

  try {
    // Fetch tonight's NBA spreads
    const oddsUrl = `https://api.the-odds-api.com/v4/sports/basketball_nba/odds/?apiKey=${oddsApiKey}&regions=us&markets=spreads,h2h&oddsFormat=american&bookmakers=fanduel,draftkings`;
    const oddsRes = await fetch(oddsUrl);
    if (!oddsRes.ok) {
      return res.status(200).json({ skipped: true, reason: `Odds API returned ${oddsRes.status}` });
    }

    const games = await oddsRes.json();
    if (!games.length) {
      return res.status(200).json({ skipped: true, reason: 'No NBA games today' });
    }

    // Parse games with spread data
    const parsed = games.map(g => {
      const spreads = g.bookmakers?.flatMap(b => b.markets?.filter(m => m.key === 'spreads').flatMap(m => m.outcomes)) || [];
      const h2h = g.bookmakers?.flatMap(b => b.markets?.filter(m => m.key === 'h2h').flatMap(m => m.outcomes)) || [];

      // Get best spread for each team
      const homeSpread = spreads.find(o => o.name === g.home_team);
      const awaySpread = spreads.find(o => o.name === g.away_team);
      const homeML = h2h.find(o => o.name === g.home_team);
      const awayML = h2h.find(o => o.name === g.away_team);

      const spread = homeSpread ? Math.abs(homeSpread.point) : null;
      const favorite = homeSpread && homeSpread.point < 0 ? g.home_team : g.away_team;
      const dog = favorite === g.home_team ? g.away_team : g.home_team;

      return {
        home: g.home_team,
        away: g.away_team,
        time: new Date(g.commence_time).toLocaleString('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' }),
        spread,
        favorite,
        dog,
        dogML: favorite === g.home_team ? awayML?.price : homeML?.price,
        favML: favorite === g.home_team ? homeML?.price : awayML?.price,
      };
    }).filter(g => g.spread !== null);

    // Categorize
    const dogsToWatch = parsed.filter(g => g.spread > 0 && g.spread <= 3.5).sort((a, b) => a.spread - b.spread);
    const bigFavGames = parsed.filter(g => g.spread > 7).sort((a, b) => b.spread - a.spread);
    const otherGames = parsed.filter(g => g.spread > 3.5 && g.spread <= 7).sort((a, b) => a.spread - b.spread);

    // Build email
    const gameRow = (g) => `
      <tr>
        <td style="padding:8px 12px;color:#fff;border-bottom:1px solid #2d2d44;">${g.away} @ ${g.home}</td>
        <td style="padding:8px 12px;color:#9ca3af;border-bottom:1px solid #2d2d44;">${g.time}</td>
        <td style="padding:8px 12px;color:#00d4aa;border-bottom:1px solid #2d2d44;">${g.dog} ${g.dogML > 0 ? '+' : ''}${g.dogML}</td>
        <td style="padding:8px 12px;color:#9ca3af;border-bottom:1px solid #2d2d44;">${g.spread.toFixed(1)}</td>
      </tr>`;

    const section = (title, emoji, color, games) => {
      if (!games.length) return '';
      return `
      <div style="margin-bottom:24px;">
        <div style="color:${color};font-size:14px;font-weight:600;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">${emoji} ${title}</div>
        <table style="width:100%;border-collapse:collapse;background:#1a1a2e;border-radius:8px;overflow:hidden;">
          <thead><tr>
            <th style="padding:8px 12px;text-align:left;color:#4b5563;font-size:11px;text-transform:uppercase;border-bottom:1px solid #2d2d44;">Game</th>
            <th style="padding:8px 12px;text-align:left;color:#4b5563;font-size:11px;text-transform:uppercase;border-bottom:1px solid #2d2d44;">Time</th>
            <th style="padding:8px 12px;text-align:left;color:#4b5563;font-size:11px;text-transform:uppercase;border-bottom:1px solid #2d2d44;">Dog ML</th>
            <th style="padding:8px 12px;text-align:left;color:#4b5563;font-size:11px;text-transform:uppercase;border-bottom:1px solid #2d2d44;">Spread</th>
          </tr></thead>
          <tbody>${games.map(gameRow).join('')}</tbody>
        </table>
      </div>`;
    };

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0f0f1a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:540px;margin:0 auto;padding:24px;">
    <div style="text-align:center;margin-bottom:24px;">
      <span style="color:#00d4aa;font-size:24px;font-weight:700;letter-spacing:2px;">ALPHA HUNTER</span>
      <div style="color:#4b5563;font-size:13px;margin-top:4px;">Daily Pre-Game Digest — ${new Date().toLocaleDateString('en-US', { timeZone: 'America/New_York', weekday: 'long', month: 'short', day: 'numeric' })}</div>
    </div>
    <div style="background:#0f0f1a;border:1px solid #2d2d44;border-radius:12px;padding:20px;">
      <div style="color:#9ca3af;font-size:13px;margin-bottom:16px;">${parsed.length} game${parsed.length !== 1 ? 's' : ''} tonight</div>
      ${section('Dogs to Watch', '🐕', '#00d4aa', dogsToWatch)}
      ${section('Big Favorite Games', '🏀', '#d97706', bigFavGames)}
      ${section('Other Games', '📋', '#4b5563', otherGames)}
    </div>
    <div style="text-align:center;color:#4b5563;font-size:11px;margin-top:16px;">
      alphahunter.one — Open the dashboard when games go live for real-time signals
    </div>
  </div>
</body>
</html>`;

    const resend = new Resend(process.env.RESEND_API_KEY);
    const { data, error } = await resend.emails.send({
      from: 'Alpha Hunter <digest@alphahunter.one>',
      to: process.env.USER_EMAIL,
      subject: `🏀 Tonight: ${parsed.length} games — ${dogsToWatch.length} dogs to watch`,
      html,
    });

    if (error) {
      return res.status(200).json({ sent: false, error: error.message });
    }

    return res.status(200).json({
      sent: true,
      id: data?.id,
      games: parsed.length,
      dogsToWatch: dogsToWatch.length,
      bigFavGames: bigFavGames.length,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
