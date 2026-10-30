/* ระบบผู้ดูแล - หน้าจอ */
(function () {
  'use strict';
  var A = window.Admin, S = A.S, CFG = window.APP_CONFIG || {};
  var app = document.getElementById('app');
  var view = 'home', curSubject = '', statsLevel = '1', busyPub = false, pubMsg = null;

  /* ---------- ตัวช่วยสร้างหน้า ---------- */
  function add(n, c) {
    if (c === null || c === undefined || c === false) return;
    if (Array.isArray(c)) { c.forEach(function (x) { add(n, x); }); return; }
    n.appendChild(typeof c === 'object' ? c : document.createTextNode(String(c)));
  }
  function el(tag, props) {
    var n = document.createElement(tag); props = props || {};
    Object.keys(props).forEach(function (k) {
      var v = props[k];
      if (v === null || v === undefined || v === false) return;
      if (k === 'class') n.className = v; else if (k === 'text') n.textContent = v;
      else if (k === 'value') n.value = v;
      else if (k.slice(0, 2) === 'on') n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v === true ? '' : v);
    });
    for (var i = 2; i < arguments.length; i++) add(n, arguments[i]);
    return n;
  }
  function btn(label, cls, fn, extra) { return el('button', Object.assign({ class: 'btn ' + cls, type: 'button', onclick: fn }, extra || {}), label); }
  function field(label, input, hint) { return el('div', { class: 'field' }, el('label', null, label, hint ? el('span', { class: 'hint', text: ' ' + hint }) : null), input); }
  function sel(options, value, onchange, id) {
    var s = el('select', { id: id || null, onchange: onchange });
    options.forEach(function (o) { var op = el('option', { value: o[0] }, o[1]); if (String(o[0]) === String(value)) op.selected = true; s.appendChild(op); });
    return s;
  }
  function msg(type, text) { return el('div', { class: 'msg ' + type, role: type === 'err' ? 'alert' : 'status' }, text); }
  function modal(title, content, wide) {
    var ov = el('div', { class: 'overlay', role: 'dialog', 'aria-modal': 'true' });
    var m = el('div', { class: 'modal' + (wide ? ' big' : ''), tabindex: '-1' }, el('h2', { text: title }), content);
    ov.appendChild(m); document.body.appendChild(ov); m.focus();
    return { close: function () { ov.remove(); }, box: m };
  }
  function seq(n) { var a = []; for (var i = 1; i <= n; i++) a.push(i); return a; }
  function lvOpts(all) { return (all ? [['', 'ทุกชั้น']] : []).concat(seq(6).map(function (n) { return [n, 'ม.' + n]; })); }
  function termLabel(t) { var x = S.settings.terms[t]; return x && x.label ? x.label : t; }
  function errText(e) { return e && e.message ? e.message : String(e); }

  /* ---------- เข้าสู่ระบบ ---------- */
  function showLogin(note) {
    document.getElementById('adminBar').hidden = true;
    var saved = {}; try { saved = JSON.parse(localStorage.getItem('adm_repo') || '{}'); } catch (e) { /* ignore */ }
    var rp = CFG.repo || {};
    var f = {
      pw: el('input', { type: 'password', id: 'a-pw', autocomplete: 'current-password' }),
      token: el('input', { type: 'password', id: 'a-token', autocomplete: 'off', placeholder: 'github_pat_...' }),
      owner: el('input', { type: 'text', id: 'a-owner', value: saved.owner || rp.owner || '', autocomplete: 'off' }),
      repo: el('input', { type: 'text', id: 'a-repo', value: saved.repo || rp.name || '', autocomplete: 'off' }),
      branch: el('input', { type: 'text', id: 'a-branch', value: saved.branch || rp.branch || 'main', autocomplete: 'off' }),
      remember: el('input', { type: 'checkbox', id: 'a-rem', style: 'width:22px;min-height:0;margin-right:8px' })
    };
    try { var t = localStorage.getItem('adm_tok'); if (t) { f.token.value = t; f.remember.checked = true; } } catch (e) { /* ignore */ }
    var out = el('div'); if (note) out.appendChild(msg('warn', note));
    var go = el('button', { class: 'btn btn-primary btn-block', type: 'submit' }, 'เข้าสู่ระบบผู้ดูแล');
    var form = el('form', { novalidate: true, onsubmit: function (e) {
      e.preventDefault(); out.textContent = '';
      var v = { pw: f.pw.value, token: f.token.value.trim(), owner: f.owner.value, repo: f.repo.value, branch: f.branch.value };
      if (!v.pw || !v.token || !v.owner.trim() || !v.repo.trim()) { out.appendChild(msg('err', 'กรุณากรอกข้อมูลให้ครบทุกช่อง')); return; }
      go.disabled = true; go.textContent = 'กำลังตรวจสอบและโหลดข้อมูล...';
      A.login(v).then(function () {
        try {
          localStorage.setItem('adm_repo', JSON.stringify({ owner: v.owner.trim(), repo: v.repo.trim(), branch: v.branch.trim() }));
          if (f.remember.checked) localStorage.setItem('adm_tok', v.token); else localStorage.removeItem('adm_tok');
        } catch (x) { /* ignore */ }
        if (S.draft && window.confirm('พบงานที่แก้ไขไว้แต่ยังไม่ได้เผยแพร่ (จากครั้งก่อน) ต้องการกู้คืนหรือไม่?\nกดตกลง = กู้คืน, กดยกเลิก = ทิ้ง')) A.restoreDraft(); else A.discardDraft();
        view = 'home'; shell();
      }).catch(function (e) {
        go.disabled = false; go.textContent = 'เข้าสู่ระบบผู้ดูแล'; out.appendChild(msg('err', errText(e)));
      });
    } },
      out,
      field('รหัสผ่านผู้ดูแล', f.pw, '(ตั้งไว้ในสคริปต์ชีท)'),
      field('โทเคน GitHub', f.token, '(ใช้เผยแพร่ข้อสอบ ดูวิธีสร้างด้านล่างฟอร์ม)'),
      el('div', { class: 'grid3' }, field('ชื่อผู้ใช้ GitHub', f.owner), field('ชื่อที่เก็บ (repository)', f.repo), field('สาขา', f.branch)),
      el('div', { class: 'field' }, el('label', { style: 'display:flex;align-items:center;font-weight:400' }, f.remember, 'จำโทเคนไว้ในเครื่องนี้ (ใช้เฉพาะเครื่องส่วนตัว)')),
      go);
    var how = el('details', { style: 'margin-top:16px' }, el('summary', { style: 'cursor:pointer;font-weight:700;color:var(--blue-dark)' }, 'วิธีสร้างโทเคน GitHub (ทำครั้งเดียว)'),
      el('ol', null,
        el('li', { text: 'เข้า github.com แล้วล็อกอิน กดรูปโปรไฟล์ แล้วเลือก Settings' }),
        el('li', { text: 'เลื่อนลงล่างสุดทางซ้าย กด Developer settings > Personal access tokens > Fine-grained tokens > Generate new token' }),
        el('li', { text: 'ตั้งชื่อ เช่น exam-admin และตั้งวันหมดอายุ เช่น 1 ปี' }),
        el('li', { text: 'Repository access: เลือก Only select repositories แล้วเลือกที่เก็บของเว็บนี้เท่านั้น' }),
        el('li', { text: 'Permissions > Repository permissions > Contents: เลือก Read and write' }),
        el('li', { text: 'กด Generate token แล้วคัดลอกข้อความที่ขึ้นต้นด้วย github_pat_ มาวางในช่องด้านบน (จะเห็นครั้งเดียว) ห้ามส่งให้ผู้อื่น' })));
    mount(el('div', { class: 'card orn', style: 'max-width:560px;margin:0 auto' }, el('div', { class: 'hero' }, el('h1', { text: 'เข้าสู่ระบบผู้ดูแล' })), form, how));
  }
  function mount(node) { app.textContent = ''; app.appendChild(node); window.scrollTo(0, 0); }

  /* ---------- โครงหน้าหลัก ---------- */
  var TABS = [['home', 'ภาพรวม'], ['subjects', 'วิชา'], ['questions', 'ข้อสอบ'], ['announce', 'ประกาศ/ตารางสอบ'], ['settings', 'ตั้งค่าเว็บ'], ['students', 'นักเรียน'], ['stats', 'สถิติ'], ['help', 'วิธีใช้']];
  var content;
  function shell() {
    var bar = document.getElementById('adminBar'); bar.hidden = false; bar.textContent = '';
    bar.appendChild(el('button', { class: 'btn-out', type: 'button', onclick: function () {
      if (A.dirtyCount() && !window.confirm('มีงานที่ยังไม่ได้เผยแพร่ (เก็บร่างไว้ในเครื่องนี้) ต้องการออกจากระบบหรือไม่?')) return;
      S.pw = ''; S.token = ''; showLogin();
    } }, 'ออกจากระบบ'));
    document.getElementById('adminSub').textContent = S.settings.schoolName;
    var wrap = el('div');
    var nav = el('nav', { class: 'navtabs', 'aria-label': 'เมนู' });
    TABS.forEach(function (t) { nav.appendChild(el('button', { type: 'button', 'aria-current': view === t[0] ? 'page' : null, onclick: function () { view = t[0]; shell(); } }, t[1])); });
    wrap.appendChild(nav);
    wrap.appendChild(pubBar());
    content = el('div'); wrap.appendChild(content);
    mount(wrap);
    ({ home: vHome, subjects: vSubjects, questions: vQuestions, announce: vAnnounce, settings: vSettings, students: vStudents, stats: vStats, help: vHelp })[view](content);
  }
  function refreshPub() { var old = document.querySelector('.pubbar'); if (old) old.replaceWith(pubBar()); }
  function pubBar() {
    var n = A.dirtyCount();
    var bar = el('div', { class: 'pubbar' + (n ? '' : ' clean') });
    var txt = pubMsg ? pubMsg : (n ? 'มีการเปลี่ยนแปลง ' + n + ' รายการที่ยังไม่ได้เผยแพร่ขึ้นเว็บ' : 'ข้อมูลบนเว็บเป็นปัจจุบันแล้ว');
    bar.appendChild(el('span', { id: 'pubText', text: txt }));
    bar.appendChild(btn(busyPub ? 'กำลังเผยแพร่...' : 'เผยแพร่ขึ้นเว็บ', 'btn-gold btn-sm', doPublish, { disabled: !n || busyPub, id: 'pubBtn' }));
    return bar;
  }
  function doPublish() {
    if (busyPub || !A.dirtyCount()) return;
    var warn = [];
    S.subjects.forEach(function (s) { if (s.open !== false && S.q[s.id] && !S.q[s.id].questions.length) warn.push(s.name); });
    if (warn.length && !window.confirm('วิชาเหล่านี้เปิดอยู่แต่ยังไม่มีข้อสอบ: ' + warn.join(', ') + '\nต้องการเผยแพร่ต่อหรือไม่?')) return;
    busyPub = true; pubMsg = 'กำลังเผยแพร่...'; refreshPub();
    A.publish(function (label, i, total) { pubMsg = 'กำลังเผยแพร่ (' + (i + 1) + '/' + total + '): ' + label; var t = document.getElementById('pubText'); if (t) t.textContent = pubMsg; })
      .then(function (n) { busyPub = false; pubMsg = 'เผยแพร่สำเร็จ ' + n + ' รายการ หน้าเว็บจะอัปเดตภายใน 1-2 นาที'; shell(); })
      .catch(function (e) { busyPub = false; pubMsg = 'เผยแพร่ไม่สำเร็จ: ' + errText(e) + ' (งานยังเก็บไว้ ลองกดเผยแพร่อีกครั้ง)'; shell(); });
  }
  window.addEventListener('beforeunload', function (e) { if (A.dirtyCount()) { e.preventDefault(); e.returnValue = ''; } });

  /* ---------- ภาพรวม ---------- */
  function vHome(box) {
    var total = S.subjects.length, open = S.subjects.filter(function (s) { return s.open !== false; }).length;
    box.appendChild(el('div', { class: 'card orn' }, el('h2', { text: 'ภาพรวม' }),
      el('p', { text: 'มีรายวิชาทั้งหมด ' + total + ' วิชา (เปิดอยู่ ' + open + ' วิชา)' }),
      el('p', { text: 'ภาคเรียนที่ใช้งานอยู่: ' + termLabel(S.settings.currentTerm) + (S.settings.terms[S.settings.currentTerm] && S.settings.terms[S.settings.currentTerm].open === false ? ' (ล็อกอยู่)' : ' (เปิด)') }),
      el('p', { class: 'muted', text: 'การแก้ไขทุกอย่างจะเก็บเป็นร่างก่อน นักเรียนจะเห็นเมื่อกด "เผยแพร่ขึ้นเว็บ" ที่แถบด้านบน' })));
    var st = el('div', { id: 'homeMsg' });
    box.appendChild(el('div', { class: 'card' }, el('h3', { text: 'เครื่องมือ' }), el('div', { class: 'toolbar' },
      btn('ดูหน้านักเรียน', 'btn-ghost btn-sm', function () { window.open('index.html', '_blank'); }),
      btn('เรียงชีทคะแนนใหม่ทันที', 'btn-ghost btn-sm', function () {
        st.textContent = ''; st.appendChild(msg('warn', 'กำลังเรียงข้อมูลในชีท...'));
        A.api({ action: 'adminSort' }).then(function () { st.textContent = ''; st.appendChild(msg('ok', 'เรียงชีทตามชั้น ห้อง เลขที่ เรียบร้อย')); }).catch(function (e) { st.textContent = ''; st.appendChild(msg('err', errText(e))); });
      }),
      btn('ดาวน์โหลดสำรองข้อมูลทั้งหมด', 'btn-ghost btn-sm', function () {
        st.textContent = ''; st.appendChild(msg('warn', 'กำลังรวบรวมข้อมูลสำรอง...'));
        Promise.all(S.subjects.map(function (s) { return A.loadQ(s.id); })).then(function () {
          var qs = {}; S.subjects.forEach(function (s) { qs[s.id] = S.q[s.id].questions; });
          A.download('backup-' + new Date().toISOString().slice(0, 10) + '.json', JSON.stringify({ settings: S.settings, subjects: S.subjects, questions: qs }, null, 2), 'application/json');
          st.textContent = ''; st.appendChild(msg('ok', 'ดาวน์โหลดไฟล์สำรองแล้ว'));
        }).catch(function (e) { st.textContent = ''; st.appendChild(msg('err', errText(e))); });
      })), st));
    box.appendChild(el('div', { class: 'card' }, el('h3', { text: 'เริ่มต้นใช้งานอย่างไร' }), el('ol', null,
      el('li', { text: 'ไปที่แท็บ "วิชา" เพิ่มวิชาของแต่ละชั้น' }), el('li', { text: 'ไปที่แท็บ "ข้อสอบ" เลือกวิชา แล้วเพิ่มข้อสอบทีละข้อ หรือนำเข้าจากไฟล์ CSV / วางจาก Excel' }),
      el('li', { text: 'ใส่ประกาศและตารางสอบของแต่ละชั้นที่แท็บ "ประกาศ/ตารางสอบ"' }), el('li', { text: 'กด "เผยแพร่ขึ้นเว็บ" แล้วรอ 1-2 นาที' }))));
  }

  /* ---------- วิชา ---------- */
  function normalizeOrder(level) {
    S.subjects.filter(function (s) { return +s.level === level; }).sort(function (a, b) { return (a.order || 0) - (b.order || 0); }).forEach(function (s, i) { s.order = i + 1; });
  }
  function vSubjects(box) {
    var terms = Object.keys(S.settings.terms).map(function (t) { return [t, termLabel(t)]; });
    var nm = el('input', { type: 'text', id: 's-name', maxlength: '60', placeholder: 'เช่น คณิตศาสตร์พื้นฐาน' });
    var lv = sel(lvOpts(false), 1, null, 's-level'), tm = sel(terms, S.settings.currentTerm, null, 's-term'), err = el('div', { class: 'fe', role: 'alert' });
    box.appendChild(el('div', { class: 'card orn' }, el('h2', { text: 'เพิ่มวิชา' }),
      el('div', { class: 'cols4' }, field('ชั้น', lv), field('ภาคเรียน', tm), el('div', { class: 'field', style: 'grid-column:span 2' }, el('label', { for: 's-name' }, 'ชื่อวิชา'), nm)), err,
      btn('เพิ่มวิชา', 'btn-primary', function () {
        var name = nm.value.replace(/\s+/g, ' ').trim(); err.textContent = '';
        if (!name) { err.textContent = 'กรุณากรอกชื่อวิชา'; return; }
        var level = +lv.value;
        if (S.subjects.some(function (s) { return +s.level === level && s.term === tm.value && s.name === name; })) { err.textContent = 'มีวิชานี้ในชั้นและภาคเรียนนี้แล้ว'; return; }
        normalizeOrder(level);
        var max = S.subjects.filter(function (s) { return +s.level === level; }).length;
        S.subjects.push({ id: A.newSubjectId(level), level: level, name: name, term: tm.value, order: max + 1, open: true });
        S.q[S.subjects[S.subjects.length - 1].id] = { questions: [] };
        A.mark('subjects'); shell();
      })));
    seq(6).forEach(function (n) {
      var list = S.subjects.filter(function (s) { return +s.level === n; }).sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
      var sec = el('div', { class: 'card' }, el('h3', { text: 'มัธยมศึกษาปีที่ ' + n + ' (' + list.length + ' วิชา)' }));
      if (!list.length) sec.appendChild(el('p', { class: 'muted', text: 'ยังไม่มีวิชา' }));
      list.forEach(function (s, i) {
        sec.appendChild(el('div', { class: 'item' },
          el('div', { class: 'main' }, el('b', { text: s.name }), el('span', { class: 'pill', text: termLabel(s.term) }), el('span', { class: 'pill ' + (s.open === false ? 'grey' : 'gold'), text: s.open === false ? 'ปิดอยู่' : 'เปิดอยู่' }), s.timeLimit ? el('span', { class: 'pill', text: s.timeLimit + ' นาที' }) : null),
          el('div', { class: 'acts' },
            btn('ขึ้น', 'btn-ghost btn-sm', function () { moveSubject(n, i, -1); }, { disabled: i === 0, 'aria-label': 'เลื่อนขึ้น ' + s.name }),
            btn('ลง', 'btn-ghost btn-sm', function () { moveSubject(n, i, 1); }, { disabled: i === list.length - 1, 'aria-label': 'เลื่อนลง ' + s.name }),
            btn(s.open === false ? 'เปิดวิชา' : 'ปิดวิชา', 'btn-ghost btn-sm', function () { s.open = s.open === false; A.mark('subjects'); shell(); }),
            btn('ข้อสอบ', 'btn-ghost btn-sm', function () { curSubject = s.id; view = 'questions'; shell(); }),
            btn('แก้ไข', 'btn-ghost btn-sm', function () { editSubject(s); }),
            btn('ลบ', 'btn-danger btn-sm', function () {
              if (!window.confirm('ลบวิชา "' + s.name + '" และข้อสอบทั้งหมดของวิชานี้?\nคะแนนที่เคยบันทึกในชีทจะยังอยู่ แต่จะไม่แสดงบนเว็บ')) return;
              S.subjects = S.subjects.filter(function (x) { return x.id !== s.id; });
              delete S.q[s.id]; delete S.dirty.q[s.id];
              if (S.deletes.indexOf(s.id) < 0) S.deletes.push(s.id);
              A.mark('subjects'); shell();
            }))));
      });
      box.appendChild(sec);
    });
  }
  function moveSubject(level, i, d) {
    normalizeOrder(level);
    var list = S.subjects.filter(function (s) { return +s.level === level; }).sort(function (a, b) { return a.order - b.order; });
    var a = list[i], b = list[i + d]; if (!a || !b) return;
    var t = a.order; a.order = b.order; b.order = t; A.mark('subjects'); shell();
  }
  function editSubject(s) {
    var nm = el('input', { type: 'text', value: s.name, maxlength: '60' });
    var tm = sel(Object.keys(S.settings.terms).map(function (t) { return [t, termLabel(t)]; }), s.term, null);
    var tl = el('input', { type: 'text', inputmode: 'numeric', value: s.timeLimit || '', placeholder: 'เว้นว่าง = ' + S.settings.timeLimitMinutes + ' นาที' });
    var err = el('div', { class: 'fe', role: 'alert' });
    var m = modal('แก้ไขวิชา', el('div', null, field('ชื่อวิชา', nm), field('ภาคเรียน', tm), field('เวลาทำข้อสอบ (นาที)', tl, '(ไม่บังคับ)'), el('p', { class: 'muted', text: 'รหัสวิชา: ' + s.id + ' (แก้ไม่ได้)' }), err,
      el('div', { class: 'row' }, btn('บันทึก', 'btn-primary', function () {
        var name = nm.value.replace(/\s+/g, ' ').trim(), t = parseInt(A.digits(tl.value), 10);
        if (!name) { err.textContent = 'กรุณากรอกชื่อวิชา'; return; }
        if (tl.value.trim() && !(t >= 1 && t <= 300)) { err.textContent = 'เวลาต้องเป็นตัวเลข 1-300 นาที'; return; }
        s.name = name; s.term = tm.value; if (tl.value.trim()) s.timeLimit = t; else delete s.timeLimit;
        A.mark('subjects'); m.close(); shell();
      }), btn('ยกเลิก', 'btn-ghost', function () { m.close(); }))));
  }

  /* ---------- ข้อสอบ ---------- */
  function vQuestions(box) {
    var opts = [['', '-- เลือกวิชา --']];
    A.sortedSubjects().forEach(function (s) { opts.push([s.id, 'ม.' + s.level + ' ' + s.name + ' (' + termLabel(s.term) + ')']); });
    var picker = sel(opts, curSubject, function (e) { curSubject = e.target.value; shell(); }, 'q-subject');
    box.appendChild(el('div', { class: 'card orn' }, el('h2', { text: 'ข้อสอบ' }), field('วิชา', picker)));
    if (!curSubject || !A.subject(curSubject)) { box.appendChild(el('p', { class: 'muted', text: 'เลือกวิชาเพื่อจัดการข้อสอบ ถ้ายังไม่มีวิชาให้ไปเพิ่มที่แท็บ "วิชา" ก่อน' })); return; }
    var holder = el('div', { class: 'card' }, el('p', { text: 'กำลังโหลดข้อสอบ...' }));
    box.appendChild(holder);
    var id = curSubject;
    A.loadQ(id).then(function () { if (curSubject === id) renderQList(holder, id); }).catch(function (e) { holder.textContent = ''; holder.appendChild(msg('err', errText(e))); });
  }
  function renderQList(holder, id) {
    var data = S.q[id], qs = data.questions, sub = A.subject(id);
    holder.textContent = '';
    holder.appendChild(el('h3', { text: sub.name + ' - ' + qs.length + ' ข้อ' }));
    holder.appendChild(el('div', { class: 'toolbar' },
      btn('เพิ่มข้อสอบ', 'btn-primary btn-sm', function () { editQuestion(id, -1); }),
      btn('นำเข้าจาก CSV / Excel', 'btn-gold btn-sm', function () { importDialog(id); }),
      btn('ดาวน์โหลดเป็น CSV', 'btn-ghost btn-sm', function () { A.download(id + '.csv', A.questionsToCsv(qs)); }, { disabled: !qs.length }),
      btn('ดาวน์โหลดไฟล์ตัวอย่าง', 'btn-ghost btn-sm', function () { A.download('ตัวอย่างข้อสอบ.csv', A.templateCsv()); })));
    if (!qs.length) holder.appendChild(el('p', { class: 'muted', text: 'ยังไม่มีข้อสอบในวิชานี้' }));
    qs.forEach(function (q, i) {
      holder.appendChild(el('div', { class: 'item' },
        el('div', { class: 'main' }, el('b', { text: 'ข้อ ' + (i + 1) }), el('div', { class: 'qprev', text: q.q.length > 140 ? q.q.slice(0, 140) + '...' : q.q }), el('span', { class: 'pill gold', text: 'เฉลย ' + 'กขคง'.charAt(q.answer) }), q.img ? el('span', { class: 'pill', text: 'มีรูป' }) : null, q.explain ? el('span', { class: 'pill', text: 'มีคำอธิบาย' }) : null),
        el('div', { class: 'acts' },
          btn('ขึ้น', 'btn-ghost btn-sm', function () { swapQ(id, i, -1, holder); }, { disabled: i === 0 }),
          btn('ลง', 'btn-ghost btn-sm', function () { swapQ(id, i, 1, holder); }, { disabled: i === qs.length - 1 }),
          btn('แก้ไข', 'btn-ghost btn-sm', function () { editQuestion(id, i); }),
          btn('ลบ', 'btn-danger btn-sm', function () {
            if (!window.confirm('ลบข้อ ' + (i + 1) + ' ?')) return;
            qs.splice(i, 1); A.mark('q', id); refreshPub(); renderQList(holder, id);
          }))));
    });
  }
  function swapQ(id, i, d, holder) {
    var qs = S.q[id].questions, t = qs[i]; qs[i] = qs[i + d]; qs[i + d] = t; A.mark('q', id); refreshPub(); renderQList(holder, id);
  }
  function editQuestion(id, idx) {
    var qs = S.q[id].questions, q = idx >= 0 ? qs[idx] : { q: '', choices: ['', '', '', ''], answer: -1 };
    var txt = el('textarea', { id: 'e-q', value: q.q, placeholder: 'พิมพ์โจทย์ ถ้ามีสูตรให้ใส่ระหว่าง $ เช่น $x^2 + 3x$' });
    var img = el('input', { type: 'text', id: 'e-img', value: q.img || '', placeholder: 'เช่น img/xxx.jpg หรือลิงก์รูป' });
    var thumb = el('img', { class: 'thumb', alt: 'ตัวอย่างรูป', hidden: !q.img }); if (q.img) thumb.src = q.img;
    var upStatus = el('div', { class: 'hint', role: 'status' });
    var file = el('input', { type: 'file', accept: 'image/*', id: 'e-file' });
    file.addEventListener('change', function () {
      var f = file.files[0]; if (!f) return;
      upStatus.textContent = 'กำลังอัปโหลดรูป...';
      A.uploadImage(f, id).then(function (path) { img.value = path; thumb.src = path + '?t=' + Date.now(); thumb.hidden = false; upStatus.textContent = 'อัปโหลดแล้ว: ' + path; })
        .catch(function (e) { upStatus.textContent = 'อัปโหลดไม่สำเร็จ: ' + errText(e); });
    });
    var chosen = q.answer, radios = [], inputs = [];
    for (var k = 0; k < 4; k++) (function (k) {
      var r = el('input', { type: 'radio', name: 'e-ans', 'aria-label': 'เลือกตัวเลือก ' + 'กขคง'.charAt(k) + ' เป็นคำตอบที่ถูก' }); r.checked = chosen === k; r.addEventListener('change', function () { chosen = k; });
      var t = el('input', { type: 'text', value: q.choices[k] || '', placeholder: 'ตัวเลือก ' + 'กขคง'.charAt(k), 'aria-label': 'ตัวเลือก ' + 'กขคง'.charAt(k) });
      radios.push(r); inputs.push(t);
    })(k);
    var exp = el('textarea', { id: 'e-exp', value: q.explain || '', style: 'min-height:70px', placeholder: 'อธิบายเฉลย (ไม่บังคับ)' });
    var err = el('div', { class: 'fe', role: 'alert' });
    var m = modal(idx >= 0 ? 'แก้ไขข้อ ' + (idx + 1) : 'เพิ่มข้อสอบ', el('div', null,
      field('โจทย์', txt), field('รูปประกอบ', el('div', null, img, el('div', { style: 'margin-top:6px' }, file), upStatus, thumb), '(ไม่บังคับ)'),
      el('p', { class: 'hint', text: 'ติ๊กวงกลมหน้าตัวเลือกที่เป็นคำตอบที่ถูกต้อง' }),
      el('div', null, [0, 1, 2, 3].map(function (i) { return el('div', { class: 'radio' }, radios[i], el('b', { text: 'กขคง'.charAt(i) + '.' }), inputs[i]); })),
      field('คำอธิบายเฉลย', exp), err,
      el('div', { class: 'row' }, btn('บันทึก', 'btn-primary', function () {
        var nq = { q: txt.value.trim(), choices: inputs.map(function (x) { return x.value.trim(); }), answer: chosen };
        if (exp.value.trim()) nq.explain = exp.value.trim();
        var iv = img.value.trim();
        if (iv) { if (!/^(https?:\/\/[^\s"'<>]+|[A-Za-z0-9_\-\/\.]+)$/.test(iv)) { err.textContent = 'ชื่อไฟล์หรือลิงก์รูปไม่ถูกต้อง'; return; } nq.img = iv; }
        var e = A.validateQuestion(nq); if (e) { err.textContent = e; return; }
        if (idx >= 0) qs[idx] = nq; else qs.push(nq);
        A.mark('q', id); m.close(); shell();
      }), btn('ยกเลิก', 'btn-ghost', function () { m.close(); }))), true);
    txt.focus();
  }
  function importDialog(id) {
    var qs = S.q[id].questions;
    var area = el('textarea', { id: 'i-paste', style: 'min-height:110px', placeholder: 'หรือคัดลอกจาก Excel (เลือกเซลล์ทั้งหมดที่เป็นข้อสอบ ไม่ต้องรวมแถวหัวตาราง) แล้ววางที่นี่' });
    var file = el('input', { type: 'file', accept: '.csv,.tsv,.txt,text/csv', id: 'i-file' });
    var mode = sel([['append', 'เพิ่มต่อท้ายข้อสอบเดิม'], ['replace', 'แทนที่ข้อสอบเดิมทั้งหมด']], 'append', null, 'i-mode');
    var report = el('div', { id: 'i-report' }), parsed = null;
    var go = btn('นำเข้า', 'btn-primary', function () {
      if (!parsed || !parsed.questions.length) return;
      if (mode.value === 'replace' && qs.length && !window.confirm('ข้อสอบเดิม ' + qs.length + ' ข้อจะถูกแทนที่ทั้งหมด ต้องการดำเนินการต่อหรือไม่?')) return;
      if (mode.value === 'replace') S.q[id].questions = parsed.questions; else parsed.questions.forEach(function (x) { qs.push(x); });
      A.mark('q', id); m.close(); shell();
    }, { disabled: true });
    function check(text) {
      report.textContent = ''; parsed = null; go.disabled = true;
      if (!text.trim()) { report.appendChild(msg('warn', 'ยังไม่มีข้อมูล เลือกไฟล์หรือวางข้อมูลก่อน')); return; }
      parsed = A.rowsToQuestions(A.parseTable(text));
      report.appendChild(msg(parsed.questions.length ? 'ok' : 'err', 'อ่านข้อสอบที่ถูกต้องได้ ' + parsed.questions.length + ' ข้อ' + (parsed.errors.length ? ' และมี ' + parsed.errors.length + ' แถวที่มีปัญหา (จะถูกข้าม)' : '')));
      if (parsed.errors.length) report.appendChild(el('ul', { class: 'errlist' }, parsed.errors.slice(0, 50).map(function (x) { return el('li', { text: x }); })));
      go.disabled = !parsed.questions.length;
    }
    file.addEventListener('change', function () {
      var f = file.files[0]; if (!f) return;
      var rd = new FileReader(); rd.onload = function () { var t = A.decodeBuffer(rd.result); area.value = t; check(t); }; rd.readAsArrayBuffer(f);
    });
    var m = modal('นำเข้าข้อสอบจาก CSV / Excel', el('div', null,
      el('p', { class: 'muted', text: 'คอลัมน์ตามลำดับ: โจทย์ | ตัวเลือก ก | ข | ค | ง | เฉลย (ก ข ค ง) | คำอธิบาย (ไม่บังคับ) | ชื่อรูป (ไม่บังคับ) ดูรายละเอียดที่แท็บ "วิธีใช้" หรือกด "ดาวน์โหลดไฟล์ตัวอย่าง"' }),
      field('เลือกไฟล์ CSV', file), area, field('วิธีนำเข้า', mode), report,
      el('div', { class: 'row' }, btn('ตรวจสอบข้อมูล', 'btn-gold', function () { check(area.value); }), go, btn('ปิด', 'btn-ghost', function () { m.close(); }))), true);
  }

  /* ---------- ประกาศ / ตารางสอบ ---------- */
  var annLevel = '1';
  function vAnnounce(box) {
    box.appendChild(el('div', { class: 'card orn' }, el('h2', { text: 'ประกาศและตารางสอบแต่ละชั้น' }), el('p', { class: 'muted', text: 'นักเรียนจะเห็นประกาศหลังจากกดเข้าชั้นเรียนนั้น' }),
      field('ชั้น', sel(lvOpts(false), annLevel, function (e) { annLevel = e.target.value; shell(); }, 'a-level'))));
    var a = S.settings.announcements[annLevel] = S.settings.announcements[annLevel] || {};
    a.schedule = a.schedule || [];
    function touch() { A.mark('settings'); refreshPub(); }
    var title = el('input', { type: 'text', value: a.title || '', maxlength: '80', id: 'a-title', placeholder: 'เช่น ตารางสอบกลางภาค' });
    title.addEventListener('input', function () { a.title = title.value; touch(); });
    var text = el('textarea', { id: 'a-text', value: a.text || '', placeholder: 'ข้อความประกาศ' });
    text.addEventListener('input', function () { a.text = text.value; touch(); });
    var card = el('div', { class: 'card' }, field('หัวข้อประกาศ', title), field('ข้อความ', text), el('h3', { text: 'ตารางสอบ' }));
    var tb = el('div');
    function renderRows() {
      tb.textContent = '';
      var dl = el('datalist', { id: 'subj-list' }, S.subjects.filter(function (s) { return +s.level === +annLevel; }).map(function (s) { return el('option', { value: s.name }); }));
      tb.appendChild(dl);
      a.schedule.forEach(function (r, i) {
        function inp(key, ph, list) { var x = el('input', { type: 'text', value: r[key] || '', placeholder: ph, list: list || null, 'aria-label': ph }); x.addEventListener('input', function () { r[key] = x.value; touch(); }); return x; }
        tb.appendChild(el('div', { class: 'item' }, el('div', { class: 'cols4', style: 'flex:1 1 100%' }, inp('subject', 'วิชา', 'subj-list'), inp('date', 'วันที่ เช่น 5 ม.ค. 2570'), inp('time', 'เวลา เช่น 09:00-10:00'),
          btn('ลบแถว', 'btn-danger btn-sm', function () { a.schedule.splice(i, 1); touch(); renderRows(); }))));
      });
    }
    renderRows(); card.appendChild(tb);
    card.appendChild(btn('เพิ่มแถวตาราง', 'btn-ghost btn-sm', function () { a.schedule.push({ subject: '', date: '', time: '' }); touch(); renderRows(); }));
    box.appendChild(card);
  }

  /* ---------- ตั้งค่าเว็บ ---------- */
  function vSettings(box) {
    var st = S.settings;
    function bind(input, set) { input.addEventListener('change', function () { set(input.value); A.mark('settings'); refreshPub(); }); return input; }
    var card = el('div', { class: 'card orn' }, el('h2', { text: 'ตั้งค่าเว็บ' }),
      field('ชื่อโรงเรียน', bind(el('input', { type: 'text', value: st.schoolName, id: 'st-school' }), function (v) { st.schoolName = v; })),
      field('ชื่อเว็บ', bind(el('input', { type: 'text', value: st.title, id: 'st-title' }), function (v) { st.title = v; })),
      field('ข้อความต้อนรับ', bind(el('input', { type: 'text', value: st.welcome || '', id: 'st-welcome' }), function (v) { st.welcome = v; })),
      el('div', { class: 'cols2' },
        field('เวลาทำข้อสอบมาตรฐาน (นาที)', bind(el('input', { type: 'text', inputmode: 'numeric', value: st.timeLimitMinutes, id: 'st-time' }), function (v) { var n = parseInt(A.digits(v), 10); if (n >= 1 && n <= 300) st.timeLimitMinutes = n; })),
        field('คำนำหน้าที่ให้เลือก (คั่นด้วยเครื่องหมายจุลภาค)', bind(el('input', { type: 'text', value: st.registration.prefixes.join(', '), id: 'st-prefix' }), function (v) { var p = v.split(',').map(function (x) { return x.trim(); }).filter(Boolean); if (p.length) st.registration.prefixes = p; }))),
      el('div', { class: 'cols2' },
        field('สีหลัก', bind(el('input', { type: 'color', value: st.theme.primary, id: 'st-c1', style: 'padding:2px' }), function (v) { st.theme.primary = v; })),
        field('สีเน้น', bind(el('input', { type: 'color', value: st.theme.accent, id: 'st-c2', style: 'padding:2px' }), function (v) { st.theme.accent = v; }))));
    box.appendChild(card);
    var tc = el('div', { class: 'card' }, el('h3', { text: 'ภาคเรียน' }), el('p', { class: 'muted', text: 'ใช้ปุ่มเปิด/ล็อกเพื่อเปิดสอบกลางภาคแล้วล็อกปลายภาคไว้ก่อน' }));
    Object.keys(st.terms).forEach(function (t) {
      var lab = bind(el('input', { type: 'text', value: st.terms[t].label, 'aria-label': 'ชื่อภาคเรียน ' + t }), function (v) { st.terms[t].label = v; });
      var open = el('input', { type: 'checkbox', style: 'width:22px;min-height:0;margin-right:8px', 'aria-label': 'เปิดให้ทำ' }); open.checked = st.terms[t].open !== false;
      open.addEventListener('change', function () { st.terms[t].open = open.checked; A.mark('settings'); refreshPub(); });
      tc.appendChild(el('div', { class: 'item' }, el('div', { class: 'main' }, lab), el('label', { style: 'display:flex;align-items:center;font-weight:400;margin:0' }, open, 'เปิดให้ทำข้อสอบ')));
    });
    tc.appendChild(field('ภาคเรียนที่แสดงให้นักเรียน', bind(sel(Object.keys(st.terms).map(function (t) { return [t, termLabel(t)]; }), st.currentTerm, null, 'st-current'), function (v) { st.currentTerm = v; })));
    box.appendChild(tc);
    box.appendChild(el('div', { class: 'card' }, el('h3', { text: 'ข้อความเมื่อทำได้เต็มทุกวิชา' }), el('p', { class: 'muted', text: 'แสดงเมื่อนักเรียนได้ 100% ในทุกวิชาของ ม.1-6 ที่เปิดอยู่' }),
      field('หัวข้อ', bind(el('input', { type: 'text', value: st.congratsTitle || '', id: 'st-ct' }), function (v) { st.congratsTitle = v; })),
      field('ข้อความ', bind(el('textarea', { value: st.congratsMessage || '', id: 'st-cm' }), function (v) { st.congratsMessage = v; }))));
    var ls = el('div', { class: 'hint', role: 'status' });
    var lf = el('input', { type: 'file', accept: 'image/*', id: 'st-logo' });
    lf.addEventListener('change', function () {
      var f = lf.files[0]; if (!f) return; ls.textContent = 'กำลังอัปโหลดโลโก้...';
      A.uploadLogo(f).then(function () { ls.textContent = 'อัปโหลดโลโก้แล้ว จะแสดงบนเว็บภายใน 1-2 นาที'; }).catch(function (e) { ls.textContent = 'ไม่สำเร็จ: ' + errText(e); });
    });
    box.appendChild(el('div', { class: 'card' }, el('h3', { text: 'โลโก้โรงเรียน' }), field('เลือกไฟล์รูป', lf), ls));
  }

  /* ---------- นักเรียน ---------- */
  function vStudents(box) {
    var q = el('input', { type: 'text', id: 'sq', placeholder: 'ค้นหาจากรหัสหรือชื่อ' });
    var lv = sel(lvOpts(true), '', null, 'sl'), rm = sel([['', 'ทุกห้อง']].concat(seq(S.settings.rooms || 12).map(function (n) { return [n, 'ห้อง ' + n]; })), '', null, 'sr');
    var out = el('div', { id: 'sres' });
    function search() {
      out.textContent = ''; out.appendChild(msg('warn', 'กำลังค้นหา...'));
      A.api({ action: 'adminSearchStudents', q: q.value, level: lv.value, room: rm.value }).then(function (r) {
        out.textContent = '';
        if (!r.rows.length) { out.appendChild(el('p', { class: 'muted', text: 'ไม่พบนักเรียน' })); return; }
        if (r.truncated) out.appendChild(msg('warn', 'แสดง 200 รายการแรก กรุณาระบุเงื่อนไขค้นหาให้แคบลง'));
        var tb = el('table', { class: 'tbl' }, el('thead', null, el('tr', null, ['ชั้น/ห้อง', 'เลขที่', 'รหัส', 'ชื่อ-นามสกุล', 'จัดการ'].map(function (h) { return el('th', { text: h }); }))));
        var body = el('tbody');
        r.rows.forEach(function (s) {
          body.appendChild(el('tr', null, el('td', { text: 'ม.' + s.level + '/' + s.room }), el('td', { text: String(s.no) }), el('td', { text: s.id }), el('td', { text: s.prefix + s.name }),
            el('td', null, el('div', { class: 'acts' }, btn('คะแนน', 'btn-ghost btn-sm', function () { scoreDialog(s, search); }), btn('แก้ไข', 'btn-ghost btn-sm', function () { editStudent(s, search); }), btn('ลบ', 'btn-danger btn-sm', function () {
              if (!window.confirm('ลบบัญชี ' + s.prefix + s.name + ' (รหัส ' + s.id + ')?\nประวัติการทำข้อสอบในแท็บ Attempts จะยังอยู่')) return;
              A.api({ action: 'adminDeleteStudent', id: s.id }).then(search).catch(function (e) { window.alert(errText(e)); });
            })))));
        });
        tb.appendChild(body); out.appendChild(el('div', { class: 'scroll' }, tb));
      }).catch(function (e) { out.textContent = ''; out.appendChild(msg('err', errText(e))); });
    }
    box.appendChild(el('div', { class: 'card orn' }, el('h2', { text: 'จัดการนักเรียน' }), el('p', { class: 'muted', text: 'แก้ไขข้อมูลที่สมัครผิด ลบบัญชี หรือล้างคะแนนรายคน' }),
      el('div', { class: 'cols4' }, el('div', { style: 'grid-column:span 2' }, field('ค้นหา', q)), field('ชั้น', lv), field('ห้อง', rm)), btn('ค้นหา', 'btn-primary', search)));
    box.appendChild(el('div', { class: 'card' }, out));
  }
  function editStudent(s, done) {
    var f = {
      prefix: sel(S.settings.registration.prefixes.map(function (p) { return [p, p]; }), s.prefix, null), name: el('input', { type: 'text', value: s.name, maxlength: '80' }),
      level: sel(lvOpts(false), s.level, null), room: sel(seq(S.settings.rooms || 12).map(function (n) { return [n, 'ห้อง ' + n]; }), s.room, null),
      no: el('input', { type: 'text', inputmode: 'numeric', value: s.no, maxlength: '2' }), id: el('input', { type: 'text', inputmode: 'numeric', value: s.id, maxlength: '8' })
    };
    if (!S.settings.registration.prefixes.includes(s.prefix)) { var op = el('option', { value: s.prefix }, s.prefix); f.prefix.appendChild(op); f.prefix.value = s.prefix; }
    var err = el('div', { class: 'fe', role: 'alert' });
    var m = modal('แก้ไขข้อมูลนักเรียน', el('div', null, el('div', { class: 'cols2' }, field('คำนำหน้า', f.prefix), field('ชื่อ-นามสกุล', f.name)), el('div', { class: 'cols4' }, field('ชั้น', f.level), field('ห้อง', f.room), field('เลขที่', f.no), field('รหัสประจำตัว', f.id)), err,
      el('div', { class: 'row' }, btn('บันทึก', 'btn-primary', function () {
        A.api({ action: 'adminUpdateStudent', id: s.id, patch: { prefix: f.prefix.value, name: f.name.value, level: f.level.value, room: f.room.value, no: A.digits(f.no.value), newId: A.digits(f.id.value).replace(/\s/g, '') } })
          .then(function () { m.close(); done(); }).catch(function (e) { err.textContent = errText(e); });
      }), btn('ยกเลิก', 'btn-ghost', function () { m.close(); }))), true);
  }
  function scoreDialog(s, done) {
    var box = el('div', null, el('p', { text: 'กำลังโหลดคะแนน...' }));
    var m = modal('คะแนนของ ' + s.prefix + s.name, box, true);
    function load() {
      A.api({ action: 'adminStudentScores', id: s.id }).then(function (r) {
        box.textContent = '';
        var ids = Object.keys(r.best);
        if (!ids.length) box.appendChild(el('p', { class: 'muted', text: 'ยังไม่มีคะแนน' }));
        ids.forEach(function (sid) {
          var sub = A.subject(sid), b = r.best[sid];
          box.appendChild(el('div', { class: 'item' }, el('div', { class: 'main' }, el('b', { text: sub ? 'ม.' + sub.level + ' ' + sub.name : sid }), el('span', { class: 'pill gold', text: b.c + '/' + b.t + ' (' + b.p + '%)' })),
            btn('ล้างคะแนนวิชานี้', 'btn-danger btn-sm', function () { if (!window.confirm('ล้างคะแนนวิชานี้ของนักเรียนคนนี้?')) return; A.api({ action: 'adminResetScore', id: s.id, subjectId: sid }).then(load).catch(function (e) { window.alert(errText(e)); }); })));
        });
        box.appendChild(el('div', { class: 'row', style: 'margin-top:12px' }, ids.length ? btn('ล้างคะแนนทั้งหมด', 'btn-danger', function () { if (!window.confirm('ล้างคะแนนทุกวิชาของนักเรียนคนนี้?')) return; A.api({ action: 'adminResetScore', id: s.id }).then(load).catch(function (e) { window.alert(errText(e)); }); }) : null, btn('ปิด', 'btn-ghost', function () { m.close(); })));
      }).catch(function (e) { box.textContent = ''; box.appendChild(msg('err', errText(e))); box.appendChild(btn('ปิด', 'btn-ghost', function () { m.close(); })); });
    }
    load();
  }

  /* ---------- สถิติ ---------- */
  function vStats(box) {
    var out = el('div', { id: 'stout' }, el('p', { text: 'กำลังโหลดสถิติ...' }));
    box.appendChild(el('div', { class: 'card orn' }, el('h2', { text: 'สถิติรายห้อง' }), el('p', { class: 'muted', text: 'คำนวณจากคะแนนที่ดีที่สุดของนักเรียนแต่ละคน (นับเฉพาะผู้ที่สมัครบัญชีแล้ว)' }),
      field('ชั้น', sel(lvOpts(false), statsLevel, function (e) { statsLevel = e.target.value; shell(); }, 'stl'))));
    box.appendChild(el('div', { class: 'card' }, out));
    A.api({ action: 'adminStats' }).then(function (r) {
      out.textContent = '';
      var rooms = r.rooms.filter(function (x) { return String(x.level) === String(statsLevel); });
      var subs = r.subjects.filter(function (x) { return x.label.indexOf('ม.' + statsLevel + ' ') === 0; });
      if (!rooms.length) { out.appendChild(el('p', { class: 'muted', text: 'ยังไม่มีนักเรียนสมัครในชั้นนี้' })); return; }
      var head = ['ห้อง', 'สมัครแล้ว (คน)', 'เคยทำข้อสอบ (คน)'].concat(subs.map(function (x) { return x.label.replace('ม.' + statsLevel + ' ', ''); }));
      var tb = el('table', { class: 'tbl' }, el('thead', null, el('tr', null, head.map(function (h) { return el('th', { text: h }); }))));
      var body = el('tbody'), tot = { total: 0, active: 0 };
      rooms.forEach(function (x) {
        tot.total += x.total; tot.active += x.active;
        body.appendChild(el('tr', null, el('td', { text: 'ห้อง ' + x.room }), el('td', { text: String(x.total) }), el('td', { text: x.active + ' (' + Math.round(x.active / x.total * 100) + '%)' }),
          subs.map(function (sb) { var v = x.subj[sb.id]; return el('td', { text: v ? 'เฉลี่ย ' + v.avg + '% (' + v.n + ' คน, เต็ม ' + v.full + ')' : '-' }); })));
      });
      body.appendChild(el('tr', null, el('td', null, el('b', { text: 'รวม' })), el('td', { text: String(tot.total) }), el('td', { text: tot.active + ' (' + Math.round(tot.active / tot.total * 100) + '%)' }), subs.map(function () { return el('td', { text: '' }); })));
      tb.appendChild(body); out.appendChild(el('div', { class: 'scroll' }, tb));
    }).catch(function (e) { out.textContent = ''; out.appendChild(msg('err', errText(e))); });
  }

  /* ---------- วิธีใช้ ---------- */
  function vHelp(box) {
    var c = el('div', { class: 'card orn help' });
    c.innerHTML = '' +
      '<h2>วิธีใช้ระบบผู้ดูแล</h2>' +
      '<h3>1. การเผยแพร่ขึ้นเว็บ</h3><ol><li>ทุกการแก้ไข (วิชา ข้อสอบ ประกาศ ตั้งค่า) เก็บเป็นร่างก่อน นักเรียนยังไม่เห็น</li><li>กดปุ่ม <b>เผยแพร่ขึ้นเว็บ</b> ที่แถบด้านบน ระบบจะส่งข้อมูลขึ้น GitHub</li><li>รอ 1-2 นาที แล้วให้นักเรียนรีเฟรชหน้าเว็บ</li></ol>' +
      '<p>ถ้าปิดหน้านี้ก่อนเผยแพร่ ร่างจะถูกเก็บไว้ในเครื่องนี้ และจะถามกู้คืนเมื่อเข้าระบบครั้งหน้า ส่วนรูปภาพที่อัปโหลดจะขึ้น GitHub ทันที</p>' +
      '<h3>2. วิธีสร้างโทเคน GitHub (ทำครั้งเดียว)</h3><ol><li>เข้า github.com แล้วล็อกอิน กดรูปโปรไฟล์ > <b>Settings</b></li><li>เลื่อนลงล่างสุดทางซ้าย กด <b>Developer settings</b> > <b>Personal access tokens</b> > <b>Fine-grained tokens</b> > <b>Generate new token</b></li><li>ตั้งชื่อ เช่น exam-admin ตั้งวันหมดอายุ (เช่น 1 ปี)</li><li>ที่ <b>Repository access</b> เลือก <b>Only select repositories</b> แล้วเลือกที่เก็บของเว็บนี้เท่านั้น</li><li>ที่ <b>Permissions</b> > <b>Repository permissions</b> หา <b>Contents</b> แล้วเลือก <b>Read and write</b></li><li>กด <b>Generate token</b> แล้วคัดลอกข้อความที่ขึ้นต้นด้วย github_pat_ เก็บไว้ที่ปลอดภัย (จะเห็นครั้งเดียว)</li></ol>' +
      '<p>ห้ามส่งโทเคนให้ผู้อื่น ห้ามใส่ลงในไฟล์ของเว็บ ถ้าโทเคนหลุดให้ลบแล้วสร้างใหม่ทันที</p>' +
      '<h3>3. การนำเข้าข้อสอบจาก CSV หรือ Excel</h3><ol><li>ที่แท็บ <b>ข้อสอบ</b> เลือกวิชา กด <b>ดาวน์โหลดไฟล์ตัวอย่าง</b> แล้วเปิดด้วย Excel</li><li>กรอกข้อสอบแต่ละข้อ 1 แถว โดยเรียงคอลัมน์ดังนี้:</li></ol>' +
      '<div class="scroll"><table class="tbl"><thead><tr><th>A โจทย์</th><th>B ก</th><th>C ข</th><th>D ค</th><th>E ง</th><th>F เฉลย</th><th>G คำอธิบาย</th><th>H รูปภาพ</th></tr></thead><tbody><tr><td>2 + 3 = ?</td><td>4</td><td>5</td><td>6</td><td>7</td><td>ข</td><td>2 + 3 = 5</td><td></td></tr></tbody></table></div>' +
      '<ol start="3"><li>ช่อง <b>เฉลย</b> ใส่ ก ข ค ง (หรือ 1-4 หรือ A-D) ส่วน <b>คำอธิบาย</b> และ <b>รูปภาพ</b> ไม่ต้องใส่ก็ได้</li><li>บันทึกไฟล์เป็น <b>CSV UTF-8</b> (ใน Excel: ไฟล์ > บันทึกเป็น > CSV UTF-8) แล้วกด <b>นำเข้าจาก CSV / Excel</b> เลือกไฟล์ หรือคัดลอกเซลล์จาก Excel (ไม่เอาแถวหัวตาราง) มาวางในช่องข้อความ</li><li>กด <b>ตรวจสอบข้อมูล</b> ระบบจะบอกจำนวนข้อที่ใช้ได้และแถวที่มีปัญหา จากนั้นเลือก เพิ่มต่อท้าย หรือ แทนที่ทั้งหมด แล้วกด <b>นำเข้า</b></li><li>ข้อสอบจะยังเป็นร่าง ต้องกด <b>เผยแพร่ขึ้นเว็บ</b> อีกครั้ง</li></ol>' +
      '<p>ใช้กับ Google Sheets ได้: เปิดตาราง ไฟล์ > ดาวน์โหลด > ค่าที่คั่นด้วยเครื่องหมายจุลภาค (.csv)</p>' +
      '<h3>4. สูตรและรูปภาพ</h3><ul><li>สูตรคณิต/ฟิสิกส์/เคมี ใส่ระหว่างเครื่องหมาย $ เช่น <code>$x^2+3x$</code>, <code>$H_2O$</code>, <code>$\\frac{a}{b}$</code></li><li>รูปประกอบ: ตอนเพิ่มหรือแก้ไขข้อ กด เลือกไฟล์ ระบบย่อรูปและอัปโหลดให้ ใน CSV ใส่ชื่อไฟล์ที่ได้ เช่น <code>img/xxx.jpg</code> หรือลิงก์รูปในคอลัมน์ H</li></ul>' +
      '<h3>5. เปิดสอบกลางภาค / ล็อกปลายภาค</h3><p>แท็บ <b>ตั้งค่าเว็บ</b> > ภาคเรียน ติ๊ก/เลิกติ๊ก <b>เปิดให้ทำข้อสอบ</b> และเลือกภาคเรียนที่แสดงให้นักเรียน วิชาที่สร้างไว้ในภาคเรียนที่ล็อกอยู่จะไม่แสดง</p>' +
      '<h3>6. เรื่องที่ควรรู้</h3><ul><li>ชีทคะแนนอยู่ใน Google Sheet แท็บ <b>Summary</b> (คะแนนสูงสุด) และ <b>Attempts</b> (ทุกครั้งที่ทำ) เรียงตามชั้น ห้อง เลขที่ ทุก 10 นาที หรือกด เรียงชีทคะแนนใหม่ทันที ที่แท็บภาพรวม</li><li>ถ้านักเรียนสมัครข้อมูลผิด ให้แก้ที่แท็บ <b>นักเรียน</b></li><li>ควรกดดาวน์โหลดสำรองข้อมูลที่แท็บภาพรวมเป็นระยะ</li><li>ข้อสอบและเฉลยอยู่ในไฟล์บนเว็บ นักเรียนที่เปิดดูโค้ดเป็นจะเห็นเฉลยได้ จึงเหมาะกับการทวนความรู้เท่านั้น</li></ul>';
    box.appendChild(c);
  }

  /* ---------- เริ่มต้น ---------- */
  showLogin();
})();
