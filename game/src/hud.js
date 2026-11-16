// hud.js — the heads-up display, in DOM over the canvas: score, clock, health,
// ammunition, money, crosshair, kill feed, objective, buy menu and scoreboard.
// It only reads the state, and writes an element only when its value changed.
import { PHASE, RULES, SHOP, WEAPONS, GEAR, TEAM_NAME } from './sim/config.js';
import { EV } from './sim/events.js';
import { weaponOf, ammoOf } from './sim/actor.js';
import { currentSpread } from './sim/weapons.js';
import { isAttacker } from './sim/state.js';
import { buyBlock, priceOf } from './sim/economy.js';
import { regionName } from './sim/map.js';
import { createRadar } from './radar.js';

const $ = (id) => document.getElementById(id);

// setters that touch the DOM only on change
function text(el) { let last = null; return (v) => { if (v !== last) { last = v; el.textContent = v; } }; }
function flag(el, name) { let last = null; return (on) => { if (on !== last) { last = on; el.classList.toggle(name, on); } }; }
function make(parent, tag, cls) { const el = document.createElement(tag); if (cls) el.className = cls; parent.appendChild(el); return el; }

const PHASE_LABEL = { buy: 'BUY PHASE', live: 'LIVE', planted: 'BEACON ACTIVE', post: 'ROUND OVER', end: 'FINAL' };

export function createHud(state, input) {
  const radar = createRadar($('radar'), state);
  const set = {};
  for (const id of ['score0', 'score1', 'pips0', 'pips1', 'timer', 'phase', 'objective', 'place', 'hp', 'armor', 'money', 'gear', 'weapon', 'mag', 'res', 'progressLabel', 'spectate']) set[id] = text($(id));
  const hidden = {};
  for (const id of ['scope', 'progress', 'spectate', 'banner', 'buy', 'board', 'cross']) hidden[id] = flag($(id), 'hide');
  const hot = flag($('clock'), 'hot'), lowHp = flag($('hp'), 'low');
  const hitEl = $('hit'), hurtEl = $('hurt'), barEl = $('progressBar'), bannerEl = $('banner');
  const ticks = $('cross').querySelectorAll('i');
  let hitT = 0, hurtT = 0, bannerT = 0, gapPx = -1, barPct = -1, refreshT = 0;

  // kill feed: five reusable lines
  const feed = [];
  for (let i = 0; i < 5; i++) {
    const row = make($('feed'), 'div', 'panel hide');
    feed.push({ row, by: make(row, 'span'), how: make(row, 'em'), who: make(row, 'span'), t: 0 });
  }
  function addFeed(e) {
    const line = feed.shift(); feed.push(line);
    const by = state.actors[e.b], who = state.actors[e.a];
    line.by.textContent = by.name; line.by.className = 't' + by.team;
    line.how.textContent = e.s + (e.c ? ' · HEADSHOT' : '');
    line.who.textContent = who.name; line.who.className = 't' + who.team;
    line.row.className = by.isPlayer || who.isPlayer ? 'panel mine' : 'panel';
    line.t = 6;
    $('feed').appendChild(line.row);
  }

  // buy menu rows, one per shop item
  const shop = SHOP.map((id, i) => {
    const row = make($('buy'), 'div', 'item');
    const item = WEAPONS[id] || GEAR[id];
    make(row, 'kbd').textContent = i + 1;
    make(row, 'span').textContent = item.name;
    make(row, 'small').textContent = item.kind;
    return { id, row, off: flag(row, 'off'), note: text(make(row, 'span', 'price num')) };
  });
  let shopSig = '';
  function updateShop(p) {
    const sig = state.phase + p.money + p.primary + p.armor + p.grenades + p.kit;
    if (sig === shopSig) return;
    shopSig = sig;
    for (const s of shop) {
      const block = buyBlock(state, p, s.id);
      s.off(block !== '');
      s.note(block === 'Owned' || block === 'Full' || block === 'Defenders only' ? block : '$' + priceOf(s.id));
    }
  }

  // scoreboard rows
  const board = $('board');
  const head = make(board, 'div', 'row head');
  for (const h of ['OPERATOR', 'K', 'D', 'BANK']) make(head, 'span').textContent = h;
  const rows = state.actors.map((a) => {
    const row = make(board, 'div', 'row');
    const name = make(row, 'span', 't' + a.team); name.textContent = a.name;
    return { out: flag(row, 'out'), k: text(make(row, 'span', 'num')), d: text(make(row, 'span', 'num')), bank: text(make(row, 'span', 'num')) };
  });

  function banner(title, sub, seconds, mood) {
    bannerEl.firstElementChild.textContent = title;
    bannerEl.lastElementChild.textContent = sub;
    bannerEl.className = 'panel ' + mood;
    bannerT = seconds;
  }

  function onEvent(e) {
    const me = state.player;
    if (e.type === EV.DOWN) addFeed(e);
    else if (e.type === EV.HURT) {
      if (e.a === me.index) hurtT = 0.5;
      else if (e.b === me.index) { hitT = 0.22; hitEl.className = e.c ? 'head' : ''; }
    } else if (e.type === EV.ROUND_START) {
      banner('ROUND ' + e.a, isAttacker(state, me) ? 'Attack: plant the beacon at A or B' : 'Defend: hold sites A and B', 4, '');
    } else if (e.type === EV.SWAP) banner('HALF TIME', 'Sides swap. Money and kit reset.', 4, '');
    else if (e.type === EV.PLANTED) banner('BEACON PLANTED', 'Site ' + e.s + ' · ' + RULES.fuseTime + ' seconds to uplink', 3, '');
    else if (e.type === EV.ROUND_END) banner(e.a === me.team ? 'ROUND WON' : 'ROUND LOST', e.s, RULES.postTime, e.a === me.team ? 'win' : 'loss');
  }

  function objective(me) {
    const beacon = state.beacon, attacking = isAttacker(state, me);
    if (state.phase === PHASE.BUY) return 'Buy phase: keys 1 to 7 · ' + (attacking ? 'Squad call: ' + state.round.plan.call : 'Hold sites A and B');
    if (beacon.state === 'planted') return attacking ? 'Beacon is live at ' + beacon.site.name + ': hold the site until the uplink completes' : 'Beacon at ' + beacon.site.name + ': get there and hold E to defuse';
    if (!attacking) return 'Hold sites A and B until the clock runs out';
    if (beacon.state === 'dropped') return 'Beacon dropped: pick it up (yellow on the radar)';
    if (beacon.carrier === me.index) return 'You carry the beacon: hold E on site A or B to plant';
    return 'Squad call: ' + state.round.plan.call + ' · ' + state.actors[beacon.carrier].name + ' carries the beacon';
  }

  function pips(team) {
    let s = '';
    for (const a of state.actors) if (a.team === team) s += a.alive ? '●' : '○';
    return s;
  }

  // Text that changes a few times a second is refreshed at 10 Hz, not every frame.
  function refresh(p) {
    const me = state.player, r = state.round, over = state.phase === PHASE.END;
    set.score0(r.score[0]); set.score1(r.score[1]); set.pips0(pips(0)); set.pips1(pips(1));
    const secs = Math.max(0, Math.ceil(state.phaseT));
    set.timer(state.phase === PHASE.POST || over ? '-:--' : Math.floor(secs / 60) + ':' + String(secs % 60).padStart(2, '0'));
    set.phase(state.phase === PHASE.LIVE ? 'ROUND ' + r.number : PHASE_LABEL[state.phase]);
    hot(state.phase === PHASE.PLANTED || (state.phase === PHASE.LIVE && secs <= 10));
    set.objective(over ? 'Match over' : objective(me));
    set.place(regionName(p.x, p.z));

    const w = weaponOf(p), am = ammoOf(p);
    set.hp(Math.ceil(p.hp)); lowHp(p.hp <= 30); set.armor(Math.ceil(p.armor));
    set.money('$' + p.money);
    set.gear((p.grenades ? 'Pulse x' + p.grenades + '  ' : '') + (p.kit ? 'Bypass kit  ' : '') + (state.beacon.carrier === p.index && state.beacon.state === 'carried' ? 'BEACON' : ''));
    set.weapon(w.name + ' · ' + w.kind); set.mag(am.mag); set.res('/ ' + am.res);
    hidden.spectate(me.alive || over);
    if (!me.alive) set.spectate(p === me ? 'You are down' : 'You are down · watching ' + p.name);

    if (over && bannerT < 0.5) {
      const won = r.score[me.team] > r.score[1 - me.team];
      banner(won ? 'VICTORY' : 'DEFEAT', TEAM_NAME[0] + ' ' + r.score[0] + ' : ' + r.score[1] + ' ' + TEAM_NAME[1] + ' · click to play again', 2, won ? 'win' : 'loss');
    }
    const buying = state.phase === PHASE.BUY && me.alive;
    hidden.buy(!buying);
    if (buying) updateShop(me);
    const tab = input.held('Tab') || over;
    hidden.board(!tab);
    if (tab) for (let i = 0; i < rows.length; i++) {
      const a = state.actors[i];
      rows[i].out(!a.alive); rows[i].k(a.kills); rows[i].d(a.downs); rows[i].bank('$' + a.money);
    }
  }

  // p: the operator on screen (the player, or the teammate being spectated)
  function update(dt, p) {
    if ((refreshT -= dt) <= 0) { refreshT = 0.1; refresh(p); }

    // crosshair gap follows the real spread cone, so the player sees accuracy return on stopping
    const gap = Math.round(4 + Math.tan(currentSpread(p)) / Math.tan(37 * Math.PI / 180) * window.innerHeight * 0.5);
    if (gap !== gapPx) {
      gapPx = gap;
      ticks[0].style.top = -gap - 9 + 'px'; ticks[1].style.top = gap + 'px';
      ticks[2].style.left = -gap - 9 + 'px'; ticks[3].style.left = gap + 'px';
    }
    hidden.cross(p.scoped || !p.alive); hidden.scope(!p.scoped);
    hitT = Math.max(0, hitT - dt); hurtT = Math.max(0, hurtT - dt);
    hitEl.style.opacity = hitT > 0 ? 1 : 0;
    hurtEl.style.opacity = hurtT * 2;

    // progress bar: plant, defuse or reload
    let pct = -1;
    if (p.useT > 0) { pct = p.useT / (isAttacker(state, p) ? RULES.plantTime : p.kit ? RULES.kitDefuseTime : RULES.defuseTime); set.progressLabel(isAttacker(state, p) ? 'PLANTING BEACON' : 'DEFUSING'); }
    else if (p.reloadT > 0) { pct = 1 - p.reloadT / weaponOf(p).reload; set.progressLabel('RELOADING'); }
    hidden.progress(pct < 0);
    pct = Math.round(pct * 100);
    if (pct >= 0 && pct !== barPct) { barPct = pct; barEl.style.width = pct + '%'; }

    for (const line of feed) if (line.t > 0 && (line.t -= dt) <= 0) line.row.classList.add('hide');
    bannerT -= dt;
    hidden.banner(bannerT <= 0);
    radar.draw(p);
  }

  return { update, onEvent };
}
