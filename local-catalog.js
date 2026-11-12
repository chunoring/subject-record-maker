const LOCAL_CATALOG_KEY = 'subject-record-maker-local-catalog-v1';
const catalogBaseStandards = JSON.parse(JSON.stringify(ACHIEVEMENT_STANDARDS));
const catalogBaseCourses = Object.fromEntries(Object.entries(SUBJECT_PROFILES).map(([key, profile]) => [key, [...profile.courses]]));
const LOCAL_AREA_PREFIX = 'local-area-';
function localAreaKey(label) { return LOCAL_AREA_PREFIX + encodeURIComponent(label.trim()); }
const LOCAL_GENERIC_WRITING_PROFILE = {
  role: '해당 교과 교육과 학생 평가에 경험을 갖춘 교사',
  evaluationFocus: ['교과 개념의 이해와 적용', '활동 과정과 구체적인 근거', '문제 해결 및 피드백 반영'],
  promptRules: ['제공된 성취기준과 관찰 근거에 맞추어 서술하세요.', '확인되지 않은 지식이나 역량을 추측하여 추가하지 마세요.'],
  recommendedVerbs: ['분석함', '설명함', '적용함', '검토함', '개선함'],
  careerLens: '교과 학습과 실제 활동의 연결',
  defaultProcess: '활동의 목적과 관련 개념을 확인하고 구체적인 근거를 바탕으로 수행 과정을 정리함.',
  processCues: [],
  supportSentences: ['수행 과정과 결과를 검토하고 피드백을 반영하여 산출물을 개선함.']
};
let localCatalog = [];

function mergeLocalCatalog(incoming, current = localCatalog) {
  if (!Array.isArray(incoming)) throw new Error('invalid-catalog');
  const result = JSON.parse(JSON.stringify(current));
  for (const entry of incoming) {
    if (!entry || typeof entry.area !== 'string' || typeof entry.subject !== 'string'
      || !entry.subject.trim() || entry.subject.length > 80 || !Array.isArray(entry.standards)) throw new Error('invalid-course');
    const isBaseArea = Object.hasOwn(catalogBaseCourses, entry.area);
    if (!isBaseArea && (typeof entry.areaLabel !== 'string' || !entry.areaLabel.trim()
      || entry.areaLabel.length > 80 || localAreaKey(entry.areaLabel) !== entry.area)) throw new Error('invalid-area');
    if (!isBaseArea && Object.keys(catalogBaseCourses).some(key => SUBJECT_PROFILES[key].label === entry.areaLabel.trim())) throw new Error('duplicate-area');
    const subject = entry.subject.trim();
    const baseArea = Object.keys(catalogBaseCourses).find(area => catalogBaseCourses[area].some(course => course.value === subject));
    let target = result.find(item => item.subject === subject);
    if ((baseArea && baseArea !== entry.area) || (target && target.area !== entry.area)) throw new Error('duplicate-course');
    if (!target) { target = { area: entry.area, ...(isBaseArea ? {} : { areaLabel: entry.areaLabel.trim() }), subject, standards: [] }; result.push(target); }
    for (const standard of entry.standards) {
      if (!standard || typeof standard.code !== 'string' || !standard.code.trim() || /[\[\]\r\n]/u.test(standard.code)
        || typeof standard.text !== 'string' || !standard.text.trim() || standard.text.length > 5000) throw new Error('invalid-standard');
      const normalized = { code: standard.code.trim(), text: standard.text.trim() };
      const previous = [...(catalogBaseStandards[subject] || []), ...target.standards].find(item => item.code === normalized.code);
      if (previous && previous.text !== normalized.text) throw new Error('duplicate-code');
      if (!previous) target.standards.push(normalized);
    }
    if (!target.standards.length && !baseArea) throw new Error('empty-course');
  }
  return result;
}

function applyLocalCatalog(catalog) {
  for (const area of Object.keys(SUBJECT_PROFILES)) {
    if (!Object.hasOwn(catalogBaseCourses, area)) delete SUBJECT_PROFILES[area];
  }
  for (const key of Object.keys(ACHIEVEMENT_STANDARDS)) delete ACHIEVEMENT_STANDARDS[key];
  for (const [subject, standards] of Object.entries(catalogBaseStandards)) ACHIEVEMENT_STANDARDS[subject] = [...standards];
  for (const [area, courses] of Object.entries(catalogBaseCourses)) SUBJECT_PROFILES[area].courses = [...courses];
  for (const entry of catalog) {
    if (!Object.hasOwn(SUBJECT_PROFILES, entry.area)) {
      SUBJECT_PROFILES[entry.area] = { label: entry.areaLabel, courses: [], competencies: [], writingProfile: LOCAL_GENERIC_WRITING_PROFILE };
    }
    if (!SUBJECT_PROFILES[entry.area].courses.some(course => course.value === entry.subject)) {
      SUBJECT_PROFILES[entry.area].courses.push({ value: entry.subject, label: entry.subject });
    }
    ACHIEVEMENT_STANDARDS[entry.subject] = [...(ACHIEVEMENT_STANDARDS[entry.subject] || []), ...entry.standards];
  }
}

function persistLocalCatalog(catalog) {
  localStorage.setItem(LOCAL_CATALOG_KEY, JSON.stringify(catalog));
  localCatalog = catalog;
  applyLocalCatalog(localCatalog);
}

try {
  localCatalog = mergeLocalCatalog(JSON.parse(localStorage.getItem(LOCAL_CATALOG_KEY) || '[]'), []);
  applyLocalCatalog(localCatalog);
} catch (error) {
  console.warn('내 과목 자료를 읽지 못했습니다. 기존 저장 자료는 보존됩니다.', error);
}

// 사용 중인 자료의 연결을 끊는 변경은 저장 전에 차단한다.
function prepareLocalCatalogChange(originalSubject, replacement, references) {
  const original = localCatalog.find(entry => entry.subject === originalSubject);
  if (originalSubject && !original) throw new Error('수정할 자료를 다시 선택해 주세요.');
  if (original) {
    const used = references.filter(item => item.subject === originalSubject);
    if (used.length && replacement && replacement.area !== original.area) throw new Error('사용 중인 과목의 교과군은 변경할 수 없습니다.');
    const remaining = new Set([...(catalogBaseStandards[originalSubject] || []), ...(replacement?.standards || [])].map(item => item.code));
    if (used.some(item => item.standards.some(code => !remaining.has(code)))
      || (used.length && replacement?.subject !== originalSubject && !catalogBaseStandards[originalSubject])) {
      throw new Error('수행평가에서 사용 중입니다. 해당 수행평가의 과목·성취기준을 먼저 변경한 뒤 삭제하거나 이름·코드를 바꿔 주세요.');
    }
  }
  const rest = localCatalog.filter(entry => entry.subject !== originalSubject);
  if (replacement && originalSubject && replacement.subject !== originalSubject
    && (Object.hasOwn(catalogBaseStandards, replacement.subject) || rest.some(entry => entry.subject === replacement.subject))) {
    throw new Error('이미 있는 과목명입니다. 다른 이름을 입력해 주세요.');
  }
  return mergeLocalCatalog(replacement ? [replacement] : [], originalSubject ? rest : localCatalog);
}


function localStandardDisplayCode(subject, code) {
  if (!/^직접-[0-9a-f]{8}-[0-9a-f-]{27}$/iu.test(code) && !/^직접-\d{13}-[0-9a-f]+$/iu.test(code)) return code;
  const standards = ACHIEVEMENT_STANDARDS[subject] || [];
  const used = new Set(standards.map(item => item.code));
  let number = 1;
  for (const item of standards) {
    if (!/^직접-[0-9a-f]{8}-[0-9a-f-]{27}$/iu.test(item.code) && !/^직접-\d{13}-[0-9a-f]+$/iu.test(item.code)) continue;
    while (used.has(`직접-${number}`)) number++;
    if (item.code === code) return `직접-${number}`;
    number++;
  }
  return code;
}
