/* ทวนความรู้ก่อนสอบ - หน้านักเรียน */
(function () {
  'use strict';
  var CFG = window.APP_CONFIG || {};
  var PATHS = CFG.paths || { settings: 'settings.json', subjects: 'subjects.json', questionsDir: 'q' };
  var app = document.getElementById('app');
  var S = { settings: null, subjects: [], qcache: {}, student: null, best: {}, exam: null, timer: null, result: null, authTab: 'login', authMsg: null, prefill: '', rank: { r: 'E', cont: '' }, snooze: null, popupBusy: false, likes: {}, askedLike: {} };
  var DEF = {
    schoolName: 'Sikhoraphumpisai School', title: 'ทวนความรู้ก่อนสอบ', welcome: '', levels: 6, rooms: 12, timeLimitMinutes: 20,
    registration: { prefixes: ['เด็กชาย', 'เด็กหญิง', 'นาย', 'นางสาว'], idPattern: '^[0-9]{5,6}$', idHint: 'ตัวเลข 5 หลัก', maxNo: 60 },
    terms: { midterm: { label: 'กลางภาค', open: true } }, currentTerm: 'midterm', announcements: {}, congratsTitle: 'ยินดีด้วย', congratsMessage: '',
    rank: {
      passPct: 50, own: [0, 20, 40, 60, 80, 100], ext: [25, 50, 75, 100],
      text: {
        title: 'NOTIFICATION',
        update: 'ความคืบหน้าของคุณถึงแรงค์ {rank} แล้ว ต้องการอัปเดตแรงค์เลยหรือยัง', updateYes: 'อัปเดตแรงค์', updateNo: 'ไว้ก่อน',
        ownDone: 'ขอแสดงความยินดี คุณทำข้อสอบของชั้นตัวเองครบทุกวิชาแล้ว ต้องการไปต่อหรือไม่', ownDoneYes: 'ไปต่อ', ownDoneNo: 'พอแค่นี้',
        unlocked: 'คุณสามารถอัปเดตแรงค์ได้มากขึ้นโดยทำข้อสอบของชั้นอื่นๆ', unlockedOk: 'รับทราบ',
        askAgain: 'คุณเลือกหยุดที่แรงค์ S การทำข้อสอบชั้นอื่นจะเริ่มสะสมความคืบหน้าแรงค์ต่อไป ต้องการไปต่อหรือไม่', askAgainYes: 'ไปต่อ', askAgainNo: 'ยกเลิก',
        top: 'ขอแสดงความยินดี คุณไปถึงแรงค์สูงสุดแล้ว คุณทำข้อสอบครบทุกวิชาทุกชั้น', topOk: 'รับทราบ',
        likeAsk: 'คุณชอบวิชา {subject} หรือไม่', likeYes: 'ชอบ', likeNo: 'ไม่ชอบ', likeSkip: 'ข้าม'
      }
    }
  };
  var RANKS = ['E', 'D', 'C', 'B', 'A', 'S', 'S+', 'SS', 'SS+', 'SSS'];

  /* ---------- ตัวช่วย ---------- */
  function add(n, c) {
    if (c === null || c === undefined || c === false) return;
    if (Array.isArray(c)) { c.forEach(function (x) { add(n, x); }); return; }
    n.appendChild(typeof c === 'object' ? c : document.createTextNode(String(c)));
  }
  function el(tag, props) {
    var n = document.createElement(tag);
    props = props || {};
    Object.keys(props).forEach(function (k) {
      var v = props[k];
      if (v === null || v === undefined || v === false) return;
      if (k === 'class') n.className = v;
      else if (k === 'text') n.textContent = v;
      else if (k.slice(0, 2) === 'on') n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v === true ? '' : v);
    });
    for (var i = 2; i < arguments.length; i++) add(n, arguments[i]);
    return n;
  }
  function go(h) { if (location.hash === h) route(); else location.hash = h; }
  function mount(node) {
    app.textContent = '';
    app.appendChild(node);
    window.scrollTo(0, 0);
  }
  function digits(s) { return String(s || '').replace(/[๐-๙]/g, function (d) { return String(d.charCodeAt(0) - 0x0E50); }); }
  function cleanId(s) { return digits(s).replace(/[\s​-‍﻿]/g, ''); }
  function delay(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function mmss(sec) { sec = Math.max(0, sec); return pad(Math.floor(sec / 60)) + ':' + pad(sec % 60); }
  function safeImg(u) { return typeof u === 'string' && /^(https?:\/\/[^\s"'<>]+|[A-Za-z0-9_\-\/\.]+)$/.test(u); }
  function ornament() {
    return el('div', { class: 'divider', 'aria-hidden': 'true', html: null }, svgNode());
  }
  function svgNode() {
    var w = document.createElement('span');
    w.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 1l4 7-4 4-4-4z"/><path d="M12 23l-4-7 4-4 4 4z" opacity=".6"/><path d="M1 12l7-4 4 4-4 4z" opacity=".6"/><path d="M23 12l-7 4-4-4 4-4z"/></svg>';
    return w.firstChild;
  }
  function setting(path, fb) { return S.settings && S.settings[path] !== undefined ? S.settings[path] : fb; }
  function fetchJson(url) {
    var bust = (url.indexOf('?') < 0 ? '?t=' : '&t=') + Math.floor(Date.now() / 60000);
    return fetch(url + bust, { cache: 'no-cache' }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    });
  }

  /* ---------- เรียกสคริปต์หลังบ้าน ---------- */
  function api(payload, tries) {
    tries = tries || 1;
    if (!CFG.scriptUrl) return Promise.resolve({ ok: false, code: 'NOCONFIG', error: 'ระบบยังไม่ได้ตั้งค่าลิงก์สคริปต์ใน config.js กรุณาแจ้งผู้ดูแลระบบ' });
    return fetch(CFG.scriptUrl, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(payload) })
      .then(function (r) { return r.json(); })
      .then(function (res) {
        if (res && res.ok === false && res.code === 'BUSY' && tries < 5) {
          return delay(1200 * tries + Math.random() * 1500).then(function () { return api(payload, tries + 1); });
        }
        res = res || { ok: false, error: 'ไม่ได้รับคำตอบจากระบบ' };
        res._retried = tries > 1;
        return res;
      })
      .catch(function () {
        if (tries < 4) return delay(900 * tries + Math.random() * 900).then(function () { return api(payload, tries + 1); });
        return { ok: false, code: 'NETWORK', error: 'เชื่อมต่อระบบไม่ได้ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองอีกครั้ง', _retried: true };
      });
  }

  /* ---------- ส่วนหัว ---------- */
  function renderHeader() {
    document.getElementById('schoolName').textContent = setting('schoolName', DEF.schoolName);
    document.getElementById('siteTitle').textContent = setting('title', DEF.title);
    document.title = setting('title', DEF.title) + ' - ' + setting('schoolName', DEF.schoolName);
    var th = setting('theme', null);
    if (th && /^#[0-9A-Fa-f]{6}$/.test(th.primary || '')) document.documentElement.style.setProperty('--blue', th.primary);
    if (th && /^#[0-9A-Fa-f]{6}$/.test(th.accent || '')) document.documentElement.style.setProperty('--gold', th.accent);
    var box = document.getElementById('userbox');
    box.textContent = '';
    if (!S.student) { box.hidden = true; return; }
    box.hidden = false;
    var st = S.student;
    box.appendChild(el('div', { class: 'who' }, st.prefix + st.name, el('small', { text: 'ม.' + st.level + '/' + st.room + ' เลขที่ ' + st.no })));
    box.appendChild(el('button', { class: 'btn-out', type: 'button', onclick: function () { location.hash = '#/status'; } }, 'สถานะ'));
    box.appendChild(el('button', { class: 'btn-out', type: 'button', onclick: logout }, 'ออกจากระบบ'));
  }
  function logout() {
    if (S.exam && !window.confirm('กำลังทำข้อสอบอยู่ ต้องการออกจากระบบและยกเลิกการทำข้อสอบนี้หรือไม่?')) return;
    abandonExam();
    S.student = null; S.best = {}; S.rank = { r: 'E', cont: '' }; S.snooze = null; S.likes = {}; S.askedLike = {};
    try { sessionStorage.removeItem('sid'); } catch (e) { /* ignore */ }
    S.authTab = 'login'; S.authMsg = null; S.prefill = '';
    go('#/');
  }

  /* ---------- สมัคร / ล็อกอิน ---------- */
  function showAuth() {
    renderHeader();
    var reg = S.settings.registration || DEF.registration;
    var wrapper = el('div', { class: 'card orn' });
    wrapper.appendChild(el('div', { class: 'hero' }, el('h1', { text: 'ยินดีต้อนรับ' }), el('p', { text: setting('welcome', '') || 'เข้าสู่ระบบเพื่อเริ่มทบทวนความรู้ก่อนสอบ' })));
    wrapper.appendChild(ornament());
    var tabs = el('div', { class: 'tabs', role: 'tablist' });
    [['login', 'เข้าสู่ระบบ'], ['register', 'สมัครบัญชี']].forEach(function (t) {
      tabs.appendChild(el('button', { class: 'tab', type: 'button', role: 'tab', 'aria-selected': S.authTab === t[0] ? 'true' : 'false', onclick: function () { S.authTab = t[0]; S.authMsg = null; showAuth(); } }, t[1]));
    });
    wrapper.appendChild(tabs);
    if (S.authMsg) wrapper.appendChild(el('div', { class: 'msg ' + (S.authMsg.type || 'err'), role: 'alert' }, S.authMsg.text));
    wrapper.appendChild(S.authTab === 'login' ? loginForm(reg) : registerForm(reg));
    mount(wrapper);
  }

  function idInput(reg, value) {
    var inp = el('input', { id: 'f-id', class: 'big', type: 'text', inputmode: 'numeric', autocomplete: 'off', maxlength: '8', placeholder: 'เช่น 12345', 'aria-describedby': 'id-hint' });
    inp.value = value || '';
    inp.addEventListener('input', function () { inp.value = cleanId(inp.value).replace(/[^0-9]/g, ''); });
    return inp;
  }
  function idValid(reg, id) { try { return new RegExp(reg.idPattern || DEF.registration.idPattern).test(id); } catch (e) { return /^[0-9]{5,6}$/.test(id); } }

  function loginForm(reg) {
    var inp = idInput(reg, S.prefill);
    var err = el('div', { class: 'fe', role: 'alert' });
    var btn = el('button', { class: 'btn btn-primary btn-block', type: 'submit' }, 'เข้าสู่ระบบ');
    var form = el('form', { novalidate: true, onsubmit: function (e) {
      e.preventDefault();
      var id = cleanId(inp.value);
      err.textContent = '';
      if (!idValid(reg, id)) { err.textContent = 'กรุณากรอกรหัสประจำตัวนักเรียน (' + (reg.idHint || 'ตัวเลข 5 หลัก') + ')'; inp.focus(); return; }
      btn.disabled = true; btn.textContent = 'กำลังตรวจสอบ...';
      api({ action: 'login', id: id }).then(function (res) {
        if (res.ok) { startSession(res); return; }
        btn.disabled = false; btn.textContent = 'เข้าสู่ระบบ';
        if (res.code === 'NOT_FOUND') {
          S.prefill = id; S.authMsg = { type: 'err', text: res.error || 'ไม่มีข้อมูลในระบบ กรุณาสมัครบัญชีก่อน' };
          showAuth();
          var go = el('button', { class: 'btn btn-gold btn-block', type: 'button', onclick: function () { S.authTab = 'register'; S.authMsg = null; showAuth(); } }, 'ไปสมัครบัญชี');
          var form2 = app.querySelector('form'); if (form2) form2.appendChild(el('div', { class: 'field', style: 'margin-top:12px' }, go));
        } else { err.textContent = res.error || 'เกิดข้อผิดพลาด กรุณาลองใหม่'; }
      });
    } },
      el('div', { class: 'field' }, el('label', { for: 'f-id' }, 'รหัสประจำตัวนักเรียน'), inp, el('div', { id: 'id-hint', class: 'hint', text: reg.idHint || '' }), err),
      btn,
      el('p', { class: 'muted', style: 'margin-top:14px;text-align:center' }, 'ยังไม่มีบัญชี? ไปที่แท็บ "สมัครบัญชี"')
    );
    return form;
  }

  function registerForm(reg) {
    var f = {};
    f.prefix = el('select', { id: 'f-prefix' }, el('option', { value: '' }, '-- เลือก --'), (reg.prefixes || DEF.registration.prefixes).map(function (p) { return el('option', { value: p }, p); }));
    f.name = el('input', { id: 'f-name', type: 'text', autocomplete: 'off', maxlength: '80', placeholder: 'ชื่อ นามสกุล' });
    f.level = el('select', { id: 'f-level' }, el('option', { value: '' }, '-- ชั้น --'), seq(setting('levels', 6)).map(function (n) { return el('option', { value: n }, 'ม.' + n); }));
    f.room = el('select', { id: 'f-room' }, el('option', { value: '' }, '-- ห้อง --'), seq(setting('rooms', 12)).map(function (n) { return el('option', { value: n }, 'ห้อง ' + n); }));
    f.no = el('input', { id: 'f-no', type: 'text', inputmode: 'numeric', autocomplete: 'off', maxlength: '2', placeholder: 'เช่น 5' });
    f.no.addEventListener('input', function () { f.no.value = digits(f.no.value).replace(/[^0-9]/g, ''); });
    f.id = idInput(reg, S.prefill);
    var errs = {};
    ['prefix', 'name', 'level', 'room', 'no', 'id'].forEach(function (k) { errs[k] = el('div', { class: 'fe', role: 'alert' }); });
    var top = el('div', { class: 'msg err', role: 'alert', hidden: true });
    var maxNo = reg.maxNo || 60;
    function validate() {
      var ok = true, vals = {};
      ['prefix', 'name', 'level', 'room', 'no', 'id'].forEach(function (k) { errs[k].textContent = ''; });
      vals.prefix = f.prefix.value; vals.name = f.name.value.replace(/\s+/g, ' ').trim();
      vals.level = f.level.value; vals.room = f.room.value; vals.no = digits(f.no.value).trim(); vals.id = cleanId(f.id.value);
      function bad(k, m) { errs[k].textContent = m; if (ok) { (f[k]).focus(); } ok = false; }
      if (!vals.prefix) bad('prefix', 'กรุณาเลือกคำนำหน้า');
      if (vals.name.length < 2 || vals.name.indexOf(' ') < 1) bad('name', 'กรุณากรอกชื่อและนามสกุล โดยเว้นวรรคระหว่างชื่อกับนามสกุล');
      if (!vals.level) bad('level', 'กรุณาเลือกชั้น');
      if (!vals.room) bad('room', 'กรุณาเลือกห้อง');
      var n = parseInt(vals.no, 10);
      if (!/^\d{1,2}$/.test(vals.no) || !(n >= 1 && n <= maxNo)) bad('no', 'เลขที่ต้องเป็นตัวเลข 1 ถึง ' + maxNo);
      if (!idValid(reg, vals.id)) bad('id', 'รหัสประจำตัวต้องเป็น' + (reg.idHint || 'ตัวเลข 5 หลัก'));
      return ok ? vals : null;
    }
    var form = el('form', { novalidate: true, onsubmit: function (e) {
      e.preventDefault();
      top.hidden = true;
      var v = validate();
      if (!v) return;
      confirmRegister(v, top);
    } },
      top,
      el('div', { class: 'grid3' },
        el('div', { class: 'field' }, el('label', { for: 'f-prefix' }, 'คำนำหน้า'), f.prefix, errs.prefix),
        el('div', { class: 'field', style: 'grid-column:span 2' }, el('label', { for: 'f-name' }, 'ชื่อ-นามสกุล'), f.name, errs.name)),
      el('div', { class: 'grid3' },
        el('div', { class: 'field' }, el('label', { for: 'f-level' }, 'ชั้น'), f.level, errs.level),
        el('div', { class: 'field' }, el('label', { for: 'f-room' }, 'ห้อง'), f.room, errs.room),
        el('div', { class: 'field' }, el('label', { for: 'f-no' }, 'เลขที่'), f.no, errs.no)),
      el('div', { class: 'field' }, el('label', { for: 'f-id' }, 'รหัสประจำตัวนักเรียน ', el('span', { class: 'hint', text: '(' + (reg.idHint || 'ตัวเลข 5 หลัก') + ')' })), f.id, errs.id),
      el('button', { class: 'btn btn-primary btn-block', type: 'submit' }, 'สมัครบัญชี'));
    return form;
  }
  function seq(n) { var a = []; for (var i = 1; i <= n; i++) a.push(i); return a; }

  /* หน้าต่างยืนยันการสมัคร */
  function confirmRegister(v, topMsg) {
    var overlay = el('div', { class: 'overlay', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'cf-title' });
    var modal = el('div', { class: 'modal', tabindex: '-1' });
    var status = el('div', { class: 'msg err', role: 'alert', hidden: true });
    var confirmBtn = el('button', { class: 'btn btn-confirm waiting', type: 'button', disabled: true }, el('span', { text: 'ยืนยัน ข้อมูลถูกต้อง' }));
    var backBtn = el('button', { class: 'btn btn-back', type: 'button' }, 'กลับไปแก้ไข');
    var busy = false, timer;
    function close() { clearTimeout(timer); overlay.remove(); document.removeEventListener('keydown', onKey); }
    function onKey(e) { if (e.key === 'Escape' && !busy) close(); }
    document.addEventListener('keydown', onKey);
    backBtn.addEventListener('click', function () { if (!busy) close(); });
    timer = setTimeout(function () {
      confirmBtn.disabled = false;
      confirmBtn.classList.remove('waiting');
      confirmBtn.classList.add('ready');
    }, 1000);
    confirmBtn.addEventListener('click', function () {
      if (confirmBtn.disabled || busy) return;
      busy = true; confirmBtn.disabled = true; backBtn.disabled = true;
      confirmBtn.firstChild.textContent = 'กำลังสมัคร...';
      api({ action: 'register', id: v.id, prefix: v.prefix, name: v.name, level: v.level, room: v.room, no: v.no }).then(function (res) {
        if (res.ok) { close(); startSession(res, 'สมัครบัญชีสำเร็จ'); return; }
        if (res.code === 'EXISTS' && res._retried) {
          /* ตอบกลับหายระหว่างเครือข่าย อาจสมัครสำเร็จไปแล้ว ลองล็อกอินเพื่อตรวจสอบ */
          return api({ action: 'login', id: v.id }).then(function (lg) {
            if (lg.ok && lg.student && String(lg.student.level) === String(v.level) && String(lg.student.room) === String(v.room) && String(lg.student.no) === String(v.no)) {
              close(); startSession(lg, 'สมัครบัญชีสำเร็จ');
            } else { failWith(res); }
          });
        }
        failWith(res);
      });
    });
    function failWith(res) {
      if (res.code === 'EXISTS') {
        close(); S.authTab = 'login'; S.prefill = v.id; S.authMsg = { type: 'warn', text: res.error }; showAuth(); return;
      }
      busy = false; backBtn.disabled = false;
      status.hidden = false; status.textContent = res.error || 'เกิดข้อผิดพลาด กรุณาลองใหม่';
      confirmBtn.disabled = false; confirmBtn.firstChild.textContent = 'ยืนยัน ข้อมูลถูกต้อง';
      confirmBtn.classList.remove('waiting'); confirmBtn.classList.add('ready');
      if (res.code && res.code !== 'NETWORK' && res.code !== 'BUSY') {
        /* ข้อมูลผิด ให้กลับไปแก้ไข */
        confirmBtn.hidden = true;
        topMsg.hidden = false; topMsg.textContent = res.error;
      }
    }
    modal.appendChild(el('h2', { id: 'cf-title', text: 'ตรวจสอบรหัสประจำตัวนักเรียน' }));
    modal.appendChild(el('p', { text: 'รหัสประจำตัวนักเรียนของคุณคือเลขนี้ ถูกต้องแล้วใช่หรือไม่?' }));
    modal.appendChild(el('div', { class: 'bigid', text: v.id }));
    modal.appendChild(el('ul', { class: 'sum' },
      sumRow('ชื่อ-นามสกุล', v.prefix + v.name), sumRow('ชั้น', 'ม.' + v.level + '/' + v.room), sumRow('เลขที่', String(parseInt(v.no, 10)))));
    modal.appendChild(el('p', { class: 'muted', text: 'ใช้รหัสนี้ในการเข้าสู่ระบบครั้งต่อไป หากผิดจะต้องแจ้งผู้ดูแลระบบเพื่อแก้ไข' }));
    modal.appendChild(status);
    modal.appendChild(el('div', { class: 'row' }, confirmBtn, backBtn));
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    modal.focus();
  }
  function sumRow(a, b) { return el('li', null, el('span', { text: a }), el('span', { text: b })); }

  function startSession(res, notice) {
    S.student = res.student; S.best = res.best || {}; S.rank = res.rank || { r: 'E', cont: '' }; S.likes = res.likes || {}; S.snooze = null;
    try { sessionStorage.setItem('sid', S.student.id); } catch (e) { /* ignore */ }
    S.authMsg = null; S.prefill = '';
    S.notice = notice || null;
    go('#/levels');
  }

  /* ---------- เลือกชั้น ---------- */
  function termSubjects() {
    var term = setting('currentTerm', 'midterm');
    return S.subjects.filter(function (s) { return (s.term || 'midterm') === term; });
  }
  function termOpen() {
    var t = (setting('terms', {}) || {})[setting('currentTerm', 'midterm')];
    return !t || t.open !== false;
  }
  function countable() { return termOpen() ? termSubjects().filter(function (s) { return s.open !== false; }) : []; }
  function allFull() {
    var list = countable();
    return list.length > 0 && list.every(function (s) { return S.best[s.id] && S.best[s.id].p >= 100; });
  }
  function termLabel() {
    var t = (setting('terms', {}) || {})[setting('currentTerm', 'midterm')];
    return t && t.label ? t.label : '';
  }
  function showLevels() {
    renderHeader();
    var box = el('div');
    if (S.notice) { box.appendChild(el('div', { class: 'msg ok', role: 'status' }, S.notice)); S.notice = null; }
    var head = el('div', { class: 'card orn hero' }, el('h1', { text: 'เลือกชั้นเรียน' }), el('p', { text: (termLabel() ? 'ข้อสอบ' + termLabel() + ' ' : '') + 'เลือกชั้นที่ต้องการทบทวน' }));
    box.appendChild(head);
    if (allFull()) box.appendChild(congratsCard());
    if (!termOpen()) box.appendChild(el('div', { class: 'msg warn' }, 'ข้อสอบ' + termLabel() + 'ยังไม่เปิดให้ทำ'));
    var grid = el('div', { class: 'lvgrid' });
    seq(setting('levels', 6)).forEach(function (n) {
      var list = termSubjects().filter(function (s) { return +s.level === n && s.open !== false; });
      var done = list.filter(function (s) { return S.best[s.id]; }).length;
      grid.appendChild(el('button', { class: 'lv', type: 'button', onclick: function () { location.hash = '#/level/' + n; } },
        el('span', { class: 'medal', text: 'ม.' + n }),
        el('span', null, el('span', { class: 't', text: 'มัธยมศึกษาปีที่ ' + n }), el('span', { class: 's', text: list.length ? 'ทำแล้ว ' + done + ' จาก ' + list.length + ' วิชา' : 'ยังไม่มีวิชา' }))));
    });
    box.appendChild(grid);
    mount(box);
    checkRankPopups();
  }
  function congratsCard() {
    var title = setting('congratsTitle', '') || 'ยินดีด้วย';
    var msg = setting('congratsMessage', '') || 'คุณทำข้อสอบได้เต็มทุกวิชาในทุกระดับชั้นแล้ว';
    return el('div', { class: 'card congrats', role: 'status' }, el('h2', { text: title }), el('p', { class: 'pre', text: msg }));
  }

  /* ---------- หน้ารายวิชาในแต่ละชั้น ---------- */
  function showLevel(n) {
    renderHeader();
    if (!(n >= 1 && n <= setting('levels', 6))) { location.hash = '#/levels'; return; }
    var box = el('div');
    box.appendChild(el('div', { class: 'crumb' }, el('a', { href: '#/levels', text: '< เลือกชั้นเรียน' })));
    box.appendChild(el('div', { class: 'card orn hero' }, el('h1', { text: 'มัธยมศึกษาปีที่ ' + n }), el('p', { text: termLabel() ? 'ข้อสอบ' + termLabel() : '' })));
    var an = (setting('announcements', {}) || {})[String(n)];
    if (an && (an.title || an.text || (an.schedule && an.schedule.length))) {
      var c = el('div', { class: 'card' });
      c.appendChild(el('h3', { text: an.title || 'ประกาศ' }));
      if (an.text) c.appendChild(el('p', { class: 'pre', text: an.text }));
      if (an.schedule && an.schedule.length) {
        var tb = el('table', { class: 'sched' }, el('thead', null, el('tr', null, el('th', { text: 'วิชา' }), el('th', { text: 'วันที่' }), el('th', { text: 'เวลา' }))));
        var body = el('tbody');
        an.schedule.forEach(function (r) { body.appendChild(el('tr', null, el('td', { text: r.subject || '' }), el('td', { text: r.date || '' }), el('td', { text: r.time || '' }))); });
        tb.appendChild(body); c.appendChild(tb);
      }
      box.appendChild(c);
    }
    if (!termOpen()) {
      box.appendChild(el('div', { class: 'msg warn' }, 'ข้อสอบ' + termLabel() + 'ยังไม่เปิดให้ทำ'));
    } else {
      var list = termSubjects().filter(function (s) { return +s.level === n; }).sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
      box.appendChild(el('h2', { text: 'เลือกวิชา' }));
      if (!list.length) box.appendChild(el('p', { class: 'muted', text: 'ยังไม่มีวิชาในชั้นนี้' }));
      list.forEach(function (s) {
        var locked = s.open === false;
        var b = S.best[s.id];
        var right = locked ? el('span', { class: 'badge lock', text: 'ยังไม่เปิด' }) : b ? el('span', { class: 'badge' + (b.p >= 100 ? ' full' : ''), text: 'ดีที่สุด ' + b.c + '/' + b.t + ' (' + b.p + '%)' }) : el('span', { class: 'badge', text: 'ยังไม่เคยทำ' });
        box.appendChild(el('button', { class: 'subj', type: 'button', disabled: locked, onclick: function () { location.hash = '#/intro/' + encodeURIComponent(s.id); } }, el('span', { class: 'n', text: s.name }), right));
      });
    }
    mount(box);
  }

  /* ---------- ข้อสอบ ---------- */
  function findSubject(id) { for (var i = 0; i < S.subjects.length; i++) if (S.subjects[i].id === id) return S.subjects[i]; return null; }
  function loadQuestions(id) {
    if (S.qcache[id]) return Promise.resolve(S.qcache[id]);
    return fetchJson(PATHS.questionsDir + '/' + encodeURIComponent(id) + '.json').then(function (j) {
      var qs = (j && j.questions || []).filter(function (q) {
        return q && typeof q.q === 'string' && Array.isArray(q.choices) && q.choices.length === 4 && q.choices.every(function (c) { return typeof c === 'string'; }) && q.answer >= 0 && q.answer <= 3;
      });
      S.qcache[id] = qs; return qs;
    });
  }
  function showIntro(id) {
    renderHeader();
    var sub = findSubject(id);
    if (!sub || sub.open === false || !termOpen()) { location.hash = '#/levels'; return; }
    var box = el('div');
    box.appendChild(el('div', { class: 'crumb' }, el('a', { href: '#/level/' + sub.level, text: '< กลับไปเลือกวิชา' })));
    var card = el('div', { class: 'card orn' }, el('h1', { text: sub.name }), el('p', { class: 'muted', text: 'ม.' + sub.level }));
    var info = el('p', { text: 'กำลังโหลดข้อสอบ...' });
    card.appendChild(info);
    box.appendChild(card);
    mount(box);
    loadQuestions(id).then(function (qs) {
      var limit = sub.timeLimit || setting('timeLimitMinutes', 20);
      if (!qs.length) { info.textContent = 'วิชานี้ยังไม่มีข้อสอบ'; return; }
      var b = S.best[id];
      info.textContent = '';
      card.appendChild(el('ul', { class: 'sum' }, sumRow('จำนวนข้อ', qs.length + ' ข้อ'), sumRow('เวลาทำข้อสอบ', limit + ' นาที'), sumRow('คะแนนที่ดีที่สุดของคุณ', b ? b.c + '/' + b.t + ' (' + b.p + '%)' : 'ยังไม่เคยทำ')));
      card.appendChild(el('p', { class: 'muted', text: 'ลำดับข้อคงเดิม แต่ลำดับตัวเลือกสลับทุกครั้ง เมื่อหมดเวลาระบบจะส่งคำตอบให้อัตโนมัติ' }));
      card.appendChild(el('button', { class: 'btn btn-primary btn-block', type: 'button', onclick: function () { beginExam(sub, qs, false); } }, 'เริ่มทำข้อสอบ'));
    }).catch(function () { info.textContent = 'โหลดข้อสอบไม่สำเร็จ กรุณาลองใหม่อีกครั้ง'; });
  }

  function makeExam(sub, raw, perms, ans, start, practice) {
    var qs = raw.map(function (r, i) {
      var choices = perms[i].map(function (o) { return { t: r.choices[o], o: o }; });
      return { q: r.q, img: r.img, choices: choices, answer: perms[i].indexOf(r.answer), explain: r.explain || '' };
    });
    var limit = practice ? 0 : (sub.timeLimit || setting('timeLimitMinutes', 20)) * 60;
    return { sub: sub, raw: raw, perms: perms, qs: qs, ans: ans, idx: 0, start: start, limit: limit, practice: practice };
  }
  function beginExam(sub, raw, practice) {
    var perms = raw.map(function () { return shuffle([0, 1, 2, 3]); });
    var ans = raw.map(function () { return -1; });
    S.exam = makeExam(sub, raw, perms, ans, Date.now(), practice);
    persistExam();
    go('#/exam');
  }
  function persistExam() {
    var e = S.exam; if (!e || e.practice) return;
    try { sessionStorage.setItem('exam', JSON.stringify({ sid: e.sub.id, perms: e.perms, ans: e.ans, start: e.start, idx: e.idx })); } catch (x) { /* ignore */ }
  }
  function abandonExam() {
    clearInterval(S.timer); S.timer = null; S.exam = null;
    try { sessionStorage.removeItem('exam'); } catch (e) { /* ignore */ }
    window.onbeforeunload = null;
  }
  function resumeExam() {
    var raw; try { raw = JSON.parse(sessionStorage.getItem('exam') || 'null'); } catch (e) { raw = null; }
    if (!raw) return Promise.resolve(false);
    var sub = findSubject(raw.sid);
    if (!sub) { abandonExam(); return Promise.resolve(false); }
    return loadQuestions(raw.sid).then(function (qs) {
      if (!qs.length || qs.length !== raw.perms.length) { abandonExam(); return false; }
      S.exam = makeExam(sub, qs, raw.perms, raw.ans, raw.start, false);
      S.exam.idx = Math.min(raw.idx || 0, qs.length - 1);
      return true;
    }).catch(function () { return false; });
  }

  function typeset(node) {
    if (!node || (node.textContent || '').indexOf('$') < 0) return;
    loadKatex().then(function () {
      if (window.renderMathInElement) window.renderMathInElement(node, { delimiters: [{ left: '$$', right: '$$', display: true }, { left: '$', right: '$', display: false }], throwOnError: false });
    }).catch(function () { /* แสดงเป็นข้อความธรรมดา */ });
  }
  var katexP = null;
  function loadKatex() {
    if (katexP) return katexP;
    katexP = new Promise(function (resolve, reject) {
      var base = 'https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/';
      var l = document.createElement('link'); l.rel = 'stylesheet'; l.href = base + 'katex.min.css'; document.head.appendChild(l);
      var s1 = document.createElement('script'); s1.src = base + 'katex.min.js';
      s1.onload = function () {
        var s2 = document.createElement('script'); s2.src = base + 'contrib/auto-render.min.js'; s2.onload = resolve; s2.onerror = reject; document.head.appendChild(s2);
      };
      s1.onerror = reject; document.head.appendChild(s1);
    });
    return katexP;
  }
  function qBlock(q, n, extra) {
    var b = el('div', null, el('div', { class: 'qno', text: 'ข้อ ' + n }), el('div', { class: 'qtext', text: q.q }));
    if (q.img && safeImg(q.img)) b.appendChild(el('img', { class: 'qimg', src: q.img, alt: 'รูปประกอบข้อ ' + n, loading: 'lazy' }));
    return b;
  }

  function showExam() {
    renderHeader();
    var e = S.exam;
    if (!e) { location.hash = '#/levels'; return; }
    var q = e.qs[e.idx], total = e.qs.length;
    var box = el('div');
    var timerEl = el('span', { class: 'timer', 'aria-label': 'เวลาที่เหลือ' });
    var head = el('div', { class: 'examhead' }, el('h2', { style: 'margin:0', text: e.sub.name + (e.practice ? ' (ฝึกข้อที่ผิด)' : '') }), e.practice ? null : timerEl);
    box.appendChild(head);
    var answered = e.ans.filter(function (a) { return a >= 0; }).length;
    var bar = el('div', { class: 'bar', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(total), 'aria-valuenow': String(answered) }, el('i', { style: 'width:' + Math.round(answered / total * 100) + '%' }));
    box.appendChild(bar);
    var card = el('div', { class: 'card' });
    card.appendChild(qBlock(q, e.idx + 1));
    var cs = el('div', { class: 'choices', role: 'radiogroup', 'aria-label': 'ตัวเลือกข้อ ' + (e.idx + 1) });
    q.choices.forEach(function (c, i) {
      cs.appendChild(el('button', { class: 'choice' + (e.ans[e.idx] === i ? ' sel' : ''), type: 'button', role: 'radio', 'aria-checked': e.ans[e.idx] === i ? 'true' : 'false', onclick: function () {
        e.ans[e.idx] = i; persistExam(); showExam();
      } }, el('span', { class: 'k', text: 'กขคง'.charAt(i) }), el('span', { text: c.t })));
    });
    card.appendChild(cs);
    box.appendChild(card);
    var nav = el('div', { class: 'row' });
    nav.appendChild(el('button', { class: 'btn btn-ghost', type: 'button', disabled: e.idx === 0, onclick: function () { e.idx--; persistExam(); showExam(); } }, 'ข้อก่อนหน้า'));
    if (e.idx < total - 1) nav.appendChild(el('button', { class: 'btn btn-primary', type: 'button', onclick: function () { e.idx++; persistExam(); showExam(); } }, 'ข้อถัดไป'));
    nav.appendChild(el('button', { class: 'btn btn-gold', type: 'button', onclick: function () { submitExam(false); } }, 'ส่งคำตอบ'));
    box.appendChild(nav);
    var pal = el('div', { class: 'palette', 'aria-label': 'เลือกข้อ' });
    e.qs.forEach(function (_, i) {
      pal.appendChild(el('button', { class: 'qdot' + (e.ans[i] >= 0 ? ' done' : '') + (i === e.idx ? ' cur' : ''), type: 'button', 'aria-label': 'ไปข้อ ' + (i + 1) + (e.ans[i] >= 0 ? ' ตอบแล้ว' : ' ยังไม่ตอบ'), onclick: function () { e.idx = i; persistExam(); showExam(); } }, String(i + 1)));
    });
    box.appendChild(pal);
    box.appendChild(el('p', { class: 'muted', text: 'ตอบแล้ว ' + answered + ' จาก ' + total + ' ข้อ' }));
    mount(box);
    typeset(box);
    window.onbeforeunload = function (ev) { ev.preventDefault(); ev.returnValue = ''; return ''; };
    clearInterval(S.timer);
    if (!e.practice) {
      var tick = function () {
        var left = e.limit - Math.floor((Date.now() - e.start) / 1000);
        timerEl.textContent = mmss(left);
        timerEl.classList.toggle('low', left <= 60);
        if (left <= 0) { clearInterval(S.timer); submitExam(true); }
      };
      tick(); S.timer = setInterval(tick, 500);
    }
  }

  function submitExam(auto) {
    var e = S.exam; if (!e) return;
    var unanswered = e.ans.filter(function (a) { return a < 0; }).length;
    if (!auto && unanswered > 0 && !window.confirm('ยังไม่ได้ตอบอีก ' + unanswered + ' ข้อ ต้องการส่งคำตอบเลยหรือไม่?')) return;
    if (!auto && unanswered === 0 && !window.confirm('ต้องการส่งคำตอบใช่หรือไม่?')) return;
    clearInterval(S.timer); S.timer = null;
    var correct = 0;
    e.qs.forEach(function (q, i) { if (e.ans[i] === q.answer) correct++; });
    var seconds = Math.min(e.limit || 1e9, Math.floor((Date.now() - e.start) / 1000));
    var r = { sub: e.sub, qs: e.qs, ans: e.ans.slice(), raw: e.raw, correct: correct, total: e.qs.length, seconds: seconds, practice: e.practice, save: e.practice ? 'none' : 'saving', auto: !!auto, onlyWrong: false };
    S.result = r;
    abandonExam();
    go('#/result');
    if (!e.practice) saveScore(r);
  }
  function saveScore(r) {
    r.save = 'saving'; if (S.result === r) showResult();
    api({ action: 'submit', id: S.student.id, subjectId: r.sub.id, subjectName: r.sub.name, subjectLevel: r.sub.level, correct: r.correct, total: r.total, seconds: r.seconds }).then(function (res) {
      if (res.ok) { S.best = res.best || S.best; if (res.rank) S.rank = res.rank; if (res.likes) S.likes = res.likes; r.save = 'saved'; r.improved = res.improved; r.congrats = allFull(); }
      else { r.save = 'failed'; r.error = res.error; if (res.code === 'NOT_FOUND') r.error = res.error; }
      if (S.result === r) showResult();
    });
  }

  /* ---------- ผลคะแนนและเฉลย ---------- */
  function showResult() {
    renderHeader();
    var r = S.result; if (!r) { location.hash = '#/levels'; return; }
    var pct = Math.round(r.correct / r.total * 1000) / 10;
    var box = el('div');
    var sc = el('div', { class: 'card orn score' }, el('h2', { text: r.sub.name + (r.practice ? ' (ฝึกข้อที่ผิด)' : '') }),
      el('div', { class: 'big', text: r.correct + '/' + r.total }), el('div', { class: 'pct', text: pct + '%' }),
      r.practice ? null : el('p', { class: 'muted', text: 'ใช้เวลา ' + mmss(r.seconds) + ' นาที' + (r.auto ? ' (หมดเวลา ระบบส่งคำตอบให้อัตโนมัติ)' : '') }));
    box.appendChild(sc);
    if (r.save === 'saving') box.appendChild(el('div', { class: 'msg warn', role: 'status' }, 'กำลังบันทึกคะแนน...'));
    if (r.save === 'saved') {
      var b = S.best[r.sub.id];
      box.appendChild(el('div', { class: 'msg ok', role: 'status' }, r.improved ? 'บันทึกแล้ว นี่คือคะแนนที่ดีที่สุดของคุณในวิชานี้' : 'บันทึกการทำข้อสอบแล้ว คะแนนที่ดีที่สุดของคุณคือ ' + (b ? b.c + '/' + b.t + ' (' + b.p + '%)' : '')));
    }
    if (r.save === 'failed') {
      var again = el('button', { class: 'btn btn-gold', type: 'button', onclick: function () { saveScore(r); } }, 'ส่งคะแนนอีกครั้ง');
      box.appendChild(el('div', { class: 'msg err', role: 'alert' }, (r.error || 'บันทึกคะแนนไม่สำเร็จ') + ' ', again));
    }
    if (r.congrats) box.appendChild(congratsCard());
    var wrongCount = r.total - r.correct;
    var actions = el('div', { class: 'row', style: 'margin-bottom:16px' });
    actions.appendChild(el('button', { class: 'btn btn-primary', type: 'button', onclick: function () { loadQuestions(r.sub.id).then(function (qs) { beginExam(r.sub, qs, false); }); } }, 'ทำอีกครั้ง'));
    if (wrongCount > 0) actions.appendChild(el('button', { class: 'btn btn-ghost', type: 'button', onclick: function () {
      var wrong = [];
      r.qs.forEach(function (q, i) { if (r.ans[i] !== q.answer) wrong.push(r.raw[i]); });
      beginExam(r.sub, wrong, true);
    } }, 'ฝึกทำเฉพาะข้อที่ผิด'));
    actions.appendChild(el('button', { class: 'btn btn-ghost', type: 'button', onclick: function () { location.hash = '#/level/' + r.sub.level; } }, 'กลับไปเลือกวิชา'));
    actions.appendChild(el('button', { class: 'btn btn-ghost', type: 'button', onclick: function () { location.hash = '#/levels'; } }, 'กลับไปเลือกชั้น'));
    box.appendChild(actions);
    box.appendChild(el('h2', { text: 'เฉลยทีละข้อ' }));
    if (wrongCount > 0) {
      var tg = el('button', { class: 'btn btn-ghost', type: 'button', style: 'margin-bottom:12px', onclick: function () { r.onlyWrong = !r.onlyWrong; showResult(); window.scrollTo(0, document.body.scrollHeight); } }, r.onlyWrong ? 'แสดงทุกข้อ' : 'แสดงเฉพาะข้อที่ผิด');
      box.appendChild(tg);
    }
    r.qs.forEach(function (q, i) {
      var mine = r.ans[i], ok = mine === q.answer;
      if (r.onlyWrong && ok) return;
      var item = el('div', { class: 'rv ' + (ok ? 'right' : 'wrong') });
      item.appendChild(qBlock(q, i + 1));
      item.appendChild(el('div', { class: 'qno', text: ok ? 'ตอบถูก' : (mine < 0 ? 'ไม่ได้ตอบ' : 'ตอบผิด') }));
      q.choices.forEach(function (c, k) {
        var cls = 'opt' + (k === q.answer ? ' correct' : '') + (k === mine && !ok ? ' mine' : '');
        var tags = [];
        if (k === q.answer) tags.push('คำตอบที่ถูกต้อง');
        if (k === mine) tags.push('คำตอบของคุณ');
        item.appendChild(el('div', { class: cls }, el('span', { class: 'k', text: 'กขคง'.charAt(k) + '.' }), el('span', { text: c.t }), tags.length ? el('span', { class: 'tag', text: tags.join(' / ') }) : null));
      });
      if (q.explain) item.appendChild(el('div', { class: 'exp' }, el('strong', { text: 'คำอธิบาย: ' }), q.explain));
      box.appendChild(item);
    });
    mount(box);
    typeset(box);
    if (r.save === 'saved' && !r.practice && !r.likeChecked) { r.likeChecked = true; askLike(r.sub).then(function () { if (S.result === r) { if (S.likes[r.sub.id] !== undefined) { /* ok */ } checkRankPopups(); } }); }
  }



  /* ---------- เสียงเอฟเฟกต์ (สร้างด้วย Web Audio ไม่ใช้ไฟล์) ---------- */
  var AC = null, MASTER = null;
  function sfxOn() { try { return localStorage.getItem('sfx') !== 'off'; } catch (e) { return true; } }
  function sfxSet(on) { try { localStorage.setItem('sfx', on ? 'on' : 'off'); } catch (e) { /* ignore */ } }
  function audio() {
    if (AC === false) return null;
    if (!AC) {
      try {
        var C = window.AudioContext || window.webkitAudioContext;
        AC = new C(); MASTER = AC.createGain(); MASTER.gain.value = 0.35;
        var d = AC.createDelay(); d.delayTime.value = 0.12;
        var fb = AC.createGain(); fb.gain.value = 0.35;
        d.connect(fb); fb.connect(d); MASTER.connect(AC.destination); MASTER.connect(d); d.connect(AC.destination);
      } catch (e) { AC = false; return null; }
    }
    if (AC.state === 'suspended') { try { AC.resume(); } catch (e) { /* ignore */ } }
    return AC;
  }
  function tone(f, t0, dur, type, g, f2) {
    var now = AC.currentTime, o = AC.createOscillator(), a = AC.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(f, now + t0);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, now + t0 + dur);
    a.gain.setValueAtTime(0.0001, now + t0);
    a.gain.exponentialRampToValueAtTime(g, now + t0 + 0.02);
    a.gain.exponentialRampToValueAtTime(0.0001, now + t0 + dur);
    o.connect(a); a.connect(MASTER); o.start(now + t0); o.stop(now + t0 + dur + 0.05);
  }
  var SILENT = 'data:audio/wav;base64,UklGRmQGAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YUAGAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
  /* ปลดล็อกเสียงบน iPad/iPhone: ต้องเรียกจากการแตะของผู้ใช้ และเปลี่ยนโหมดเสียงให้เล่นได้แม้เปิดสวิตช์เงียบ */
  var SYS = null, SYS_READY = false, CLK = null;
  function mk(src) { try { var a = new Audio(src); a.preload = 'auto'; a.setAttribute('playsinline', ''); return a; } catch (e) { return false; } }
  function sysSound() { if (!SYS) SYS = mk('system.mp3'); return SYS; }
  function clkSound() { if (!CLK) CLK = mk('click.mp3'); return CLK; }
  function playFile(a, vol) { a.pause(); a.currentTime = 0; a.volume = vol; var pr = a.play(); return pr; }
  function unlockAudio() {
    var sy = sysSound();
    if (sy && !SYS_READY) {
      SYS_READY = true;
      var ck = clkSound(); if (ck) { try { ck.muted = true; var pc = ck.play(); if (pc && pc.then) pc.then(function () { ck.pause(); ck.currentTime = 0; ck.muted = false; }).catch(function () { ck.muted = false; }); } catch (e) { ck.muted = false; } }
      try { sy.muted = true; var pp = sy.play(); if (pp && pp.then) pp.then(function () { sy.pause(); sy.currentTime = 0; sy.muted = false; }).catch(function () { sy.muted = false; SYS_READY = false; }); } catch (e) { sy.muted = false; SYS_READY = false; }
    }
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) { /* ignore */ }
    var a = audio(); if (!a) return;
    try { var b = a.createBuffer(1, 1, 22050), src = a.createBufferSource(); src.buffer = b; src.connect(a.destination); src.start(0); } catch (e) { /* ignore */ }
    try { var el2 = new Audio(SILENT); el2.setAttribute('playsinline', ''); var pr = el2.play(); if (pr && pr.catch) pr.catch(function () { /* ignore */ }); } catch (e) { /* ignore */ }
  }
  ['touchstart', 'touchend', 'pointerdown', 'click', 'keydown'].forEach(function (ev) {
    document.addEventListener(ev, function () { if (!AC || AC.state !== 'running') unlockAudio(); }, { passive: true });
  });
  function sfx(kind) {
    try {
      if (!sfxOn()) return;
      audio();
      var f = kind === 'click' ? clkSound() : sysSound();
      if (f) {
        try { var pr0 = playFile(f, kind === 'click' ? 0.6 : 0.8); if (pr0 && pr0.catch) pr0.catch(function () { synth(kind); }); return; } catch (e) { /* ใช้เสียงสังเคราะห์แทน */ }
      }
      synth(kind);
    } catch (e) { /* ignore */ }
  }
  function synth(kind) {
    try {
      if (!AC) return;
      if (kind === 'click') { tone(1200, 0, 0.08, 'square', 0.1, 600); return; }
      if (kind === 'rank') {
        [523, 659, 784].forEach(function (f, i) { tone(f, i * 0.1, 0.3, 'sine', 0.35); });
        tone(1047, 0.3, 0.9, 'triangle', 0.4); tone(180, 0, 0.5, 'sawtooth', 0.1, 1000); return;
      }
      if (kind === 'top') {
        [392, 523, 659, 784, 1047, 1319, 1568].forEach(function (f, i) { tone(f, i * 0.11, 0.5, 'sine', 0.3); });
        tone(1047, 0.8, 1.6, 'triangle', 0.3); tone(1568, 0.8, 1.6, 'sine', 0.25); tone(130, 0, 0.9, 'sawtooth', 0.12, 1200); return;
      }
      tone(880, 0, 0.5, 'sine', 0.45); tone(1320, 0.08, 0.5, 'triangle', 0.28); tone(1760, 0.16, 0.7, 'sine', 0.22); tone(200, 0, 0.35, 'sawtooth', 0.1, 900);
    } catch (e) { /* ignore */ }
  }

  /* ---------- แรงค์ ---------- */
  function rankCfg() { return S.settings.rank || DEF.rank; }
  function rkText(k, vars) {
    var t = (rankCfg().text || {})[k]; if (t === undefined || t === '') t = DEF.rank.text[k];
    return String(t).replace(/\{rank\}/g, vars && vars.rank !== undefined ? vars.rank : '').replace(/\{subject\}/g, vars && vars.subject !== undefined ? vars.subject : '');
  }
  function unitsOf(ownLevel) {
    var lv = S.student ? +S.student.level : 0, pass = +rankCfg().passPct;
    var list = countable().filter(function (s) { return ownLevel ? +s.level === lv : +s.level !== lv; });
    var passed = list.filter(function (s) { return S.best[s.id] && S.best[s.id].p >= pass; }).length;
    return { total: list.length, passed: passed, pct: list.length ? passed / list.length * 100 : 0, list: list };
  }
  function calcRank() {
    var cfg = rankCfg(), own = cfg.own, ext = cfg.ext;
    var o = unitsOf(true), x = unitsOf(false);
    var claimed = Math.max(0, RANKS.indexOf(S.rank.r));
    var cont = S.rank.cont;
    var reached = 0;
    if (o.total) { for (var i = 0; i < own.length; i++) if (o.pct + 1e-9 >= own[i]) reached = i; }
    if (cont === 'ใช่' && x.total) { var k = 0; ext.forEach(function (t) { if (x.pct + 1e-9 >= t) k++; }); reached = Math.max(reached, 5 + k); }
    var pool, lo, hi, frac = 1, need = 0;
    if (claimed < 9 && !(claimed >= 5 && cont !== 'ใช่')) {
      if (claimed < 5) { pool = o; lo = own[claimed]; hi = own[claimed + 1]; }
      else { pool = x; lo = claimed === 5 ? 0 : ext[claimed - 6]; hi = ext[claimed - 5]; }
      frac = pool.total ? Math.max(0, Math.min(1, (pool.pct - lo) / (hi - lo))) : 0;
      need = pool.total ? Math.max(0, Math.ceil(pool.total * hi / 100 - 1e-9) - pool.passed) : 0;
    }
    return { own: o, other: x, claimed: claimed, reached: reached, cont: cont, frac: frac, need: need, hasUnits: o.total > 0, top: claimed >= 9 };
  }
  function rankClass(i) { return i >= 6 ? 'r-ext' : (i >= 4 ? 'r-high' : (i >= 2 ? 'r-mid' : 'r-low')); }
  function notify(body, yes, no, third, kind) {
    return new Promise(function (resolve) {
      var prev = document.activeElement;
      sfx(kind || 'open');
      var ov = el('div', { class: 'overlay notif-ov' });
      function done(v) { sfx('click'); ov.remove(); if (prev && prev.focus) { try { prev.focus(); } catch (x) { /* ignore */ } } resolve(v); }
      var row = el('div', { class: 'row end' });
      if (third) row.appendChild(el('button', { class: 'btn btn-ghost', type: 'button', onclick: function () { done('skip'); } }, third));
      if (no) row.appendChild(el('button', { class: 'btn btn-ghost', type: 'button', onclick: function () { done(false); } }, no));
      row.appendChild(el('button', { class: 'btn btn-primary', type: 'button', onclick: function () { done(true); } }, yes));
      var box = el('div', { class: 'modal notif', role: 'alertdialog', 'aria-modal': 'true', 'aria-label': rkText('title'), tabindex: '-1' },
        el('div', { class: 'notif-head' }, el('span', { class: 'notif-ic', 'aria-hidden': 'true', text: '!' }), el('span', { class: 'notif-t', text: rkText('title') })),
        el('p', { class: 'notif-body pre', text: body }), row);
      ov.appendChild(box); document.body.appendChild(ov); box.focus();
    });
  }
  function claim(rankIdx, cont) {
    return api({ action: 'claimRank', id: S.student.id, rank: rankIdx !== null ? RANKS[rankIdx] : '', cont: cont || '' }).then(function (res) {
      if (res.ok) { S.rank = res.rank; return true; }
      window.alert(res.error || 'บันทึกแรงค์ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
      return false;
    });
  }
  function checkRankPopups() {
    if (S.exam || !S.student || S.popupBusy) return Promise.resolve();
    var R = calcRank();
    if (!R.hasUnits) return Promise.resolve();
    S.popupBusy = true;
    var fin = function () { S.popupBusy = false; };
    var p;
    if (R.reached > R.claimed && S.snooze !== R.reached) {
      p = notify(rkText('update', { rank: RANKS[R.reached] }), rkText('updateYes'), rkText('updateNo')).then(function (yes) {
        if (!yes) { S.snooze = R.reached; return false; }
        return claim(R.reached).then(function (ok) {
          if (ok && R.reached >= 9) return notify(rkText('top'), rkText('topOk'), null, null, 'top').then(function () { return true; });
          if (ok) sfx('rank');
          return ok;
        });
      });
    } else if (R.claimed === 5 && R.cont === '' && R.other.total > 0) {
      p = notify(rkText('ownDone'), rkText('ownDoneYes'), rkText('ownDoneNo')).then(function (yes) {
        return claim(null, yes ? 'ใช่' : 'พอแค่นี้').then(function (ok) {
          if (ok && yes) return notify(rkText('unlocked'), rkText('unlockedOk')).then(function () { return true; });
          return ok;
        });
      });
    } else { fin(); return Promise.resolve(); }
    return p.then(function (again) { fin(); if (again) { renderCurrent(); return checkRankPopups(); } }, fin);
  }
  function setLike(subjectId, like) {
    return api({ action: 'setLike', id: S.student.id, subjectId: subjectId, like: like ? 1 : 0 }).then(function (res) {
      if (res.ok) { S.likes = res.likes || S.likes; return true; }
      window.alert(res.error || 'บันทึกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
      return false;
    });
  }
  function askLike(sub) {
    if (!sub || S.exam || S.likes[sub.id] !== undefined || S.askedLike[sub.id]) return Promise.resolve();
    S.askedLike[sub.id] = true;
    return notify(rkText('likeAsk', { subject: sub.name }), rkText('likeYes'), rkText('likeNo'), rkText('likeSkip')).then(function (v) {
      if (v === 'skip') { delete S.askedLike[sub.id]; S.askedLike['_skip_' + sub.id] = true; return; }
      return setLike(sub.id, v === true);
    });
  }
  function renderCurrent() { if (location.hash.indexOf('#/status') === 0) showStatus(); }
  /* ถามก่อนเข้าชั้นอื่น ถ้าเคยเลือก "พอแค่นี้" */
  function guardOtherLevel(level) {
    if (!S.student || +level === +S.student.level || S.rank.cont !== 'พอแค่นี้') return Promise.resolve(true);
    return notify(rkText('askAgain'), rkText('askAgainYes'), rkText('askAgainNo')).then(function (yes) {
      if (!yes) return false;
      return claim(null, 'ใช่').then(function (ok) {
        if (!ok) return false;
        return notify(rkText('unlocked'), rkText('unlockedOk')).then(function () { return true; });
      });
    });
  }

  function showStatus() {
    renderHeader();
    var R = calcRank(), box = el('div');
    if (S.exam) {
      var left = S.exam.practice ? null : S.exam.limit - Math.floor((Date.now() - S.exam.start) / 1000);
      box.appendChild(el('div', { class: 'msg warn', role: 'status' }, 'คุณกำลังทำข้อสอบ ' + S.exam.sub.name + ' อยู่' + (left !== null ? ' (เวลาเดินต่อ เหลือ ' + mmss(left) + ' นาที)' : '') + ' ',
        el('button', { class: 'btn btn-gold btn-sm', type: 'button', onclick: function () { location.hash = '#/exam'; } }, 'กลับไปทำข้อสอบต่อ')));
    } else box.appendChild(el('div', { class: 'crumb' }, el('a', { href: '#/levels', text: '< เลือกชั้นเรียน' })));
    var card = el('div', { class: 'card orn rankcard' }, el('h2', { text: 'สถานะ' }));
    card.appendChild(el('div', { class: 'muted', text: S.student.prefix + S.student.name + ' ม.' + S.student.level + '/' + S.student.room }));
    card.appendChild(el('div', { class: 'rank-letter ' + rankClass(R.claimed), text: RANKS[R.claimed] }));
    if (!R.hasUnits) card.appendChild(el('p', { class: 'muted', text: 'ชั้นของคุณยังไม่มีวิชาที่เปิดให้ทำ' }));
    else {
      var inExt = R.claimed >= 5 && R.cont === 'ใช่';
      var barOn = !R.top && (R.claimed < 5 || inExt);
      if (barOn) {
        card.appendChild(el('div', { class: 'bar rankbar', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(Math.round(R.frac * 100)) }, el('i', { style: 'width:' + Math.round(R.frac * 100) + '%' })));
        card.appendChild(el('p', { class: 'muted', text: 'ความคืบหน้าแรงค์ ' + Math.round(R.frac * 100) + '%' + (R.need > 0 ? ' (อีก ' + R.need + ' วิชาถึงขั้นถัดไป)' : '') }));
      }
      card.appendChild(el('p', { text: 'ชั้นของคุณ ผ่านแล้ว ' + R.own.passed + ' จาก ' + R.own.total + ' วิชา (' + Math.round(R.own.pct) + '%)' }));
      if (inExt) card.appendChild(el('p', { text: 'ชั้นอื่น ผ่านแล้ว ' + R.other.passed + ' จาก ' + R.other.total + ' วิชา (' + Math.round(R.other.pct) + '%)' }));
      card.appendChild(el('p', { class: 'muted', text: 'วิชาที่ผ่านคือวิชาที่ได้คะแนนสูงสุดตั้งแต่ ' + rankCfg().passPct + '% ขึ้นไป' }));
      if (R.reached > R.claimed && !S.exam) card.appendChild(el('button', { class: 'btn btn-gold', type: 'button', onclick: function () { S.snooze = null; checkRankPopups(); } }, 'อัปเดตแรงค์'));
    }
    var sb = el('button', { class: 'btn btn-ghost btn-sm', type: 'button', 'aria-pressed': sfxOn() ? 'true' : 'false' }, 'เสียงเอฟเฟกต์: ' + (sfxOn() ? 'เปิด' : 'ปิด'));
    sb.addEventListener('click', function () { var on = !sfxOn(); sfxSet(on); sb.textContent = 'เสียงเอฟเฟกต์: ' + (on ? 'เปิด' : 'ปิด'); sb.setAttribute('aria-pressed', on ? 'true' : 'false'); if (on) { unlockAudio(); sfx('open'); } });
    card.appendChild(el('div', { class: 'row', style: 'justify-content:center; margin-top:6px' }, sb));
    box.appendChild(card);
    var ol = R.own.list;
    if (ol.length && ol.every(function (x) { return S.best[x.id] && S.likes[x.id] !== undefined; })) {
      var mx = Math.max.apply(null, ol.map(function (x) { return S.best[x.id].p; }));
      var apt = ol.filter(function (x) { return S.best[x.id].p === mx; }), lik = ol.filter(function (x) { return S.likes[x.id] === 1; });
      var both = apt.filter(function (x) { return S.likes[x.id] === 1; });
      var names = function (a) { return a.length ? a.map(function (x) { return x.name; }).join(', ') : 'ไม่มี'; };
      var sc = el('div', { class: 'card orn' }, el('h2', { text: 'สรุปความถนัดและความชอบ' }));
      [['วิชาที่ถนัดที่สุด (คะแนนสูงสุด ' + mx + '%)', apt], ['วิชาที่ชอบ', lik], ['วิชาที่ทั้งชอบและถนัด', both]].forEach(function (t) {
        sc.appendChild(el('div', { class: 'sum-row' }, el('span', { text: t[0] }), el('strong', { text: names(t[1]) })));
      });
      box.appendChild(sc);
    }
    if (R.top) box.appendChild(el('div', { class: 'card congrats', role: 'status' }, el('h2', { text: setting('congratsTitle', '') || 'ยินดีด้วย' }), el('p', { class: 'pre', text: rkText('top') })));
    seq(setting('levels', 6)).forEach(function (n) {
      var list = countable().filter(function (s) { return +s.level === n; });
      if (!list.length) return;
      if (+n !== +S.student.level && R.cont !== 'ใช่') return;
      var c = el('div', { class: 'card' }, el('h3', { text: 'ม.' + n + (+n === +S.student.level ? ' (ชั้นของคุณ)' : '') }));
      list.forEach(function (s) {
        var b = S.best[s.id], pass = b && b.p >= +rankCfg().passPct;
        var lk = S.likes[s.id], rowEl = el('div', { class: 'sum-row' }, el('span', { text: s.name }), el('span', { class: 'badge' + (pass ? ' full' : ''), text: b ? b.c + '/' + b.t + ' (' + b.p + '%)' + (pass ? ' ผ่าน' : '') : 'ยังไม่ได้ทำ' }));
        if (+n === +S.student.level && b) {
          var lb = el('span', { class: 'likebtns' });
          [[1, 'ชอบ'], [0, 'ไม่ชอบ']].forEach(function (o) {
            lb.appendChild(el('button', { class: 'btn btn-sm ' + (lk === o[0] ? 'btn-primary' : 'btn-ghost'), type: 'button', 'aria-pressed': lk === o[0] ? 'true' : 'false', onclick: function () { setLike(s.id, o[0] === 1).then(function (ok) { if (ok) showStatus(); }); } }, o[1]));
          });
          rowEl.appendChild(lb);
        }
        c.appendChild(rowEl);
      });
      box.appendChild(c);
    });
    mount(box);
    checkRankPopups();
  }

  /* ---------- เส้นทางหน้า ---------- */
  function route() {
    var parts = (location.hash || '').replace(/^#\/?/, '').split('/');
    var head = parts[0] || '';
    if (S.exam && head !== 'exam' && head !== 'status') {
      if (!window.confirm('กำลังทำข้อสอบอยู่ ต้องการออกและยกเลิกการทำข้อสอบนี้หรือไม่?')) { location.hash = '#/exam'; return; }
      abandonExam();
    }
    window.onbeforeunload = S.exam ? window.onbeforeunload : null;
    if (!S.student) { showAuth(); return; }
    if (head === 'status') return showStatus();
    if (head === 'level') {
      var ln = parseInt(parts[1], 10);
      return guardOtherLevel(ln).then(function (ok) { if (ok) showLevel(ln); else go('#/levels'); });
    }
    if (head === 'intro') {
      var iid = decodeURIComponent(parts[1] || ''), isub = findSubject(iid);
      return guardOtherLevel(isub ? isub.level : S.student.level).then(function (ok) { if (ok) showIntro(iid); else go('#/levels'); });
    }
    if (head === 'exam') return S.exam ? showExam() : (location.hash = '#/levels');
    if (head === 'result') return S.result ? showResult() : (location.hash = '#/levels');
    return showLevels();
  }

  /* ---------- เริ่มต้น ---------- */
  function init() {
    Promise.all([
      fetchJson(PATHS.settings).catch(function () { return {}; }),
      fetchJson(PATHS.subjects).catch(function () { return []; })
    ]).then(function (r) {
      var st = r[0] || {};
      S.settings = {};
      Object.keys(DEF).forEach(function (k) { S.settings[k] = DEF[k]; });
      Object.keys(st).forEach(function (k) { S.settings[k] = st[k]; });
      S.settings.registration = Object.assign({}, DEF.registration, st.registration || {});
      var rk = st.rank || {};
      S.settings.rank = Object.assign({}, DEF.rank, rk, { text: Object.assign({}, DEF.rank.text, rk.text || {}) });
      S.subjects = Array.isArray(r[1]) ? r[1] : [];
      renderHeader();
      var sid = null; try { sid = sessionStorage.getItem('sid'); } catch (e) { /* ignore */ }
      if (!sid) { route(); return; }
      api({ action: 'login', id: sid }).then(function (res) {
        if (res.ok) { S.student = res.student; S.best = res.best || {}; S.rank = res.rank || { r: 'E', cont: '' }; S.likes = res.likes || {}; return resumeExam(); }
        try { sessionStorage.removeItem('sid'); } catch (e) { /* ignore */ }
        return false;
      }).then(function (resumed) {
        if (resumed) { go('#/exam'); } else { route(); }
      });
    });
    window.addEventListener('hashchange', route);
  }
  init();
})();
