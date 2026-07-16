import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyCXqPRPt_BKIjaH1My3QAE4vYgqq6TRaRs",
  authDomain: "catwms-46c94.firebaseapp.com",
  projectId: "catwms-46c94",
  storageBucket: "catwms-46c94.firebasestorage.app",
  messagingSenderId: "240887897192",
  appId: "1:240887897192:web:411b5433fc12a37e0eafdd"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Документ, в котором хранится весь массив коробок
const BOXES_DOC_REF = doc(db, "warehouse", "boxes");

console.log("Firebase подключен");

/* ================= AUTH: ЭКРАН ВХОДА ================= */
const loginOverlay = document.getElementById('login-overlay');
const appRoot = document.getElementById('app-root');
const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');
const logoutBtn = document.getElementById('logout-btn');

let appInitialized = false; // чтобы initApp() не запускался повторно

// Firebase Auth требует email-формат, но друзьям удобнее вводить просто логин.
// Поэтому логин на лету превращается в "фейковый" email вида login@catmailco.local
const FAKE_EMAIL_DOMAIN = 'catmailco.local';
function usernameToFakeEmail(username){
  const clean = username.trim().toLowerCase().replace(/[^a-z0-9._-]/g, '');
  return clean + '@' + FAKE_EMAIL_DOMAIN;
}

loginForm.addEventListener('submit', async (e)=>{
  e.preventDefault();
  loginError.textContent = '';
  const username = document.getElementById('login-username').value;
  const password = document.getElementById('login-password').value;
  const email = usernameToFakeEmail(username);
  const submitBtn = loginForm.querySelector('button[type=submit]');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Входим…';
  try{
    await signInWithEmailAndPassword(auth, email, password);
    // дальше подхватит onAuthStateChanged
  }catch(err){
    loginError.textContent = 'Не удалось войти: неверный логин или пароль.';
    console.error('Ошибка входа:', err);
  }finally{
    submitBtn.disabled = false;
    submitBtn.textContent = 'Войти';
  }
});

if(logoutBtn){
  logoutBtn.addEventListener('click', ()=>{ signOut(auth); });
}

onAuthStateChanged(auth, (user)=>{
  if(user){
    loginOverlay.classList.add('hidden');
    appRoot.classList.remove('hidden');
    if(!appInitialized){
      appInitialized = true;
      initApp();
    }
  }else{
    loginOverlay.classList.remove('hidden');
    appRoot.classList.add('hidden');
    loginForm.reset();
  }
});

/* ================= ОСНОВНОЕ ПРИЛОЖЕНИЕ (запускается только после входа) ================= */
function initApp(){
  "use strict";

  /* ================= DATA DEFINITIONS ================= */
  const ROOMS = [
    {id:'hot',         name:'Жаркая комната',       icon:'🔥'},
    {id:'sunny',       name:'Солнечная комната',    icon:'☀️'},
    {id:'registers',   name:'Кассы',                icon:'💰'},
    {id:'handles',     name:'Посылки с ручками',    icon:'🧺'},
    {id:'smallstock',  name:'Малый склад',          icon:'📦'},
    {id:'dark',        name:'Тёмная комната',       icon:'🌑'},
    {id:'fridge',      name:'Холодильник',          icon:'❄️'},
    {id:'fragile',     name:'Хрупкие посылки',      icon:'🥚'},
    {id:'heavy',       name:'Тяжёлые посылки',      icon:'🏋️'},
    {id:'ship',        name:'Посылки у корабля',    icon:'🚢'},
  ];
  const ROOM_MAP = Object.fromEntries(ROOMS.map(r=>[r.id,r]));

  // Координаты меток на карте склада (% от ширины/высоты картинки)
  const MAP_HOTSPOTS = [
    {room:'heavy',      left:31.4, top:19.4},
    {room:'fridge',     left:14.0, top:21.8},
    {room:'sunny',      left:84.6, top:24.9},
    {room:'smallstock', left:30.1, top:43.7},
    {room:'dark',       left:14.0, top:52.6},
    {room:'hot',        left:85.6, top:47.6},
    {room:'ship',       left:64.3, top:58.5},
    {room:'handles',    left:42.0, top:63.6},
    {room:'registers',  left:50.8, top:81.3},
    {room:'fragile',    left:83.9, top:81.6},
  ];

  const CONDITIONS = [
    {id:'ribbon-yellow', name:'Жёлтая лента',      color:'#C9A227'},
    {id:'ribbon-red',    name:'Красная лента',      color:'#B23A32'},
    {id:'ribbon-blue',   name:'Синяя лента',        color:'#3D6C93'},
    {id:'heavy',         name:'Тяжёлая коробка',    color:'#6b4f2b'},
    {id:'fragile',       name:'Хрупкая коробка',    color:'#a15a8e'},
    {id:'warm',          name:'Хранение в тепле',   color:'#c0562b'},
    {id:'cold',          name:'Хранение в холоде',  color:'#3f7fa6'},
    {id:'dark',          name:'Хранение в темноте', color:'#3a3550'},
    {id:'light',         name:'Хранение на свету',  color:'#c9922b'},
    {id:'twine',         name:'Шпагат',              color:'#8a6b3c'},
  ];
  // Вторая категория меток — особые отметки на коробках
  const CONDITIONS_EXTRA = [
    {id:'scratches', name:'Царапины', color:'#8a7f74'},
    {id:'lavender',  name:'Лаванда',  color:'#7e6bab'},
    {id:'toad',       name:'Жаба',     color:'#4f7942'},
    {id:'clover',     name:'Клевер',   color:'#4c9a4c'},
    {id:'bites',      name:'Укусы',    color:'#a1483a'},
    {id:'lemon',      name:'Лимон',    color:'#c9a227'},
    {id:'duck',       name:'Утка',     color:'#e0932e'},
  ];
  const COND_MAP = Object.fromEntries([...CONDITIONS, ...CONDITIONS_EXTRA].map(c=>[c.id,c]));

  // Условие -> подсказка о комнате
  const SUGGEST_ROOM = {
    warm:'hot', cold:'fridge', dark:'dark', light:'sunny',
    heavy:'heavy', fragile:'fragile'
  };

  // Комната -> тег, который проставляется автоматически при выборе этой комнаты
  const ROOM_TO_COND = {
    fridge:'cold', sunny:'light', hot:'warm', dark:'dark',
    fragile:'fragile', heavy:'heavy'
  };

  const FORMAT_DEFAULTS = ['Куб','Полукуб','Четверть куба','Большой куб','Вертикальная','С ручками','Подарочная коробка','Письмо','Перевязанный мешок'];

  /* ================= STATE ================= */
  let boxes = [];
  let firestoreLoaded = false;   // получили ли мы уже первые данные из Firestore
  let isSavingRemotely = false;  // защита от повторного запуска сохранения поверх ещё не завершённого

  let state = {
    view:'rooms',
    filterRoom:null,
    filterCond:null,
    filterFormat:null,
    filterSurname:null,
    filterStatus:'stored', // stored | pending | all
    search:'',
    editingId:null,
    formConditions:new Set()
  };

  function uid(){
    return 'b_' + Date.now().toString(36) + Math.random().toString(36).slice(2,8);
  }

  /* ================= FIRESTORE SYNC ================= */

  // Записываем текущий массив boxes в Firestore.
  // Вызывается после любого локального изменения (CRUD/import/clear).
  async function saveBoxes(){
    isSavingRemotely = true;
    try{
      await setDoc(BOXES_DOC_REF, { list: boxes, updatedAt: Date.now() });
    }catch(err){
      console.error('Ошибка записи в Firestore:', err);
      showToast('⚠️ Не удалось сохранить: ' + err.message);
    }finally{
      isSavingRemotely = false;
    }
  }

  // Живая подписка: срабатывает при первом запуске и при любом
  // изменении документа (в том числе с других устройств/вкладок).
  function subscribeToBoxes(){
    onSnapshot(BOXES_DOC_REF, (snap)=>{
      if(snap.exists()){
        const data = snap.data();
        boxes = Array.isArray(data.list) ? data.list : [];
      } else {
        boxes = [];
      }
      firestoreLoaded = true;
      renderAll();
    }, (err)=>{
      console.error('Ошибка подписки на Firestore:', err);
      showToast('⚠️ Нет связи с базой данных: ' + err.message);
    });
  }

  // Если документа ещё не существует (первый запуск проекта) — создаём его пустым.
  async function ensureBoxesDocExists(){
    try{
      const snap = await getDoc(BOXES_DOC_REF);
      if(!snap.exists()){
        await setDoc(BOXES_DOC_REF, { list: [], updatedAt: Date.now() });
      }
    }catch(err){
      console.error('Ошибка инициализации документа Firestore:', err);
      showToast('⚠️ Не удалось создать документ в базе: ' + err.message);
    }
  }

  /* ================= HELPERS ================= */
  function fmtDate(iso){
    if(!iso) return '';
    const d = new Date(iso);
    return d.toLocaleDateString('ru-RU') + ' ' + d.toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'});
  }
  function isToday(iso){
    if(!iso) return false;
    const d = new Date(iso), t = new Date();
    return d.getFullYear()===t.getFullYear() && d.getMonth()===t.getMonth() && d.getDate()===t.getDate();
  }
  function formatFio(b){
    const name = (b.name||'').trim();
    const surname = (b.surname||'').trim();
    if(name && surname){
      return surname.length<=2 ? `${escapeHtml(name)} ${escapeHtml(surname)}.` : `${escapeHtml(name)} ${escapeHtml(surname)}`;
    }
    if(name) return escapeHtml(name);
    if(surname) return escapeHtml(surname);
    return '—';
  }
  function escapeHtml(str){
    return String(str).replace(/[&<>"']/g, s=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]));
  }
  function showToast(msg, undoFn){
    const t = document.getElementById('toast');
    t.innerHTML = escapeHtml(msg) + (undoFn ? ' <button id="toast-undo">Отменить</button>' : '');
    t.classList.add('show');
    if(undoFn){
      document.getElementById('toast-undo').onclick = ()=>{ undoFn(); t.classList.remove('show'); };
    }
    clearTimeout(showToast._t);
    showToast._t = setTimeout(()=>t.classList.remove('show'), 4500);
  }

  /* ================= RENDER: STATS ================= */
  function renderStats(){
    const stored = boxes.filter(b=>b.status==='stored').length;
    const issuedToday = boxes.filter(b=>b.status==='issued' && isToday(b.issuedAt)).length;
    const receivedToday = boxes.filter(b=>b.status!=='pending' && isToday(b.createdAt)).length;
    const dupCount = computeDuplicateGroups().length;
    document.getElementById('stats-pills').innerHTML = `
      <div class="stat-pill">📦 В хранении: <b>${stored}</b></div>
      <div class="stat-pill">📥 Принято сегодня: <b>${receivedToday}</b></div>
      <div class="stat-pill">✅ Выдано сегодня: <b>${issuedToday}</b></div>
      <button type="button" class="stat-pill stat-pill-clickable ${dupCount>0?'has-dups':''}" id="dup-stat-pill" title="Проверить похожие посылки">🧩 Дублей: <b>${dupCount}</b></button>
    `;
  }

  /* ================= RENDER: ROOMS ================= */
  function renderRooms(){
    const wall = document.getElementById('cubby-wall');
    wall.innerHTML = ROOMS.map(r=>{
      const count = boxes.filter(b=>b.room===r.id && b.status==='stored').length;
      return `
        <div class="cubby" data-room="${r.id}">
          <span class="tag ${count===0?'empty':''}">${count} шт.</span>
          <span class="icon">${r.icon}</span>
          <span class="rname">${r.name}</span>
          <span class="brass"></span>
        </div>`;
    }).join('');
    wall.querySelectorAll('.cubby').forEach(el=>{
      el.addEventListener('click', ()=>goToRoomList(el.dataset.room));
    });
  }

  function goToRoomList(roomId){
    state.filterRoom = roomId;
    state.filterStatus = 'stored';
    setView('list');
    renderFilters();
    renderList();
  }

  /* ================= RENDER: MAP ================= */
  function renderMap(){
    const wrap = document.getElementById('map-wrap');
    wrap.querySelectorAll('.hotspot').forEach(h=>h.remove());
    closeMapPopover();
    MAP_HOTSPOTS.forEach(hs=>{
      const room = ROOM_MAP[hs.room];
      const count = boxes.filter(b=>b.room===hs.room && b.status==='stored').length;
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.className = 'hotspot' + (count===0 ? ' empty' : '');
      dot.style.left = hs.left + '%';
      dot.style.top = hs.top + '%';
      dot.textContent = count;
      dot.title = room.name;
      dot.addEventListener('click', e=>{
        e.stopPropagation();
        openMapPopover(hs, dot);
      });
      wrap.appendChild(dot);
    });
  }

  function openMapPopover(hotspot, dotEl){
    closeMapPopover();
    const room = ROOM_MAP[hotspot.room];
    const count = boxes.filter(b=>b.room===hotspot.room && b.status==='stored').length;
    const pop = document.createElement('div');
    pop.className = 'map-popover';
    pop.id = 'map-popover';
    pop.style.left = hotspot.left + '%';
    pop.style.top = hotspot.top + '%';
    pop.innerHTML = `
      <button type="button" class="pop-close" data-close>✕</button>
      <div class="pop-head"><span class="icon">${room.icon}</span><h4>${room.name}</h4></div>
      <div class="count">${count} ${count===1?'посылка':'посылок'} в хранении</div>
      <div class="pop-actions">
        <button type="button" class="pop-view">📋 Посылки</button>
        <button type="button" class="pop-add">➕ Добавить</button>
      </div>`;
    document.getElementById('map-wrap').appendChild(pop);
    pop.querySelector('[data-close]').addEventListener('click', e=>{ e.stopPropagation(); closeMapPopover(); });
    pop.querySelector('.pop-view').addEventListener('click', e=>{ e.stopPropagation(); goToRoomList(hotspot.room); });
    pop.querySelector('.pop-add').addEventListener('click', e=>{ e.stopPropagation(); closeMapPopover(); openModal(null, hotspot.room); });
  }
  function closeMapPopover(){
    const existing = document.getElementById('map-popover');
    if(existing) existing.remove();
  }
  document.addEventListener('click', e=>{
    if(!e.target.closest('.map-popover') && !e.target.closest('.hotspot')) closeMapPopover();
  });

  /* ================= RENDER: FILTERS ================= */
  function renderFilters(){
    const wrap = document.getElementById('filters');
    const usedFormats = [...new Set(boxes.map(b=>b.format).filter(Boolean))];
    const allFormats = [...new Set([...FORMAT_DEFAULTS, ...usedFormats])];
    wrap.innerHTML = `
      <input type="text" id="filter-surname" value="${escapeHtml(state.filterSurname||'')}" placeholder="Фамилия на букву…">
      <select id="filter-room">
        <option value="">Все комнаты</option>
        ${ROOMS.map(r=>`<option value="${r.id}" ${state.filterRoom===r.id?'selected':''}>${r.icon} ${r.name}</option>`).join('')}
      </select>
      <select id="filter-format">
        <option value="">Все форматы коробки</option>
        ${allFormats.map(f=>`<option value="${escapeHtml(f)}" ${state.filterFormat===f?'selected':''}>${escapeHtml(f)}</option>`).join('')}
      </select>
      <select id="filter-status">
        <option value="stored" ${state.filterStatus==='stored'?'selected':''}>В хранении</option>
        <option value="pending" ${state.filterStatus==='pending'?'selected':''}>Не принята</option>
        <option value="all" ${state.filterStatus==='all'?'selected':''}>Все статусы</option>
      </select>
      <div class="chip-toggle" id="filter-cond-chips">
        ${CONDITIONS.map(c=>`<span class="chip ${state.filterCond===c.id?'active':''}" data-cond="${c.id}">${c.name}</span>`).join('')}
      </div>
      <div class="chip-toggle" id="filter-cond-chips-extra">
        ${CONDITIONS_EXTRA.map(c=>`<span class="chip ${state.filterCond===c.id?'active':''}" data-cond="${c.id}">${c.name}</span>`).join('')}
      </div>
      <div class="spacer"></div>
      <button type="button" class="clear-filters" id="clear-filters-btn">Сбросить фильтры</button>
    `;
    document.getElementById('filter-surname').addEventListener('input', e=>{
      state.filterSurname = e.target.value.trim() || null; renderList();
    });
    document.getElementById('filter-room').addEventListener('change', e=>{
      state.filterRoom = e.target.value || null; renderList();
    });
    document.getElementById('filter-format').addEventListener('change', e=>{
      state.filterFormat = e.target.value || null; renderList();
    });
    document.getElementById('filter-status').addEventListener('change', e=>{
      state.filterStatus = e.target.value; renderList();
    });
    wrap.querySelectorAll('#filter-cond-chips .chip, #filter-cond-chips-extra .chip').forEach(chip=>{
      chip.addEventListener('click', ()=>{
        const c = chip.dataset.cond;
        state.filterCond = state.filterCond===c ? null : c;
        renderFilters(); renderList();
      });
    });
    document.getElementById('clear-filters-btn').addEventListener('click', ()=>{
      state.filterRoom=null; state.filterCond=null; state.filterFormat=null; state.filterSurname=null; state.filterStatus='stored'; state.search='';
      document.getElementById('global-search').value='';
      updateSearchClearBtn();
      renderFilters(); renderList();
    });
  }

  /* ================= RENDER: LIST ================= */
  function matchesFilters(b){
    if(state.filterRoom && b.room !== state.filterRoom) return false;
    if(state.filterFormat && b.format !== state.filterFormat) return false;
    if(state.filterCond && !(b.conditions||[]).includes(state.filterCond)) return false;
    if(state.filterSurname && !(b.surname||'').toLowerCase().startsWith(state.filterSurname.toLowerCase())) return false;
    if(state.filterStatus==='stored' && b.status!=='stored') return false;
    if(state.filterStatus==='pending' && b.status!=='pending') return false;
    if(state.search){
      const q = state.search.toLowerCase();
      // Ищем и по отдельности, и по полному "имя фамилия" — так находятся посылки,
      // у которых указана только фамилия (или только имя).
      const full = [b.name, b.surname].filter(Boolean).join(' ');
      const hay = [b.name, b.surname, full, b.format, b.note].join(' ').toLowerCase();
      if(!hay.includes(q)) return false;
    }
    return true;
  }

  function renderList(){
    const listEl = document.getElementById('box-list');

    if(!firestoreLoaded){
      listEl.innerHTML = `<div class="empty-state"><span class="em">⏳</span>Загрузка данных из базы…</div>`;
      return;
    }

    const filtered = boxes.filter(matchesFilters).sort((a,b)=> (b.createdAt||'').localeCompare(a.createdAt||''));
    if(filtered.length===0){
      listEl.innerHTML = `<div class="empty-state"><span class="em">🐾</span>Тут пока пусто. Похоже, все посылки разобраны или не найдено совпадений.</div>`;
      return;
    }
    listEl.innerHTML = filtered.map(b=>{
      const room = ROOM_MAP[b.room] || {name:'—', icon:'❔'};
      const condPills = (b.conditions||[]).map(cid=>{
        const c = COND_MAP[cid];
        return c ? `<span class="cond-pill" style="background:${c.color}">${c.name}</span>` : '';
      }).join('');
      return `
        <div class="box-card ${b.status==='issued'?'issued':''} ${b.status==='pending'?'pending':''}" data-id="${b.id}">
          <div class="who">
            <span class="fio">${formatFio(b)}</span>
            <span class="fmt">${escapeHtml(b.format || 'формат не указан')}</span>
          </div>
          <div class="room-cell">${room.icon} ${room.name}</div>
          <div class="conditions">${condPills || '<span style="color:#a08e6f; font-size:12px;">без условий</span>'}</div>
          <span class="status-badge ${b.status}">${b.status==='stored'?'В хранении':b.status==='pending'?'Не принята':'Выдана'}</span>
          <div class="box-actions">
            ${b.status==='stored' ? `<button class="icon-btn" data-action="issue" title="Выдать">📤</button>`
              : b.status==='pending' ? `<button class="icon-btn" data-action="receive" title="Принять на склад">✅</button>`
              : `<button class="icon-btn" data-action="return" title="Вернуть на склад">↩️</button>`}
            <button class="icon-btn" data-action="edit" title="Изменить">✏️</button>
            <button class="icon-btn danger" data-action="delete" title="Удалить">🗑️</button>
          </div>
        </div>`;
    }).join('');

    listEl.querySelectorAll('.box-card').forEach(card=>{
      const id = card.dataset.id;
      card.querySelectorAll('[data-action]').forEach(btn=>{
        btn.addEventListener('click', ()=>{
          const action = btn.dataset.action;
          if(action==='issue') issueBox(id);
          else if(action==='receive') receiveBox(id);
          else if(action==='return') returnBox(id);
          else if(action==='edit') openModal(id);
          else if(action==='delete') deleteBox(id);
        });
      });
    });
  }

  /* ================= RENDER: HISTORY ================= */
  function renderHistory(){
    const el = document.getElementById('history-list');

    if(!firestoreLoaded){
      el.innerHTML = `<div class="empty-state"><span class="em">⏳</span>Загрузка данных из базы…</div>`;
      return;
    }

    const issued = boxes.filter(b=>b.status==='issued').sort((a,b)=>(b.issuedAt||'').localeCompare(a.issuedAt||''));
    if(issued.length===0){
      el.innerHTML = `<div class="empty-state"><span class="em">📜</span>Пока никто ничего не забирал.</div>`;
      return;
    }
    el.innerHTML = issued.map(b=>{
      const room = ROOM_MAP[b.room] || {name:'—', icon:'❔'};
      return `
        <div class="history-row">
          <span class="fio">${formatFio(b)}</span>
          <span>${room.icon} ${room.name}</span>
          <span>${escapeHtml(b.format||'—')}</span>
          <span class="when">${fmtDate(b.issuedAt)}</span>
          <button class="icon-btn" data-id="${b.id}" data-action="return" title="Вернуть на склад">↩️ Вернуть</button>
        </div>`;
    }).join('');
    el.querySelectorAll('[data-action="return"]').forEach(btn=>{
      btn.addEventListener('click', ()=>returnBox(btn.dataset.id));
    });
  }

  /* ================= CRUD ================= */
  function issueBox(id){
    const b = boxes.find(x=>x.id===id);
    if(!b) return;
    b.status='issued';
    b.issuedAt = new Date().toISOString();
    saveBoxes();
    renderAll();
    showToast(`Посылка для «${formatFio(b)}» выдана`, ()=>{ returnBox(id); });
  }
  function receiveBox(id){
    const b = boxes.find(x=>x.id===id);
    if(!b) return;
    b.status='stored';
    saveBoxes();
    renderAll();
    showToast(`Посылка для «${formatFio(b)}» принята на склад`, ()=>{
      b.status='pending'; saveBoxes(); renderAll();
    });
  }
  function returnBox(id){
    const b = boxes.find(x=>x.id===id);
    if(!b) return;
    b.status='stored';
    b.issuedAt=null;
    saveBoxes();
    renderAll();
    showToast('Посылка возвращена на склад');
  }
  function deleteBox(id){
    const b = boxes.find(x=>x.id===id);
    if(!b) return;
    if(!confirm(`Удалить карточку «${formatFio(b)}»? Это необратимо.`)) return;
    boxes = boxes.filter(x=>x.id!==id);
    saveBoxes();
    renderAll();
    showToast('Карточка удалена');
  }

  /* ================= ДУБЛИ ================= */
  // Дублем считаем совпадение имени + фамилии + формата коробки среди
  // ещё не выданных посылок (выданные уже не мешают на складе).
  // dismissedDupKeys хранит группы, которые вручную отметили «это не дубли» —
  // сбрасывается при обновлении страницы.
  let dismissedDupKeys = new Set();

  function computeDuplicateGroups(){
    const map = new Map();
    boxes.forEach(b=>{
      if(b.status==='issued') return;
      const key = [
        (b.name||'').trim().toLowerCase(),
        (b.surname||'').trim().toLowerCase(),
        (b.format||'').trim().toLowerCase()
      ].join('|');
      if(key==='||') return; // совсем пустая карточка — пропускаем
      if(dismissedDupKeys.has(key)) return;
      if(!map.has(key)) map.set(key, []);
      map.get(key).push(b);
    });
    return [...map.entries()]
      .filter(([,list])=>list.length>1)
      .map(([key,list])=>({key, list}));
  }

  function resolveDuplicateGroup(keepId, groupIds){
    const toDelete = groupIds.filter(id=>id!==keepId);
    if(!confirm(`Оставить выбранную карточку, а остальные (${toDelete.length}) удалить? Это необратимо.`)) return;
    boxes = boxes.filter(b=>!toDelete.includes(b.id));
    saveBoxes();
    renderAll();
    renderDuplicatesModal();
    showToast('Дубли убраны, актуальная карточка сохранена');
  }

  function dismissDuplicateGroup(key){
    dismissedDupKeys.add(key);
    renderStats();
    renderDuplicatesModal();
  }

  /* ================= MODAL / FORM ================= */
  const overlay = document.getElementById('modal-overlay');
  const form = document.getElementById('box-form');

  // При выборе комнаты автоматически проставляем связанный с ней тег
  // (только для комнат из ROOM_TO_COND — остальные не трогаем).
  document.getElementById('f-room').addEventListener('change', e=>{
    const cid = ROOM_TO_COND[e.target.value];
    if(cid && !state.formConditions.has(cid)){
      state.formConditions.add(cid);
      refreshCondUI();
      refreshSuggestBox();
    }
  });

  function populateStaticFormBits(){
    const roomSel = document.getElementById('f-room');
    roomSel.innerHTML = ROOMS.map(r=>`<option value="${r.id}">${r.icon} ${r.name}</option>`).join('');

    const dl = document.getElementById('format-suggestions');
    const usedFormats = [...new Set(boxes.map(b=>b.format).filter(Boolean))];
    const allFormats = [...new Set([...FORMAT_DEFAULTS, ...usedFormats])];
    dl.innerHTML = allFormats.map(f=>`<option value="${escapeHtml(f)}">`).join('');

    const condGrid = document.getElementById('cond-grid');
    condGrid.innerHTML = CONDITIONS.map(c=>`<span class="cond-check" data-cond="${c.id}">${c.name}</span>`).join('');
    const condGridExtra = document.getElementById('cond-grid-extra');
    condGridExtra.innerHTML = CONDITIONS_EXTRA.map(c=>`<span class="cond-check" data-cond="${c.id}">${c.name}</span>`).join('');
    [condGrid, condGridExtra].forEach(grid=>{
      grid.querySelectorAll('.cond-check').forEach(el=>{
        el.addEventListener('click', ()=>{
          const cid = el.dataset.cond;
          if(state.formConditions.has(cid)) state.formConditions.delete(cid);
          else state.formConditions.add(cid);
          refreshCondUI();
          refreshSuggestBox();
        });
      });
    });
  }

  function refreshCondUI(){
    document.querySelectorAll('#cond-grid .cond-check, #cond-grid-extra .cond-check').forEach(el=>{
      const cid = el.dataset.cond;
      const c = COND_MAP[cid];
      if(state.formConditions.has(cid)){
        el.classList.add('on');
        el.style.background = c.color;
        el.style.borderColor = c.color;
      }else{
        el.classList.remove('on');
        el.style.background = '';
        el.style.borderColor = '';
      }
    });
  }

  function refreshSuggestBox(){
    const box = document.getElementById('suggest-box');
    const suggestions = [...state.formConditions]
      .map(cid=>SUGGEST_ROOM[cid])
      .filter(Boolean);
    const uniqueRooms = [...new Set(suggestions)];
    if(uniqueRooms.length===0){
      box.classList.remove('show');
      box.innerHTML='';
      return;
    }
    box.classList.add('show');
    box.innerHTML = '💡 Подходящая комната по условиям: ' + uniqueRooms.map(rid=>{
      const r = ROOM_MAP[rid];
      return `${r.icon} ${r.name} <button type="button" data-room="${rid}">Выбрать</button>`;
    }).join(' &nbsp; ');
    box.querySelectorAll('button[data-room]').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        document.getElementById('f-room').value = btn.dataset.room;
      });
    });
  }

  function openModal(editId, presetRoom){
    state.editingId = editId || null;
    document.getElementById('modal-title').textContent = editId ? 'Изменить коробку' : 'Новая коробка';
    document.getElementById('submit-modal').textContent = editId ? 'Сохранить изменения' : 'Сохранить';
    populateStaticFormBits();

    if(editId){
      const b = boxes.find(x=>x.id===editId);
      document.getElementById('f-name').value = b.name;
      document.getElementById('f-surname').value = b.surname;
      document.getElementById('f-room').value = b.room;
      document.getElementById('f-format').value = b.format || '';
      document.getElementById('f-note').value = b.note || '';
      document.getElementById('f-status').value = b.status==='pending' ? 'pending' : 'stored';
      state.formConditions = new Set(b.conditions || []);
    }else{
      form.reset();
      state.formConditions = new Set();
      document.getElementById('f-room').value = presetRoom || ROOMS[0].id;
      document.getElementById('f-status').value = 'stored';
    }
    refreshCondUI();
    refreshSuggestBox();
    overlay.classList.remove('hidden');
    setTimeout(()=>document.getElementById('f-name').focus(), 50);
  }
  function closeModal(){
    overlay.classList.add('hidden');
    state.editingId = null;
  }

  form.addEventListener('submit', e=>{
    e.preventDefault();
    const name = document.getElementById('f-name').value.trim();
    const surname = document.getElementById('f-surname').value.trim().toUpperCase();
    const room = document.getElementById('f-room').value;
    const format = document.getElementById('f-format').value.trim();
    const note = document.getElementById('f-note').value.trim();
    const status = document.getElementById('f-status').value; // stored | pending
    if((!name && !surname) || !room){
      showToast('Укажите хотя бы имя или фамилию');
      return;
    }

    if(state.editingId){
      const b = boxes.find(x=>x.id===state.editingId);
      const patch = {name, surname, room, format, note, conditions:[...state.formConditions]};
      // Статус уже выданной посылки через эту форму не трогаем — для этого есть кнопка "Вернуть".
      if(b.status !== 'issued'){ patch.status = status; }
      Object.assign(b, patch);
      showToast('Изменения сохранены');
    }else{
      boxes.push({
        id:uid(), name, surname, room, format, note,
        conditions:[...state.formConditions],
        status, createdAt:new Date().toISOString(), issuedAt:null
      });
      showToast(status==='pending' ? 'Коробка добавлена как «не принята»' : 'Коробка добавлена на склад');
    }
    saveBoxes();
    closeModal();
    renderAll();
  });

  document.getElementById('open-add-modal').addEventListener('click', ()=>openModal(null));
  document.getElementById('cancel-modal').addEventListener('click', closeModal);
  overlay.addEventListener('click', e=>{ if(e.target===overlay) closeModal(); });
  document.addEventListener('keydown', e=>{ if(e.key==='Escape' && !overlay.classList.contains('hidden')) closeModal(); });

  /* ================= ISSUE MODAL (выдача посылки по словам клиента) ================= */
  const issueOverlay = document.getElementById('issue-modal-overlay');
  let issueConditions = new Set();

  function populateIssueFormBits(){
    const roomSel = document.getElementById('issue-f-room');
    roomSel.innerHTML = '<option value="">Любая комната</option>' +
      ROOMS.map(r=>`<option value="${r.id}">${r.icon} ${r.name}</option>`).join('');

    const formatSel = document.getElementById('issue-f-format');
    const usedFormats = [...new Set(boxes.map(b=>b.format).filter(Boolean))];
    const allFormats = [...new Set([...FORMAT_DEFAULTS, ...usedFormats])];
    formatSel.innerHTML = '<option value="">Любой формат</option>' +
      allFormats.map(f=>`<option value="${escapeHtml(f)}">${escapeHtml(f)}</option>`).join('');

    const condGrid = document.getElementById('issue-cond-grid');
    condGrid.innerHTML = [...CONDITIONS, ...CONDITIONS_EXTRA]
      .map(c=>`<span class="cond-check" data-cond="${c.id}">${c.name}</span>`).join('');
    condGrid.querySelectorAll('.cond-check').forEach(el=>{
      el.addEventListener('click', ()=>{
        const cid = el.dataset.cond;
        const c = COND_MAP[cid];
        if(issueConditions.has(cid)){
          issueConditions.delete(cid);
          el.classList.remove('on');
          el.style.background = '';
          el.style.borderColor = '';
        }else{
          issueConditions.add(cid);
          el.classList.add('on');
          el.style.background = c.color;
          el.style.borderColor = c.color;
        }
        renderIssueResults();
      });
    });
  }

  // Ищет коробки в хранении по любому набору признаков, которые успел назвать клиент.
  // Пустые поля просто игнорируются — фильтр применяется только по заполненным.
  function renderIssueResults(){
    const resultsEl = document.getElementById('issue-results');
    const query = document.getElementById('issue-f-query').value.trim().toLowerCase();
    const format = document.getElementById('issue-f-format').value;
    const room = document.getElementById('issue-f-room').value;
    const hasAnyFilter = !!(query || format || room || issueConditions.size>0);

    if(!hasAnyFilter){
      resultsEl.innerHTML = `<div class="empty-state"><span class="em">🔍</span>Укажите хотя бы один признак — имя, фамилию, формат, комнату или отметку — и здесь появятся подходящие посылки.</div>`;
      return;
    }

    const matches = boxes.filter(b=>{
      if(b.status!=='stored') return false;
      if(room && b.room!==room) return false;
      if(format && b.format!==format) return false;
      if(issueConditions.size>0){
        const conds = b.conditions || [];
        for(const cid of issueConditions){ if(!conds.includes(cid)) return false; }
      }
      if(query){
        const full = [b.name, b.surname].filter(Boolean).join(' ');
        const hay = [b.name, b.surname, full, b.format, b.note].join(' ').toLowerCase();
        if(!hay.includes(query)) return false;
      }
      return true;
    }).sort((a,b)=> (b.createdAt||'').localeCompare(a.createdAt||''));

    if(matches.length===0){
      resultsEl.innerHTML = `<div class="empty-state"><span class="em">🐾</span>Ничего не нашлось. Попробуйте убрать один из признаков.</div>`;
      return;
    }

    resultsEl.innerHTML = matches.map(b=>{
      const room = ROOM_MAP[b.room] || {name:'—', icon:'❔'};
      const condPills = (b.conditions||[]).map(cid=>{
        const c = COND_MAP[cid];
        return c ? `<span class="cond-pill" style="background:${c.color}">${c.name}</span>` : '';
      }).join('');
      return `
        <div class="issue-result-card" data-id="${b.id}">
          <div class="who">
            <span class="fio">${formatFio(b)}</span>
            <span class="fmt">${escapeHtml(b.format || 'формат не указан')} · ${room.icon} ${room.name}</span>
          </div>
          <div class="conditions">${condPills || '<span style="color:#a08e6f; font-size:12px;">без условий</span>'}</div>
          <button type="button" class="btn btn-primary issue-pick-btn" data-id="${b.id}">📤 Выдать</button>
        </div>`;
    }).join('');

    resultsEl.querySelectorAll('.issue-pick-btn').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        issueBox(btn.dataset.id);
        renderIssueResults();
      });
    });
  }

  function openIssueModal(){
    populateIssueFormBits();
    issueConditions = new Set();
    document.getElementById('issue-f-query').value = '';
    document.getElementById('issue-f-format').value = '';
    document.getElementById('issue-f-room').value = '';
    renderIssueResults();
    issueOverlay.classList.remove('hidden');
    setTimeout(()=>document.getElementById('issue-f-query').focus(), 50);
  }
  function closeIssueModal(){
    issueOverlay.classList.add('hidden');
  }

  document.getElementById('open-issue-modal').addEventListener('click', openIssueModal);
  document.getElementById('cancel-issue-modal').addEventListener('click', closeIssueModal);
  issueOverlay.addEventListener('click', e=>{ if(e.target===issueOverlay) closeIssueModal(); });
  document.addEventListener('keydown', e=>{ if(e.key==='Escape' && !issueOverlay.classList.contains('hidden')) closeIssueModal(); });

  let issueQueryTimer;
  document.getElementById('issue-f-query').addEventListener('input', ()=>{
    clearTimeout(issueQueryTimer);
    issueQueryTimer = setTimeout(renderIssueResults, 150);
  });
  document.getElementById('issue-f-format').addEventListener('change', renderIssueResults);
  document.getElementById('issue-f-room').addEventListener('change', renderIssueResults);

  /* ================= DUPLICATES MODAL ================= */
  const duplicatesOverlay = document.getElementById('duplicates-modal-overlay');

  function renderDuplicatesModal(){
    const el = document.getElementById('duplicates-list');
    const groups = computeDuplicateGroups();

    if(groups.length===0){
      el.innerHTML = `<div class="empty-state"><span class="em">✨</span>Дублей не найдено — все карточки уникальны.</div>`;
      return;
    }

    el.innerHTML = groups.map(({key, list})=>{
      const ids = list.map(b=>b.id).join(',');
      const cards = list.map(b=>{
        const room = ROOM_MAP[b.room] || {name:'—', icon:'❔'};
        const condPills = (b.conditions||[]).map(cid=>{
          const c = COND_MAP[cid];
          return c ? `<span class="cond-pill" style="background:${c.color}">${c.name}</span>` : '';
        }).join('');
        return `
          <div class="dup-card">
            <div class="who">
              <span class="fio">${formatFio(b)}</span>
              <span class="fmt">${escapeHtml(b.format || 'формат не указан')} · ${room.icon} ${room.name}</span>
              <span class="fmt">Добавлена: ${fmtDate(b.createdAt)}</span>
            </div>
            <div class="conditions">${condPills || '<span style="color:#a08e6f; font-size:12px;">без условий</span>'}</div>
            <span class="status-badge ${b.status}">${b.status==='stored'?'В хранении':b.status==='pending'?'Не принята':'Выдана'}</span>
            <button type="button" class="btn btn-primary dup-pick-btn" data-id="${b.id}" data-group="${ids}">✅ Это актуальная</button>
          </div>`;
      }).join('');
      return `
        <div class="dup-group">
          <div class="dup-group-head">
            <span class="dup-group-title">Похожие карточки (${list.length})</span>
            <button type="button" class="dup-dismiss-btn" data-key="${escapeHtml(key)}">Это не дубли — пропустить</button>
          </div>
          <div class="dup-group-cards">${cards}</div>
        </div>`;
    }).join('');

    el.querySelectorAll('.dup-pick-btn').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        resolveDuplicateGroup(btn.dataset.id, btn.dataset.group.split(','));
      });
    });
    el.querySelectorAll('.dup-dismiss-btn').forEach(btn=>{
      btn.addEventListener('click', ()=>dismissDuplicateGroup(btn.dataset.key));
    });
  }

  function openDuplicatesModal(){
    renderDuplicatesModal();
    duplicatesOverlay.classList.remove('hidden');
  }
  function closeDuplicatesModal(){
    duplicatesOverlay.classList.add('hidden');
  }

  document.getElementById('stats-pills').addEventListener('click', e=>{
    if(e.target.closest('#dup-stat-pill')) openDuplicatesModal();
  });
  document.getElementById('cancel-duplicates-modal').addEventListener('click', closeDuplicatesModal);
  duplicatesOverlay.addEventListener('click', e=>{ if(e.target===duplicatesOverlay) closeDuplicatesModal(); });
  document.addEventListener('keydown', e=>{ if(e.key==='Escape' && !duplicatesOverlay.classList.contains('hidden')) closeDuplicatesModal(); });

  /* ================= TABS / VIEW ================= */
  function setView(view){
    state.view = view;
    document.querySelectorAll('.tab-btn').forEach(b=>b.classList.toggle('active', b.dataset.view===view));
    document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
    document.getElementById('view-'+view).classList.add('active');
  }
  document.querySelectorAll('.tab-btn').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      setView(btn.dataset.view);
      if(btn.dataset.view==='list'){ renderFilters(); renderList(); }
      if(btn.dataset.view==='history'){ renderHistory(); }
      if(btn.dataset.view==='rooms'){
        const activeSub = document.querySelector('.subtab-btn.active');
        if(activeSub && activeSub.dataset.sub==='wall') renderRooms(); else renderMap();
      }
    });
  });

  /* ================= SEARCH ================= */
  let searchTimer;
  const searchInput = document.getElementById('global-search');
  const searchClearBtn = document.getElementById('search-clear');
  function updateSearchClearBtn(){
    searchClearBtn.classList.toggle('show', !!searchInput.value);
  }
  searchInput.addEventListener('input', e=>{
    updateSearchClearBtn();
    clearTimeout(searchTimer);
    searchTimer = setTimeout(()=>{
      state.search = e.target.value.trim();
      if(state.search && state.view==='rooms'){ setView('list'); renderFilters(); }
      if(state.view==='list') renderList();
    }, 180);
  });
  searchClearBtn.addEventListener('click', ()=>{
    searchInput.value = '';
    state.search = '';
    updateSearchClearBtn();
    if(state.view==='list') renderList();
    searchInput.focus();
  });
  updateSearchClearBtn();

  /* ================= EXPORT / IMPORT / CLEAR ================= */
  document.getElementById('export-btn').addEventListener('click', ()=>{
    const blob = new Blob([JSON.stringify(boxes, null, 2)], {type:'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `cat-mail-co-backup-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  });
  document.getElementById('import-btn').addEventListener('click', ()=>{
    document.getElementById('import-file').click();
  });
  document.getElementById('import-file').addEventListener('change', e=>{
    const file = e.target.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = ()=>{
      try{
        const data = JSON.parse(reader.result);
        if(!Array.isArray(data)) throw new Error('bad format');
        if(confirm(`Импортировать ${data.length} записей? Это заменит текущие данные для ВСЕХ пользователей.`)){
          boxes = data;
          saveBoxes();
          renderAll();
          showToast('Данные импортированы');
        }
      }catch(err){
        alert('Не удалось прочитать файл. Убедитесь, что это корректный JSON-экспорт из этого приложения.');
      }
      e.target.value = '';
    };
    reader.readAsText(file);
  });
  document.getElementById('clear-btn').addEventListener('click', ()=>{
    if(confirm('Удалить ВСЕ данные о коробках без возможности восстановления? Это затронет ВСЕХ пользователей.')){
      boxes = [];
      saveBoxes();
      renderAll();
      showToast('Склад полностью очищен');
    }
  });

  /* ================= ROOMS SUBTABS (карта / список) ================= */
  document.querySelectorAll('.subtab-btn').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      document.querySelectorAll('.subtab-btn').forEach(b=>b.classList.toggle('active', b===btn));
      const sub = btn.dataset.sub;
      document.getElementById('sub-map').style.display = sub==='map' ? '' : 'none';
      document.getElementById('sub-wall').style.display = sub==='wall' ? '' : 'none';
      if(sub==='map') renderMap();
      if(sub==='wall') renderRooms();
    });
  });

  /* ================= INIT ================= */
  function renderAll(){
    renderStats();
    if(state.view==='rooms'){
      const activeSub = document.querySelector('.subtab-btn.active');
      if(activeSub && activeSub.dataset.sub==='wall') renderRooms();
      else renderMap();
    }
    if(state.view==='list'){ renderFilters(); renderList(); }
    if(state.view==='history') renderHistory();
  }

  // Первичная отрисовка (пустое состояние, пока грузятся данные)
  renderMap();
  renderStats();

  // Подключаемся к Firestore: создаём документ при первом запуске и подписываемся на изменения
  ensureBoxesDocExists().then(subscribeToBoxes);
}
