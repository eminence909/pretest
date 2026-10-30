/* ระบบผู้ดูแล - แกนข้อมูล: GitHub, สคริปต์ชีท, CSV, ร่างงาน */
(function () {
  'use strict';
  var CFG = window.APP_CONFIG || {};
  var PATHS = CFG.paths || { settings: 'settings.json', subjects: 'subjects.json', questionsDir: 'q' };
  var A = window.Admin = {};
  A.PATHS = PATHS;
  A.S = { pw: '', token: '', owner: '', repo: '', branch: 'main', settings: null, subjects: [], q: {}, dirty: { settings: false, subjects: false, q: {} }, deletes: [] };
  var S = A.S;

  /* ---------- ตัวช่วย ---------- */
  A.delay = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  A.digits = function (s) { return String(s || '').replace(/[๐-๙]/g, function (d) { return String(d.charCodeAt(0) - 0x0E50); }); };
  A.b64enc = function (str) {
    var bytes = new TextEncoder().encode(str), bin = '';
    for (var i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  };
  A.b64dec = function (b64) {
    var bin = atob(String(b64).replace(/\s/g, '')), bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder('utf-8').decode(bytes);
  };
  A.validId = function (id) { return /^[A-Za-z0-9_-]{1,40}$/.test(id); };
  A.newSubjectId = function (level) { return 'm' + level + '-' + Date.now().toString(36); };

  /* ---------- GitHub ---------- */
  function ghHeaders() {
    return { Authorization: 'Bearer ' + S.token, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
  }
  function ghErr(res, body) {
    var m = (body && body.message) || '';
    if (res.status === 401) return 'โทเคน GitHub ไม่ถูกต้องหรือหมดอายุ';
    if (res.status === 403) return 'โทเคน GitHub ไม่มีสิทธิ์เขียนที่เก็บนี้ หรือถูกจำกัดการใช้งานชั่วคราว (' + m + ')';
    if (res.status === 404) return 'ไม่พบที่เก็บ GitHub หรือโทเคนไม่ได้รับสิทธิ์กับที่เก็บนี้ ตรวจชื่อผู้ใช้และชื่อที่เก็บ';
    return 'GitHub ตอบกลับผิดพลาด (' + res.status + ') ' + m;
  }
  function contentsUrl(path) {
    return 'https://api.github.com/repos/' + encodeURIComponent(S.owner) + '/' + encodeURIComponent(S.repo) + '/contents/' + path.split('/').map(encodeURIComponent).join('/');
  }
  A.ghGet = function (path) {
    return fetch(contentsUrl(path) + '?ref=' + encodeURIComponent(S.branch) + '&t=' + Date.now(), { headers: ghHeaders(), cache: 'no-store' }).then(function (res) {
      if (res.status === 404) {
        return res.json().catch(function () { return {}; }).then(function (b) {
          if (/not found/i.test(b.message || '') && b.documentation_url && /contents/.test(b.documentation_url)) return null;
          return null;
        });
      }
      return res.json().then(function (b) {
        if (!res.ok) throw new Error(ghErr(res, b));
        return b;
      });
    });
  };
  A.ghCheckRepo = function () {
    return fetch('https://api.github.com/repos/' + encodeURIComponent(S.owner) + '/' + encodeURIComponent(S.repo), { headers: ghHeaders(), cache: 'no-store' }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (b) {
        if (!res.ok) throw new Error(ghErr(res, b));
        if (b.permissions && b.permissions.push === false) throw new Error('โทเคนนี้อ่านได้อย่างเดียว ต้องให้สิทธิ์ Contents: Read and write');
        return b;
      });
    });
  };
  A.readText = function (path) {
    return A.ghGet(path).then(function (f) {
      if (!f) return null;
      if (f.content) return { text: A.b64dec(f.content), sha: f.sha };
      return fetch('https://api.github.com/repos/' + encodeURIComponent(S.owner) + '/' + encodeURIComponent(S.repo) + '/git/blobs/' + f.sha, { headers: ghHeaders() })
        .then(function (r) { return r.json(); }).then(function (b) { return { text: A.b64dec(b.content), sha: f.sha }; });
    });
  };
  /* เขียนไฟล์ (b64 = เนื้อหาเป็น base64 แล้ว) */
  A.ghPut = function (path, b64, message, tries) {
    tries = tries || 1;
    return A.ghGet(path).then(function (cur) {
      var body = { message: message, content: b64, branch: S.branch };
      if (cur && cur.sha) body.sha = cur.sha;
      return fetch(contentsUrl(path), { method: 'PUT', headers: Object.assign({ 'Content-Type': 'application/json' }, ghHeaders()), body: JSON.stringify(body) }).then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (b) {
          if (res.ok) return b;
          if ((res.status === 409 || res.status === 422) && tries < 3) return A.delay(700 * tries).then(function () { return A.ghPut(path, b64, message, tries + 1); });
          throw new Error(ghErr(res, b));
        });
      });
    });
  };
  A.ghDelete = function (path, message) {
    return A.ghGet(path).then(function (cur) {
      if (!cur) return null;
      return fetch(contentsUrl(path), { method: 'DELETE', headers: Object.assign({ 'Content-Type': 'application/json' }, ghHeaders()), body: JSON.stringify({ message: message, sha: cur.sha, branch: S.branch }) })
        .then(function (res) { return res.json().catch(function () { return {}; }).then(function (b) { if (!res.ok) throw new Error(ghErr(res, b)); return b; }); });
    });
  };
  A.putJson = function (path, obj, message) { return A.ghPut(path, A.b64enc(JSON.stringify(obj, null, 2) + '\n'), message); };

  /* ---------- สคริปต์ชีท ---------- */
  A.api = function (payload, tries) {
    tries = tries || 1;
    if (!CFG.scriptUrl) return Promise.reject(new Error('ยังไม่ได้ตั้งค่า scriptUrl ใน config.js'));
    payload.pw = S.pw;
    return fetch(CFG.scriptUrl, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(payload) })
      .then(function (r) { return r.json(); })
      .then(function (res) {
        if (res && res.ok) return res;
        if (res && res.code === 'BUSY' && tries < 4) return A.delay(1200 * tries).then(function () { return A.api(payload, tries + 1); });
        var e = new Error((res && res.error) || 'เกิดข้อผิดพลาด'); e.code = res && res.code; throw e;
      }, function () {
        if (tries < 3) return A.delay(800 * tries).then(function () { return A.api(payload, tries + 1); });
        throw new Error('เชื่อมต่อชีทไม่ได้ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองอีกครั้ง');
      });
  };

  /* ---------- เข้าสู่ระบบ + โหลดข้อมูล ---------- */
  A.defaults = function () {
    return {
      schoolName: 'Sikhoraphumpisai School', title: 'ทวนความรู้ก่อนสอบ', welcome: '', levels: 6, rooms: 12, timeLimitMinutes: 20,
      registration: { prefixes: ['เด็กชาย', 'เด็กหญิง', 'นาย', 'นางสาว'], idPattern: '^[0-9]{5,6}$', idHint: 'ตัวเลข 5 หลัก', maxNo: 60 },
      theme: { primary: '#1D5FA8', accent: '#F2B705' },
      terms: { midterm: { label: 'กลางภาค', open: true }, final: { label: 'ปลายภาค', open: false } }, currentTerm: 'midterm',
      announcements: { '1': {}, '2': {}, '3': {}, '4': {}, '5': {}, '6': {} }, congratsTitle: 'ยินดีด้วย', congratsMessage: ''
    };
  };
  A.draftKey = function () { return 'adm_draft_' + S.owner + '/' + S.repo + '@' + S.branch; };
  A.login = function (o) {
    S.pw = o.pw; S.token = o.token; S.owner = o.owner.trim(); S.repo = o.repo.trim(); S.branch = (o.branch || 'main').trim();
    return A.api({ action: 'adminPing' }).then(function () { return A.ghCheckRepo(); }).then(function () {
      return Promise.all([A.readText(PATHS.settings), A.readText(PATHS.subjects)]);
    }).then(function (r) {
      var def = A.defaults(), st = r[0] ? JSON.parse(r[0].text) : {};
      S.settings = Object.assign({}, def, st);
      S.settings.registration = Object.assign({}, def.registration, st.registration || {});
      S.settings.terms = Object.assign({}, def.terms, st.terms || {});
      S.settings.announcements = Object.assign({}, def.announcements, st.announcements || {});
      S.subjects = r[1] ? JSON.parse(r[1].text) : [];
      S.q = {}; S.dirty = { settings: false, subjects: false, q: {} }; S.deletes = [];
      try { S.draft = JSON.parse(localStorage.getItem(A.draftKey()) || 'null'); } catch (e) { S.draft = null; }
    });
  };
  A.restoreDraft = function () {
    var d = S.draft; if (!d) return;
    if (d.settings) { S.settings = d.settings; S.dirty.settings = true; }
    if (d.subjects) { S.subjects = d.subjects; S.dirty.subjects = true; }
    Object.keys(d.q || {}).forEach(function (id) { S.q[id] = { questions: d.q[id] }; S.dirty.q[id] = true; });
    S.deletes = d.deletes || [];
    S.draft = null;
  };
  A.discardDraft = function () { S.draft = null; try { localStorage.removeItem(A.draftKey()); } catch (e) { /* ignore */ } };
  A.dirtyCount = function () { return (S.dirty.settings ? 1 : 0) + (S.dirty.subjects ? 1 : 0) + Object.keys(S.dirty.q).length + S.deletes.length; };
  A.saveDraft = function () {
    try {
      if (!A.dirtyCount()) { localStorage.removeItem(A.draftKey()); return; }
      var q = {}; Object.keys(S.dirty.q).forEach(function (id) { q[id] = S.q[id].questions; });
      localStorage.setItem(A.draftKey(), JSON.stringify({ settings: S.dirty.settings ? S.settings : null, subjects: S.dirty.subjects ? S.subjects : null, q: q, deletes: S.deletes }));
    } catch (e) { /* พื้นที่เต็ม ไม่ต้องทำอะไร */ }
  };
  A.mark = function (what, id) {
    if (what === 'q') S.dirty.q[id] = true; else S.dirty[what] = true;
    A.saveDraft();
  };
  A.loadQ = function (id) {
    if (S.q[id]) return Promise.resolve(S.q[id]);
    return A.readText(PATHS.questionsDir + '/' + encodeURIComponent(id) + '.json').then(function (f) {
      var j = f ? JSON.parse(f.text) : { questions: [] };
      S.q[id] = { questions: Array.isArray(j.questions) ? j.questions : [] };
      return S.q[id];
    });
  };
  A.subject = function (id) { for (var i = 0; i < S.subjects.length; i++) if (S.subjects[i].id === id) return S.subjects[i]; return null; };

  /* ---------- เผยแพร่ ---------- */
  A.publish = function (progress) {
    var tasks = [];
    Object.keys(S.dirty.q).forEach(function (id) {
      if (!A.subject(id)) return;
      tasks.push({ label: 'ข้อสอบ ' + A.subject(id).name, run: function () { return A.putJson(PATHS.questionsDir + '/' + id + '.json', { subjectId: id, questions: S.q[id].questions }, 'อัปเดตข้อสอบ ' + id); } });
    });
    S.deletes.forEach(function (id) {
      tasks.push({ label: 'ลบข้อสอบ ' + id, run: function () { return A.ghDelete(PATHS.questionsDir + '/' + id + '.json', 'ลบข้อสอบ ' + id); } });
    });
    if (S.dirty.subjects) tasks.push({ label: 'รายวิชา', run: function () { return A.putJson(PATHS.subjects, A.sortedSubjects(), 'อัปเดตรายวิชา'); } });
    if (S.dirty.settings) tasks.push({ label: 'ตั้งค่าเว็บและประกาศ', run: function () { return A.putJson(PATHS.settings, S.settings, 'อัปเดตตั้งค่าเว็บ'); } });
    var done = 0;
    return tasks.reduce(function (p, t) {
      return p.then(function () { progress && progress(t.label, done, tasks.length); return t.run().then(function () { done++; }); });
    }, Promise.resolve()).then(function () {
      S.dirty = { settings: false, subjects: false, q: {} }; S.deletes = []; A.saveDraft();
      return A.api({ action: 'adminSyncSubjects', subjects: S.subjects.map(function (s) { return { id: s.id, level: s.level, name: s.name, order: s.order || 0 }; }) }).catch(function () { return null; });
    }).then(function () { return done; });
  };
  A.sortedSubjects = function () {
    return S.subjects.slice().sort(function (a, b) { return (a.level - b.level) || ((a.order || 0) - (b.order || 0)); });
  };

  /* ---------- รูปภาพ ---------- */
  A.uploadImage = function (file, basename) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        var max = 1100, w = img.width, h = img.height, k = Math.min(1, max / Math.max(w, h));
        var c = document.createElement('canvas'); c.width = Math.round(w * k); c.height = Math.round(h * k);
        var g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        var data = c.toDataURL('image/jpeg', 0.88).split(',')[1];
        var path = 'img/' + basename + '-' + Date.now().toString(36) + '.jpg';
        A.ghPut(path, data, 'อัปโหลดรูป ' + path).then(function () { resolve(path); }, reject);
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('เปิดไฟล์รูปไม่ได้')); };
      img.src = url;
    });
  };
  A.uploadLogo = function (file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        var k = Math.min(1, 256 / Math.max(img.width, img.height));
        var c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
        A.ghPut('logo.png', c.toDataURL('image/png').split(',')[1], 'อัปเดตโลโก้').then(resolve, reject);
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('เปิดไฟล์รูปไม่ได้')); };
      img.src = url;
    });
  };

  /* ---------- CSV / วางจาก Excel ---------- */
  A.decodeBuffer = function (buf) {
    try { return new TextDecoder('utf-8', { fatal: true }).decode(buf).replace(/^﻿/, ''); }
    catch (e) { try { return new TextDecoder('windows-874').decode(buf); } catch (e2) { return new TextDecoder('utf-8').decode(buf); } }
  };
  A.parseTable = function (text) {
    text = String(text).replace(/^﻿/, '').replace(/\r\n?/g, '\n');
    var first = text.split('\n')[0] || '';
    var d = first.indexOf('\t') >= 0 ? '\t' : (first.split(';').length > first.split(',').length ? ';' : ',');
    var rows = [], row = [], cell = '', q = false;
    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      if (q) {
        if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch;
      } else if (ch === '"' && cell === '') q = true;
      else if (ch === d) { row.push(cell); cell = ''; }
      else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
      else cell += ch;
    }
    if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
    return rows.filter(function (r) { return r.some(function (c) { return String(c).trim() !== ''; }); });
  };
  var ANS = { 'ก': 0, 'ข': 1, 'ค': 2, 'ง': 3, 'a': 0, 'b': 1, 'c': 2, 'd': 3, '1': 0, '2': 1, '3': 2, '4': 3 };
  A.rowsToQuestions = function (rows) {
    var out = [], errors = [];
    if (rows.length && (/^(โจทย์|question)$/i.test(String(rows[0][0]).trim()) || /^ตัวเลือก/.test(String(rows[0][1] || '').trim()))) rows = rows.slice(1);
    rows.forEach(function (r, i) {
      var n = i + 1, c = r.map(function (x) { return String(x === undefined ? '' : x).trim(); });
      while (c.length < 8) c.push('');
      if (!c[0]) return errors.push('แถว ' + n + ': ไม่มีโจทย์');
      if (!c[1] || !c[2] || !c[3] || !c[4]) return errors.push('แถว ' + n + ': ตัวเลือกไม่ครบ 4 ข้อ');
      var key = A.digits(c[5]).toLowerCase().replace(/[\s.)]/g, '');
      if (!(key in ANS)) return errors.push('แถว ' + n + ': เฉลยต้องเป็น ก ข ค ง (หรือ 1-4 หรือ A-D)');
      var q = { q: c[0], choices: [c[1], c[2], c[3], c[4]], answer: ANS[key] };
      if (c[6]) q.explain = c[6];
      if (c[7]) { if (/^(https?:\/\/[^\s"'<>]+|[A-Za-z0-9_\-\/\.]+)$/.test(c[7])) q.img = c[7]; else errors.push('แถว ' + n + ': ชื่อรูปไม่ถูกต้อง (ข้ามรูปนี้)'); }
      out.push(q);
    });
    return { questions: out, errors: errors };
  };
  function csvCell(v) { v = String(v === undefined ? '' : v); return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
  A.questionsToCsv = function (qs) {
    var head = ['โจทย์', 'ตัวเลือก ก', 'ตัวเลือก ข', 'ตัวเลือก ค', 'ตัวเลือก ง', 'เฉลย', 'คำอธิบาย', 'รูปภาพ'];
    var lines = [head.join(',')];
    qs.forEach(function (q) {
      lines.push([q.q].concat(q.choices, ['กขคง'.charAt(q.answer), q.explain || '', q.img || '']).map(csvCell).join(','));
    });
    return '﻿' + lines.join('\r\n') + '\r\n';
  };
  A.templateCsv = function () {
    return A.questionsToCsv([
      { q: 'ตัวอย่าง: 2 + 3 มีค่าเท่าใด', choices: ['4', '5', '6', '7'], answer: 1, explain: '2 + 3 = 5' },
      { q: 'ตัวอย่าง: สูตรเคมีของน้ำคือข้อใด', choices: ['$CO_2$', '$H_2O$', '$O_2$', '$NaCl$'], answer: 1, explain: 'น้ำประกอบด้วยไฮโดรเจน 2 อะตอมกับออกซิเจน 1 อะตอม' }
    ]);
  };
  A.download = function (name, text, type) {
    var blob = new Blob([text], { type: type || 'text/csv;charset=utf-8' }), a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  };
  A.validateQuestion = function (q) {
    if (!q.q || !q.q.trim()) return 'กรุณากรอกโจทย์';
    if (!q.choices || q.choices.length !== 4 || q.choices.some(function (c) { return !String(c).trim(); })) return 'กรุณากรอกตัวเลือกให้ครบ 4 ข้อ';
    if (!(q.answer >= 0 && q.answer <= 3)) return 'กรุณาเลือกข้อที่ถูกต้อง';
    return '';
  };
})();
