# Alpha Hunter — Full Site Audit

**File:** `/tmp/alpha-hunter/index.html` (4,432 lines, single HTML file)
**Structure:** CSS (lines 8-391) → HTML (lines 393-776) → JavaScript (lines 778-4290) → History/Tracker/Guide HTML (lines 4290-4432)

---

## 1. ARCHITECTURE OVERVIEW

Single-page app with:
- **Inline CSS** (lines 8-391) — all styles, responsive breakpoints, dark mode via `[data-theme="dark"]`
- **HTML tabs** (lines 393-776) — 11 tabs total (8 NBA + 3 LoL)
- **Inline JS** (lines 778-4290) — all logic, no build tools, no frameworks
- **Data sources:** ESPN API, The Odds API, hardcoded LoL data (Oracle's Elixir)
- **Persistence:** `localStorage` for all state (bets, stars, settings, signals, history)
- **No server-side code** — purely client-side

---

## 2. COLOR SCHEME & CSS VARIABLES (lines 11-31)

```
Light mode:
  --accent: #00d4aa (teal/green)     --green: #00d4aa
  --red: #dc2626                     --orange: #d97706
  --purple: #7c3aed                  --bg: #f7f8fa
  --card-bg: #ffffff                 --border: #e8e8e8
  --text-primary: #1a1a2e            --text-secondary: #4b5563

Dark mode (lines 22-38):
  --bg: #0f0f1a                      --card-bg: #1a1a2e
  --border: #2d2d44                  --accent: #00d4aa (same)
```

### Key CSS Classes:
- `.signal-badge.badge-3pt` → `background: #3b82f6` (blue) — line 247
- `.signal-badge.badge-star` → `background: #f59e0b` (amber) — line 248
- `.signal-badge.badge-fragile` → `background: #ef4444` (red) — line 249
- `.signal-badge.badge-combined` → `background: #00d4aa` (teal) — line 253
- `.signal-chip.combined-active` → glow animation (line 236)
- `.game-card.signal-fire` → accent border + shadow (line 322)
- `.game-card.signal-warn` → orange border (line 323)

---

## 3. TABS & UI STRUCTURE

### Tab Bar (lines 432-444)
| Tab ID | Label | Type | Content ID |
|--------|-------|------|------------|
| `tab-live` | Live Games | NBA | `content-live` (line 450) |
| `tab-threept` | 3PT Tracker | NBA | `content-threept` (line 523) |
| `tab-stars` | Star Tracker | NBA | `content-stars` (line 543) |
| `tab-log` | Bet Log | Both | `content-log` (line 572) |
| `tab-bankroll` | Bankroll | Both | `content-bankroll` (line 596) |
| `tab-history` | History | Both | `content-history` (line 4290) |
| `tab-tracker` | Backtest | NBA | `content-tracker` (line 4307) |
| `tab-guide` | Signal Guide | NBA | `content-guide` (line 4333) |
| `tab-champpool` | Champion Pool | LoL | `content-champpool` (line 662) |
| `tab-analyzer` | Game Analyzer | LoL | `content-analyzer` (line 721) |
| `tab-lolguide` | LoL Guide | LoL | `content-lolguide` (line 734) |

### Tab Switching Function (line 988)
```js
function switchTab(t) {
  // removes .active from all .tab and .tab-content
  // adds .active to #tab-{t} and #content-{t}
}
```

---

## 4. HEADER (lines 395-430)

- Logo SVG with pulse animation
- Title: `#main-title` "ALPHA HUNTER"
- Subtitle: `#main-subtitle` "NBA & LEAGUE OF LEGENDS..."
- Buttons: Mode toggle (`#modeToggle`), Dark mode (`#darkModeToggle`), Sound (`#soundToggle`)
- Status indicators: `#statusDot`, `#statusText`, `#connStatus`

---

## 5. SIGNAL STRIP (lines 475-500)

**Location:** Top of Live Games tab, 3 clickable signal chips

| Chip Element ID | Label | Description |
|-----------------|-------|-------------|
| `#live-games-count` | Games | Total live games |
| `#live-3ptfragile-signals` | 3PT Fragile | Hot 3PT + fragile lead |
| `#live-star-signals` | Star Coil | Star cold + close game |
| `#live-combined-signals` | Combined | 2+ signals same game |

**Click behavior:** `toggleSignalDetail(type)` (line 996) — opens dropdown panel `#chip-detail-{type}` showing affected games. Click a game → `scrollToGame(eventId)` (line 1036).

**Signal game tracking:** `window._signalGames` object (line 2003) stores `{ '3ptfragile': [], 'star': [], 'combined': [] }` with game details.

---

## 6. SIGNAL DETECTION FUNCTIONS

### 6A. 3PT Fragile Signal (lines 1454-1538)

**Thresholds defined at:**
- `getFragile3PtThreshold()` → returns `42` (line 1338) — % of scoring from 3PT to consider "fragile"
- Hot 3PT check (line 1432): `(pn >= 50 && an >= 12) || (pn >= 55 && an >= 8)` — percentage + attempts
- Warm 3PT (line 1433): `pn >= 45 && an >= 10`
- Lead composition fragile (line 1445-1452): `pct3 >= 42%` AND opponent non-3PT `>= 58%`
- Lead margin filter: `>= 3` AND `<= 15` points (lines 1476, 1486-1493)
- **Opponent Engine Check** (lines 1459-1474): `NO_ENGINE_THRESHOLD = 1.3` non-3PT PPM

**Signal levels:**
- Level 2 (strong): Hot 3PT + fragile lead + 3-15pt margin + opponent has engine
- Level 1 (watching): Only one condition met, or blowout, or tight margin

**Key variable:** `sig3Fragile` counter (lines 1479, 1516)

### 6B. Star Coil Signal (lines 1541-1628)

**Star database:** `DEFAULT_STARS` array (lines 907-931) — 23 players with `{name, team, ppg}`
**State:** `state.stars` stored in localStorage key `'starPlayers'`

**Thresholds:**
- Pace ratio: `pr < 0.65` (line 1554) — below 65% of expected scoring pace
- Period: `per >= 2 && per <= 3` (line 1554) — Q2 and Q3 only
- Score margin: `scoreMargin <= 15` (line 1554) — competitive game

**Supporting Cast Analysis** (function `analyzeSupportingCast`, lines 805-832):
```
castScore = teamScore - starPts
castGap = castScore - opponentScore
Tiers: castGap >= -8 (strong), -8 to -15 (moderate), < -15 (weak)
regressionFlips = starDeficit > |castGap|
```

**Damage Locked Detection** (function `analyzeDamageLocked`, lines 1201-1264):
- Requires 4+ snapshots, 3-minute time span, score must change
- Tracks score deficit trend: growing, stable, or shrinking
- `MIN_TIME_SPAN_MS = 180000` (3 min), `MIN_GAME_MINUTES = 15`

**Signal tiers (lines 1577-1586):**
- `elite` (💪 CAST STRONG) — cast within 8pts or leading
- `standard` (🌀) — cast 8-15pts behind
- `weak` (⚠️ CAST WEAK) — cast >15 behind
- `locked` (🔒 DAMAGE LOCKED) — deficit baked in

**Key variable:** `sigStar` counter (lines 1592)

### 6C. Combined Signal (lines 1632-1637)

```js
const has3ptFragile = signals.some(s => s.type === '3ptFragile' && s.level === 2);
const hasStar = signals.some(s => s.type === 'star' && s.level === 2);
const activeSignals = [has3ptFragile, hasStar].filter(Boolean).length;
if (activeSignals >= 2) { signalLevel = 2; sigCombined++; }
```

---

## 7. DATA FLOW

### 7A. Main Data Fetch: `fetchESPNScoreboard()` (line 1341)

1. Calls `fetchLiveOdds()` first (line 1345)
2. Fetches ESPN scoreboard: `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard` (line 904)
3. Filters events for `state === 'in'` or `state === 'pre'`
4. For each game:
   - Extracts team stats (3PT%, FGM, FGA, etc.)
   - Runs `trackScoreMomentum()` (line 1403)
   - Runs `checkQuarterEnd()` (line 1407)
   - Runs 3PT Fragile check (lines 1427-1538)
   - Runs Star Coil check (lines 1541-1628)
   - Runs Combined check (lines 1632-1637)
   - Builds game card HTML (lines 1771-1839)
   - Builds thesis card HTML (lines 1964-1998)
5. Updates signal counts in UI (lines 1907-1920)
6. Builds Edge Thesis Panel (lines 1922-2000)
7. Calls `updateStarTracker()`, `renderBetLog()`, `updateBacktestPanel()`, `updateKelly()`, `autoResolveBets()`, `resolveSignalTracker()`

### 7B. Live Odds: `fetchLiveOdds()` (line 843)

- **API:** `https://api.the-odds-api.com/v4/sports/basketball_nba/odds/`
- **API Key:** hardcoded `4ca2c6a2ed9e162809eb03722e2dc734` (line 851)
- **Markets:** h2h, totals
- **Bookmakers:** fanduel, draftkings, betmgm
- **Cache TTL:** 120000ms (2 min) — line 837
- **Rate limit:** 480 requests/month tracked in localStorage (line 848)
- Returns `oddsCache` object: `{ "Away vs Home": { home, away, homeML, awayML, book, ouLine, overPrice, underPrice } }`

### 7C. Odds Matching: `matchOdds()` (line 890)
Tries abbreviation match, then last/first word of full name.

### 7D. Score Momentum: `trackScoreMomentum()` (line 1183)
- Stores score snapshots every 25+ seconds in `state.scoreHistory[gameId]`
- Keeps last 15 snapshots (~6-7 min at 30s intervals)

---

## 8. GAME CARD RENDERING (lines 1771-1839)

Each game card includes:
- **Header:** Live/Upcoming status, period, clock, signal badges
- **Scoreboard:** Team names, records, scores
- **Odds row:** ML for both teams with implied probabilities
- **3PT stat bars:** `bar3()` helper (line 1734)
- **Durability bars:** Fragile/durable lead indicators (lines 1739-1752)
- **FTA info:** Free throw attempts comparison (lines 1755-1759)
- **Leaders:** Top scorer for each team (lines 1805-1808)
- **Signal panel:** Colored box with signal text, recommendation, bet button (lines 1810-1837)
- **Data attribute:** `data-game-id="${gid}"` for scrollToGame targeting

### Game Card CSS Classes:
- `.game-card` — base card (line 132)
- `.game-card.signal-fire` — strong signal (line 322)
- `.game-card.signal-warn` — developing signal (line 323)

---

## 9. EDGE THESIS PANEL (lines 1922-2000)

**Container:** `#edgeThesisContainer` (line 452)
**Cards container:** `#edgeThesisCards` (line 457)

Each thesis card contains:
- Game label and period info
- Confidence meter (dots: red for strong, green for met, gray for unmet)
- Bet recommendation: `BET [team] ML (odds)`
- Kelly sizing info
- Bet logic explanation
- Criteria breakdown (3PT Fragile Away/Home, Star Coil Away/Home)
- Log Bet button

---

## 10. BET RECOMMENDATION ENGINE (lines 1087-1163)

`getRecommendation(awayScore, homeScore, awayAbbr, homeAbbr, period, clock, signalLevel)`

**Returns:** `{ type: 'ML'|'SPREAD'|'WATCH', side, spreadLine, units, reasoning, margin, minRemaining }`

**Rules:**
- OT or <3 min → WATCH
- signalLevel < 2 → WATCH
- Margin 0-5 → ML (1.5u)
- Margin 6-10 → SPREAD (1.5u)
- Margin 11-15 → SPREAD (1.5u)
- Margin 16-20 → SPREAD (1u)
- Margin 21+ → WATCH
- <6 min remaining → downgrade one tier

---

## 11. BET SIDE LOGIC (lines 1646-1727)

**Scoring system:**
```
awayFade / homeFade counters
3PT Fragile (strong): +1 to fade the hot team
Star Coil Elite: +1.5 to fade the opponent
Star Coil Standard: +1.0 to fade the opponent
Star Coil Locked: +1.0 to fade the STAR's team (reversed)
Star Coil Weak: 0 (no weight)
```

Side with higher fade score → bet the opposite team.

---

## 12. KELLY CRITERION / POSITION SIZING (lines 2098-2115)

`kellySize(impliedP, odds, fraction, signalCount)`

```
edge = getEdgeBonus(signalCount)    // lines 2085-2096
p = min(0.90, impliedP + edge)
b = decimal odds
f* = (b*p - q) / b
Capped at 5% max, 0.5% min
Multiplied by fraction (default 0.5 = half Kelly)
```

**Edge modes** (line 2086-2096):
- Conservative: 2-5% base
- Moderate: 3.5-6.5% base (default)
- Aggressive: 6-9% base
- Backtest: from actual bet history

---

## 13. AUTO-LOG & AUTO-RESOLVE BETS

### Auto-Log: `autoLogBet()` (line 2117)
- Triggers when signalLevel >= 2 and market odds available (line 1725)
- Stores in localStorage key `'betLog'`
- Deduplicates by `gameId + '_' + team`

### Auto-Resolve: `autoResolveBets()` (line 2541)
- Fetches ESPN scoreboard for final scores
- Matches by `gameId`
- Sets `outcome: 'W'` or `'L'`, calculates payout

### Manual Resolve: `markOutcome(id, won)` (line 2609)

---

## 14. SIGNAL BACKTEST TRACKER (lines 2142-2537)

**Constants:**
- `TRACKER_BANKROLL = 20000` (line 2143)
- `TRACKER_DEFAULT_EDGE = 0.08` (line 2144)
- `TRACKER_MAX_KELLY = 0.05` (line 2145)

**Auto-track:** `autoTrackSignal(thesis, rec)` (line 2162) — records every level 2 signal
**Resolve:** `resolveSignalTracker()` (line 2224) — fetches ESPN for final scores
**Stats:** `getSignalTrackerStats()` (line 2323) — breakdowns by signal type, quarter, rec type
**Render:** `renderSignalTracker()` (line 2391) — bankroll header, stat cards, breakdowns, history table
**Export:** `exportSignalTracker()` (line 2525) — CSV download

**State:** `state.signalTracker` stored in localStorage key `'signalTracker'`

---

## 15. NOTIFICATION / ALERT SYSTEM

### Current System:
- **NO browser notifications** — explicitly killed (line 971)
- **NO toast popups** — removed (line 118 comment, line 976 comment)
- **Signal display:** only on signal chips and game cards (line 776 comment)
- **Sound alerts:** Web Audio API chimes (lines 2857-2917)
  - `playAlertSound('coil')` — ascending C major arpeggio
  - `playAlertSound('hot3pt')` — D5→A5 two-tone
  - `playAlertSound('combined')` — triumphant chord
- **Scenario alerts:** `showScenarioAlert()` (line 2994) — saves to `ALERT_HISTORY` in localStorage, no UI popup
- **No email/phone alerts** — none exist

### Alert Firing Functions:
- `sendSignalNotification()` (line 975) — deduplicates by key, plays sound, no popup
- `fireStarCoilAlert()` (line 3017) — calls `showScenarioAlert()` with star coil data
- `fire3PTAlert()` (line 3040) — calls `showScenarioAlert()` with 3PT data

---

## 16. AUTO-REFRESH SYSTEM (lines 1058-1080)

- Toggle: `toggleAutoRefresh()` — starts/stops polling
- Interval select: 30s (default), 60s, 2min
- Countdown bar: visual indicator
- State: `state.autoRefresh`, `state.refreshTimer`, `state.countdownTimer`

---

## 17. QUARTER-END DETECTION (lines 1277-1309)

`checkQuarterEnd(gameId, teamAbbr, currentPeriod, pct, made, att, gameLabel)`
- Detects period transitions
- If quarter 3PT% >= 50% on 4+ attempts → creates alert
- Stores in `state.quarterAlerts`, renders in table

---

## 18. LEAD DURABILITY ANALYSIS (lines 1311-1328)

`analyzeScoringDurability(teamAbbr, score, fg3Made, opponentScore)`
- Calculates `pct3 = pts_from_3 / total_score * 100`
- Fragile: `pct3 >= 42%` AND leading AND score >= 20
- Durable: `pct3 <= 28%` AND leading AND score >= 20

---

## 19. SUPPORTING DATA STRUCTURES

### Team 3PT Averages: `TEAM_3PT_AVG` (lines 779-786)
Hardcoded 2025-26 NBA team 3PT% averages for all 30 teams.

### Team Name Map: `TEAM_MAP` (lines 933-942)
Full name → abbreviation mapping for all 30 NBA teams.

### State Object: `state` (lines 948-961)
```js
{
  betLog: [],           // localStorage 'betLog'
  bankroll: {start, current},  // localStorage 'bankroll'
  stars: [],            // localStorage 'starPlayers'
  autoRefresh: false,
  refreshTimer: null,
  countdownTimer: null,
  quarterAlerts: [],    // localStorage 'quarterAlerts'
  lastKnownPeriods: {},
  prevTeamData: {},
  scoreHistory: {},     // in-memory only
  errorCount: 0,
  consecutiveErrors: 0,
  signalFirstSeen: {},  // in-memory
  favorites: [],        // localStorage 'favorites'
  signalHistory: [],    // localStorage 'signalHistory'
  signalTracker: [],    // localStorage 'signalTracker'
}
```

---

## 20. BET LOG TAB (lines 571-593)

**Stats panel** (`#backtest-panel`, line 577): Total Bets, Win Rate, ROI, Avg Edge, Units P/L
**Signal breakdown** (`#signal-breakdown`, line 584): by signal type
**Table** (`#bet-log-entries`, line 591): time, team, signals, odds, edge, kelly, size, result, P/L
**Functions:** `renderBetLog()` (line 2648), `updateBacktestPanel()` (line 2703), `exportBetLog()` (line 2793), `clearBetLog()` (line 2807)

---

## 21. BANKROLL TAB (lines 595-657)

- Settings: bankroll amount, Kelly fraction (25/50/75/100%), edge mode
- Kelly formula display
- Active recommendations table (`#kelly-recs`, line 655)
- Functions: `saveBankrollSettings()` (line 2772), `loadBankrollSettings()` (line 2782), `updateKelly()` (line 2735)

---

## 22. DARK MODE (lines 2956-2971)

`toggleDarkMode()` — sets `data-theme="dark"` on `<html>`, persists in localStorage `'darkMode'`

---

## 23. SOUND SYSTEM (lines 2857-2917)

- Web Audio API — no external sound files
- `initAudio()` — creates AudioContext
- `playNote()` — plays individual notes
- `playAlertSound(type)` — 'coil', 'hot3pt', 'combined' chimes
- `toggleSound()` — mute/unmute, stored in localStorage `'soundEnabled'`

---

## 24. MODE SWITCHING (NBA ↔ LoL) (lines 3069-3090)

`switchMode()` — toggles `currentMode` between 'nba' and 'lol'
- Swaps tab visibility using CSS classes `.nba-tab` / `.lol-tab`
- Updates mode toggle button text/icon
- Shows/hides appropriate content

---

## 25. LOL FEATURES (lines 661-752, 3065-3900+)

### LOL Data: `LOL_DATA` (line 3066)
Massive inline JSON object with player champion pool data from Oracle's Elixir.

### Champion Pool Tab (lines 662-718)
- Live matches section with fetch from lolesports
- Player cards with champion pools
- Draft tool with blue/red side
- Filter bar: league, team, role, search

### Game Analyzer Tab (lines 721-731)
- 5-dimension analysis: Early Game, Objective Control, Late Game, Comp, Vision/Macro
- `runAnalyzer()` function (line 3900)

### Key LoL Functions:
- `fetchLiveMatches()` (line 3137)
- `initChampPool()` (line 3301)
- `filterChampPool()` (line 3317)
- `analyzeComp()` (line 3560)
- `resetDraft()` (line 3689)
- `openChampPicker()` (line 3726)

---

## 26. ODDS HISTORY TRACKER (lines 4010-4289)

- IIFE that wraps `fetch` to capture Odds API URL
- `fetchOddsHistory()` — fetches historical odds every 3 hours for 24h
- `buildOddsHistoryHTML()` — renders movement table
- `toggleOddsHistory()` — panel toggle on game cards
- `injectOddsButtons()` — adds "24h Odds" buttons to game cards via MutationObserver

---

## 27. QUICK BET ACTION CARDS (lines 502-506, 1859-1882)

**Panel:** `#quick-bet-panel` — shown when gameTheses exist
**Cards:** `#quick-bet-cards` — compact bet recommendations with signals, odds, kelly sizing

---

## 28. FAVORITES / WATCHLIST (lines 2918-2936)

`toggleFavorite(gameId)` — adds/removes from `state.favorites`, re-sorts game grid

---

## 29. SIGNAL HISTORY DASHBOARD (lines 2939-2954)

`renderSignalHistory()` — shows total signals, type breakdown, recent 10 signals
Tab: History (`#content-history`, line 4290)

---

## 30. KEY LINE NUMBERS QUICK REFERENCE

| What | Line(s) |
|------|---------|
| CSS variables (colors) | 11-31 |
| Signal badge colors | 246-257 |
| Tab bar HTML | 432-444 |
| Signal strip HTML | 475-500 |
| Live games grid | 513 |
| Edge thesis panel HTML | 452-458 |
| Quick bet panel HTML | 502-506 |
| Game card HTML template | 1771-1839 |
| Thesis card HTML template | 1964-1998 |
| 3PT Fragile thresholds | 1338, 1432, 1445-1452 |
| Star Coil thresholds | 1554 |
| Supporting Cast function | 805-832 |
| Damage Locked function | 1201-1264 |
| Combined signal check | 1632-1637 |
| Bet recommendation engine | 1090-1163 |
| Bet side logic | 1646-1727 |
| Kelly sizing | 2098-2115 |
| ESPN API URL | 904 |
| Odds API URL + key | 851 |
| Star database (defaults) | 907-931 |
| Team abbreviation map | 933-942 |
| State object | 948-961 |
| Auto-refresh toggle | 1059-1080 |
| Sound system | 2857-2917 |
| Notification function | 975-985 |
| Auto-log bet | 2117-2140 |
| Auto-resolve bets | 2541-2607 |
| Signal backtest tracker | 2142-2537 |
| Mode switch (NBA/LoL) | 3069-3090 |
| Dark mode toggle | 2956-2971 |
| fetchESPNScoreboard() | 1341-2021 |
| fetchLiveOdds() | 843-889 |
| Signal Guide content | 4333-4432 |
