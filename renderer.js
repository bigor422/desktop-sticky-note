const clockTime = document.getElementById('clock-time');
const clockDate = document.getElementById('clock-date');
const todoForm = document.getElementById('todo-form');
const todoInput = document.getElementById('todo-input');
const todoList = document.getElementById('todo-list');
const emptyState = document.getElementById('empty-state');
const statusText = document.getElementById('status-text');
const taskCount = document.getElementById('task-count');
const btnClose = document.getElementById('btn-close');
const btnMin = document.getElementById('btn-min');
const btnPin = document.getElementById('btn-pin');
const btnTheme = document.getElementById('btn-theme');
const btnOpacity = document.getElementById('btn-opacity');
const opacityPanel = document.getElementById('opacity-panel');
const opacityRange = document.getElementById('opacity-range');
const opacityValue = document.getElementById('opacity-value');

const WEEKDAYS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
const PREFS_KEY = 'desktop-sticky-note-prefs';
let todos = [];
let saveTimer = null;
let prefs = loadPrefs();

function pad(value) {
  return value.toString().padStart(2, '0');
}

function createId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function loadPrefs() {
  try {
    const saved = JSON.parse(localStorage.getItem(PREFS_KEY) || '{}');
    return {
      theme: saved.theme === 'light' ? 'light' : 'dark',
      opacity: Number.isFinite(saved.opacity) ? saved.opacity : 90,
    };
  } catch (_error) {
    return { theme: 'dark', opacity: 90 };
  }
}

function savePrefs() {
  localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
}

function applyPrefs() {
  const opacity = Math.min(100, Math.max(55, prefs.opacity));
  document.body.dataset.theme = prefs.theme;
  document.documentElement.style.setProperty('--window-opacity', String(opacity / 100));
  opacityRange.value = String(opacity);
  opacityValue.textContent = `${opacity}%`;
  btnTheme.title = prefs.theme === 'light' ? '切换到深色' : '切换到浅色';
}

function updateClock() {
  const now = new Date();
  clockTime.textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  clockDate.textContent = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日 ${WEEKDAYS[now.getDay()]}`;
}

function normalizeTodos(nextTodos) {
  return nextTodos
    .map((todo) => ({
      id: todo.id || createId(),
      text: String(todo.text || '').trim(),
      done: Boolean(todo.done),
      createdAt: todo.createdAt || Date.now(),
      completedAt: todo.completedAt || null,
    }))
    .filter((todo) => todo.text);
}

function parseSavedContent(savedContent) {
  if (!savedContent) {
    return [];
  }

  try {
    const parsed = JSON.parse(savedContent);
    if (Array.isArray(parsed)) {
      return normalizeTodos(parsed);
    }
  } catch (_error) {
    // Old versions stored plain text. Each non-empty line becomes one todo.
  }

  return savedContent
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((text) => ({
      id: createId(),
      text,
      done: false,
      createdAt: Date.now(),
      completedAt: null,
    }));
}

function sortTodos() {
  todos.sort((a, b) => {
    if (a.done !== b.done) {
      return Number(a.done) - Number(b.done);
    }

    const aTime = a.done ? a.completedAt || a.createdAt : a.createdAt;
    const bTime = b.done ? b.completedAt || b.createdAt : b.createdAt;
    return aTime - bTime;
  });
}

function setStatus(text, isSaving = false) {
  statusText.textContent = text;
  statusText.classList.toggle('saving', isSaving);
}

function updateTaskCount() {
  const remaining = todos.filter((todo) => !todo.done).length;
  const done = todos.length - remaining;
  taskCount.textContent = `${remaining} 待办 · ${done} 完成`;
}

function renderTodos() {
  sortTodos();
  todoList.innerHTML = '';

  todos.forEach((todo) => {
    const item = document.createElement('li');
    item.className = `todo-item${todo.done ? ' is-done' : ''}`;
    item.dataset.id = todo.id;

    const checkbox = document.createElement('button');
    checkbox.className = 'todo-check';
    checkbox.type = 'button';
    checkbox.setAttribute('aria-label', todo.done ? '标记为未完成' : '标记为完成');
    checkbox.setAttribute('aria-pressed', String(todo.done));
    checkbox.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';

    const text = document.createElement('span');
    text.className = 'todo-text';
    text.textContent = todo.text;

    const remove = document.createElement('button');
    remove.className = 'todo-remove';
    remove.type = 'button';
    remove.title = '删除';
    remove.setAttribute('aria-label', '删除');
    remove.textContent = '×';

    item.append(checkbox, text, remove);
    todoList.appendChild(item);
  });

  emptyState.hidden = todos.length > 0;
  updateTaskCount();
}

function saveTodosNow() {
  window.electronAPI.saveNote(JSON.stringify(todos, null, 2));
  setStatus('已自动保存');
}

function scheduleSave() {
  setStatus('保存中...', true);
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveTodosNow, 300);
}

function addTodo(text) {
  const trimmed = text.trim();
  if (!trimmed) {
    return;
  }

  todos.push({
    id: createId(),
    text: trimmed,
    done: false,
    createdAt: Date.now(),
    completedAt: null,
  });
  todoInput.value = '';
  renderTodos();
  scheduleSave();
}

function toggleTodo(id) {
  todos = todos.map((todo) => {
    if (todo.id !== id) {
      return todo;
    }

    const done = !todo.done;
    return {
      ...todo,
      done,
      completedAt: done ? Date.now() : null,
    };
  });
  renderTodos();
  scheduleSave();
}

function removeTodo(id) {
  todos = todos.filter((todo) => todo.id !== id);
  renderTodos();
  scheduleSave();
}

function updatePinState(isPinned) {
  btnPin.classList.toggle('is-pinned', isPinned);
  btnPin.title = isPinned ? '取消置顶' : '保持置顶';
  btnPin.setAttribute('aria-pressed', String(isPinned));
}

applyPrefs();

window.electronAPI.loadNote()
  .then((savedContent) => {
    todos = parseSavedContent(savedContent);
    renderTodos();
    setStatus('已自动保存');
  })
  .catch(() => {
    setStatus('读取失败');
  });

updateClock();
setInterval(updateClock, 1000);
updatePinState(true);

btnTheme.addEventListener('click', () => {
  prefs.theme = prefs.theme === 'dark' ? 'light' : 'dark';
  applyPrefs();
  savePrefs();
});

btnOpacity.addEventListener('click', () => {
  const willOpen = opacityPanel.hidden;
  opacityPanel.hidden = !willOpen;
  btnOpacity.setAttribute('aria-expanded', String(willOpen));
});

opacityRange.addEventListener('input', () => {
  prefs.opacity = Number(opacityRange.value);
  applyPrefs();
  savePrefs();
});

document.addEventListener('click', (event) => {
  if (opacityPanel.hidden) {
    return;
  }

  const clickedPanel = opacityPanel.contains(event.target);
  const clickedButton = btnOpacity.contains(event.target);
  if (!clickedPanel && !clickedButton) {
    opacityPanel.hidden = true;
    btnOpacity.setAttribute('aria-expanded', 'false');
  }
});

todoForm.addEventListener('submit', (event) => {
  event.preventDefault();
  addTodo(todoInput.value);
});

todoList.addEventListener('click', (event) => {
  const item = event.target.closest('.todo-item');
  if (!item) {
    return;
  }

  if (event.target.closest('.todo-check')) {
    toggleTodo(item.dataset.id);
  }

  if (event.target.closest('.todo-remove')) {
    removeTodo(item.dataset.id);
  }
});

todoInput.addEventListener('keydown', (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
    event.preventDefault();
    clearTimeout(saveTimer);
    saveTodosNow();
  }
});

btnClose.addEventListener('click', () => {
  clearTimeout(saveTimer);
  saveTodosNow();
  window.electronAPI.closeWindow();
});

btnMin.addEventListener('click', () => {
  window.electronAPI.minimizeWindow();
});

btnPin.addEventListener('click', () => {
  window.electronAPI.toggleTop();
});

window.electronAPI.onTopStateChanged(updatePinState);
