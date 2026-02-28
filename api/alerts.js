const { Resend } = require('resend');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { type, team, game, signalType, tier, score, betSize, betType, dogML } = req.body || {};

  if (!type || !team || !game) {
    return res.status(400).json({ error: 'Missing required fields: type, team, game' });
  }

  const results = { email: null, phone: null };

  // --- Email via Resend ---
  if (process.env.RESEND_API_KEY && process.env.USER_EMAIL) {
    try {
      const resend = new Resend(process.env.RESEND_API_KEY);

      const signalCount = tier || 1;
      const tierLabel = signalCount >= 3 ? 'TIER 3 — COMBINED' : signalCount >= 2 ? 'TIER 2 — STRONG' : 'TIER 1';
      const tierColor = signalCount >= 3 ? '#00d4aa' : signalCount >= 2 ? '#3b82f6' : '#d97706';
      const urgency = signalCount >= 2 ? '🚨' : '📡';

      const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0f0f1a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:480px;margin:0 auto;padding:24px;">
    <div style="text-align:center;margin-bottom:20px;">
      <span style="color:#00d4aa;font-size:24px;font-weight:700;letter-spacing:2px;">ALPHA HUNTER</span>
    </div>
    <div style="background:#1a1a2e;border:1px solid ${tierColor};border-radius:12px;padding:20px;margin-bottom:16px;">
      <div style="font-size:12px;color:${tierColor};text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">${urgency} ${tierLabel}</div>
      <div style="color:#fff;font-size:20px;font-weight:700;margin-bottom:4px;">${game}</div>
      <div style="color:#9ca3af;font-size:14px;margin-bottom:16px;">${signalType || type}</div>
      <div style="background:#0f0f1a;border-radius:8px;padding:12px;margin-bottom:12px;">
        <div style="color:#00d4aa;font-size:16px;font-weight:600;">BET ${team} ${betType || 'ML'}${dogML ? ' (' + dogML + ')' : ''}</div>
        ${betSize ? `<div style="color:#9ca3af;font-size:13px;margin-top:4px;">Size: ${betSize}</div>` : ''}
        ${score ? `<div style="color:#9ca3af;font-size:13px;margin-top:4px;">Score: ${score}</div>` : ''}
      </div>
    </div>
    <div style="text-align:center;color:#4b5563;font-size:11px;">
      alphahunter.one — ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })} ET
    </div>
  </div>
</body>
</html>`;

      const { data, error } = await resend.emails.send({
        from: 'Alpha Hunter <alerts@alphahunter.one>',
        to: process.env.USER_EMAIL,
        subject: `${urgency} ${tierLabel}: ${team} — ${game}`,
        html,
      });

      results.email = error ? { error: error.message } : { sent: true, id: data?.id };
    } catch (err) {
      results.email = { error: err.message };
    }
  }

  // --- Phone via Twilio ---
  const hasTwilio = process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN &&
                    process.env.TWILIO_PHONE_NUMBER && process.env.USER_PHONE_NUMBER;

  if (hasTwilio) {
    try {
      const twilio = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
      const signalCount = tier || 1;

      if (signalCount >= 2) {
        // Tier 2+: phone CALL
        const twiml = `<Response><Say voice="alice">Alpha Hunter alert. ${tierLabel(signalCount)} signal. ${game}. Bet ${team} ${betType || 'moneyline'}. ${betSize ? 'Size ' + betSize : ''}. Check the dashboard for details.</Say></Response>`;

        const call = await twilio.calls.create({
          twiml,
          to: process.env.USER_PHONE_NUMBER,
          from: process.env.TWILIO_PHONE_NUMBER,
        });
        results.phone = { type: 'call', sid: call.sid };
      } else {
        // Tier 1: SMS only
        const msg = await twilio.messages.create({
          body: `📡 Alpha Hunter — ${game}: ${signalType || type} signal. Bet ${team} ${betType || 'ML'}${dogML ? ' (' + dogML + ')' : ''}${betSize ? ' | Size: ' + betSize : ''}`,
          to: process.env.USER_PHONE_NUMBER,
          from: process.env.TWILIO_PHONE_NUMBER,
        });
        results.phone = { type: 'sms', sid: msg.sid };
      }
    } catch (err) {
      results.phone = { error: err.message };
    }
  }

  return res.status(200).json({ ok: true, results });

  function tierLabel(count) {
    return count >= 3 ? 'Tier 3 combined' : count >= 2 ? 'Tier 2 strong' : 'Tier 1';
  }
};
