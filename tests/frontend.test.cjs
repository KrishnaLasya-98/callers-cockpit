const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');

// Small DOM boundary fake: exercise actual event handlers and HTTP payloads.
// It does not replace browser layout/visual verification.
class Classes {
  constructor(value = '') { this.items = new Set(value.split(/\s+/).filter(Boolean)); }
  add(value) { this.items.add(value); }
  remove(value) { this.items.delete(value); }
  contains(value) { return this.items.has(value); }
  toggle(value, force) {
    const add = force ?? !this.items.has(value);
    add ? this.items.add(value) : this.items.delete(value);
  }
}
const decode = value => value.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
class Element {
  constructor() { this.classList = new Classes(); this.children = []; this.dataset = {}; this.value = ''; this.checked = false; this.disabled = false; this._text = ''; }
  set textContent(value) { this._text = String(value); this.children = []; this._html = ''; }
  get textContent() { return this._text; }
  set innerHTML(value) {
    this._html = value; this.children = [];
    for (const tag of value.matchAll(/<(button|option|span)\b([^>]*)>(.*?)<\/\1>/gs)) {
      const child = new Element(); child.textContent = decode(tag[3]);
      for (const attr of tag[2].matchAll(/([\w-]+)="([^"]*)"/g)) {
        if (attr[1] === 'class') child.classList = new Classes(attr[2]);
        else if (attr[1].startsWith('data-')) child.dataset[attr[1].slice(5)] = decode(attr[2]);
        else child[attr[1]] = decode(attr[2]);
      }
      this.children.push(child);
    }
  }
  get innerHTML() { return this._html || ''; }
  appendChild(child) { this.children.push(child); }
}
async function setup({ confirm = true, model = null } = {}) {
  const html = readFileSync('frontend/index.html', 'utf8');
  const elements = {};
  for (const match of html.matchAll(/id="([^"]+)"/g)) elements[match[1]] = new Element();
  const requests = [], alerts = [];
  const lead = { id: 'demo-1', company: '<img src=x onerror=alert(1)>', contact_name: 'Demo', status: 'queue', language: 'English' };
  const history = [{ id: 'old', stage_reached: 3, outcome: 'follow_up', started_at: '2026-10-20T10:00:00Z' }];
  const review = model || { available: true, observed_stage: 7, suggested_outcome: 'next_step_agreed', summary: 'Callback agreed', next_step_text: 'Call Tuesday 3pm', next_step_has_time: true, mismatch_note: 'A timed callback was agreed' };
  const context = vm.createContext({
    document: {
      getElementById: id => elements[id], createElement: () => new Element(),
      querySelectorAll: selector => Object.values(elements).flatMap(e => e.children)
        .filter(e => selector.split('.').filter(Boolean).every(c => e.classList.contains(c))),
    },
    location: { search: '', hostname: 'localhost', origin: 'http://localhost:5500' },
    localStorage: { getItem: () => null }, URLSearchParams, Date, console,
    setInterval: () => 1, clearInterval: () => {},
    alert: message => alerts.push(message), confirm: () => confirm,
    fetch: async (url, options = {}) => {
      const path = url.replace('http://localhost:8000', '');
      const body = options.body ? JSON.parse(options.body) : null;
      requests.push({ path, method: options.method || 'GET', body });
      let data;
      if (path === '/health') data = { status: 'ok' };
      else if (path === '/leads') data = [lead];
      else if (path === '/leads/demo-1') data = { ...lead, calls: history };
      else if (path === '/calls' && options.method === 'POST') data = { id: 'call-new' };
      else if (path === '/calls/call-new/events') data = body;
      else if (path === '/calls/call-new') data = body;
      else if (path === '/llm/debrief') data = review;
      else if (path === '/calls') data = [{ ...history[0], company: lead.company, next_step_text: '<b>unsafe</b>', logged_vs_observed_note: '<svg onload=alert(1)>' }];
      else throw new Error('Unexpected request: ' + path);
      return { ok: true, json: async () => data };
    },
  });
  vm.runInContext(readFileSync('frontend/app.js', 'utf8'), context);
  for (let i = 0; i < 10; i++) await Promise.resolve();
  return { el: elements, requests, alerts, context };
}
const lastSave = app => app.requests.filter(r => r.method === 'PATCH').at(-1)?.body;

test('loads lead detail/history and escapes queue names', async () => {
  const app = await setup();
  assert.ok(app.requests.some(r => r.path === '/leads/demo-1'));
  assert.match(app.el.leadHistory.children[0].textContent, /stage 3/);
  assert.match(app.el.leadPicker.innerHTML, /&lt;img/);
});

test('discard sends required stage, resets session and unlocks selection', async () => {
  const app = await setup();
  await app.el.startBtn.onclick();
  assert.equal(app.el.leadPicker.disabled, true);
  vm.runInContext("document.getElementById('stepper').children[5].onclick()", app.context);
  await app.el.stageTaps.children[0].onclick();
  app.el.endCallBtn.onclick();
  await app.el.discardBtn.onclick();
  assert.equal(lastSave(app).outcome, 'not_logged');
  assert.equal(lastSave(app).stage_reached, 6);
  assert.equal(app.el.leadPicker.disabled, false);
  assert.equal(app.el.startBtn.disabled, false);
});

test('tap highlight survives stage navigation and close stage is recordable', async () => {
  const app = await setup(); await app.el.startBtn.onclick();
  await app.el.stageTaps.children[0].onclick();
  assert.equal(app.el.stageTaps.children[0].classList.contains('pressed'), true);
  app.el.nextStageBtn.onclick(); app.el.stepper.children[0].onclick();
  assert.equal(app.el.stageTaps.children[0].classList.contains('pressed'), true);
  app.el.stepper.children[7].onclick();
  assert.ok(app.el.stageTaps.children.length > 0);
  await app.el.stageTaps.children[0].onclick();
  app.el.endCallBtn.onclick(); await app.el.saveCallBtn.onclick();
  assert.equal(lastSave(app).stage_reached, 8);
});

test('vague timing is amber; day alone, time alone and incidental substrings are insufficient', async () => {
  const app = await setup();
  assert.equal(app.el.nextStepHasTime.checked, false);
  for (const text of ['Call next week', 'Call tomorrow', 'Call at 3pm', 'Send money']) {
    app.el.nextStepText.value = text; app.el.nextStepText.oninput();
    assert.equal(app.el.amberNote.classList.contains('hidden'), false, text);
  }
  for (const text of ['Call Tuesday 3pm', 'Call in 30 minutes']) {
    app.el.nextStepText.value = text; app.el.nextStepText.oninput();
    assert.equal(app.el.amberNote.classList.contains('hidden'), true, text);
  }
});

test('accepted review saves stage, next step and review metadata and clears panel', async () => {
  const app = await setup(); await app.el.startBtn.onclick(); app.el.endCallBtn.onclick();
  await app.el.debriefBtn.onclick(); await app.el.saveCallBtn.onclick();
  const saved = lastSave(app);
  assert.equal(saved.stage_reached, 7);
  assert.equal(saved.outcome, 'next_step_agreed');
  assert.equal(saved.next_step_text, 'Call Tuesday 3pm');
  assert.equal(saved.llm_reviewed, true);
  assert.equal(saved.logged_vs_observed_note, '');
  assert.equal(app.el.debriefOut.classList.contains('hidden'), true);
});

test('declining review keeps caller stage and records disagreement', async () => {
  const app = await setup({ confirm: false }); await app.el.startBtn.onclick(); app.el.endCallBtn.onclick();
  await app.el.debriefBtn.onclick(); await app.el.saveCallBtn.onclick();
  assert.equal(lastSave(app).stage_reached, 1);
  assert.equal(lastSave(app).outcome, 'not_logged');
  assert.match(lastSave(app).logged_vs_observed_note, /callback/);
});

test('model outage still permits manual saving', async () => {
  const app = await setup({ model: { available: false, error: 'Model offline' } });
  await app.el.startBtn.onclick(); app.el.endCallBtn.onclick(); await app.el.debriefBtn.onclick();
  assert.equal(app.el.saveCallBtn.disabled, false);
  await app.el.saveCallBtn.onclick();
  assert.equal(lastSave(app).llm_reviewed, false);
  assert.deepEqual(app.alerts, ['Model offline']);
});

test('call log escapes stored company, next step and model text', async () => {
  const app = await setup(); app.el.tabLog.onclick();
  for (let i = 0; i < 5; i++) await Promise.resolve();
  assert.match(app.el.logList.innerHTML, /&lt;img/);
  assert.match(app.el.logList.innerHTML, /&lt;b&gt;unsafe/);
  assert.match(app.el.logList.innerHTML, /&lt;svg/);
  assert.doesNotMatch(app.el.logList.innerHTML, /<img|<svg/);
});
