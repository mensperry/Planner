// Everything you see and click in the planner window.
(() => {
'use strict';

const COLORS = ['#00d1ff', '#ff3b6b', '#ffd400', '#3dff8b', '#b66bff', '#ff7a1a', '#ff5ce1'];

// If the app runs outside Electron (e.g. opened in a browser for testing), save in the browser instead.
const store = window.plannerStore || {
  load: async () => JSON.parse(localStorage.getItem('planner') || 'null'),
  save: async (d) => localStorage.setItem('planner', JSON.stringify(d)),
  setOnTop: async () => {},
};

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

let state = {
  sections: [],
  hideDone: false,
  onTop: false,
};

function defaultState() {
  return {
    hideDone: false,
    onTop: false,
    sections: [
      { id: uid(), name: 'Today', color: COLORS[0], collapsed: false, tasks: [] },
      { id: uid(), name: 'This week', color: COLORS[1], collapsed: false, tasks: [] },
    ],
  };
}

// ---------- saving ----------
let saveTimer;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => store.save(state), 150);
}
window.addEventListener('beforeunload', () => store.save(state));

function commit() {
  save();
  render();
}

// ---------- finding things ----------
function findSection(id) {
  return state.sections.find((s) => s.id === id);
}

// Returns { item, list } for a task or subtask by id.
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
function sorted(list) {
  return list.map((t, i) => [t, i]).sort((a, b) => rank(a[0]) - rank(b[0]) || a[1] - b[1]).map((p) => p[0]);
}

// ---------- drawing ----------
const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let editingId = null;     // which task/section text is being edited
let subAddOpen = null;    // which task has its "add subtask" box open
let focusAfter = null;    // CSS selector to put the cursor back after redrawing

function itemRow(t, isSub) {
  const cls = ['row', t.important && 'important', t.next && 'next'].filter(Boolean).join(' ');
  const text =
    editingId === t.id
      ? `<input class="edit-input" data-edit="${t.id}" value="${esc(t.text)}" />`
      : `<span class="text" data-action="edit" data-id="${t.id}" title="Double-click to edit">${esc(t.text)}</span>`;
  return `
    <div class="${cls}">
      <input type="checkbox" class="check" data-action="done" data-id="${t.id}" ${t.done ? 'checked' : ''} title="Mark as done" />
      ${text}
      <button class="flag imp ${t.important ? 'on' : ''}" data-action="important" data-id="${t.id}" title="Important">!</button>
      <button class="flag nxt ${t.next ? 'on' : ''}" data-action="next" data-id="${t.id}" title="Up next">▶</button>
      ${isSub ? '' : `<button class="icon-btn" data-action="add-sub" data-id="${t.id}" title="Add a subtask">+</button>`}
      <button class="icon-btn" data-action="delete" data-id="${t.id}" title="Delete">✕</button>
    </div>`;
}

function taskHtml(t) {
  const subs = sorted(t.subtasks).map((st) => `<li class="task ${st.done ? 'done' : ''}">${itemRow(st, true)}</li>`).join('');
  const subAdd =
    subAddOpen === t.id
      ? `<div class="sub-add"><input class="add-input" data-add-sub="${t.id}" placeholder="Add a subtask, press Enter" /></div>`
      : '';
  return `
    <li class="task ${t.done ? 'done' : ''}">
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
    <div class="section ${s.collapsed ? 'collapsed' : ''}" style="--accent:${s.color}">
      <div class="section-head">
        <button class="color-dot" data-action="color" data-id="${s.id}" title="Change colour"></button>
        ${name}
        <span class="count" title="Tasks left">${open}</span>
        <button class="icon-btn" data-action="up" data-id="${s.id}" title="Move section up">↑</button>
        <button class="icon-btn" data-action="collapse" data-id="${s.id}" title="${s.collapsed ? 'Expand' : 'Collapse'}">${s.collapsed ? '▸' : '▾'}</button>
        <button class="icon-btn" data-action="delete-section" data-id="${s.id}" title="Delete section">✕</button>
      </div>
      <div class="section-body">
        <input class="add-input" data-add="${s.id}" placeholder="Add a task, press Enter" />
        ${tasks ? `<ul class="tasks">${tasks}</ul>` : `<div class="empty">Nothing here yet.</div>`}
        ${doneCount && !state.hideDone ? `<button class="clear-done" data-action="clear-done" data-id="${s.id}">Clear ${doneCount} finished</button>` : ''}
      </div>
    </div>`;
}

function upNextHtml() {
  const items = [];
  for (const s of state.sections) {
    for (const t of s.tasks) {
      if (t.next && !t.done) items.push({ item: t, s, label: s.name });
      for (const st of t.subtasks) {
        if (st.next && !st.done) items.push({ item: st, s, label: `${s.name} › ${t.text}` });
      }
    }
  }
  if (!items.length) return '';
  return `
    <div class="upnext-box">
      <h2>▶ Up next</h2>
      ${items
        .map(
          ({ item, s, label }) => `
        <div class="upnext-item">
          <input type="checkbox" class="check" data-action="done" data-id="${item.id}" title="Mark as done" />
          <span class="dot" style="background:${s.color}"></span>
          <span>${esc(item.text)}</span>
          <span class="where" title="${esc(label)}">${esc(s.name)}</span>
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
    if (el) el.focus();
  }
  focusAfter = null;
}

// ---------- clicks ----------
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const id = el.dataset.id;
  const action = el.dataset.action;

  if (action === 'done' || action === 'important' || action === 'next') {
    const found = findItem(id);
    if (!found) return;
    const key = action;
    found.item[key] = !found.item[key];
    // finishing a task finishes its subtasks too
    if (key === 'done' && found.item.done && found.item.subtasks) found.item.subtasks.forEach((st) => (st.done = true));
    // ticking off the last subtask finishes the parent
    if (key === 'done' && found.parent) {
      if (found.parent.subtasks.every((st) => st.done)) found.parent.done = true;
      else found.parent.done = false;
    }
    commit();
  } else if (action === 'delete') {
    const found = findItem(id);
    if (!found) return;
    found.list.splice(found.list.indexOf(found.item), 1);
    commit();
  } else if (action === 'add-sub') {
    subAddOpen = subAddOpen === id ? null : id;
    focusAfter = `[data-add-sub="${id}"]`;
    render();
  } else if (action === 'color') {
    const s = findSection(id);
    s.color = COLORS[(COLORS.indexOf(s.color) + 1) % COLORS.length];
    commit();
  } else if (action === 'collapse') {
    const s = findSection(id);
    s.collapsed = !s.collapsed;
    commit();
  } else if (action === 'up') {
    const i = state.sections.findIndex((s) => s.id === id);
    if (i > 0) {
      [state.sections[i - 1], state.sections[i]] = [state.sections[i], state.sections[i - 1]];
      commit();
    }
  } else if (action === 'delete-section') {
    const s = findSection(id);
    const n = s.tasks.length;
    if (n && !confirm(`Delete "${s.name}" and its ${n} task${n === 1 ? '' : 's'}?`)) return;
    state.sections = state.sections.filter((x) => x.id !== id);
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
    if (editingId) { editingId = null; render(); }
    else if (subAddOpen) { subAddOpen = null; render(); }
    return;
  }

  if (e.key !== 'Enter') return;

  if (t.dataset.add) {
    const item = newItem(t.value, true);
    if (!item) return;
    findSection(t.dataset.add).tasks.push(item);
    focusAfter = `[data-add="${t.dataset.add}"]`;
    commit();
  } else if (t.dataset.addSub) {
    const found = findItem(t.dataset.addSub);
    const item = newItem(t.value, false);
    if (!item || !found) return;
    found.item.subtasks.push(item);
    found.item.done = false;
    focusAfter = `[data-add-sub="${t.dataset.addSub}"]`;
    commit();
  } else if (t.dataset.edit || t.dataset.editSection) {
    finishEdit(t);
  } else if (t.id === 'new-section') {
    const name = t.value.trim();
    if (!name) return;
    const color = COLORS[state.sections.length % COLORS.length];
    const s = { id: uid(), name, color, collapsed: false, tasks: [] };
    state.sections.push(s);
    t.value = '';
    focusAfter = `[data-add="${s.id}"]`;
    commit();
    document.querySelector(focusAfter)?.scrollIntoView({ block: 'center' });
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
  weekday: 'long', day: 'numeric', month: 'short',
});

store.load().then((saved) => {
  state = saved && Array.isArray(saved.sections) ? saved : defaultState();
  if (state.onTop) store.setOnTop(true);
  render();
});
})();
