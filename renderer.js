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
let editingId = null;
let draggedTodoId = null;
let dragOverTodoId = null;
let dragInsertAfter = false;

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
    .map((todo, index) => ({
      id: todo.id || createId(),
      text: String(todo.text || '').trim(),
      done: Boolean(todo.done),
      createdAt: todo.createdAt || Date.now(),
      completedAt: todo.completedAt || null,
      order: Number.isFinite(todo.order) ? todo.order : index,
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
    .map((text, index) => ({
      id: createId(),
      text,
      done: false,
      createdAt: Date.now(),
      completedAt: null,
      order: index,
    }));
}

function sortTodos() {
  todos.sort((a, b) => {
    if (a.done !== b.done) {
      return Number(a.done) - Number(b.done);
    }

    const aOrder = Number.isFinite(a.order) ? a.order : a.createdAt;
    const bOrder = Number.isFinite(b.order) ? b.order : b.createdAt;
    return aOrder - bOrder;
  });
}

function getBoundaryOrder(done, edge) {
  const matchingOrders = todos
    .filter((todo) => todo.done === done)
    .map((todo) => todo.order)
    .filter(Number.isFinite);

  if (matchingOrders.length === 0) {
    return 0;
  }

  return edge === 'first' ? Math.min(...matchingOrders) - 1 : Math.max(...matchingOrders) + 1;
}

function refreshTodoOrder() {
  todos.forEach((todo, index) => {
    todo.order = index;
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
  refreshTodoOrder();
  todoList.innerHTML = '';

  todos.forEach((todo) => {
    const item = document.createElement('li');
    item.className = [
      'todo-item',
      todo.done ? 'is-done' : '',
      editingId === todo.id ? 'is-editing' : '',
      draggedTodoId === todo.id ? 'is-dragging' : '',
      dragOverTodoId === todo.id ? (dragInsertAfter ? 'is-drop-after' : 'is-drop-before') : '',
    ].filter(Boolean).join(' ');
    item.dataset.id = todo.id;

    const dragHandle = document.createElement('button');
    dragHandle.className = 'todo-drag';
    dragHandle.type = 'button';
    dragHandle.draggable = editingId !== todo.id;
    dragHandle.title = '拖动排序';
    dragHandle.setAttribute('aria-label', '拖动排序');
    dragHandle.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="9" cy="5" r="1.6"/><circle cx="15" cy="5" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="19" r="1.6"/><circle cx="15" cy="19" r="1.6"/></svg>';

    const checkbox = document.createElement('button');
    checkbox.className = 'todo-check';
    checkbox.type = 'button';
    checkbox.setAttribute('aria-label', todo.done ? '标记为未完成' : '标记为完成');
    checkbox.setAttribute('aria-pressed', String(todo.done));
    checkbox.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';

    const content = document.createElement('div');
    content.className = 'todo-content';

    if (editingId === todo.id) {
      const editInput = document.createElement('input');
      editInput.className = 'todo-edit-input';
      editInput.type = 'text';
      editInput.value = todo.text;
      editInput.setAttribute('aria-label', '修改任务');
      content.appendChild(editInput);
    } else {
      const text = document.createElement('span');
      text.className = 'todo-text';
      text.textContent = todo.text;
      content.appendChild(text);
    }

    const actions = document.createElement('div');
    actions.className = 'todo-actions';

    const edit = document.createElement('button');
    edit.className = 'todo-action todo-edit';
    edit.type = 'button';
    edit.title = editingId === todo.id ? '保存' : '修改';
    edit.setAttribute('aria-label', editingId === todo.id ? '保存任务' : '修改任务');
    edit.innerHTML = editingId === todo.id
      ? '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>'
      : '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>';

    const remove = document.createElement('button');
    remove.className = 'todo-action todo-remove';
    remove.type = 'button';
    remove.title = '删除';
    remove.setAttribute('aria-label', '删除');
    remove.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12"/><path d="M18 6 6 18"/></svg>';

    actions.append(edit, remove);
    item.append(dragHandle, checkbox, content, actions);
    todoList.appendChild(item);
  });

  emptyState.hidden = todos.length > 0;
  updateTaskCount();

  const activeInput = editingId ? todoList.querySelector('.todo-edit-input') : null;
  if (activeInput) {
    activeInput.focus();
    activeInput.select();
  }
}

function saveTodosNow() {
  sortTodos();
  refreshTodoOrder();
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
    order: getBoundaryOrder(false, 'first'),
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
      order: getBoundaryOrder(done, done ? 'last' : 'first'),
    };
  });
  renderTodos();
  scheduleSave();
}

function removeTodo(id) {
  todos = todos.filter((todo) => todo.id !== id);
  if (editingId === id) {
    editingId = null;
  }
  refreshTodoOrder();
  renderTodos();
  scheduleSave();
}

function startEditing(id) {
  editingId = id;
  renderTodos();
}

function saveTodoEdit(id, text) {
  const trimmed = text.trim();
  if (!trimmed) {
    editingId = null;
    renderTodos();
    return;
  }

  todos = todos.map((todo) => (
    todo.id === id
      ? { ...todo, text: trimmed }
      : todo
  ));
  editingId = null;
  renderTodos();
  scheduleSave();
}

function cancelTodoEdit() {
  editingId = null;
  renderTodos();
}

function moveTodoTo(id, targetId, insertAfter) {
  sortTodos();
  const currentIndex = todos.findIndex((todo) => todo.id === id);
  const targetIndex = todos.findIndex((todo) => todo.id === targetId);

  if (
    currentIndex < 0
    || targetIndex < 0
    || id === targetId
    || todos[currentIndex].done !== todos[targetIndex].done
  ) {
    resetDragState();
    return;
  }

  const [todo] = todos.splice(currentIndex, 1);
  const adjustedTargetIndex = todos.findIndex((nextTodo) => nextTodo.id === targetId);
  const nextIndex = adjustedTargetIndex + (insertAfter ? 1 : 0);
  todos.splice(nextIndex, 0, todo);
  refreshTodoOrder();
  draggedTodoId = null;
  dragOverTodoId = null;
  dragInsertAfter = false;
  renderTodos();
  scheduleSave();
}

function resetDragState(shouldRender = true) {
  draggedTodoId = null;
  dragOverTodoId = null;
  dragInsertAfter = false;

  if (shouldRender) {
    renderTodos();
  }
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

  const editInput = item.querySelector('.todo-edit-input');

  if (event.target.closest('.todo-check')) {
    toggleTodo(item.dataset.id);
  }

  if (event.target.closest('.todo-edit')) {
    if (editingId === item.dataset.id && editInput) {
      saveTodoEdit(item.dataset.id, editInput.value);
    } else {
      startEditing(item.dataset.id);
    }
  }

  if (event.target.closest('.todo-remove')) {
    removeTodo(item.dataset.id);
  }
});

todoList.addEventListener('dblclick', (event) => {
  const item = event.target.closest('.todo-item');
  if (item && event.target.closest('.todo-text')) {
    startEditing(item.dataset.id);
  }
});

todoList.addEventListener('keydown', (event) => {
  if (!event.target.classList.contains('todo-edit-input')) {
    return;
  }

  const item = event.target.closest('.todo-item');
  if (!item) {
    return;
  }

  if (event.key === 'Enter') {
    event.preventDefault();
    saveTodoEdit(item.dataset.id, event.target.value);
  }

  if (event.key === 'Escape') {
    event.preventDefault();
    cancelTodoEdit();
  }
});

todoList.addEventListener('focusout', (event) => {
  if (!event.target.classList.contains('todo-edit-input')) {
    return;
  }

  const item = event.target.closest('.todo-item');
  const nextFocusInSameItem = item?.contains(event.relatedTarget);
  if (item && !nextFocusInSameItem) {
    saveTodoEdit(item.dataset.id, event.target.value);
  }
});

todoList.addEventListener('dragstart', (event) => {
  const item = event.target.closest('.todo-item');
  if (!item || !event.target.closest('.todo-drag') || editingId) {
    event.preventDefault();
    return;
  }

  draggedTodoId = item.dataset.id;
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData('text/plain', draggedTodoId);
  setTimeout(renderTodos, 0);
});

todoList.addEventListener('dragover', (event) => {
  const item = event.target.closest('.todo-item');
  if (!item || !draggedTodoId || item.dataset.id === draggedTodoId) {
    return;
  }

  const draggedTodo = todos.find((todo) => todo.id === draggedTodoId);
  const targetTodo = todos.find((todo) => todo.id === item.dataset.id);
  if (!draggedTodo || !targetTodo || draggedTodo.done !== targetTodo.done) {
    return;
  }

  event.preventDefault();
  const rect = item.getBoundingClientRect();
  const insertAfter = event.clientY > rect.top + rect.height / 2;

  if (dragOverTodoId !== item.dataset.id || dragInsertAfter !== insertAfter) {
    dragOverTodoId = item.dataset.id;
    dragInsertAfter = insertAfter;
    renderTodos();
  }
});

todoList.addEventListener('drop', (event) => {
  const item = event.target.closest('.todo-item');
  if (!item || !draggedTodoId) {
    resetDragState();
    return;
  }

  event.preventDefault();
  moveTodoTo(draggedTodoId, item.dataset.id, dragInsertAfter);
});

todoList.addEventListener('dragleave', (event) => {
  if (!todoList.contains(event.relatedTarget)) {
    dragOverTodoId = null;
    dragInsertAfter = false;
    renderTodos();
  }
});

todoList.addEventListener('dragend', () => {
  resetDragState();
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
