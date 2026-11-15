// Everything you see and click in the planner window.
(() => {
'use strict';

const COLORS = ['#3cc8ff', '#ff6b93', '#ffd23f', '#4fe08a', '#b78cff', '#ff9a4d', '#ff7ae0', '#c9cfdd'];
const ICONS = ['☀️', '📅', '🌙', '💼', '🏠', '❤️', '🛒', '💪', '📚', '🎯', '✈️', '💡', '💰', '🎨', '🐾', '🎮', '🧹', '🍳', '🎵', '👪', '🌱', '⭐', '📞', '📝'];

// If the app runs outside Electron (e.g. opened in a browser for testing), save in the browser instead.
const store = window.plannerStore || {
  load: async () => JSON.parse(localStorage.getItem('planner') || 'null'),
  save: (d) => localStorage.setItem('planner', JSON.stringify(d)),
  setOnTop: async () => {},
};

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

let state = { sections: [], hideDone: false, onTop: false };

function defaultState() {
  return {
    hideDone: false,
    onTop: false,
    sections: [
      { id: uid(), name: 'Today', icon: '☀️', color: COLORS[0], collapsed: false, tasks: [] },
      { id: uid(), name: 'This week', icon: '📅', color: COLORS[1], collapsed: false, tasks: [] },
    ],
  };
}

// Bring data saved by an older version of the app up to date.
function upgrade(data) {
  data.sections.forEach((s, i) => {
    if (!s.icon) s.icon = /today/i.test(s.name) ? '☀️' : /week/i.test(s.name) ? '📅' : '📝';
    if (!COLORS.includes(s.color)) s.color = COLORS[i % COLORS.length];
    s.tasks.forEach((t) => (t.subtasks = t.subtasks || []));
  });
  return data;
}

// ---------- saving: every change is written to disk straight away ----------
function save() {
  try {
    store.save(state);
  } catch (err) {
    console.error('Could not save', err);
  }
}

function commit() {
  save();
  render();
}

// ---------- finding things ----------
const findSection = (id) => state.sections.find((s) => s.id === id);

function findItem(id) {
  for (const s of state.sections) {
    for (const t of s.tasks) {
      if (t.id === id) return { item: t, list: s.tasks, section: s };
      for (const st of t.subtasks) {
        if (st.id === id) return { item: st, list: t.subtasks, section: s, parent: t };
      }
    }
  }
  return null;
}

// "!" = important, ">" = up next, at the start of the text, in any order.
function parseQuickText(raw) {
  let text = raw.trim();
  let important = false;
  let next = false;
  while (/^[!>]/.test(text)) {
    if (text[0] === '!') important = true;
    if (text[0] === '>') next = true;
    text = text.slice(1).trimStart();
  }
  return { text, important, next };
}

function newItem(raw, withSubtasks) {
  const { text, important, next } = parseQuickText(raw);
  if (!text) return null;
  const item = { id: uid(), text, done: false, important, next };
  if (withSubtasks) item.subtasks = [];
  return item;
}

// Up next first, then important, then the rest; finished items sink to the bottom.
function rank(t) {
  if (t.done) return 3;
  if (t.next) return 0;
  if (t.important) return 1;
  return 2;
}
const sorted = (list) =>
  list.map((t, i) => [t, i]).sort((a, b) => rank(a[0]) - rank(b[0]) || a[1] - b[1]).map((p) => p[0]);

function toggleDone(found) {
  const item = found.item;
  item.done = !item.done;
  if (item.done && item.subtasks) item.subtasks.forEach((st) => (st.done = true));
  if (found.parent) found.parent.done = found.parent.subtasks.every((st) => st.done);
}

// ---------- drawing ----------
const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let editingId = null; // which task/section text is being edited
let subAddOpen = null; // which task has its "add subtask" box open
let focusAfter = null; // CSS selector to put the cursor back after redrawing

function tags(t) {
  return (t.next ? '<span class="tag nxt">NEXT</span>' : '') + (t.important ? '<span class="tag imp">!</span>' : '');
}

function itemRow(t, isSub) {
  const cls = ['row', t.important && 'important', t.next && 'next'].filter(Boolean).join(' ');
  const left = t.subtasks ? t.subtasks.filter((s) => !s.done).length : 0;
  const text =
    editingId === t.id
      ? `<input class="edit-input" data-edit="${t.id}" value="${esc(t.text)}" />`
      : `<span class="text" data-action="edit" data-id="${t.id}">${tags(t)}${esc(t.text)}${
          left ? `<span class="sub-count">${left}</span>` : ''
        }</span>`;
  return `
    <div class="${cls}" ${isSub ? '' : `draggable="true" data-drag="${t.id}"`}>
      <input type="checkbox" class="check" data-action="done" data-id="${t.id}" ${t.done ? 'checked' : ''} title="Mark as done" />
      ${text}
      <button class="more" data-action="task-menu" data-id="${t.id}" title="Options">⋯</button>
    </div>`;
}

function taskHtml(t) {
  const subs = sorted(t.subtasks).map((st) => `<li class="${st.done ? 'done' : ''}">${itemRow(st, true)}</li>`).join('');
  const subAdd =
    subAddOpen === t.id
      ? `<div class="sub-add"><input class="add-input" data-add-sub="${t.id}" placeholder="Add a subtask, press Enter" /></div>`
      : '';
  return `
    <li class="${t.done ? 'done' : ''}">
      ${itemRow(t, false)}
      ${subs ? `<ul class="subtasks">${subs}</ul>` : ''}
      ${subAdd}
    </li>`;
}

function sectionHtml(s) {
  const open = s.tasks.filter((t) => !t.done).length;
  const doneCount = s.tasks.length - open;
  const name =
    editingId === s.id
      ? `<input class="edit-input" data-edit-section="${s.id}" value="${esc(s.name)}" />`
      : `<span class="name" data-action="rename" data-id="${s.id}" title="Double-click to rename">${esc(s.name)}</span>`;
  const tasks = sorted(s.tasks).map(taskHtml).join('');
  return `
    <div class="section ${s.collapsed ? 'collapsed' : ''}" style="--accent:${s.color}" data-section="${s.id}">
      <div class="section-head">
        <button class="section-icon" data-action="section-menu" data-id="${s.id}" title="Change icon, colour and more">${s.icon}</button>
        ${name}
        <span class="count" title="Tasks left">${open}</span>
        <button class="icon-btn" data-action="collapse" data-id="${s.id}" title="${s.collapsed ? 'Expand' : 'Collapse'}">${s.collapsed ? '▸' : '▾'}</button>
      </div>
      <div class="section-body">
        ${tasks ? `<ul class="tasks">${tasks}</ul>` : `<div class="empty">Nothing here yet.</div>`}
        <input class="add-input" data-add="${s.id}" placeholder="+ Add a task, press Enter" />
        ${doneCount && !state.hideDone ? `<button class="clear-done" data-action="clear-done" data-id="${s.id}">Clear ${doneCount} finished</button>` : ''}
      </div>
    </div>`;
}

function upNextHtml() {
  const items = [];
  for (const s of state.sections) {
    for (const t of s.tasks) {
      if (t.next && !t.done) items.push({ item: t, s });
      for (const st of t.subtasks) if (st.next && !st.done) items.push({ item: st, s });
    }
  }
  if (!items.length) return '';
  return `
    <div class="upnext-box">
      <h2>▶ Up next</h2>
      ${items
        .map(
          ({ item, s }) => `
        <div class="upnext-item">
          <input type="checkbox" class="check" data-action="done" data-id="${item.id}" title="Mark as done" />
          <span class="txt">${esc(item.text)}</span>
          <span class="where">${s.icon} ${esc(s.name)}</span>
        </div>`
        )
        .join('')}
    </div>`;
}

function render() {
  document.getElementById('sections').innerHTML = state.sections.map(sectionHtml).join('');
  document.getElementById('upnext').innerHTML = upNextHtml();
  document.body.classList.toggle('hide-done', state.hideDone);
  document.getElementById('toggle-done').classList.toggle('on', state.hideDone);
  document.getElementById('toggle-top').classList.toggle('on', state.onTop);

  const edit = document.querySelector('[data-edit], [data-edit-section]');
  if (edit) {
    edit.focus();
    edit.select();
  } else if (focusAfter) {
    const el = document.querySelector(focusAfter);
    if (el) {
      el.focus();
      el.scrollIntoView({ block: 'nearest' });
    }
  }
  focusAfter = null;
}

// ---------- pop-up menu ----------
const menu = document.getElementById('menu');
let menuFor = null;

function closeMenu() {
  menu.hidden = true;
  menuFor = null;
  document.querySelectorAll('.more.open').forEach((b) => b.classList.remove('open'));
}

function openMenu(anchor, html, id) {
  menuFor = id;
  menu.innerHTML = html;
  menu.hidden = false;
  anchor.classList.add('open');
  const r = anchor.getBoundingClientRect();
  const m = menu.getBoundingClientRect();
  const left = Math.min(Math.max(8, r.right - m.width), window.innerWidth - m.width - 8);
  let top = r.bottom + 4;
  if (top + m.height > window.innerHeight - 8) top = Math.max(8, r.top - m.height - 4);
  menu.style.left = left + 'px';
  menu.style.top = top + 'px';
}

const item = (action, ico, label, extra = '') =>
  `<button class="item ${extra}" data-menu="${action}"><span class="ico">${ico}</span>${label}</button>`;

function taskMenuHtml(found) {
  const t = found.item;
  let html =
    item('next', '▶', t.next ? 'Remove from up next' : 'Mark as up next') +
    item('important', '!', t.important ? 'Not important' : 'Mark as important');
  if (!found.parent) {
    html += item('add-sub', '+', 'Add a subtask');
    const others = state.sections.filter((s) => s !== found.section);
    if (others.length) {
      html += '<hr><div class="label">Move to</div>';
      html += others.map((s) => item('move:' + s.id, s.icon, esc(s.name))).join('');
    }
  }
  html += '<hr>' + item('delete', '✕', 'Delete', 'danger');
  return html;
}

function sectionMenuHtml(s) {
  const i = state.sections.indexOf(s);
  return (
    '<div class="label">Icon</div><div class="grid">' +
    ICONS.map((ic) => `<button data-menu="icon:${ic}" class="${ic === s.icon ? 'sel' : ''}">${ic}</button>`).join('') +
    '</div><div class="label">Colour</div><div class="grid colors">' +
    COLORS.map(
      (c) =>
        `<button data-menu="color:${c}" class="swatch ${c === s.color ? 'sel' : ''}" style="background:${c}" title="${c}"></button>`
    ).join('') +
    '</div><hr>' +
    item('rename', '✎', 'Rename') +
    (i > 0 ? item('up', '↑', 'Move section up') : '') +
    (i < state.sections.length - 1 ? item('down', '↓', 'Move section down') : '') +
    '<hr>' +
    item('delete-section', '✕', 'Delete section', 'danger')
  );
}

menu.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-menu]');
  if (!btn || !menuFor) return;
  const [action, arg] = btn.dataset.menu.split(/:(.*)/s);
  const id = menuFor;

  const found = findItem(id);
  const s = findSection(id);
  closeMenu();

  if (found) {
    const t = found.item;
    if (action === 'next') t.next = !t.next;
    else if (action === 'important') t.important = !t.important;
    else if (action === 'delete') found.list.splice(found.list.indexOf(t), 1);
    else if (action === 'add-sub') {
      subAddOpen = id;
      focusAfter = `[data-add-sub="${id}"]`;
      render();
      return;
    } else if (action === 'move') moveTask(id, arg);
    commit();
  } else if (s) {
    const i = state.sections.indexOf(s);
    if (action === 'icon') s.icon = arg;
    else if (action === 'color') s.color = arg;
    else if (action === 'rename') editingId = s.id;
    else if (action === 'up' && i > 0) [state.sections[i - 1], state.sections[i]] = [s, state.sections[i - 1]];
    else if (action === 'down' && i < state.sections.length - 1)
      [state.sections[i + 1], state.sections[i]] = [s, state.sections[i + 1]];
    else if (action === 'delete-section') {
      const n = s.tasks.length;
      if (n && !confirm(`Delete "${s.name}" and its ${n} task${n === 1 ? '' : 's'}?`)) return;
      state.sections = state.sections.filter((x) => x !== s);
    }
    commit();
  }
});

function moveTask(taskId, sectionId) {
  const found = findItem(taskId);
  const target = findSection(sectionId);
  if (!found || found.parent || !target || target === found.section) return;
  found.list.splice(found.list.indexOf(found.item), 1);
  target.tasks.push(found.item);
  target.collapsed = false;
}

// ---------- clicks ----------
document.addEventListener('click', (e) => {
  if (!menu.hidden && !e.target.closest('#menu')) {
    const wasFor = menuFor;
    closeMenu();
    const btn = e.target.closest('[data-action="task-menu"], [data-action="section-menu"]');
    if (btn && btn.dataset.id === wasFor) return; // clicking the same button again just closes it
  }
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const id = el.dataset.id;
  const action = el.dataset.action;

  if (action === 'done') {
    const found = findItem(id);
    if (!found) return;
    toggleDone(found);
    commit();
  } else if (action === 'task-menu') {
    const found = findItem(id);
    if (found) openMenu(el, taskMenuHtml(found), id);
  } else if (action === 'section-menu') {
    openMenu(el, sectionMenuHtml(findSection(id)), id);
  } else if (action === 'collapse') {
    const s = findSection(id);
    s.collapsed = !s.collapsed;
    commit();
  } else if (action === 'clear-done') {
    const s = findSection(id);
    s.tasks = s.tasks.filter((t) => !t.done);
    s.tasks.forEach((t) => (t.subtasks = t.subtasks.filter((st) => !st.done)));
    commit();
  }
});

document.addEventListener('dblclick', (e) => {
  const el = e.target.closest('[data-action="edit"], [data-action="rename"]');
  if (!el) return;
  editingId = el.dataset.id;
  render();
});

// ---------- drag a task onto another section ----------
let dragId = null;
document.addEventListener('dragstart', (e) => {
  const row = e.target.closest && e.target.closest('[data-drag]');
  if (!row) return;
  dragId = row.dataset.drag;
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', dragId);
  row.classList.add('dragging');
  closeMenu();
});
document.addEventListener('dragend', () => {
  dragId = null;
  document.querySelectorAll('.dragging, .section.drop').forEach((el) => el.classList.remove('dragging', 'drop'));
});
document.addEventListener('dragover', (e) => {
  if (!dragId) return;
  const sec = e.target.closest('[data-section]');
  document.querySelectorAll('.section.drop').forEach((el) => el !== sec && el.classList.remove('drop'));
  if (!sec) return;
  e.preventDefault();
  sec.classList.add('drop');
});
document.addEventListener('drop', (e) => {
  const sec = e.target.closest('[data-section]');
  if (!dragId || !sec) return;
  e.preventDefault();
  moveTask(dragId, sec.dataset.section);
  dragId = null;
  commit();
});

// ---------- typing ----------
document.addEventListener('keydown', (e) => {
  const t = e.target;

  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') {
    e.preventDefault();
    const first = document.querySelector('[data-add]');
    (first || document.getElementById('new-section')).focus();
    return;
  }

  if (e.key === 'Escape') {
    if (!menu.hidden) closeMenu();
    else if (editingId) {
      editingId = null;
      render();
    } else if (subAddOpen) {
      subAddOpen = null;
      render();
    }
    return;
  }

  if (e.key !== 'Enter') return;

  if (t.dataset.add) {
    const it = newItem(t.value, true);
    if (!it) return;
    findSection(t.dataset.add).tasks.push(it);
    focusAfter = `[data-add="${t.dataset.add}"]`;
    commit();
  } else if (t.dataset.addSub) {
    const found = findItem(t.dataset.addSub);
    const it = newItem(t.value, false);
    if (!it || !found) return;
    found.item.subtasks.push(it);
    found.item.done = false;
    focusAfter = `[data-add-sub="${t.dataset.addSub}"]`;
    commit();
  } else if (t.dataset.edit || t.dataset.editSection) {
    finishEdit(t);
  } else if (t.id === 'new-section') {
    const name = t.value.trim();
    if (!name) return;
    const used = state.sections.map((s) => s.color);
    const color = COLORS.find((c) => !used.includes(c)) || COLORS[state.sections.length % COLORS.length];
    const s = { id: uid(), name, icon: '📝', color, collapsed: false, tasks: [] };
    state.sections.push(s);
    t.value = '';
    focusAfter = `[data-add="${s.id}"]`;
    commit();
  }
});

function finishEdit(input) {
  const value = input.value.trim();
  if (input.dataset.editSection) {
    if (value) findSection(input.dataset.editSection).name = value;
  } else {
    const found = findItem(input.dataset.edit);
    if (found) {
      const { text, important, next } = parseQuickText(value);
      if (text) {
        found.item.text = text;
        if (important) found.item.important = true;
        if (next) found.item.next = true;
      }
    }
  }
  editingId = null;
  commit();
}

// Clicking away from an edit box saves it.
document.addEventListener('focusout', (e) => {
  const t = e.target;
  if ((t.dataset.edit || t.dataset.editSection) && editingId) finishEdit(t);
});

window.addEventListener('resize', closeMenu);
document.addEventListener('scroll', closeMenu, true);

// ---------- top buttons ----------
document.getElementById('toggle-done').addEventListener('click', () => {
  state.hideDone = !state.hideDone;
  commit();
});
document.getElementById('toggle-top').addEventListener('click', () => {
  state.onTop = !state.onTop;
  store.setOnTop(state.onTop);
  commit();
});
document.getElementById('toggle-help').addEventListener('click', () => {
  const help = document.getElementById('help');
  help.hidden = !help.hidden;
});

// ---------- start ----------
document.getElementById('today').textContent = new Date().toLocaleDateString(undefined, {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
});

Promise.resolve(store.load()).then((saved) => {
  state = saved && Array.isArray(saved.sections) ? upgrade(saved) : defaultState();
  if (state.onTop) store.setOnTop(true);
  render();
});
})();
