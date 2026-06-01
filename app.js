'use strict';

// ===================================================================
// CONFIGURATION
// ===================================================================

const CONFIG = {
  defaultMonth: '2026-05',
  workingDays: [2, 3, 4, 5, 6], // Tue=2, Wed=3, Thu=4, Fri=5, Sat=6
  dayLabels: ['日', '月', '火', '水', '木', '金', '土'],
};

// ===================================================================
// ★ Google Apps Script URL（デプロイ後に発行されるURLを貼る）
// ===================================================================
const GAS_URL = 'https://script.google.com/macros/s/AKfycbyoKsne20Efq_J6QrjE_IvqXRaROV8hy_i_KqlbWG1O4mKp7Di949pNT1VBo9zOmMYn/exec';

// ===================================================================
// MASTER DATA — スタッフ
// ===================================================================

// ラボに単独で入れるスタッフID（それ以外は2名以上体制必須）
// 京香は条件付きで単独OK（2名以上推奨だが緊急時・特定日は1人可）
const LAB_SOLO_OK = new Set(['megumi', 'naomi', 'akane', 'kyoka']);

const STAFF = [
  {
    id: 'mio',
    name: 'みお',
    short: 'みお',
    locations: ['食堂'],
    maxDaysPerWeek: null,
    hourlyRate: 1130,
    monthlyCap: null,
    color: '#80cbc4',
    blankIsAvailable: true,
  },
  {
    id: 'akane',
    name: 'あかね',
    short: 'あかね',
    locations: ['ラボ'],
    maxDaysPerWeek: null,
    hourlyRate: 1150,
    monthlyCap: null,
    color: '#ef9a9a',
    labSoloOk: true,
    blankIsAvailable: true,
  },
  {
    id: 'kyoka',
    name: '京香',
    short: '京香',
    locations: ['ラボ'],
    maxDaysPerWeek: null,
    hourlyRate: 1140,
    monthlyCap: null,
    color: '#90caf9',
    note: 'ラボ単独OK（条件付き解放。2名以上が望ましい）',
    blankIsUnavailable: true, // 5月暫定：未入力＝出社不可
  },
  {
    id: 'miyuki',
    name: 'みゆき',
    short: 'みゆき',
    locations: ['食堂'],
    maxDaysPerWeek: 3,
    maxEndHour: 16,
    hourlyRate: 1150,
    monthlyCap: 105000,
    monthlyCapSoft: 85000,
    color: '#a5d6a7',
    note: '103万の壁 / 9-16時・週3日上限',
  },
  {
    id: 'naomi',
    name: '直美',
    short: '直美',
    locations: ['食堂', 'ラボ'],
    maxDaysPerWeek: null,
    isEmployee: true,   // 社員
    hourlyRate: 0,      // 月給制のため時給計算なし
    monthlyCap: null,
    color: '#fff176',
    labSoloOk: true,
    blankIsAvailable: true, // 未入力=○（イベント・出張時のみ×）
  },
  {
    id: 'asami',
    name: 'あさみ',
    short: 'あさみ',
    locations: ['食堂', 'マルシェ', 'ラボ'],
    maxDaysPerWeek: null,
    hourlyRate: 1140,
    monthlyCap: null,
    color: '#ce93d8',
    note: 'ラボ単独NG（2名以上体制）',
    blankIsAvailable: true, // 未入力=○（×の日のみ不可）
  },
  {
    id: 'kamoshika',
    name: 'カモシカ氏（雄介）',
    short: 'カモシカ氏',
    locations: ['マルシェ', 'ラボ'],
    isOwner: true,
    isFlex: true,   // 人員外・緊急時投入
    hourlyRate: 0,
    monthlyCap: null,
    color: '#b0bec5',
    labSoloOk: true,
    note: '人員外。マルシェ販売のみ対応可（食堂不可）。ラボ強化日と販売完全空白時のみ投入',
  },
  {
    id: 'megumi',
    name: '恵',
    short: '恵',
    locations: ['食堂', 'マルシェ', 'ラボ'],
    targetDaysPerWeek: 3,
    isOwner: true,
    hourlyRate: 0,
    monthlyCap: null,
    color: '#f48fb1',
    labSoloOk: true,
    blankIsAvailable: true, // 未入力=○（イベント・出張時のみ×）
  },
];

// ===================================================================
// MASTER DATA — シフト枠
// ===================================================================

// hours: そのスロットの標準時間数
const SLOTS = [
  { id: 'shokudo_am',   location: '食堂',   label: '朝',        time: '9:00-11:30',  startH: 9,  endH: 11.5, hours: 2.5, minStaff: 1, required: true  },
  { id: 'shokudo_core', location: '食堂',   label: 'コアタイム', time: '11:30-15:00', startH: 11.5, endH: 15, hours: 3.5, minStaff: 2, required: true  },
  { id: 'shokudo_pm',   location: '食堂',   label: '午後',       time: '15:00-18:00', startH: 15, endH: 18,   hours: 3.0, minStaff: 1, required: true  },
  { id: 'marche_ship',     location: 'マルシェ', label: '出荷',       time: '9:00-11:30',  startH: 9,    endH: 11.5, hours: 2.5, minStaff: 1, required: false },
  { id: 'marche_sales_am', location: 'マルシェ', label: '販売(前半)', time: '11:30-15:00', startH: 11.5, endH: 15,   hours: 3.5, minStaff: 1, required: true  },
  { id: 'marche_sales_pm', location: 'マルシェ', label: '販売(後半)', time: '15:00-17:00', startH: 15,   endH: 17,   hours: 2.0, minStaff: 1, required: false },
  { id: 'lab_day',      location: 'ラボ',    label: '日勤',      time: '9:00-18:00',  startH: 9,  endH: 18,   hours: 9.0, minStaff: 1, required: false, skipPartialCheck: true },
  { id: 'mgmt',         location: '経営事務', label: '事務',      time: '随時',        startH: 9,  endH: 18,   hours: 0,   minStaff: 0, required: false, skipPartialCheck: true },
];

// 特殊ルール（曜日など条件付き）
const SPECIAL_RULES = [
  {
    slotId: 'shokudo_am',
    condition: (date) => date.getDay() === 5, // 金曜
    minStaff: 2,
    note: '金曜 10:30〜 全体会議 → 朝から2名体制',
  },
];

// ===================================================================
// STATE
// ===================================================================

let state = {
  currentMonth: CONFIG.defaultMonth,
  currentTab: 'shift',
  assignments: {},          // { 'YYYY-MM-DD': { slotId: ['staffId', ...] } }
  availability: {},         // { 'YYYY-MM-DD': { staffId: true|false } }
  availabilityNotes: {},    // { 'YYYY-MM-DD': { staffId: '11-18' } }  時間制限メモ
  modal: null,              // { dateStr, slotId } | null
};

// ===================================================================
// EXCEL 希望データ — スタッフ記載ルール
//   × / ✕    → false（不可）
//   時間帯    → true（その時間で出勤可）
//   空白      → true（制限なし・出勤可前提）
// ===================================================================

// 特記事項（日付ごとのメモ・イベント）
const DAY_NOTES = {
  '2026-05-01': { label: '採用説明会 17:00〜', cls: 'note-event' },
  '2026-05-08': { label: '周年', cls: 'note-anniv' },
  '2026-05-09': { label: '周年', cls: 'note-anniv' },
};

// Excelから抽出済みの5月希望データ（初期シード）
// 更新: 2026-04-14（朱音・みおの希望を追加）
const SEEDED_AVAILABILITY = {
  "2026-05-01": { "miyuki": true,  "akane": true,  "mio": true  },
  "2026-05-02": { "miyuki": false, "akane": false },
  "2026-05-05": { "miyuki": true,  "asami": false, "akane": false, "mio": true  },
  "2026-05-06": { "miyuki": true,  "akane": false, "mio": true  },
  "2026-05-07": { "miyuki": true,  "akane": true,  "mio": true  },
  "2026-05-08": { "miyuki": true,  "akane": true,  "mio": false },
  "2026-05-09": { "miyuki": false, "akane": true,  "mio": false },
  "2026-05-12": { "miyuki": true,  "akane": true,  "mio": true  },
  "2026-05-13": { "miyuki": true,  "kyoka": true  },
  "2026-05-14": { "miyuki": true,  "asami": false, "akane": true,  "kyoka": true,  "mio": false },
  "2026-05-15": { "miyuki": false, "asami": false, "akane": true,  "kyoka": true,  "mio": false },
  "2026-05-16": { "miyuki": false, "asami": false, "akane": true,  "mio": false },
  "2026-05-19": { "miyuki": true,  "akane": true,  "mio": false },
  "2026-05-20": { "miyuki": true,  "akane": true,  "mio": false },
  "2026-05-21": { "miyuki": true,  "asami": true,  "akane": true,  "kyoka": true,  "mio": false },
  "2026-05-22": { "miyuki": true,  "akane": true,  "kyoka": true,  "mio": false },
  "2026-05-23": { "miyuki": false, "akane": false, "mio": true  },
  "2026-05-26": { "miyuki": true,  "akane": true,  "mio": true  },
  "2026-05-27": { "miyuki": true,  "asami": false, "kyoka": true,  "mio": true  },
  "2026-05-28": { "miyuki": true,  "akane": true,  "mio": true  },
  "2026-05-29": { "miyuki": false, "akane": true,  "kyoka": true  },
  "2026-05-30": { "miyuki": false, "akane": false, "mio": true  },
};

// 時間制限メモ（UIには現在未表示・参考用）
const AVAILABILITY_NOTES = {
  "2026-05-01": { "akane": "16-18のみ" },
  "2026-05-07": { "akane": "11-18" },
  "2026-05-08": { "akane": "11-18" },
  "2026-05-09": { "akane": "11-18" },
  "2026-05-12": { "akane": "11-18" },
  "2026-05-13": { "kyoka": "9-15" },
  "2026-05-14": { "akane": "11-18", "kyoka": "9-12" },
  "2026-05-15": { "akane": "16-18のみ", "kyoka": "9-12" },
  "2026-05-16": { "akane": "12-18" },
  "2026-05-19": { "akane": "11-18" },
  "2026-05-20": { "akane": "11-18" },
  "2026-05-21": { "asami": "9-12のみ", "akane": "11-18", "kyoka": "9-15" },
  "2026-05-22": { "akane": "16-18のみ", "kyoka": "9-12" },
  "2026-05-26": { "akane": "11-18" },
  "2026-05-27": { "kyoka": "9-15" },
  "2026-05-28": { "akane": "11-18" },
  "2026-05-29": { "akane": "16-18のみ", "kyoka": "9-12" },
  "2026-05-30": { "akane": "12-18" },
};

// ===================================================================
// STORAGE
// ===================================================================

function saveState() {
  try {
    localStorage.setItem('kamoshika_shift_v2', JSON.stringify({
      assignments: state.assignments,
      availability: state.availability,
      availabilityNotes: state.availabilityNotes,
    }));
  } catch (e) { console.warn('保存失敗', e); }
}

function loadState() {
  try {
    const raw = localStorage.getItem('kamoshika_shift_v2');
    if (raw) {
      const data = JSON.parse(raw);
      state.assignments        = data.assignments        || {};
      state.availability       = data.availability       || {};
      state.availabilityNotes  = data.availabilityNotes  || {};
    }
  } catch (e) { console.warn('読み込み失敗', e); }

  // blankIsUnavailable スタッフのIDセット（localStorageの古いデータを強制リセット）
  const blankUnavailIds = new Set(STAFF.filter(s => s.blankIsUnavailable).map(s => s.id));

  // シードデータをマージ
  // blankIsUnavailable スタッフはSEEDEDを正とし、localStorageの値を上書き
  // それ以外は既存データがない日のみ上書き
  for (const [ds, staffMap] of Object.entries(SEEDED_AVAILABILITY)) {
    if (!state.availability[ds]) state.availability[ds] = {};
    for (const [sid, val] of Object.entries(staffMap)) {
      if (blankUnavailIds.has(sid) || state.availability[ds][sid] === undefined) {
        state.availability[ds][sid] = val;
      }
    }
  }

  // blankIsUnavailable スタッフについて、SEEDEDにない日のデータを削除（古いtrue値を除去）
  for (const [ds, dayMap] of Object.entries(state.availability)) {
    for (const sid of blankUnavailIds) {
      if (dayMap[sid] !== undefined) {
        const seededForDay = SEEDED_AVAILABILITY[ds];
        if (!seededForDay || seededForDay[sid] === undefined) {
          delete dayMap[sid];
        }
      }
    }
  }
  // 既存の時間制限シードをマージ（まだ保存されていない場合のみ）
  for (const [ds, noteMap] of Object.entries(AVAILABILITY_NOTES)) {
    if (!state.availabilityNotes[ds]) state.availabilityNotes[ds] = {};
    for (const [sid, note] of Object.entries(noteMap)) {
      if (!state.availabilityNotes[ds][sid]) {
        state.availabilityNotes[ds][sid] = note;
      }
    }
  }
}

function clearCurrentMonth() {
  const days = getWorkingDays(state.currentMonth);
  for (const d of days) {
    const ds = formatDate(d);
    delete state.assignments[ds];
  }
  saveState();
  renderApp();
}

// ===================================================================
// UTILITIES
// ===================================================================

function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseMonth(s) {
  const [y, m] = s.split('-').map(Number);
  return { year: y, month: m };
}

function formatMonthLabel(s) {
  const { year, month } = parseMonth(s);
  return `${year}年${month}月`;
}

function getWorkingDays(monthStr) {
  const { year, month } = parseMonth(monthStr);
  const days = [];
  const d = new Date(year, month - 1, 1);
  while (d.getMonth() === month - 1) {
    if (CONFIG.workingDays.includes(d.getDay())) days.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }
  return days;
}

function getStaffById(id)  { return STAFF.find(s => s.id === id); }
function getSlotById(id)   { return SLOTS.find(s => s.id === id); }

function getAssigned(dateStr, slotId) {
  return (state.assignments[dateStr] && state.assignments[dateStr][slotId]) || [];
}

function getAvail(dateStr, staffId) {
  if (!state.availability[dateStr]) return null;
  const v = state.availability[dateStr][staffId];
  return v === undefined ? null : v;
}

// 時間メモ（"11-18", "9:00~16:00", "9～15" 等）を {start, end} に解析
function parseTimeNote(note) {
  if (!note) return null;
  // 全角・半角コロン問わず数字列をすべて抽出
  // "9:00~16:00" "9：00〜16：00" "11-18" "9～15" などに対応
  const nums = note.match(/\d+/g);
  if (!nums || nums.length < 2) return null;
  if (nums.length >= 4) {
    // HH:MM ~ HH:MM → [H, MM, H, MM] → start=nums[0], end=nums[2]
    return { start: parseInt(nums[0]), end: parseInt(nums[2]) };
  }
  // H ~ H → [H, H]
  return { start: parseInt(nums[0]), end: parseInt(nums[1]) };
}

// スタッフがそのスロット全時間帯をカバーできるか（maxEndHour + 当日時間メモ）
// dateStr を渡すと時間メモも照合する
function staffCanWork(staff, slot, dateStr) {
  // maxEndHour 上限チェック（みゆきさんの16時上限など）
  if (staff.maxEndHour) {
    if (slot.startH >= staff.maxEndHour) return false; // スロット開始前に終了
    if (slot.endH   >  staff.maxEndHour) return false; // スロット終了前に退勤
  }
  // 当日の時間メモチェック
  if (dateStr) {
    const note = (state.availabilityNotes[dateStr] || {})[staff.id] || '';
    const parsed = parseTimeNote(note);
    if (parsed) {
      if (parsed.start > slot.startH) return false; // 開始前に来られない
      if (parsed.end   < slot.endH)   return false; // 終了前に帰る
    }
  }
  return true;
}

// スタッフの実質稼働時間（みゆきさんは16時打ち切り）
function effectiveHours(staff, slot) {
  if (!staff.maxEndHour) return slot.hours;
  const actualEnd = Math.min(slot.endH, staff.maxEndHour);
  return Math.max(0, actualEnd - slot.startH);
}

// ラボ単独NGチェック：単独OK以外のスタッフが1人だけ入っていたらNG
function getLabSoloViolation(dateStr) {
  const labSlot = SLOTS.find(s => s.id === 'lab_day');
  const assigned = getAssigned(dateStr, labSlot.id);
  if (assigned.length === 0) return null;
  const soloOkCount = assigned.filter(id => LAB_SOLO_OK.has(id)).length;
  if (soloOkCount === 0 && assigned.length >= 1) {
    // 単独NGスタッフのみで構成
    const names = assigned.map(id => getStaffById(id)?.short).filter(Boolean).join('・');
    return `ラボ単独NG：${names}は2名以上体制が必要`;
  }
  return null;
}

// ===================================================================
// VALIDATION
// ===================================================================

function getSlotStatus(dateStr, slot) {
  const date = new Date(dateStr + 'T00:00:00');
  const assigned = getAssigned(dateStr, slot.id);
  const count = assigned.length;

  let minStaff = slot.minStaff;
  let specialNote = null;
  for (const rule of SPECIAL_RULES) {
    if (rule.slotId === slot.id && rule.condition(date)) {
      if (rule.minStaff > minStaff) {
        minStaff = rule.minStaff;
        specialNote = rule.note;
      }
    }
  }

  // 時間メモを考慮した実質カバー人数（スロット全時間帯をカバーできる人数）
  const fullCoverCount = assigned.filter(sid => {
    const s = getStaffById(sid);
    return s && staffCanWork(s, slot, dateStr);
  }).length;
  // 途中退出するスタッフの退出時刻（最も早い退出時刻）
  const partialExits = assigned
    .map(sid => {
      const s = getStaffById(sid);
      if (!s) return null;
      const note = (state.availabilityNotes[dateStr] || {})[sid] || '';
      const parsed = parseTimeNote(note);
      if (parsed && parsed.end < slot.endH && parsed.end > slot.startH) return parsed.end;
      if (s.maxEndHour && s.maxEndHour < slot.endH) return s.maxEndHour;
      return null;
    })
    .filter(h => h !== null);
  const partialNote = partialExits.length > 0
    ? `（${Math.min(...partialExits)}時〜人員不足）`
    : null;

  if (count === 0 && slot.required) return { status: 'danger',  label: '人員なし', minStaff, specialNote };
  if (count < minStaff && slot.required) return { status: 'danger',  label: `${count}/${minStaff}名`, minStaff, specialNote };
  if (count < minStaff) return { status: 'warning', label: `${count}/${minStaff}名`, minStaff, specialNote };
  if (count === 0)       return { status: 'empty',   label: '未入力',   minStaff, specialNote };
  // 実質カバー不足（人数は足りているが時間帯をカバーできない）
  // skipPartialCheck のスロット（ラボ等）は部分参加でも OK 扱い
  if (!slot.skipPartialCheck) {
    if (fullCoverCount < minStaff && slot.required)
      return { status: 'danger',  label: `実質${fullCoverCount}/${minStaff}名${partialNote || ''}`, minStaff, specialNote };
    if (fullCoverCount < minStaff)
      return { status: 'warning', label: `実質${fullCoverCount}/${minStaff}名${partialNote || ''}`, minStaff, specialNote };
  }
  return { status: 'ok', label: `${count}名`, minStaff, specialNote };
}

function getDayHeaderClass(dateStr) {
  for (const slot of SLOTS) {
    const s = getSlotStatus(dateStr, slot);
    if (s.status === 'danger') return 'has-danger';
  }
  for (const slot of SLOTS) {
    const s = getSlotStatus(dateStr, slot);
    if (s.status === 'warning') return 'has-warning';
  }
  return '';
}

// ===================================================================
// MONTHLY STATS
// ===================================================================

function getMonthlyStats(staffId, monthStr) {
  const staff = getStaffById(staffId);
  const days  = getWorkingDays(monthStr);
  let totalHours = 0;
  const daysWorked = new Set();

  for (const day of days) {
    const ds = formatDate(day);
    for (const slot of SLOTS) {
      if (!staff.locations.includes(slot.location)) continue;
      const assigned = getAssigned(ds, slot.id);
      if (assigned.includes(staffId)) {
        daysWorked.add(ds);
        totalHours += effectiveHours(staff, slot);
      }
    }
  }

  const estimatedSalary = staff.hourlyRate > 0 ? Math.round(totalHours * staff.hourlyRate) : null;
  return { totalDays: daysWorked.size, totalHours, estimatedSalary };
}

// その日が含まれる週の稼働日数を返す
function getWeekDaysCount(staffId, dateStr) {
  const date = new Date(dateStr + 'T00:00:00');
  const dow = date.getDay();
  const mon = new Date(date);
  mon.setDate(date.getDate() - (dow === 0 ? 6 : dow - 1));
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  const monStr = formatDate(mon);
  const sunStr = formatDate(sun);

  const days = getWorkingDays(state.currentMonth).filter(d => {
    const ds = formatDate(d);
    return ds >= monStr && ds <= sunStr;
  });

  const worked = new Set();
  for (const d of days) {
    const ds = formatDate(d);
    for (const slot of SLOTS) {
      if (getAssigned(ds, slot.id).includes(staffId)) worked.add(ds);
    }
  }
  return worked.size;
}

// ===================================================================
// RENDER — APP
// ===================================================================

function renderApp() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <header class="app-header">
      <div class="header-title">
        <span class="logo">🦌</span>
        <h1>カモシカ シフト管理</h1>
      </div>
      <nav class="tab-nav">
        <button class="tab-btn ${state.currentTab === 'shift'        ? 'active' : ''}" onclick="switchTab('shift')">シフト表</button>
        <button class="tab-btn ${state.currentTab === 'availability' ? 'active' : ''}" onclick="switchTab('availability')">希望入力</button>
        <button class="tab-btn ${state.currentTab === 'alert'        ? 'active' : ''}" onclick="switchTab('alert')">差分確認</button>
        <button class="tab-btn ${state.currentTab === 'summary'      ? 'active' : ''}" onclick="switchTab('summary')">集計</button>
        <button class="tab-btn ${state.currentTab === 'staff'        ? 'active' : ''}" onclick="switchTab('staff')">スタッフ</button>
      </nav>
    </header>

    <div class="month-nav">
      <button onclick="prevMonth()">◀ 前月</button>
      <h2>${formatMonthLabel(state.currentMonth)}</h2>
      <button onclick="nextMonth()">次月 ▶</button>
      <button class="btn-auto" onclick="runAutoAssign()">⚡ 仮組みを生成</button>
      <button class="btn-gas-sync" id="gas-sync-btn" onclick="syncFromGAS()">☁️ スプレッド同期</button>
      <button class="btn-import" onclick="document.getElementById('xlsxInput').click()">📂 Excel読込</button>
      <input type="file" id="xlsxInput" accept=".xlsx" style="display:none" onchange="importExcelFile(this.files[0]);this.value=''">
      <button class="btn-print" onclick="window.print()">🖨 印刷</button>
      <button class="btn-excel" onclick="exportExcel()">📥 Excel出力</button>
      <input type="file" id="kanriInput" accept=".xlsx" style="display:none" onchange="doTransfer(this.files[0]);this.value=''">
      <button class="btn-transfer" onclick="document.getElementById('kanriInput').click()">📋 管理表転記</button>
      <button class="btn-clear" onclick="confirmClear()">リセット</button>
    </div>

    <main class="main-content">
      ${state.currentTab === 'shift'        ? renderShiftTab()        : ''}
      ${state.currentTab === 'availability' ? renderAvailabilityTab() : ''}
      ${state.currentTab === 'alert'        ? renderAlertTab()        : ''}
      ${state.currentTab === 'summary'      ? renderSummaryTab()      : ''}
      ${state.currentTab === 'staff'        ? renderStaffTab()        : ''}
    </main>

    ${state.modal ? renderModal() : ''}
  `;
}

// ===================================================================
// RENDER — SHIFT TAB
// ===================================================================

function renderShiftTab() {
  const days = getWorkingDays(state.currentMonth);

  const dayHeaders = days.map(d => {
    const ds = formatDate(d);
    const dow = d.getDay();
    const isSat = dow === 6;
    const isFri = dow === 5;
    const statusClass = getDayHeaderClass(ds);
    const hasAssign = !!state.assignments[ds];
    const pmEmpty = hasAssign && getAssigned(ds, 'shokudo_pm').length === 0;
    const labAssigned = getAssigned(ds, 'lab_day');
    const nattoOK = hasAssign &&
                    labAssigned.includes('akane') &&
                    labAssigned.includes('naomi') &&
                    labAssigned.includes('megumi');
    const dayNote = DAY_NOTES[ds];
    return `
      <th class="day-header ${isSat ? 'saturday' : ''} ${isFri ? 'friday' : ''} ${statusClass}" data-date="${ds}">
        <div class="date-num">${d.getDate()}</div>
        <div class="day-label">(${CONFIG.dayLabels[dow]})</div>
        ${isFri ? '<div class="flag-badge">会議</div>' : ''}
        ${dayNote ? `<div class="${dayNote.cls}">${dayNote.label}</div>` : ''}
        ${pmEmpty ? '<div class="pm-warn-badge">午後空</div>' : ''}
        ${nattoOK ? '<div class="natto-badge">納豆◎</div>' : ''}
      </th>`;
  }).join('');

  const locationGroups = ['食堂', 'マルシェ', 'ラボ', '経営事務'];
  let tbody = '';

  for (const loc of locationGroups) {
    const locSlots = SLOTS.filter(s => s.location === loc);
    for (let i = 0; i < locSlots.length; i++) {
      const slot = locSlots[i];
      tbody += '<tr>';

      if (i === 0) {
        tbody += `
          <td class="location-label" rowspan="${locSlots.length}">
            <span class="loc-badge loc-${locClass(loc)}">${loc}</span>
          </td>`;
      }

      tbody += `
        <td class="slot-label ${slot.required ? 'required' : ''}">
          <div class="slot-name">${slot.label}</div>
          <div class="slot-time">${slot.time}</div>
          ${slot.required ? '<span class="required-badge">必須</span>' : ''}
        </td>`;

      for (const day of days) {
        const ds = formatDate(day);
        const assigned = getAssigned(ds, slot.id);
        const st = getSlotStatus(ds, slot);

        tbody += `
          <td class="shift-cell status-${st.status}" onclick="openModal('${ds}', '${slot.id}')">
            ${assigned.map(sid => {
              const s = getStaffById(sid);
              if (!s) return '';
              const chipNote = (state.availabilityNotes[ds] || {})[sid] || '';
              return `<span class="staff-chip" style="background:${s.color}">${s.short}${chipNote ? `<span class="chip-time">${chipNote}</span>` : ''}</span>`;
            }).join('')}
            ${assigned.length === 0 ? '<span class="empty-plus">＋</span>' : ''}
          </td>`;
      }
      tbody += '</tr>';
    }
  }

  return `
    <div class="shift-table-wrapper">
      <table class="shift-table">
        <thead>
          <tr>
            <th class="col-location">拠点</th>
            <th class="col-slot">シフト枠</th>
            ${dayHeaders}
          </tr>
        </thead>
        <tbody>${tbody}</tbody>
      </table>
    </div>
    <div class="legend">
      <span class="legend-item"><span class="dot danger"></span> 必須枠・人員不足</span>
      <span class="legend-item"><span class="dot warning"></span> 人員不足</span>
      <span class="legend-item"><span class="dot ok"></span> 充足</span>
      <span style="color:#999">※ セルをクリックしてスタッフを割り当て</span>
    </div>`;
}

function locClass(loc) {
  return { '食堂': 'shokudo', 'マルシェ': 'marche', 'ラボ': 'labo', '経営事務': 'mgmt' }[loc] || 'other';
}

// ===================================================================
// RENDER — AVAILABILITY TAB
// ===================================================================

function renderAvailabilityTab() {
  const days = getWorkingDays(state.currentMonth);
  // オーナーでも blankIsAvailable（直美・恵）は表示して×入力できるようにする
  const partStaff = STAFF.filter(s => !s.isOwner || s.blankIsAvailable);

  const headers = days.map(d => {
    const dow = d.getDay();
    return `<th class="${dow === 6 ? 'saturday' : ''} ${dow === 5 ? 'friday' : ''}">${d.getDate()}<br><small>${CONFIG.dayLabels[dow]}</small></th>`;
  }).join('');

  const rows = partStaff.map(staff => {
    const cells = days.map(d => {
      const ds = formatDate(d);
      const avail = getAvail(ds, staff.id);
      const note = (state.availabilityNotes[ds] || {})[staff.id] || '';
      const effAvail = avail === null
        ? (staff.blankIsUnavailable ? false : staff.blankIsAvailable ? true : null)
        : avail;
      const cls = effAvail === true ? 'avail-yes' : effAvail === false ? 'avail-no' : 'avail-unknown';
      const sym = effAvail === true
        ? (note ? `○<br><small class="time-note">${note}</small>` : '○')
        : effAvail === false ? '×' : '－';
      return `<td class="avail-cell ${cls}" onclick="toggleAvail('${ds}', '${staff.id}')">${sym}</td>`;
    }).join('');

    return `<tr>
      <td class="staff-name-cell" style="border-left:4px solid ${staff.color}">${staff.name}</td>
      ${cells}
    </tr>`;
  }).join('');

  return `
    <div class="avail-info">
      💡 パートさんの希望シフトをここに入力してください。クリックで <strong>○（出勤可）→ ×（不可）→ 未入力</strong> と切り替わります。<br>
      入力後、「シフト表」タブでスタッフを割り当てるときに参考情報として表示されます。
    </div>
    <div class="avail-table-wrapper">
      <table class="avail-table">
        <thead>
          <tr>
            <th style="min-width:80px">スタッフ</th>
            ${headers}
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <div class="avail-legend">
      <span>○ = 出勤可</span>
      <span>× = 不可</span>
      <span>－ = 未入力</span>
    </div>`;
}

// ===================================================================
// RENDER — SUMMARY TAB
// ===================================================================

function renderSummaryTab() {
  const partStaff = STAFF.filter(s => !s.isOwner);

  const rows = partStaff.map(staff => {
    const stats = getMonthlyStats(staff.id, state.currentMonth);
    const sal = stats.estimatedSalary;
    let salClass = '';
    let salNote = '';
    if (staff.monthlyCap && sal !== null) {
      if (sal > staff.monthlyCap) {
        salClass = 'salary-over'; salNote = '⚠ 上限超過';
      } else if (staff.monthlyCapSoft && sal > staff.monthlyCapSoft) {
        salClass = 'salary-warn'; salNote = '△ 要確認';
      }
    }

    return `<tr>
      <td><span class="staff-dot" style="background:${staff.color}"></span>${staff.name}</td>
      <td class="num">${stats.totalDays} 日</td>
      <td class="num">${stats.totalHours.toFixed(1)} h</td>
      <td class="num ${salClass}">${sal !== null ? `¥${sal.toLocaleString()}` : '—'} <span class="salary-note">${salNote}</span></td>
      <td class="num">${staff.monthlyCap ? `¥${staff.monthlyCap.toLocaleString()}` : '—'}</td>
      <td class="note-cell">${staff.note || ''}</td>
    </tr>`;
  }).join('');

  // Owners summary
  const ownerRows = STAFF.filter(s => s.isOwner).map(staff => {
    const stats = getMonthlyStats(staff.id, state.currentMonth);
    return `<tr>
      <td><span class="staff-dot" style="background:${staff.color}"></span>${staff.name}</td>
      <td class="num">${stats.totalDays} 日</td>
      <td class="num">${stats.totalHours.toFixed(1)} h</td>
      <td class="num" colspan="3" style="color:#aaa; font-style:italic">経営者</td>
    </tr>`;
  }).join('');

  return `
    <div class="summary-section">
      <h3>月次集計 — ${formatMonthLabel(state.currentMonth)}</h3>
      <table class="summary-table">
        <thead>
          <tr>
            <th>スタッフ</th>
            <th>出勤日数</th>
            <th>総時間</th>
            <th>推定給与</th>
            <th>月額上限</th>
            <th>備考</th>
          </tr>
        </thead>
        <tbody>${rows}${ownerRows}</tbody>
      </table>
      <p class="summary-note">※ 時給はスタッフ設定値に基づく推定。みゆきさんは16時打ち切り計算済み。</p>
      ${renderWarnings()}
    </div>`;
}

function renderWarnings() {
  const days = getWorkingDays(state.currentMonth);
  const warns = [];

  for (const day of days) {
    const ds = formatDate(day);
    const dl = `${day.getDate()}日(${CONFIG.dayLabels[day.getDay()]})`;
    for (const slot of SLOTS) {
      const st = getSlotStatus(ds, slot);
      if (st.status === 'danger') {
        warns.push(`🔴 ${dl} ${slot.location}「${slot.label}」必須枠に人員なし`);
      } else if (st.status === 'warning') {
        warns.push(`🟡 ${dl} ${slot.location}「${slot.label}」${st.label}（最低${st.minStaff}名必要）`);
      }
      if (st.specialNote) {
        const assigned = getAssigned(ds, slot.id);
        if (assigned.length < st.minStaff) {
          warns.push(`⚠ ${dl}：${st.specialNote}`);
        }
      }
    }
  }

  // ラボ強化日チェック（恵・直美・あかね 3名全員○な日が月2回以上）
  const boostDays = days.filter(d => {
    const ds = formatDate(d);
    return ['megumi', 'naomi', 'akane'].every(sid => {
      const staff = getStaffById(sid);
      if (!staff) return false;
      const raw = getAvail(ds, sid);
      const eff = raw === null
        ? (staff.blankIsUnavailable ? false : staff.blankIsAvailable ? true : null)
        : raw;
      return eff === true;
    });
  });
  if (boostDays.length < 2) {
    warns.push(`🟡 ラボ強化可能日が${boostDays.length}回（目標：月2〜3回）。恵・直美・あかねが同時に○な日を確認してください`);
  }

  // ラボ単独NGチェック
  for (const day of days) {
    const ds = formatDate(day);
    const violation = getLabSoloViolation(ds);
    if (violation) {
      const dl = `${day.getDate()}日(${CONFIG.dayLabels[day.getDay()]})`;
      warns.push(`🔴 ${dl}：${violation}`);
    }
  }

  // みゆきさんの給与チェック
  const miyuki = getStaffById('miyuki');
  const mStats = getMonthlyStats('miyuki', state.currentMonth);
  if (miyuki.monthlyCap && mStats.estimatedSalary > miyuki.monthlyCap) {
    warns.push(`🔴 みゆきさん：推定給与 ¥${mStats.estimatedSalary.toLocaleString()} が月額上限 ¥${miyuki.monthlyCap.toLocaleString()} を超過`);
  } else if (miyuki.monthlyCapSoft && mStats.estimatedSalary > miyuki.monthlyCapSoft) {
    warns.push(`🟡 みゆきさん：推定給与 ¥${mStats.estimatedSalary.toLocaleString()} がソフト上限 ¥${miyuki.monthlyCapSoft.toLocaleString()} を超過`);
  }

  if (warns.length === 0) {
    return `<div class="warnings-box ok">✅ 現時点で問題は検出されていません</div>`;
  }
  return `
    <div class="warnings-box">
      <h4>⚠ 要確認事項（${warns.length}件）</h4>
      <ul>${warns.map(w => `<li>${w}</li>`).join('')}</ul>
    </div>`;
}

// ===================================================================
// RENDER — ALERT TAB
// ===================================================================

// その日に「出勤可能だがどのスロットにも割り当てられていない」スタッフを返す
function getAvailNotAssigned(dateStr) {
  return STAFF.filter(staff => {
    if (staff.isFlex) return false;
    const avail = getAvail(dateStr, staff.id);
    const effAvail = avail === null
      ? (staff.blankIsUnavailable ? false : staff.blankIsAvailable ? true : null)
      : avail;
    if (effAvail !== true) return false;
    return !SLOTS.some(slot => getAssigned(dateStr, slot.id).includes(staff.id));
  });
}

function renderAlertTab() {
  const days = getWorkingDays(state.currentMonth);

  // 集計サマリー
  let totalDanger = 0, totalWarn = 0, totalSkip = 0, totalAvail = 0;

  const dayCards = days.map(d => {
    const ds = formatDate(d);
    const dow = d.getDay();
    const dl = `${d.getMonth()+1}/${d.getDate()}(${CONFIG.dayLabels[dow]})`;
    const isSat = dow === 6;

    const items = [];

    // ① スロット不足・時間相違
    for (const slot of SLOTS) {
      const st = getSlotStatus(ds, slot);
      if (st.status === 'danger') {
        items.push({ type: 'danger', icon: '🔴', msg: `${slot.location}「${slot.label}」${st.label}` });
        totalDanger++;
      } else if (st.status === 'warning') {
        items.push({ type: 'warning', icon: '🟡', msg: `${slot.location}「${slot.label}」${st.label}` });
        totalWarn++;
      }
    }

    // ② ラボ単独NG
    const labViolation = getLabSoloViolation(ds);
    if (labViolation) {
      items.push({ type: 'danger', icon: '🔴', msg: labViolation });
    }

    // ③ 希望あり・未配置スタッフ
    const notAssigned = getAvailNotAssigned(ds);
    for (const staff of notAssigned) {
      const note = (state.availabilityNotes[ds] || {})[staff.id] || '';
      const weekCount = getWeekDaysCount(staff.id, ds);
      const atLimit = staff.maxDaysPerWeek !== null && weekCount >= staff.maxDaysPerWeek;
      if (atLimit) {
        items.push({
          type: 'skip',
          icon: '🟣',
          msg: `${staff.name}：希望あり・週${staff.maxDaysPerWeek}日上限でスキップ中（今週${weekCount}日）${note ? `（${note}）` : ''}`,
        });
        totalSkip++;
      } else {
        items.push({
          type: 'avail',
          icon: '🔵',
          msg: `${staff.name}：希望あり・未配置${note ? `（${note}）` : ''}`,
        });
        totalAvail++;
      }
    }

    if (items.length === 0) return '';

    const hasDanger  = items.some(i => i.type === 'danger');
    const hasWarn    = items.some(i => i.type === 'warning');
    const cardClass  = hasDanger ? 'alert-card danger' : hasWarn ? 'alert-card warning' : 'alert-card info';

    return `
      <div class="${cardClass}${isSat ? ' saturday' : ''}">
        <div class="alert-card-header">
          <span class="alert-date">${dl}</span>
          <button class="alert-goto-btn" onclick="state.currentTab='shift';renderApp();setTimeout(()=>{ const el=document.querySelector('[data-date=\\'${ds}\\']');if(el)el.scrollIntoView({behavior:'smooth',block:'center'}); },100)">シフトへ →</button>
        </div>
        <ul class="alert-list">
          ${items.map(i => `<li class="alert-item alert-type-${i.type}">${i.icon} ${i.msg}</li>`).join('')}
        </ul>
      </div>`;
  }).filter(Boolean).join('');

  // 納豆充填3名体制日（恵・直美・あかね全員○）のカウント — 可用性ベース
  const nattoBoostDays = days.filter(d => {
    const ds = formatDate(d);
    return ['megumi', 'naomi', 'akane'].every(sid => {
      const staff = getStaffById(sid);
      if (!staff) return false;
      const raw = getAvail(ds, sid);
      const eff = raw === null
        ? (staff.blankIsUnavailable ? false : staff.blankIsAvailable ? true : null)
        : raw;
      return eff === true;
    });
  });
  const nattoAlert = nattoBoostDays.length < 2
    ? `🧪 納豆充填3名体制が ${nattoBoostDays.length}日（目標：月2日以上）`
    : null;

  const totalIssues = totalDanger + totalWarn + totalSkip + totalAvail;

  return `
    <div class="alert-tab">
      <div class="alert-summary-bar">
        <span class="alert-summary-title">差分・アラート一覧</span>
        <span class="alert-badge danger">🔴 必須不足 ${totalDanger}</span>
        <span class="alert-badge warning">🟡 人員不足/時間相違 ${totalWarn}</span>
        <span class="alert-badge skip">🟣 週上限スキップ ${totalSkip}</span>
        <span class="alert-badge avail">🔵 希望あり未配置 ${totalAvail}</span>
        ${nattoAlert ? `<span class="alert-badge natto">${nattoAlert}</span>` : `<span class="alert-badge natto ok">🧪 納豆充填 ${nattoBoostDays.length}日 ✅</span>`}
      </div>
      ${totalIssues === 0 && !nattoAlert
        ? '<div class="alert-all-ok">✅ アラートなし。シフトは問題ありません。</div>'
        : `<div class="alert-grid">${dayCards}</div>`
      }
      <p class="alert-note">※ 「シフトへ→」ボタンでその日の列に移動できます。週上限スキップ（🟣）は自動配置の制約で入れられなかった人。手動で追加するか週の配置を見直してください。</p>
    </div>`;
}

// ===================================================================
// RENDER — STAFF TAB
// ===================================================================

function staffRow(staff) {
  const role = staff.isOwner ? '経営者' : staff.isFlex ? '人員外(緊急)' : 'パート';
  const roleStyle = staff.isFlex ? 'color:#e65100;font-style:italic' : '';
  return `<tr style="${staff.isFlex ? 'background:#fffde7' : ''}">
    <td><span class="staff-dot" style="background:${staff.color}"></span>${staff.name}</td>
    <td style="${roleStyle}">${role}</td>
    <td>${staff.locations.join('・')}</td>
    <td>${staff.maxDaysPerWeek !== null ? `週${staff.maxDaysPerWeek}日` : (staff.targetDaysPerWeek ? `目標週${staff.targetDaysPerWeek}日` : '—')}</td>
    <td>${staff.maxEndHour ? `${staff.maxEndHour}:00まで` : '—'}</td>
    <td>${staff.hourlyRate > 0 ? `¥${staff.hourlyRate.toLocaleString()}` : '—'}</td>
    <td class="note-cell">${staff.note || ''}</td>
  </tr>`;
}

function renderStaffTab() {
  const regularRows = STAFF.filter(s => !s.isFlex).map(staffRow).join('');
  const flexRows    = STAFF.filter(s => s.isFlex).map(staffRow).join('');

  const tableHead = `<thead><tr>
    <th>名前</th><th>区分</th><th>担当拠点</th><th>稼働上限/週</th><th>終了時刻</th><th>時給</th><th>備考</th>
  </tr></thead>`;

  return `
    <div class="staff-section">
      <h3>スタッフ一覧・制約（カモシカ氏は人員外）</h3>
      <table class="staff-table">
        ${tableHead}
        <tbody>${regularRows}</tbody>
      </table>

      <h3 style="margin-top:20px">人員外リソース（緊急時のみ）</h3>
      <table class="staff-table">
        ${tableHead}
        <tbody>${flexRows}</tbody>
      </table>

      <div class="rules-section">
        <h3>シフトルール（組み込み済み）</h3>
        <ul class="rules-list">
          <li>🏠 <strong>食堂 コアタイム（11:30-15:00）</strong>：2名体制 必須</li>
          <li>🏠 <strong>食堂 朝（9:00-11:30）</strong>：1名以上</li>
          <li>🏠 <strong>食堂 午後（15:00-18:00）</strong>：1名（16時以降の空白に注意。<strong>マルシェ販売が2名以上なら1名を食堂午後に回す</strong>）</li>
          <li>🗓 <strong>金曜 朝（9:00-11:30）</strong>：全体会議(10:30〜) → 2名体制が必要</li>
          <li>🛒 <strong>マルシェ 販売（11:30-17:00）</strong>：<strong>基本1名で運営可</strong>（1名 必須・最小限）。2名以上いる場合は余剰人員を食堂午後の16-18カバーに回す</li>
          <li>🧪 <strong>ラボ</strong>：水槽管理が最優先。あかね・京香・直美・オーナー・恵が中心</li>
          <li>🧪 <strong>ラボ単独OK</strong>：恵・直美・あかね・京香（条件付き解放）。2名以上が望ましい</li>
          <li>🧪 <strong>ラボ強化日（月2〜3回）</strong>：恵・直美・あかね 3名が同時にラボに入る日を必須設定</li>
          <li>🌅 <strong>出荷担当（9:00-11:30）</strong>：直美・あさみ・恵のいずれか1名。直美・あさみが食堂の場合は恵が優先</li>
          <li>👩‍💼 <strong>直美（正社員）</strong>：9:00-18:00 フル稼働・どこでも担当可。コアタイム入りの場合は朝（9-11:30）を出荷 or 食堂仕込みで埋める</li>
          <li>👩‍💼 <strong>恵（経営者）</strong>：9:00-18:00 稼働・直美より配置優先度は低め。コアタイム入りの場合は同様に朝枠補完あり</li>
          <li>🛒 <strong>マルシェ主担当</strong>：あさみ・恵・直美（優先順）。ヘルプ：カモシカ氏</li>
          <li>🏠 <strong>食堂主担当</strong>：みお・みゆき・あさみ・直美。ヘルプ：恵</li>
          <li>🗓 <strong>土曜特別体制</strong>：カモシカ氏→マルシェ、恵+直美→食堂、ラボ=あかね or 閉め</li>
          <li>⚠ <strong>あさみさん</strong>：ラボ単独NG（2名以上なら入れる）</li>
          <li>💰 <strong>みゆきさん</strong>：月額 ¥85,000〜¥105,000 / 9:00-16:00 / 週3日 上限<br>
              <small style="color:#888">→ 午後スロット(15-18時)に割り当てた場合は16時までの1hで計算</small></li>
        </ul>
      </div>
    </div>`;
}

// ===================================================================
// RENDER — MODAL
// ===================================================================

function renderModal() {
  const { dateStr, slotId } = state.modal;
  const slot = getSlotById(slotId);
  const date = new Date(dateStr + 'T00:00:00');
  const dl = `${date.getMonth()+1}月${date.getDate()}日(${CONFIG.dayLabels[date.getDay()]})`;
  const assigned = getAssigned(dateStr, slotId);
  const st = getSlotStatus(dateStr, slot);
  const eligible = STAFF.filter(s => s.locations.includes(slot.location));

  const staffItems = eligible.map(staff => {
    const isAssigned  = assigned.includes(staff.id);
    const avail       = getAvail(dateStr, staff.id);
    const effAvail    = avail === null
      ? (staff.blankIsUnavailable ? false : staff.blankIsAvailable ? true : null)
      : avail;
    const weekDays    = getWeekDaysCount(staff.id, dateStr);
    const overWeek    = staff.maxDaysPerWeek !== null && weekDays >= staff.maxDaysPerWeek && !isAssigned;
    const cantWork    = !staffCanWork(staff, slot, dateStr);
    const unavailable = effAvail === false;

    // cantWork の理由を特定（時間メモ or maxEndHour）
    const timeNote = (state.availabilityNotes[dateStr] || {})[staff.id] || '';
    const cantWorkReason = cantWork
      ? (timeNote ? `${timeNote}` : staff.maxEndHour ? `${staff.maxEndHour}時まで` : '時間外')
      : '';

    let tagHtml = '';
    if (effAvail === true && !isAssigned) tagHtml = `<span class="avail-tag">○ 希望日</span>`;
    if (unavailable)                      tagHtml = `<span class="avail-tag">× 不可</span>`;
    if (overWeek)                         tagHtml = `<span class="warn-tag">週${weekDays}日済</span>`;
    if (cantWork)                         tagHtml = `<span class="warn-tag">${cantWorkReason}</span>`;

    return `
      <label class="staff-checkbox ${isAssigned ? 'checked' : ''} ${unavailable ? 'unavailable' : ''} ${effAvail === true && !isAssigned ? 'available' : ''}">
        <input type="checkbox" ${isAssigned ? 'checked' : ''} onchange="toggleAssign('${dateStr}', '${slotId}', '${staff.id}', this.checked)">
        <span class="staff-dot" style="background:${staff.color}"></span>
        ${staff.name}
        ${tagHtml}
      </label>`;
  }).join('');

  const statusMsg = {
    danger:  `🔴 必須枠・人員不足${st.specialNote ? '<br><small>' + st.specialNote + '</small>' : ''}`,
    warning: `🟡 ${st.label}（最低${st.minStaff}名）${st.specialNote ? '<br><small>' + st.specialNote + '</small>' : ''}`,
    ok:      `✅ 充足（${st.label}）`,
    empty:   `⚪ 未入力`,
  }[st.status];

  return `
    <div class="modal-overlay" onclick="closeModal()">
      <div class="modal" onclick="event.stopPropagation()">
        <div class="modal-header">
          <h3>${dl}　${slot.location}「${slot.label}」</h3>
          <div class="slot-time-label">${slot.time}（${slot.hours}時間）</div>
          <button class="modal-close" onclick="closeModal()">✕</button>
        </div>
        <div class="modal-status status-${st.status}">${statusMsg}</div>
        <div class="modal-body">
          <p class="modal-hint">担当スタッフを選択（複数可）：</p>
          <div class="staff-list">${staffItems}</div>
        </div>
      </div>
    </div>`;
}

// ===================================================================
// EVENT HANDLERS
// ===================================================================

function switchTab(tab) { state.currentTab = tab; renderApp(); }

function prevMonth() {
  const { year, month } = parseMonth(state.currentMonth);
  const d = new Date(year, month - 2, 1);
  state.currentMonth = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  renderApp();
}

function nextMonth() {
  const { year, month } = parseMonth(state.currentMonth);
  const d = new Date(year, month, 1);
  state.currentMonth = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  renderApp();
}

function openModal(dateStr, slotId) {
  state.modal = { dateStr, slotId };
  renderApp();
}

function closeModal() {
  state.modal = null;
  renderApp();
}

function toggleAssign(dateStr, slotId, staffId, checked) {
  if (!state.assignments[dateStr]) state.assignments[dateStr] = {};
  if (!state.assignments[dateStr][slotId]) state.assignments[dateStr][slotId] = [];

  const arr = state.assignments[dateStr][slotId];
  if (checked && !arr.includes(staffId)) arr.push(staffId);
  if (!checked) state.assignments[dateStr][slotId] = arr.filter(id => id !== staffId);

  saveState();
  renderApp(); // モーダルも含めて再描画
}

function toggleAvail(dateStr, staffId) {
  if (!state.availability[dateStr]) state.availability[dateStr] = {};
  const cur = state.availability[dateStr][staffId];
  if (cur === undefined || cur === null) {
    state.availability[dateStr][staffId] = true;
  } else if (cur === true) {
    state.availability[dateStr][staffId] = false;
    // 時間制限ノートも削除
    if (state.availabilityNotes[dateStr]) {
      delete state.availabilityNotes[dateStr][staffId];
    }
  } else {
    delete state.availability[dateStr][staffId];
  }
  saveState();
  renderApp();
}

function runAutoAssign() {
  if (confirm(`${formatMonthLabel(state.currentMonth)} のシフトを自動仮組みします。\n現在の割り当ては上書きされます。よろしいですか？`)) {
    autoAssignMonth();
    state.currentTab = 'shift';
    renderApp();
  }
}

function confirmClear() {
  if (confirm(`${formatMonthLabel(state.currentMonth)} のシフトをすべてリセットしますか？\n（希望入力データは残ります）`)) {
    clearCurrentMonth();
  }
}

// ===================================================================
// GOOGLE SHEETS 同期（GAS経由）
// ===================================================================

function syncFromGAS() {
  if (GAS_URL === 'YOUR_GAS_URL_HERE') {
    alert('⚠️ GAS_URLが設定されていません。');
    return;
  }

  const btn = document.getElementById('gas-sync-btn');
  if (btn) { btn.textContent = '☁️ 同期中...'; btn.disabled = true; }

  const month = state.currentMonth;

  fetch(`${GAS_URL}?month=${encodeURIComponent(month)}`)
    .then(r => r.json())
    .then(result => {
      if (btn) { btn.textContent = '☁️ スプレッド同期'; btn.disabled = false; }

      if (!result.ok) {
        alert(`同期エラー: ${result.error || '不明なエラー'}`);
        return;
      }

      const latest = result.latestByStaff || {};
      if (Object.keys(latest).length === 0) {
        alert(`スプレッドシートに ${month} のデータがまだありません。`);
        return;
      }

      let count = 0;
      const synced = [];

      for (const [sid, sub] of Object.entries(latest)) {
        if (!getStaffById(sid)) continue;
        const data = sub.data || {};
        for (const [ds, val] of Object.entries(data)) {
          if (!state.availability[ds])      state.availability[ds]      = {};
          if (!state.availabilityNotes[ds]) state.availabilityNotes[ds] = {};
          if (val === '×') {
            state.availability[ds][sid] = false;
            delete state.availabilityNotes[ds][sid];
          } else if (val === '○') {
            state.availability[ds][sid] = true;
            delete state.availabilityNotes[ds][sid];
          } else {
            state.availability[ds][sid]      = true;
            state.availabilityNotes[ds][sid] = val;
          }
          count++;
        }
        synced.push(`${getStaffById(sid).name}（${sub.ts}）`);
      }

      saveState();
      state.currentTab = 'availability';
      renderApp();
      alert(`✅ 同期完了\n\n${synced.join('\n')}\n\n合計 ${count} 件を反映しました`);
    })
    .catch(err => {
      if (btn) { btn.textContent = '☁️ スプレッド同期'; btn.disabled = false; }
      alert(`同期エラー: ${err.message}`);
    });
}

// ===================================================================
// STAFF CODE IMPORT（スタッフ入力ページからのコード取込）
// ===================================================================

function showImportCodeDialog() {
  const dialog = document.createElement('div');
  dialog.id = 'import-code-dialog';
  dialog.style.cssText = `
    position:fixed; inset:0; background:rgba(0,0,0,0.5);
    display:flex; align-items:center; justify-content:center; z-index:9999;
  `;
  dialog.innerHTML = `
    <div style="background:#fff; border-radius:12px; padding:24px; max-width:480px; width:92%; box-shadow:0 8px 32px rgba(0,0,0,0.2);">
      <h3 style="margin:0 0 12px; font-size:16px;">📋 スタッフコードを取り込む</h3>
      <p style="font-size:13px; color:#666; margin:0 0 12px;">
        スタッフが「シフト希望入力ページ」でコピーしたコードを貼り付けてください。<br>
        複数人分は改行して並べてもOKです。
      </p>
      <textarea id="import-code-ta" placeholder='{"staff":"akane","month":"2026-05","data":{...}}'
        style="width:100%; height:140px; padding:10px; border:1px solid #ddd; border-radius:8px;
               font-size:13px; box-sizing:border-box; font-family:monospace; resize:vertical;"
      ></textarea>
      <div style="display:flex; gap:10px; margin-top:14px;">
        <button onclick="doImportCode()" style="flex:1; padding:12px; background:#5c6bc0; color:#fff; border:none; border-radius:8px; font-size:15px; cursor:pointer;">取り込む</button>
        <button onclick="document.getElementById('import-code-dialog').remove()" style="flex:1; padding:12px; background:#eee; border:none; border-radius:8px; font-size:15px; cursor:pointer;">キャンセル</button>
      </div>
    </div>`;
  document.body.appendChild(dialog);
  document.getElementById('import-code-ta').focus();
}

function doImportCode() {
  const raw = document.getElementById('import-code-ta').value.trim();
  if (!raw) return;

  const lines = raw.split('\n').map(l => l.trim()).filter(l => l.startsWith('{'));
  if (lines.length === 0) {
    alert('コードが見つかりません。正しい形式か確認してください。');
    return;
  }

  let totalDays = 0;
  const names = [];

  for (const line of lines) {
    try {
      const payload = JSON.parse(line);
      const { staff: sid, month, data } = payload;

      if (!getStaffById(sid)) throw new Error(`スタッフID不明: ${sid}`);
      if (!data || typeof data !== 'object') throw new Error('dataが不正です');

      const staffName = getStaffById(sid).name;

      for (const [ds, val] of Object.entries(data)) {
        if (!state.availability[ds]) state.availability[ds] = {};
        if (!state.availabilityNotes[ds]) state.availabilityNotes[ds] = {};

        if (val === '×') {
          state.availability[ds][sid] = false;
          delete state.availabilityNotes[ds][sid];
        } else if (val === '○') {
          state.availability[ds][sid] = true;
          delete state.availabilityNotes[ds][sid];
        } else {
          // 時間制限（例: "9-15", "11-18のみ"）
          state.availability[ds][sid] = true;
          state.availabilityNotes[ds][sid] = val;
        }
        totalDays++;
      }
      names.push(staffName);
    } catch (err) {
      alert(`取り込みエラー: ${err.message}\n\n該当行:\n${line}`);
      return;
    }
  }

  saveState();
  document.getElementById('import-code-dialog').remove();
  state.currentTab = 'availability';
  renderApp();
  alert(`✅ 取り込み完了\n対象: ${names.join('・')}\n合計 ${totalDays} 件のデータを反映しました`);
}

// ===================================================================
// EXCEL IMPORT（希望シートの読み込み）
// ===================================================================

// Excelスタッフ名 → app ID
const EXCEL_STAFF_MAP = {
  '恵': 'megumi', '直美': 'naomi', 'ジル': null,
  'みゆき': 'miyuki', '麻美': 'asami',
  '朱音': 'akane', '京佳': 'kyoka', 'みお': 'mio',
};
const DAY_COLS = [2, 7, 12, 17, 22, 27, 32];

// { avail: true|false|null, note: string|null }
// null = 未入力（blankIsUnavailableスタッフは呼び出し側でfalseに変換）
function parseAvailValue(v) {
  if (v === null || v === undefined || v === '') return { avail: null, note: null };
  // 数値（Excelの日付シリアル値など）は○として扱う（時間メモにしない）
  if (typeof v === 'number' || v instanceof Date) return { avail: true, note: null };
  const s = String(v).trim();
  if (s === '×' || s === '✕' || s === 'x' || s === 'X') return { avail: false, note: null };
  if (s === '○' || s === '〇' || s === 'o' || s === 'O') return { avail: true, note: null };
  // 数字のみの文字列（Excelシリアル値が文字列として来た場合）
  if (/^\d+(\.\d+)?$/.test(s)) return { avail: true, note: null };
  // 時間文字列（例: "9:00~16:00", "9～15", "11-18のみ"）
  return { avail: true, note: s };
}

function importExcelFile(file) {
  if (typeof XLSX === 'undefined') {
    alert('ライブラリ読み込み中。ネット接続を確認してください。');
    return;
  }
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });

      // 現在月のシート名を探す（例: 20265）
      const { year, month } = parseMonth(state.currentMonth);
      const sheetName = `${year}${month}`;
      const ws = wb.Sheets[sheetName];
      if (!ws) {
        alert(`シート「${sheetName}」が見つかりません。\n利用可能: ${wb.SheetNames.join(', ')}`);
        return;
      }

      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
      const imported = {};

      // 日付行を検出してスタッフ行を読む
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        // 日付行の判定：col2にDateオブジェクトか日付シリアル
        const col2 = row[2];
        let isDateRow = false;
        if (col2 instanceof Date) isDateRow = true;
        else if (typeof col2 === 'number' && col2 > 40000 && col2 < 50000) isDateRow = true;

        if (!isDateRow) continue;

        // 日付を取得
        const blockDates = {};
        for (const col of DAY_COLS) {
          const v = row[col];
          let d = null;
          if (v instanceof Date) d = v;
          else if (typeof v === 'number' && v > 40000) {
            // Excel serial → Date
            d = new Date(Math.round((v - 25569) * 86400 * 1000));
          }
          if (d) {
            const ds = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
            if (ds.startsWith(`${year}-${String(month).padStart(2,'0')}`)) {
              blockDates[col] = ds;
            }
          }
        }
        if (Object.keys(blockDates).length === 0) continue;

        // このブロックのスタッフ行を次の25行から探す
        for (let off = 1; off <= 25; off++) {
          const sr = rows[i + off];
          if (!sr) continue;
          const name = sr[0];
          if (!(name in EXCEL_STAFF_MAP)) continue;
          const sid = EXCEL_STAFF_MAP[name];
          if (!sid) continue;

          for (const [col, ds] of Object.entries(blockDates)) {
            const val = sr[parseInt(col)];
            const parsed = parseAvailValue(val);
            const staff  = getStaffById(sid);
            // blankIsUnavailable スタッフは空白=不可
            const effectiveAvail = (parsed.avail === null && staff && staff.blankIsUnavailable)
              ? false : parsed.avail;
            if (!imported[ds]) imported[ds] = {};
            imported[ds][sid] = { avail: effectiveAvail, note: parsed.note };
          }
        }
      }

      // マージ
      let count = 0;
      for (const [ds, staffMap] of Object.entries(imported)) {
        if (!state.availability[ds])     state.availability[ds]     = {};
        if (!state.availabilityNotes[ds]) state.availabilityNotes[ds] = {};
        for (const [sid, { avail, note }] of Object.entries(staffMap)) {
          if (avail === null) {
            // 未入力：エントリ削除（希望入力タブでは「－」表示）
            delete state.availability[ds][sid];
            delete state.availabilityNotes[ds][sid];
          } else {
            state.availability[ds][sid] = avail;
            if (note) {
              state.availabilityNotes[ds][sid] = note;
            } else {
              delete state.availabilityNotes[ds][sid];
            }
          }
          count++;
        }
      }
      saveState();
      state.currentTab = 'availability';
      renderApp();
      alert(`✅ 取り込み完了：${Object.keys(imported).length}日分のデータを読み込みました`);
    } catch(err) {
      alert('読み込みエラー: ' + err.message);
      console.error(err);
    }
  };
  reader.readAsArrayBuffer(file);
}

// ===================================================================
// AUTO-ASSIGN（仮組み）
// ===================================================================

// スタッフ×拠点 → 担当スロット定義
// 朝→コア→午後 の連続性をここで定義する
const LOCATION_SLOTS = {
  mio:       { '食堂': ['shokudo_am', 'shokudo_core', 'shokudo_pm'] }, // 9〜18時
  miyuki:    { '食堂': ['shokudo_am', 'shokudo_core'] },              // 9〜15時（16時制約）
  asami:     { '食堂': ['shokudo_core'],               // コアのみ（朝は別途担当制）
               'マルシェ': ['marche_ship', 'marche_sales_am', 'marche_sales_pm'],
               'ラボ':     ['lab_day'] },
  naomi:     { '食堂': ['shokudo_core', 'shokudo_pm'], // コア+午後（朝は別途担当制）
               'マルシェ': ['marche_ship', 'marche_sales_am', 'marche_sales_pm'],
               'ラボ':     ['lab_day'] },
  megumi:    { '食堂': ['shokudo_core', 'shokudo_pm'], // コア+午後（朝は別途担当制）
               'マルシェ': ['marche_ship', 'marche_sales_am', 'marche_sales_pm'],
               'ラボ':     ['lab_day'] },
  akane:     { 'ラボ': ['lab_day'] },
  kyoka:     { 'ラボ': ['lab_day'] },
  kamoshika: { 'マルシェ': ['marche_sales_am', 'marche_sales_pm'],
               'ラボ':     ['lab_day'] },
};

// ラボ強化日を選定（月N回：恵・直美・あかね全員available な非土曜日）
function selectLabBoostDays(days, count) {
  const candidates = days.filter(d => {
    if (d.getDay() === 6) return false;
    const ds = formatDate(d);
    return getAvail(ds, 'megumi') !== false &&
           getAvail(ds, 'naomi')  !== false &&
           getAvail(ds, 'akane')  !== false;
  });
  if (candidates.length === 0) return [];
  // 月前半・後半からバランスよく選ぶ
  const h = Math.ceil(candidates.length / 2);
  const picks = [
    candidates[Math.floor(h * 0.3)],
    candidates[h + Math.floor((candidates.length - h) * 0.3)],
    candidates[Math.floor(h * 0.7)],
  ].filter(Boolean).map(formatDate);
  return [...new Set(picks)].slice(0, count);
}

function autoAssignMonth() {
  const days = getWorkingDays(state.currentMonth);
  for (const d of days) delete state.assignments[formatDate(d)];

  // ラボ強化日を月2回選定（恵・直美・あかね全員ラボ＝納豆充填等）
  const labBoostDaySet = new Set(selectLabBoostDays(days, 2));

  const weeks = groupDaysByWeek(days);

  for (const week of weeks) {
    const weekDays = {};
    const cntWD = id => weekDays[id] || 0;
    const addWD = id => { weekDays[id] = cntWD(id) + 1; };

    // みゆき金曜優先：週内処理順を 金→火水木→土 にする
    // 週3枠の1枠目が金曜に入るため、会議日（朝2名必須）の体制が確保されやすくなる
    const orderedWeek = [...week].sort((a, b) => {
      const rank = d => d.getDay() === 5 ? 0 : d.getDay() === 6 ? 2 : 1;
      return rank(a) - rank(b);
    });

    for (const day of orderedWeek) {
      const ds    = formatDate(day);
      const isSat = day.getDay() === 6;
      const isFri = day.getDay() === 5;
      if (!state.assignments[ds]) state.assignments[ds] = {};
      const placed = new Set();

      // 単スロット配置（特殊用途）
      function tryPlace(sid, slotId) {
        if (placed.has(sid)) return false;
        const staff = getStaffById(sid);
        if (!staff) return false;
        if (staff.maxDaysPerWeek !== null && cntWD(sid) >= staff.maxDaysPerWeek) return false;
        const rawAvail = getAvail(ds, sid);
        const effAvailAuto = rawAvail === null
          ? (staff.blankIsUnavailable ? false : staff.blankIsAvailable ? true : null)
          : rawAvail;
        if (effAvailAuto === false) return false;
        const slot = getSlotById(slotId);
        if (!staffCanWork(staff, slot)) return false;
        if (!staff.locations.includes(slot.location)) return false;
        if (!state.assignments[ds][slotId]) state.assignments[ds][slotId] = [];
        if (!state.assignments[ds][slotId].includes(sid)) state.assignments[ds][slotId].push(sid);
        placed.add(sid);
        addWD(sid);
        return true;
      }

      // 拠点ベース配置：LOCATION_SLOTSを使い朝→コア→午後の連続性を保証
      function placeAt(sid, location) {
        if (placed.has(sid)) return false;
        const staff = getStaffById(sid);
        if (!staff) return false;
        if (staff.maxDaysPerWeek !== null && cntWD(sid) >= staff.maxDaysPerWeek) return false;
        const rawAvailP = getAvail(ds, sid);
        const effAvailP = rawAvailP === null
          ? (staff.blankIsUnavailable ? false : staff.blankIsAvailable ? true : null)
          : rawAvailP;
        if (effAvailP === false) return false;
        const slotIds = (LOCATION_SLOTS[sid] || {})[location];
        if (!slotIds || slotIds.length === 0) return false;
        let anyPlaced = false;
        for (const slotId of slotIds) {
          const slot = getSlotById(slotId);
          if (!staffCanWork(staff, slot)) continue; // みゆきの16時制約などはスキップ
          if (!state.assignments[ds][slotId]) state.assignments[ds][slotId] = [];
          if (!state.assignments[ds][slotId].includes(sid)) {
            state.assignments[ds][slotId].push(sid);
            anyPlaced = true;
          }
        }
        if (anyPlaced) { placed.add(sid); addWD(sid); }
        return anyPlaced;
      }

      const coreOK   = () => getAssigned(ds, 'shokudo_core').length >= 2;
      const marcheOK = () => getAssigned(ds, 'marche_sales_am').length >= 1;
      const shipOK   = () => getAssigned(ds, 'marche_ship').length >= 1;
      const labOK    = () => getAssigned(ds, 'lab_day').length >= 1;

      // 午後空き補完：コアにいるスタッフ（みゆきの16時制約除く）を午後にも追加
      function fillPM() {
        if (!state.assignments[ds]['shokudo_pm']) state.assignments[ds]['shokudo_pm'] = [];
        const pm = state.assignments[ds]['shokudo_pm'];
        if (pm.length >= 1) return;
        for (const sid of getAssigned(ds, 'shokudo_core')) {
          if (sid === 'miyuki') continue; // 16時制約
          if (!pm.includes(sid)) { pm.push(sid); break; }
        }
      }

      // 食堂午後16時以降カバレッジ補完
      // マルシェ販売に2名以上いる場合、18時まで対応できる人を食堂午後にも追加
      // （マルシェは基本1名運営可。余剰1名を食堂後半の片付け要員として回す）
      function fillPMCoverage() {
        if (!state.assignments[ds]['shokudo_pm']) state.assignments[ds]['shokudo_pm'] = [];
        const pm = state.assignments[ds]['shokudo_pm'];
        const pmSlot = getSlotById('shokudo_pm');
        // すでに18時まで対応できる人がいればOK
        const has18Cover = pm.some(sid => {
          const s = getStaffById(sid);
          return s && staffCanWork(s, pmSlot, ds);
        });
        if (has18Cover) return;
        // マルシェ販売(前半)の人員確認（1名残した上で動かせるか）
        const sales = getAssigned(ds, 'marche_sales_am');
        if (sales.length >= 2) {
          // 直美(naomi)→恵(megumi)→その他 の順で食堂午後へ補充
          const marcheCandidates = [
            ...['naomi', 'megumi'].filter(id => sales.includes(id)),
            ...sales.filter(id => id !== 'naomi' && id !== 'megumi'),
          ];
          for (const sid of marcheCandidates) {
            const s = getStaffById(sid);
            if (!s) continue;
            if (!s.locations.includes('食堂')) continue;
            if (!staffCanWork(s, pmSlot, ds)) continue;
            if (!pm.includes(sid)) { pm.push(sid); return; }
          }
        }
        // マルシェから引けない場合のフォールバック: ラボにいる食堂対応可能な人を午後にも追加
        // 直美(naomi)→恵(megumi)→その他 の順で優先
        const labAssigned = getAssigned(ds, 'lab_day');
        const labCandidates = [
          ...['naomi', 'megumi'].filter(id => labAssigned.includes(id)),
          ...labAssigned.filter(id => id !== 'naomi' && id !== 'megumi'),
        ];
        for (const sid of labCandidates) {
          const s = getStaffById(sid);
          if (!s) continue;
          if (!s.locations.includes('食堂')) continue;
          if (!staffCanWork(s, pmSlot, ds)) continue;
          if (!pm.includes(sid)) { pm.push(sid); return; }
        }
      }

      // 朝担当確定ヘルパー：空ならコア担当者を朝にも追加
      // ※ 出荷担当として入っているスタッフは朝に重複追加しない（9-11:30 は一方のみ）
      function fillAM(targetCount) {
        if (!state.assignments[ds]['shokudo_am']) state.assignments[ds]['shokudo_am'] = [];
        const am = state.assignments[ds]['shokudo_am'];
        if (am.length >= targetCount) return;
        for (const sid of getAssigned(ds, 'shokudo_core')) {
          if (getAssigned(ds, 'marche_ship').includes(sid)) continue; // 出荷担当はスキップ
          if (!am.includes(sid)) { am.push(sid); if (am.length >= targetCount) break; }
        }
      }

      // 直美・恵の朝枠補完ヘルパー（9-11:30 の時間帯を有効活用）
      // コアタイムにいる場合、食堂朝の充足状況に応じて振り先を決める
      // ※ placed セットを迂回して直接追加（時間的に連続する枠のため許容）
      function fillMorningSlot(sid) {
        if (!getAssigned(ds, 'shokudo_core').includes(sid)) return;
        if (!state.assignments[ds]['shokudo_am'])  state.assignments[ds]['shokudo_am']  = [];
        if (!state.assignments[ds]['marche_ship']) state.assignments[ds]['marche_ship'] = [];
        if (!state.assignments[ds]['lab_day'])     state.assignments[ds]['lab_day']     = [];
        const am   = state.assignments[ds]['shokudo_am'];
        const ship = state.assignments[ds]['marche_ship'];
        const lab  = state.assignments[ds]['lab_day'];

        if (am.length >= 1) {
          // 食堂朝が充足 → 余剰なので別枠へ
          if (sid === 'naomi') {
            // 直美：出荷へ。あさみが出荷にいれば差し替え（あさみは販売のみに）
            if (!ship.includes(sid)) {
              const aIdx = ship.indexOf('asami');
              if (aIdx !== -1) ship.splice(aIdx, 1);
              ship.push(sid);
            }
          } else if (sid === 'megumi') {
            // 恵：ラボへ（朝の時間帯をラボで活用）
            if (!lab.includes(sid)) lab.push(sid);
          }
        } else {
          // 食堂朝が空 → 食堂仕込みへ
          if (!am.includes(sid)) am.push(sid);
        }
      }

      if (isSat) {
        // ===== 土曜特別体制 =====
        placeAt('miyuki', '食堂');    // みゆき → 朝+コア (core: 1)
        placeAt('akane',  'ラボ');    // あかね → ラボ

        // あさみ優先でコア2名確保。不在なら直美
        if (!placeAt('asami', '食堂')) {
          placeAt('naomi', '食堂');   // あさみ不在 → 直美がコア+午後
        }

        // 恵 → マルシェ（不在ならカモシカ氏）
        placeAt('megumi', 'マルシェ') || placeAt('kamoshika', 'マルシェ');

        if (!placed.has('mio')) placeAt('mio', '食堂');

        // 直美の残り（土曜は食堂優先）
        // コア不足 → 食堂コアへ。コア充足 → 食堂午後優先、なければラボ
        if (!placed.has('naomi')) {
          if (!coreOK()) {
            placeAt('naomi', '食堂') || placeAt('naomi', 'ラボ');
          } else {
            tryPlace('naomi', 'shokudo_pm') || placeAt('naomi', 'ラボ');
          }
        }

        // 食堂コア不足救済（土曜）: ラボ配置スタッフを食堂コアへ移動
        if (!coreOK()) {
          if (!state.assignments[ds]['lab_day']) state.assignments[ds]['lab_day'] = [];
          const lab = state.assignments[ds]['lab_day'];
          for (const sid of ['naomi', 'megumi', 'asami']) {
            if (coreOK()) break;
            if (!lab.includes(sid)) continue;
            lab.splice(lab.indexOf(sid), 1);
            if (!state.assignments[ds]['shokudo_core']) state.assignments[ds]['shokudo_core'] = [];
            if (!state.assignments[ds]['shokudo_core'].includes(sid)) {
              state.assignments[ds]['shokudo_core'].push(sid);
            }
          }
          if (state.assignments[ds]['lab_day'] && state.assignments[ds]['lab_day'].length === 0) {
            delete state.assignments[ds]['lab_day'];
          }
        }

        // 直美・恵の朝枠補完（コアにいる場合、出荷 or 食堂仕込みへ）
        fillMorningSlot('naomi');
        fillMorningSlot('megumi');
        fillAM(1);
        fillPM();
        fillPMCoverage();

        // 恵があぶれた場合 → 経営事務へ
        if (!placed.has('megumi')) {
          const rawM = getAvail(ds, 'megumi');
          const effM = rawM === null ? true : rawM; // blankIsAvailable
          if (effM !== false) {
            if (!state.assignments[ds]['mgmt']) state.assignments[ds]['mgmt'] = [];
            if (!state.assignments[ds]['mgmt'].includes('megumi')) {
              state.assignments[ds]['mgmt'].push('megumi');
            }
            placed.add('megumi');
          }
        }

      } else {
        // ===== 通常体制 =====
        const isBoostDay = labBoostDaySet.has(ds);

        // 1. ラボ専任（入れれば入る、なければクローズ）
        placeAt('akane', 'ラボ');
        placeAt('kyoka', 'ラボ');

        // 2. 食堂朝担当：みゆき（朝+コア）
        placeAt('miyuki', '食堂');

        // 3. みお → 食堂（朝〜午後まで対応）
        if (!placed.has('mio')) placeAt('mio', '食堂');

        // 4. あさみ: コア充足なら → マルシェ、不足なら → 食堂コア
        if (coreOK()) {
          placeAt('asami', 'マルシェ');
        } else {
          placeAt('asami', '食堂');
        }

        // 5. マルシェ担当がまだなら 恵 → 直美 の順で確保
        if (!marcheOK()) {
          placeAt('megumi', 'マルシェ') || placeAt('naomi', 'マルシェ');
        }

        // 6. 食堂コア2名確保
        if (!coreOK()) {
          placeAt('naomi', '食堂') || placeAt('megumi', '食堂');
        }

        // 7. 直美の残り
        // ラボ強化日（月2回）または マルシェ充足時: ラボ最優先（製造強化）
        // ただしラボに既に誰かいる場合のみラボ可（直美の単独ラボはつくらない）
        // マルシェ未充足: マルシェ → 食堂 の順
        if (!placed.has('naomi')) {
          const labHasSomeone = getAssigned(ds, 'lab_day').length >= 1;
          if ((isBoostDay || marcheOK()) && labHasSomeone) {
            placeAt('naomi', 'ラボ') || placeAt('naomi', 'マルシェ') || placeAt('naomi', '食堂');
          } else {
            placeAt('naomi', 'マルシェ') || placeAt('naomi', '食堂');
          }
        }

        // 8. 恵の残り
        // ラボ強化日: ラボに誰かいれば → ラボ、いなければ → 食堂
        // 通常日・マルシェ充足: 何もしない → step 15 で 経営事務
        // 通常日・マルシェ未充足 or コア不足: 食堂優先
        if (!placed.has('megumi')) {
          if (isBoostDay) {
            const labHasSomeMegumi = getAssigned(ds, 'lab_day').length >= 1;
            if (labHasSomeMegumi) {
              placeAt('megumi', 'ラボ') || placeAt('megumi', '食堂');
            } else {
              placeAt('megumi', '食堂');
            }
          } else if (!coreOK()) {
            // 食堂コアがまだ足りなければ食堂へ
            placeAt('megumi', '食堂');
          }
          // marcheOK かつ coreOK → 何もしない（step 15 で 経営事務へ）
        }

        // 8.5. 食堂コア不足救済: ラボ配置のスタッフを食堂コアへ移動
        if (!coreOK()) {
          if (!state.assignments[ds]['lab_day']) state.assignments[ds]['lab_day'] = [];
          const lab = state.assignments[ds]['lab_day'];
          for (const sid of ['naomi', 'megumi', 'asami']) {
            if (coreOK()) break;
            if (!lab.includes(sid)) continue;
            lab.splice(lab.indexOf(sid), 1);
            if (!state.assignments[ds]['shokudo_core']) state.assignments[ds]['shokudo_core'] = [];
            if (!state.assignments[ds]['shokudo_core'].includes(sid)) {
              state.assignments[ds]['shokudo_core'].push(sid);
            }
          }
          if (state.assignments[ds]['lab_day'] && state.assignments[ds]['lab_day'].length === 0) {
            delete state.assignments[ds]['lab_day'];
          }
        }

        // 9. 直美・恵の朝枠補完
        fillMorningSlot('naomi');
        fillMorningSlot('megumi');

        // 10. あさみのフォールバック
        if (!placed.has('asami')) {
          if (!coreOK()) placeAt('asami', '食堂'); // コア不足 → 食堂コアへ
          else tryPlace('asami', 'marche_sales_am'); // あぶれた → マルシェ販売前半へ
        }
        // あさみが食堂コアを担当した後、マルシェ販売後半（15-17）が空なら回す
        if (getAssigned(ds, 'shokudo_core').includes('asami')) {
          if (!state.assignments[ds]['marche_sales_pm']) state.assignments[ds]['marche_sales_pm'] = [];
          if (!state.assignments[ds]['marche_sales_pm'].includes('asami')) {
            state.assignments[ds]['marche_sales_pm'].push('asami');
          }
        }

        // 11. 出荷補充
        if (!shipOK()) tryPlace('asami', 'marche_ship');

        // 12. 朝担当確定（空なら→コア担当者を追加、金曜は2名）
        fillAM(isFri ? 2 : 1);

        // 13. カモシカ氏：マルシェ販売のみ穴埋め
        if (!marcheOK()) placeAt('kamoshika', 'マルシェ');

        // 14. 午後空き補完
        fillPM();
        fillPMCoverage();

        // 15. 恵があぶれた場合 → 経営事務へ
        if (!placed.has('megumi')) {
          const rawM = getAvail(ds, 'megumi');
          const effM = rawM === null ? true : rawM; // blankIsAvailable
          if (effM !== false) {
            if (!state.assignments[ds]['mgmt']) state.assignments[ds]['mgmt'] = [];
            if (!state.assignments[ds]['mgmt'].includes('megumi')) {
              state.assignments[ds]['mgmt'].push('megumi');
            }
            placed.add('megumi');
          }
        }
      }
    }
  }

  saveState();
  renderApp();
}

// 日付配列を「月曜始まり」の週ごとにグループ化
function groupDaysByWeek(days) {
  const weeks = [];
  let currentWeek = [];
  let lastMonStr = null;

  for (const d of days) {
    const dow = d.getDay();
    const mon = new Date(d);
    mon.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1));
    const monStr = formatDate(mon);

    if (monStr !== lastMonStr) {
      if (currentWeek.length > 0) weeks.push(currentWeek);
      currentWeek = [];
      lastMonStr = monStr;
    }
    currentWeek.push(d);
  }
  if (currentWeek.length > 0) weeks.push(currentWeek);
  return weeks;
}

// ===================================================================
// EXCEL EXPORT
// ===================================================================

function exportExcel() {
  if (typeof XLSX === 'undefined') {
    alert('Excelライブラリが読み込まれていません。ネット接続を確認してください。');
    return;
  }

  const days = getWorkingDays(state.currentMonth);
  const { year, month } = parseMonth(state.currentMonth);
  const wb = XLSX.utils.book_new();

  // ===== セルスタイルヘルパー =====
  const LOC_COLORS = { '食堂': 'E8F5E9', 'マルシェ': 'FFF3E0', 'ラボ': 'E3F2FD' };
  const LOC_FONT  = { '食堂': '1B5E20', 'マルシェ': 'BF360C', 'ラボ': '0D47A1' };
  const HEADER_BG = 'F5F5F5';
  const SAT_BG    = 'E8F0FE';
  const FRI_BG    = 'FFF3E0';
  const DANGER_BG = 'FFEBEE';
  const WARN_BG   = 'FFF8E1';
  const OK_BG     = 'F1F8E9';

  function border() {
    const s = { style: 'thin', color: { rgb: 'CCCCCC' } };
    return { top: s, bottom: s, left: s, right: s };
  }
  function makeStyle(bg, fontColor, bold) {
    const s = { fill: { fgColor: { rgb: bg || 'FFFFFF' } }, border: border() };
    if (fontColor || bold) s.font = {};
    if (fontColor) s.font.color = { rgb: fontColor };
    if (bold) s.font.bold = true;
    return s;
  }
  function cellAddr(c, r) {
    // c=0 → 'A'
    let col = '';
    let n = c;
    do { col = String.fromCharCode(65 + (n % 26)) + col; n = Math.floor(n / 26) - 1; } while (n >= 0);
    return col + (r + 1);
  }
  function applyStyle(ws, c, r, style) {
    const addr = cellAddr(c, r);
    if (!ws[addr]) ws[addr] = { t: 's', v: '' };
    ws[addr].s = style;
  }
  function setStyle(ws, c, r, style) {
    const addr = cellAddr(c, r);
    if (ws[addr]) ws[addr].s = style;
  }

  // ===== シート1: シフト表（スロット×日付）=====
  const shiftRows = [];   // AOA
  const styleMap  = [];   // styleMap[row][col] = styleObj

  // ヘッダー行 (row 0)
  const headerRow = ['拠点', 'シフト枠', '時間'];
  const headerStyle = [];
  headerStyle[0] = makeStyle(HEADER_BG, null, true);
  headerStyle[1] = makeStyle(HEADER_BG, null, true);
  headerStyle[2] = makeStyle(HEADER_BG, null, true);

  for (let di = 0; di < days.length; di++) {
    const d = days[di];
    const dow = d.getDay();
    const label = `${d.getDate()}(${CONFIG.dayLabels[dow]})`;
    headerRow.push(label);
    const bg = dow === 6 ? SAT_BG : dow === 5 ? FRI_BG : HEADER_BG;
    headerStyle[3 + di] = makeStyle(bg, null, true);
  }
  shiftRows.push(headerRow);
  styleMap.push(headerStyle);

  // データ行
  const merges = [];
  let rowIdx = 1;
  for (const loc of ['食堂', 'マルシェ', 'ラボ']) {
    const locSlots = SLOTS.filter(s => s.location === loc);
    const locBg = LOC_COLORS[loc];
    const locFont = LOC_FONT[loc];
    const mergeStart = rowIdx;

    for (let si = 0; si < locSlots.length; si++) {
      const slot = locSlots[si];
      const row = [si === 0 ? loc : '', slot.label, slot.time];
      const rowStyle = [];
      rowStyle[0] = makeStyle(locBg, locFont, true);
      rowStyle[1] = makeStyle('FAFAFA', null, true);
      rowStyle[2] = makeStyle('FAFAFA', '999999', false);

      for (let di = 0; di < days.length; di++) {
        const d = days[di];
        const ds = formatDate(d);
        const assigned = getAssigned(ds, slot.id);
        const names = assigned.map(id => getStaffById(id)?.short || '').filter(Boolean);
        row.push(names.join('・') || '');

        // セル背景：スロットステータスに応じて
        const st = getSlotStatus(ds, slot);
        const dow = d.getDay();
        let cellBg;
        if (st.status === 'danger')  cellBg = DANGER_BG;
        else if (st.status === 'warning') cellBg = WARN_BG;
        else if (st.status === 'ok')      cellBg = OK_BG;
        else {
          // 曜日ごとの薄い背景
          cellBg = dow === 6 ? 'F0F4FF' : dow === 5 ? 'FFFBF0' : 'FFFFFF';
        }
        rowStyle[3 + di] = makeStyle(cellBg, null, false);
      }

      shiftRows.push(row);
      styleMap.push(rowStyle);
      rowIdx++;
    }

    // 拠点列マージ
    if (locSlots.length > 1) {
      merges.push({ s: { r: mergeStart, c: 0 }, e: { r: mergeStart + locSlots.length - 1, c: 0 } });
    }
  }

  const ws1 = XLSX.utils.aoa_to_sheet(shiftRows);
  ws1['!cols'] = [
    { wch: 7 }, { wch: 10 }, { wch: 12 },
    ...days.map(d => ({ wch: d.getDay() === 6 ? 11 : 10 }))
  ];
  ws1['!rows'] = [{ hpt: 18 }, ...shiftRows.slice(1).map(() => ({ hpt: 22 }))];
  ws1['!merges'] = merges;

  // スタイル適用
  for (let r = 0; r < styleMap.length; r++) {
    for (let c = 0; c < styleMap[r].length; c++) {
      if (styleMap[r][c]) setStyle(ws1, c, r, styleMap[r][c]);
    }
  }

  XLSX.utils.book_append_sheet(wb, ws1, 'シフト表');

  // ===== シート2: スタッフ別集計 =====
  const summaryData = [
    ['スタッフ', '出勤日数', '総時間(h)', '推定給与(円)', '月額上限(円)', '備考'],
  ];
  for (const staff of STAFF) {
    const stats = getMonthlyStats(staff.id, state.currentMonth);
    summaryData.push([
      staff.name,
      stats.totalDays,
      stats.totalHours,
      staff.hourlyRate > 0 && stats.estimatedSalary !== null ? stats.estimatedSalary : '月給制',
      staff.monthlyCap || '',
      staff.note || '',
    ]);
  }

  const ws2 = XLSX.utils.aoa_to_sheet(summaryData);
  ws2['!cols'] = [{ wch: 14 }, { wch: 8 }, { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 26 }];
  // ヘッダー行スタイル
  for (let c = 0; c < 6; c++) setStyle(ws2, c, 0, makeStyle(HEADER_BG, null, true));
  XLSX.utils.book_append_sheet(wb, ws2, '集計');

  // ===== シート3: 希望入力 =====
  const availData = [['スタッフ', ...days.map(d => `${d.getDate()}(${CONFIG.dayLabels[d.getDay()]})`)]];
  for (const staff of STAFF.filter(s => !s.isOwner)) {
    const row = [staff.name];
    for (const d of days) {
      const ds = formatDate(d);
      const avail = getAvail(ds, staff.id);
      row.push(avail === true ? '○' : avail === false ? '×' : '');
    }
    availData.push(row);
  }

  const ws3 = XLSX.utils.aoa_to_sheet(availData);
  ws3['!cols'] = [{ wch: 12 }, ...days.map(() => ({ wch: 6 }))];
  // ヘッダースタイル
  for (let c = 0; c < availData[0].length; c++) {
    const dow = c === 0 ? -1 : days[c - 1].getDay();
    const bg = dow === 6 ? SAT_BG : dow === 5 ? FRI_BG : HEADER_BG;
    setStyle(ws3, c, 0, makeStyle(bg, null, true));
  }
  // データ行：○×に色付け
  for (let r = 1; r < availData.length; r++) {
    const staff = STAFF.filter(s => !s.isOwner)[r - 1];
    const staffBg = (staff?.color || 'FFFFFF').replace('#', '');
    setStyle(ws3, 0, r, makeStyle(staffBg, null, true));
    for (let c = 1; c < availData[r].length; c++) {
      const v = availData[r][c];
      const bg = v === '○' ? 'E8F5E9' : v === '×' ? 'FFEBEE' : 'FFFFFF';
      setStyle(ws3, c, r, makeStyle(bg, null, false));
    }
  }
  XLSX.utils.book_append_sheet(wb, ws3, '希望入力');

  // ファイル出力（cellStyles:true でスタイルを書き込む）
  const filename = `カモシカ_シフト_${year}年${month}月.xlsx`;
  XLSX.writeFile(wb, filename, { cellStyles: true });
}

// ===================================================================
// 管理表転記（ボタン1つで完結）
// ===================================================================

function doTransfer(file) {
  if (!file) return;
  if (typeof XLSX === 'undefined') {
    alert('Excelライブラリが読み込まれていません。ネット接続を確認してください。');
    return;
  }

  const { year, month } = parseMonth(state.currentMonth);
  const sheetName = `${year}${month}`;  // 例: "20265"

  const slotInfo = {
    shokudo_am:      { loc: '食堂',    startH: 9,    endH: 11.5, hours: 2.5 },
    shokudo_core:    { loc: '食堂',    startH: 11.5, endH: 15,   hours: 3.5 },
    shokudo_pm:      { loc: '食堂',    startH: 15,   endH: 18,   hours: 3.0 },
    marche_ship:     { loc: 'マルシェ', startH: 9,    endH: 11.5, hours: 2.5 },
    marche_sales_am: { loc: 'マルシェ', startH: 11.5, endH: 15,   hours: 3.5 },
    marche_sales_pm: { loc: 'マルシェ', startH: 15,   endH: 17,   hours: 2.0 },
    lab_day:         { loc: 'ラボ',    startH: 9,    endH: 18,   hours: 9.0 },
    mgmt:            { loc: '経営事務', startH: 9,    endH: 18,   hours: 0   },
  };

  // スタッフID → 週ブロック内の行オフセット（日付行からの差分）
  const STAFF_OFFSETS = {
    megumi: 15, naomi: 16, miyuki: 18,
    asami: 19, akane: 20, kyoka: 21, mio: 22,
  };

  // 週内の日付インデックス → 列番号（1始まり）
  const DAY_COLS = [
    { time: 3,  place: 4,  hours: 6  },
    { time: 8,  place: 9,  hours: 11 },
    { time: 13, place: 14, hours: 16 },
    { time: 18, place: 19, hours: 21 },
    { time: 23, place: 24, hours: 26 },
    { time: 28, place: 29, hours: 31 },
  ];

  const WEEK1_DATE_ROW = 6;
  const WEEK_BLOCK     = 31;

  function fmtH(h) {
    const hh = Math.floor(h);
    const mm = (h % 1 !== 0) ? '30' : '00';
    return `${hh}:${mm}`;
  }

  function setCell(ws, row1, col1, value) {
    const addr = XLSX.utils.encode_cell({ r: row1 - 1, c: col1 - 1 });
    const t = typeof value === 'number' ? 'n' : 's';
    if (!ws[addr]) ws[addr] = {};
    ws[addr].v = value;
    ws[addr].t = t;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    const wb = XLSX.read(e.target.result, { type: 'array', cellDates: true, cellFormula: true });

    if (!wb.SheetNames.includes(sheetName)) {
      alert(`シート "${sheetName}" が見つかりません。\n選んだファイルに ${year}年${month}月のシートがあるか確認してください。\n\n利用可能なシート: ${wb.SheetNames.join(', ')}`);
      return;
    }

    const ws = wb.Sheets[sheetName];

    // 週1の初日（C6）を取得して全日付→位置マップを構築
    const c6 = ws[XLSX.utils.encode_cell({ r: WEEK1_DATE_ROW - 1, c: 2 })];
    if (!c6 || !c6.v) {
      alert('管理表の C6 セルに日付が見つかりません。');
      return;
    }
    const firstDate = c6.v instanceof Date ? c6.v : new Date(c6.v);

    const dateToPos = {};
    for (let wi = 0; wi < 8; wi++) {
      const dateRow = WEEK1_DATE_ROW + wi * WEEK_BLOCK;
      for (let di = 0; di < 6; di++) {
        const d = new Date(firstDate);
        d.setDate(d.getDate() + wi * 7 + di);
        dateToPos[formatDate(d)] = { dateRow, dayIdx: di };
      }
    }

    // シフトデータを書き込む
    const days = getWorkingDays(state.currentMonth);
    let written = 0;

    for (const d of days) {
      const ds = formatDate(d);
      const dayAssign = state.assignments[ds] || {};
      const pos = dateToPos[ds];
      if (!pos) continue;

      const { dateRow, dayIdx } = pos;
      const cols = DAY_COLS[dayIdx];

      for (const staff of STAFF) {
        const offset = STAFF_OFFSETS[staff.id];
        if (offset === undefined) continue;

        const assignedSlots = [];
        for (const [slotId, staffIds] of Object.entries(dayAssign)) {
          if (staffIds.includes(staff.id) && slotInfo[slotId]) {
            assignedSlots.push({ slotId, ...slotInfo[slotId] });
          }
        }
        if (assignedSlots.length === 0) continue;

        const locHours = {};
        for (const s of assignedSlots) {
          locHours[s.loc] = (locHours[s.loc] || 0) + s.hours;
        }
        const mainLoc = Object.entries(locHours).sort((a, b) => b[1] - a[1])[0][0];
        const startH  = Math.min(...assignedSlots.map(s => s.startH));
        const endH    = Math.max(...assignedSlots.map(s => s.endH));
        const totalH  = assignedSlots.reduce((sum, s) => sum + s.hours, 0);

        const staffRow = dateRow + offset;
        setCell(ws, staffRow, cols.time,  `${fmtH(startH)}～${fmtH(endH)}`);
        setCell(ws, staffRow, cols.place, mainLoc);
        setCell(ws, staffRow, cols.hours, totalH);
        written++;
      }
    }

    XLSX.writeFile(wb, `シフト管理表_${year}年${month}月転記済.xlsx`);
    alert(`✅ ${written}件のシフトを転記しました！\n「シフト管理表_${year}年${month}月転記済.xlsx」がダウンロードされました。`);
  };

  reader.readAsArrayBuffer(file);
}

// ===================================================================
// INIT
// ===================================================================

document.addEventListener('DOMContentLoaded', () => {
  loadState();
  renderApp();
});
