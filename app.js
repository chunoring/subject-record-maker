const STORAGE_KEY = 'subject-record-maker-assessments-v1';
const BATCH_STORAGE_KEY = 'subject-record-maker-batch-drafts-v1';
const RECOVERY_STORAGE_KEY = 'subject-record-maker-recovery-v1';
const BATCH_TIP_STORAGE_KEY = 'subject-record-maker-batch-tip-dismissed-v1';
const DEFAULT_BATCH_ROW_COUNT = 10;
const DEFAULT_SUBJECT_AREA = Object.keys(SUBJECT_PROFILES)[0] || '';

function findSubjectArea(subject) {
  return Object.keys(SUBJECT_PROFILES).find(area => SUBJECT_PROFILES[area].courses.some(course => course.value === subject)) || DEFAULT_SUBJECT_AREA;
}

function getCourseLabel(subject) {
  for (const profile of Object.values(SUBJECT_PROFILES)) {
    const course = profile.courses.find(item => item.value === subject);
    if (course) return course.label;
  }
  return subject;
}

function getSubjectPath(item) {
  const area = item.subjectArea || findSubjectArea(item.subject);
  const areaLabel = SUBJECT_PROFILES[area]?.label || area;
  return `${areaLabel} / ${getCourseLabel(item.subject)}`;
}

function getSubjectArea(itemOrArea) {
  if (!itemOrArea) return '';
  if (typeof itemOrArea === 'string') return itemOrArea;
  return itemOrArea?.subjectArea || findSubjectArea(itemOrArea?.subject || '');
}

function getSubjectCourseProfile(itemOrArea) {
  if (!itemOrArea || typeof itemOrArea !== 'object') return null;
  return SUBJECT_PROFILES[getSubjectArea(itemOrArea)]?.courses
    ?.find(course => course.value === itemOrArea.subject) || null;
}

function getSubjectCompetencies(itemOrArea) {
  const course = getSubjectCourseProfile(itemOrArea);
  if (course && Array.isArray(course.competencies)) return course.competencies;
  return SUBJECT_PROFILES[getSubjectArea(itemOrArea)]?.competencies || [];
}

function getSubjectWritingProfile(itemOrArea) {
  const course = getSubjectCourseProfile(itemOrArea);
  if (course?.writingProfile && SUBJECT_WRITING_PROFILES[course.writingProfile]) {
    return SUBJECT_WRITING_PROFILES[course.writingProfile];
  }
  return SUBJECT_PROFILES[getSubjectArea(itemOrArea)]?.writingProfile
    || SUBJECT_WRITING_PROFILES.math;
}

function shortCompetencyLabel(label) {
  return label.replace(/\s*역량$/u, '').replace(/\s*능력$/u, '');
}

function appendCompetencyChoice(container, competency, value = competency.key) {
  const label = document.createElement('label');
  const input = document.createElement('input');
  const text = document.createElement('span');
  input.type = 'checkbox';
  input.value = value;
  text.textContent = competency.label;
  input.title = `${competency.description} / 평가요소: ${competency.evaluationElements.join(', ')}`;
  label.append(input, text);
  container.append(label);
}

function renderIndividualCompetencies(item) {
  const field = $('#competencyField');
  const container = $('#competencyChoices');
  const competencies = item ? getSubjectCompetencies(item) : [];
  container.replaceChildren();
  field.classList.toggle('hidden', competencies.length === 0);
  if (!competencies.length) return;
  $('#competencyLegend').textContent = `강조할 ${SUBJECT_PROFILES[getSubjectArea(item)].label} 핵심역량`;
  competencies.forEach(competency => appendCompetencyChoice(container, competency));
}

function renderBatchCompetencyControls(item) {
  const section = $('#batchBulkCompetencySection');
  const container = $('#batchBulkCompetencies');
  const competencies = item ? getSubjectCompetencies(item) : [];
  container.replaceChildren();
  section.classList.toggle('hidden', competencies.length === 0);
  competencies.forEach(competency => appendCompetencyChoice(container, competency, competency.label));
}
function renderSubjectAreas(selectedArea = DEFAULT_SUBJECT_AREA) {
  const select = $('#assessmentSubjectArea');
  select.replaceChildren(new Option('교과군을 선택하세요', ''));
  Object.entries(SUBJECT_PROFILES)
    .sort(([, first], [, second]) => first.label.localeCompare(second.label, 'ko'))
    .forEach(([value, profile]) => select.add(new Option(profile.label, value)));
  select.value = SUBJECT_PROFILES[selectedArea] ? selectedArea : '';
}

function renderSubjectCourses(area, selectedSubject = '') {
  const select = $('#assessmentSubject');
  select.replaceChildren(new Option(area ? '과목명을 선택하세요' : '교과군을 먼저 선택하세요', ''));
  (SUBJECT_PROFILES[area]?.courses || []).forEach(course => select.add(new Option(course.label, course.value)));
  if ([...select.options].some(option => option.value === selectedSubject)) select.value = selectedSubject;
  select.disabled = !area;
}
const MAX_RECOVERY_SNAPSHOTS = 3;
const DEFAULT_EVIDENCE_LABEL = '학생 관찰 근거(학생 활동 내용)';
const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const DEFAULT_OPTIONAL_FIELDS = [
  { id: 'career', type: 'career', label: '학생의 진로' },
  { id: 'teacher', type: 'teacher', label: '교사의 평가' }
];
const OPTIONAL_FIELD_EXAMPLES = ['탐구 주제', '선택 동기', '맡은 역할', '문제 해결 과정', '활용한 교과 개념', '자료 분석 방법', '발표·산출물 특징', '피드백 반영 내용'];
const competencyText = {
  problem: [
    '주어진 조건과 정보를 분석하여 적절한 해결 전략을 탐색하고, 풀이 과정을 점검하며 타당한 결과를 도출하는 문제해결 역량이 돋보임',
    '수학의 개념과 원리를 문제 상황에 적절히 활용하고, 해결 방법을 끈기 있게 탐색하는 문제해결 역량을 보임'
  ],
  reasoning: [
    '관찰한 사실을 바탕으로 수학적 관계를 추측하고 논리적 근거를 들어 정당화하는 추론 역량이 돋보임',
    '개념과 원리를 체계적으로 연결하여 절차를 수행하고, 수학적 증거를 바탕으로 결론의 타당성을 판단함'
  ],
  communication: [
    '수학 용어와 기호, 식, 표, 그래프를 정확히 사용하여 자신의 아이디어와 해결 과정을 명료하게 설명함',
    '상황에 적절한 수학적 표현을 선택하고 표현 간 변환을 활용하여 풀이 과정과 결과를 효과적으로 전달함'
  ],
  connection: [
    '수학 개념 사이의 관련성을 파악하고 이를 실생활 및 다른 영역의 경험과 연결하여 해석하는 역량이 돋보임',
    '여러 수학적 개념과 원리를 연계해 새로운 관점으로 문제를 바라보고 수학의 유용성을 인식함'
  ],
  information: [
    '자료와 정보를 목적에 맞게 수집·변환·정리하고, 수학적 근거를 바탕으로 합리적인 결론을 도출함',
    '공학 도구를 적절히 활용하여 자료를 분석하고 결과의 의미를 정확하게 해석하는 정보처리 역량을 보임'
  ]
};

const levelText = {
  excellent: [
    '핵심 개념을 깊이 이해하고 새로운 상황에 확장하여 적용하는 탁월한 성취를 보임',
    '개념적 이해와 수행의 완성도가 매우 높으며 스스로 탐구를 확장하는 태도가 인상적임'
  ],
  good: [
    '핵심 개념을 정확히 이해하고 과제에 안정적으로 적용하여 우수한 성취를 보임',
    '학습한 원리를 충실히 활용하고 논리적인 과정을 통해 완성도 높은 결과를 도출함'
  ],
  steady: [
    '기본 개념을 바탕으로 주어진 과제를 성실히 수행하고 자신의 해결 과정을 표현함',
    '학습한 내용을 과제에 적절히 적용하며 안정적인 수행 능력을 보임'
  ],
  growth: [
    '피드백을 적극적으로 반영해 오류를 수정하고 수행의 완성도를 높이는 성장 과정을 보임',
    '어려운 부분을 꾸준히 보완하며 수학적 이해와 문제 해결 능력을 발전시킴'
  ]
};

const veteranCompetencyText = {
  problem: [
    '주어진 조건에서 핵심 정보를 가려내고 여러 해결 전략을 비교한 뒤 타당한 방법을 선택하여 결론을 도출하는 문제해결능력이 돋보임',
    '도전 과제에 끈기 있게 몰입하며 풀이 절차를 점검하고 오류를 수정하여 합리적인 해결 방안을 구체화함'
  ],
  reasoning: [
    '관찰한 규칙을 수학적으로 추론하고 추측의 근거를 논리적으로 입증하는 과정에서 사고의 깊이가 뚜렷하게 드러남',
    '개념과 원리의 관계를 체계적으로 조직하고 수학적 증거를 바탕으로 결론을 타당화하는 추론 역량이 우수함'
  ],
  communication: [
    '수학 용어와 기호, 식, 표, 그래프를 정확하게 사용하여 해결 과정과 결과를 구체적으로 설명하는 의사소통능력이 돋보임',
    '복잡한 수학적 아이디어를 이해하기 쉬운 표현으로 재구성하고 질문에 논리적으로 답하여 타인과의 소통을 이끌어냄'
  ],
  connection: [
    '서로 다른 수학 개념을 관계 짓고 수행 주제를 실생활 및 진로 맥락과 연결하여 해석하는 융합적 사고가 두드러짐',
    '교과에서 학습한 원리를 새로운 상황에 응용하여 수학의 활용 가능성을 구체적으로 보여주는 연결 역량이 돋보임'
  ],
  information: [
    '자료에서 중요 정보를 추출하고 목적에 맞게 분류·변환·도식화하여 타당한 결론을 도출하는 정보처리 역량이 우수함',
    '공학 도구를 적절히 활용해 자료를 분석하고 결과의 의미와 한계를 수학적 근거에 따라 해석함'
  ]
};

const veteranLevelText = {
  excellent: [
    '개념을 새로운 조건에 정확하게 응용하고 대안을 제시하는 모습에서 탁월한 수학적 통찰력과 성장잠재력이 드러남',
    '과제 수행 전반에서 논리적 사고와 자기주도성이 매우 두드러지며 결과의 완성도 또한 더할 나위 없이 우수함'
  ],
  good: [
    '핵심 개념을 정확하게 적용하고 풀이의 타당성을 점검하는 모습에서 우수한 성취 수준과 성실성이 뚜렷하게 드러남',
    '주어진 과제를 책임감 있게 수행하며 수학적 근거를 바탕으로 완성도 높은 결과를 도출함'
  ],
  steady: [
    '기본 개념을 과제에 적절히 적용하고 해결 과정을 단계적으로 작성하는 등 안정적인 성취 수준을 보임',
    '수업에서 다룬 원리와 절차를 충실히 활용하여 맡은 과제를 성실하게 수행함'
  ],
  growth: [
    '피드백을 수용하여 오류를 수정하고 해결 과정을 재정리하는 모습에서 뚜렷한 발전가능성과 끈기가 드러남',
    '어려운 부분을 질문과 재시도를 통해 보완하며 과제 수행의 정확성과 완성도를 꾸준히 높여가는 모습을 보임'
  ]
};

let assessmentLoadIssue = '';
let lastRecoverySnapshotAt = 0;
let assessments = loadAssessments();
let batchDrafts = loadBatchDrafts();
let variant = 0;

function loadAssessments() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const saved = JSON.parse(raw);
    if (!Array.isArray(saved)) throw new Error('not-array');
    const loaded = [];
    saved.forEach((item, index) => {
      try {
        if (!item || typeof item !== 'object') throw new Error('invalid-item');
        loaded.push({ ...item, subjectArea: item.subjectArea || findSubjectArea(item.subject), evidenceLabel: normalizeEvidenceLabel(item.evidenceLabel), promptFocus: normalizePromptFocus(item.promptFocus), optionalFields: normalizeOptionalFields(item) });
      } catch {
        assessmentLoadIssue = `저장된 수행평가 ${index + 1}번 항목을 읽지 못했습니다.`;
      }
    });
    if (saved.length && !loaded.length) assessmentLoadIssue = '저장된 수행평가를 읽지 못해 원본 보호 모드로 전환했습니다.';
    return loaded;
  }
  catch {
    assessmentLoadIssue = '저장 데이터를 해석하지 못해 원본 보호 모드로 전환했습니다.';
    return [];
  }
}

function storedAssessmentCount() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(saved) ? saved.length : 0;
  } catch {
    return -1;
  }
}

function saveAssessments({ force = false, allowDecrease = false } = {}) {
  const previousCount = storedAssessmentCount();
  if (!force && (assessmentLoadIssue || previousCount < 0)) {
    createRecoverySnapshot('저장 오류 감지 전 원본 보관', true);
    showToast('기존 데이터 보호를 위해 저장을 중단했습니다. 이전 데이터 복구를 이용해 주세요.');
    updateDataSafetyStatus();
    return false;
  }
  if (!force && !allowDecrease && previousCount > assessments.length) {
    createRecoverySnapshot('수행평가 수 감소 감지', true);
    showToast('수행평가 수가 갑자기 줄어 저장을 중단했습니다. 이전 데이터 복구를 확인해 주세요.');
    updateDataSafetyStatus();
    return false;
  }
  createRecoverySnapshot('수행평가 저장 전 자동 보관', true);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(assessments));
    assessmentLoadIssue = '';
    updateDataSafetyStatus();
    return true;
  } catch {
    showToast('저장 공간이 부족해 수행평가를 저장하지 못했습니다. 전체 저장하기로 백업해 주세요.');
    updateDataSafetyStatus();
    return false;
  }
}

function createFullBackup() {
  const assessmentIds = new Set(assessments.map(item => item.id));
  const relatedBatchDrafts = Object.fromEntries(Object.entries(batchDrafts)
    .filter(([assessmentId]) => assessmentIds.has(assessmentId)));
  return {
    app: '교과 수행평가 세특 메이커',
    version: 2,
    type: 'full-backup',
    exportedAt: new Date().toISOString(),
    assessments,
    batchDrafts: relatedBatchDrafts
  };
}

function downloadBackupFile(backup, label = '전체백업') {
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const date = new Date().toLocaleDateString('sv-SE');
  link.href = url;
  link.download = `세특메이커_${label}_${date}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function readRecoverySnapshots() {
  try {
    const saved = JSON.parse(localStorage.getItem(RECOVERY_STORAGE_KEY) || '[]');
    return Array.isArray(saved) ? saved.filter(snapshot => snapshot && typeof snapshot === 'object') : [];
  } catch {
    return [];
  }
}

function createRecoverySnapshot(reason, force = false) {
  const now = Date.now();
  if (!force && now - lastRecoverySnapshotAt < 60000) return false;
  const assessmentsRaw = localStorage.getItem(STORAGE_KEY);
  const batchDraftsRaw = localStorage.getItem(BATCH_STORAGE_KEY);
  if (!assessmentsRaw && !batchDraftsRaw) return false;

  const snapshots = readRecoverySnapshots();
  const latest = snapshots[0];
  if (latest?.assessmentsRaw === (assessmentsRaw || '[]') && latest?.batchDraftsRaw === (batchDraftsRaw || '{}')) {
    lastRecoverySnapshotAt = now;
    return false;
  }

  const snapshot = {
    savedAt: new Date(now).toISOString(),
    reason,
    assessmentsRaw: assessmentsRaw || '[]',
    batchDraftsRaw: batchDraftsRaw || '{}'
  };
  const next = [snapshot, ...snapshots].slice(0, MAX_RECOVERY_SNAPSHOTS);
  try {
    localStorage.setItem(RECOVERY_STORAGE_KEY, JSON.stringify(next));
    lastRecoverySnapshotAt = now;
    return true;
  } catch {
    try {
      localStorage.setItem(RECOVERY_STORAGE_KEY, JSON.stringify([{ ...snapshot, batchDraftsRaw: '{}' }]));
      lastRecoverySnapshotAt = now;
      return true;
    } catch {
      return false;
    }
  }
}

function recoverySnapshotCounts(snapshot) {
  let assessmentCount = 0;
  let classCount = 0;
  try {
    const savedAssessments = JSON.parse(snapshot.assessmentsRaw || '[]');
    assessmentCount = Array.isArray(savedAssessments) ? savedAssessments.length : 0;
  } catch { /* 원본 문자열은 복구본에 그대로 유지 */ }
  try {
    const savedDrafts = JSON.parse(snapshot.batchDraftsRaw || '{}');
    classCount = savedDrafts && typeof savedDrafts === 'object' && !Array.isArray(savedDrafts)
      ? Object.values(savedDrafts).filter(batchDraftHasContent).length
      : 0;
  } catch { /* 원본 문자열은 복구본에 그대로 유지 */ }
  return { assessmentCount, classCount };
}

function updateDataSafetyStatus() {
  const status = $('#dataSafetyStatus');
  const panel = $('.data-safety-panel');
  if (!status || !panel) return;
  panel.classList.toggle('safety-warning', Boolean(assessmentLoadIssue));
  if (assessmentLoadIssue) {
    status.textContent = `${assessmentLoadIssue} 새로 저장하지 말고 ‘이전 데이터 복구’를 눌러 주세요.`;
    return;
  }
  const latest = readRecoverySnapshots()[0];
  status.textContent = latest
    ? `자동 복구본 보관됨 · ${new Date(latest.savedAt).toLocaleString('ko-KR')}`
    : '현재 데이터를 자동 복구본으로 안전하게 보관합니다.';
}

function recoverPreviousData() {
  const currentAssessmentsRaw = localStorage.getItem(STORAGE_KEY) || '[]';
  const currentBatchRaw = localStorage.getItem(BATCH_STORAGE_KEY) || '{}';
  const candidate = readRecoverySnapshots().find(snapshot => snapshot.assessmentsRaw !== currentAssessmentsRaw
    || snapshot.batchDraftsRaw !== currentBatchRaw);
  if (!candidate) return showToast('복구할 이전 데이터가 없습니다.');

  const { assessmentCount, classCount } = recoverySnapshotCounts(candidate);
  const savedAt = new Date(candidate.savedAt).toLocaleString('ko-KR');
  if (!confirm(`${savedAt} 복구본으로 되돌릴까요?\n수행평가 ${assessmentCount}개 · 학급 자료 ${classCount}개\n현재 데이터는 먼저 긴급 백업 파일로 저장됩니다.`)) return;

  downloadBackupFile({
    ...createFullBackup(),
    type: 'pre-recovery-emergency-backup',
    rawStorage: { assessmentsRaw: currentAssessmentsRaw, batchDraftsRaw: currentBatchRaw }
  }, '복구전_긴급백업');
  try {
    localStorage.setItem(STORAGE_KEY, candidate.assessmentsRaw || '[]');
    localStorage.setItem(BATCH_STORAGE_KEY, candidate.batchDraftsRaw || '{}');
    window.location.reload();
  } catch {
    showToast('복구 데이터를 저장할 공간이 부족합니다. 내려받은 긴급 백업 파일을 보관해 주세요.');
  }
}

function exportFullBackup() {
  if (!assessments.length) return showToast('저장할 데이터가 없습니다.');
  const backup = createFullBackup();
  downloadBackupFile(backup);
  const classCount = Object.values(backup.batchDrafts).filter(batchDraftHasContent).length;
  showToast(`수행평가 ${assessments.length}개와 학급 자료 ${classCount}개를 저장했습니다.`);
}

function normalizeImportedAssessment(item) {
  if (!item || typeof item !== 'object') return null;
  const name = typeof item.name === 'string' ? clean(item.name) : '';
  const subject = typeof item.subject === 'string' ? item.subject : '';
  const activity = typeof item.activity === 'string' ? clean(item.activity) : '';
  const validCodes = new Set((ACHIEVEMENT_STANDARDS[subject] || []).map(standard => standard.code));
  const standards = Array.isArray(item.standards)
    ? [...new Set(item.standards.filter(code => typeof code === 'string' && validCodes.has(code)))]
    : [];
  if (!name || !activity || !ACHIEVEMENT_STANDARDS[subject] || !standards.length) return null;
  const subjectArea = typeof item.subjectArea === 'string' && SUBJECT_PROFILES[item.subjectArea]
    ? item.subjectArea
    : findSubjectArea(subject);
  return {
    id: typeof item.id === 'string' && item.id ? item.id : makeId(),
    name,
    subject,
    subjectArea,
    activity,
    evidenceLabel: normalizeEvidenceLabel(item.evidenceLabel),
    promptFocus: normalizePromptFocus(item.promptFocus),
    optionalFields: normalizeOptionalFields(item),
    standards,
    updatedAt: typeof item.updatedAt === 'string' ? item.updatedAt : new Date().toISOString()
  };
}

function normalizeEvidenceLabel(value) {
  const label = typeof value === 'string' ? clean(value).slice(0, 40) : '';
  return label || DEFAULT_EVIDENCE_LABEL;
}

function defaultOptionalFields() {
  return DEFAULT_OPTIONAL_FIELDS.map(field => ({ ...field }));
}

function normalizeOptionalFields(item) {
  if (!Array.isArray(item?.optionalFields)) {
    const fields = defaultOptionalFields();
    const legacyLabel = typeof item?.customFieldLabel === 'string' ? clean(item.customFieldLabel).slice(0, 40) : '';
    if (legacyLabel) fields.push({ id: makeId(), type: 'custom', label: legacyLabel });
    return fields;
  }

  const usedIds = new Set();
  return item.optionalFields.slice(0, 10).map(field => {
    if (!field || typeof field !== 'object') return null;
    const label = typeof field.label === 'string' ? clean(field.label).slice(0, 40) : '';
    if (!label) return null;
    const type = ['career', 'teacher', 'custom'].includes(field.type) ? field.type : 'custom';
    let id = typeof field.id === 'string' && field.id ? field.id : makeId();
    if (usedIds.has(id)) id = makeId();
    usedIds.add(id);
    return { id, type, label };
  }).filter(Boolean);
}

function normalizeImportedBatchDraft(draft, item) {
  if (!draft || typeof draft !== 'object' || Array.isArray(draft)) return null;
  const allowedFields = new Set(item.optionalFields.map(field => field.id));
  const sourceRows = Array.isArray(draft.rows) ? draft.rows.slice(0, 40) : [];
  const rows = sourceRows.map((row, index) => {
    const normalized = normalizeBatchRow(row, index, item);
    normalized.localLabel = normalized.localLabel.slice(0, 60);
    normalized.evidence = normalized.evidence.slice(0, 5000);
    normalized.optional = Object.fromEntries(Object.entries(normalized.optional)
      .filter(([key, value]) => allowedFields.has(key) && typeof value === 'string')
      .map(([key, value]) => [key, value.slice(0, 5000)]));
    return normalized;
  });
  return {
    length: ['short', 'medium', 'long'].includes(draft.length) ? draft.length : 'medium',
    styleReference: typeof draft.styleReference === 'string' ? draft.styleReference.slice(0, 2000) : '',
    rows: rows.length ? rows : createDefaultBatchRows()
  };
}

function batchDraftHasContent(draft) {
  if (!draft || typeof draft !== 'object') return false;
  if (typeof draft.styleReference === 'string' && draft.styleReference.trim()) return true;
  return Array.isArray(draft.rows) && draft.rows.some((row, index) => {
    const label = typeof row?.localLabel === 'string' ? row.localLabel.trim() : '';
    const hasOptional = row?.optional && typeof row.optional === 'object'
      && Object.values(row.optional).some(value => typeof value === 'string' && value.trim());
    return (label && label !== String(index + 1))
      || (typeof row?.evidence === 'string' && row.evidence.trim())
      || hasOptional
      || Boolean(row?.achievement)
      || Boolean(String(row?.competencies || '').trim());
  });
}

async function importFullBackup(file) {
  if (!file) return;
  if (file.size > 10 * 1024 * 1024) return showToast('백업 파일은 10MB 이하만 불러올 수 있습니다.');
  try {
    const parsed = JSON.parse(await file.text());
    const source = Array.isArray(parsed) ? parsed : parsed?.assessments;
    if (!Array.isArray(source)) throw new Error('invalid-format');
    const isMathMakerBackup = parsed?.app === '수학 수행평가 세특 메이커';
    const imported = source.map(normalizeImportedAssessment).filter(Boolean);
    if (!imported.length) throw new Error('empty-backup');

    if (assessments.length || Object.values(batchDrafts).some(batchDraftHasContent)) {
      downloadBackupFile(createFullBackup(), '불러오기전_안전백업');
    }
    const merged = new Map(assessments.map(item => [item.id, item]));
    imported.forEach(item => merged.set(item.id, item));
    assessments = [...merged.values()].sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));

    const importedDraftSource = parsed?.batchDrafts && typeof parsed.batchDrafts === 'object' && !Array.isArray(parsed.batchDrafts)
      ? parsed.batchDrafts
      : {};
    let importedClassCount = 0;
    imported.forEach(item => {
      const normalizedDraft = normalizeImportedBatchDraft(importedDraftSource[item.id], item);
      if (!normalizedDraft) return;
      batchDrafts[item.id] = normalizedDraft;
      if (batchDraftHasContent(normalizedDraft)) importedClassCount += 1;
    });
    saveAssessments({ force: true });
    saveBatchDrafts({ skipSnapshot: true });
    resetAssessmentForm();
    renderAssessmentList();
    renderAssessmentSelect(imported[0].id);
    renderBatchAssessmentSelect();
    const sourceLabel = isMathMakerBackup ? '수학 세특 메이커에서 ' : '';
    showToast(`${sourceLabel}수행평가 ${imported.length}개와 학급 자료 ${importedClassCount}개를 불러왔습니다.`);
  } catch {
    showToast('올바른 전체 백업 파일이 아닙니다.');
  } finally {
    $('#fullBackupFileInput').value = '';
  }
}

function makeId() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function clean(text) {
  return text.trim().replace(/\s+/g, ' ').replace(/[.!?。]+$/, '');
}

function normalizePromptFocus(value) {
  return typeof value === 'string'
    ? value.trim().replace(/\r\n?/g, '\n').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').slice(0, 600)
    : '';
}

function pick(list, offset = 0) {
  return list[(variant + offset) % list.length];
}

function showToast(message) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.classList.add('show');
  window.setTimeout(() => toast.classList.remove('show'), 1800);
}

function switchView(name) {
  $$('.view').forEach(view => view.classList.toggle('active', view.id === `${name}View`));
  $$('.flow-nav .flow-step').forEach(step => step.classList.toggle('active', step.dataset.view === name));
  if (name === 'generate') renderAssessmentSelect();
  if (name === 'batch') {
    renderBatchAssessmentSelect();
    maybeOpenBatchTip();
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

$$('.flow-nav .flow-step').forEach(button => button.addEventListener('click', () => switchView(button.dataset.view)));
$('#backToRegister').addEventListener('click', () => switchView('register'));
$('#backToIndividual').addEventListener('click', () => switchView('generate'));

function renderStandards(subject, selectedCodes = []) {
  const list = $('#standardsList');
  list.replaceChildren();
  const standards = ACHIEVEMENT_STANDARDS[subject] || [];
  $('#standardsGuide').classList.toggle('hidden', standards.length > 0);
  $('#standardToolbar').classList.toggle('hidden', standards.length === 0);

  standards.forEach(standard => {
    const label = document.createElement('label');
    label.className = 'standard-item';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.value = standard.code;
    input.checked = selectedCodes.includes(standard.code);
    input.addEventListener('change', updateSelectedStandardCount);
    const text = document.createElement('span');
    const code = document.createElement('strong');
    code.textContent = `[${standard.code}] `;
    text.append(code, document.createTextNode(standard.text));
    label.append(input, text);
    list.append(label);
  });
  updateSelectedStandardCount();
}

function updateSelectedStandardCount() {
  const count = $$('#standardsList input:checked').length;
  $('#selectedStandardCount').textContent = `${count}개 선택`;
}

$('#assessmentSubjectArea').addEventListener('change', event => {
  renderSubjectCourses(event.target.value);
  renderStandards('');
});
$('#assessmentSubject').addEventListener('change', event => renderStandards(event.target.value));
$('#selectAllStandards').addEventListener('click', () => {
  $$('#standardsList input').forEach(input => { input.checked = true; });
  updateSelectedStandardCount();
});
$('#clearStandards').addEventListener('click', () => {
  $$('#standardsList input').forEach(input => { input.checked = false; });
  updateSelectedStandardCount();
});

function appendOptionalFieldRow(field = { id: makeId(), type: 'custom', label: '' }) {
  const container = $('#optionalFieldConfig');
  if (container.children.length >= 10) return showToast('선택 작성 항목은 최대 10개까지 추가할 수 있습니다.');

  const row = document.createElement('div');
  row.className = 'content-field-row';
  row.dataset.fieldId = field.id;
  row.dataset.fieldType = field.type;

  const content = document.createElement('div');
  const status = document.createElement('span');
  status.className = 'field-status optional';
  status.textContent = '선택';
  const input = document.createElement('input');
  input.type = 'text';
  input.maxLength = 40;
  input.required = true;
  input.value = field.label;
  const customFieldCount = [...container.children].filter(child => child.dataset.fieldType === 'custom').length;
  input.placeholder = field.type === 'custom'
    ? `예: ${OPTIONAL_FIELD_EXAMPLES[customFieldCount % OPTIONAL_FIELD_EXAMPLES.length]}`
    : '작성 항목 이름 입력';
  input.setAttribute('aria-label', '선택 작성 항목 이름');
  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'remove-field-button';
  remove.title = '이 작성 항목 삭제';
  remove.setAttribute('aria-label', `${field.label || '새 작성 항목'} 삭제`);
  remove.textContent = '×';
  remove.addEventListener('click', () => row.remove());
  content.append(status, input);
  row.append(content, remove);
  container.append(row);
  if (!field.label) input.focus();
}

function renderOptionalFieldConfig(fields = defaultOptionalFields()) {
  $('#optionalFieldConfig').replaceChildren();
  fields.forEach(field => appendOptionalFieldRow(field));
}

function collectOptionalFields() {
  const fields = $$('#optionalFieldConfig .content-field-row').map(row => ({
    id: row.dataset.fieldId || makeId(),
    type: row.dataset.fieldType || 'custom',
    label: clean(row.querySelector('input').value).slice(0, 40)
  }));
  const labels = fields.map(field => field.label);
  if (labels.some(label => !label)) return null;
  if (new Set(labels).size !== labels.length) {
    showToast('작성 항목 이름은 서로 다르게 입력해 주세요.');
    return null;
  }
  return fields;
}

$('#addOptionalField').addEventListener('click', () => appendOptionalFieldRow());

$('#editEvidenceLabel').addEventListener('click', () => {
  const input = $('#assessmentEvidenceLabel');
  input.focus();
  input.select();
  input.closest('.required-field-row').classList.add('is-editing');
});
$('#assessmentEvidenceLabel').addEventListener('blur', event => {
  event.target.closest('.required-field-row').classList.remove('is-editing');
});


$('#assessmentForm').addEventListener('submit', event => {
  event.preventDefault();
  const standards = $$('#standardsList input:checked').map(input => input.value);
  if (!standards.length) return showToast('관련 성취기준을 하나 이상 선택해 주세요.');
  const optionalFields = collectOptionalFields();
  if (!optionalFields) return;
  const evidenceLabel = normalizeEvidenceLabel($('#assessmentEvidenceLabel').value);
  if (optionalFields.some(field => field.label === evidenceLabel)) return showToast('필수 항목과 선택 항목의 이름은 서로 다르게 입력해 주세요.');

  const data = {
    id: $('#editingId').value || makeId(),
    name: clean($('#assessmentName').value),
    subjectArea: $('#assessmentSubjectArea').value,
    subject: $('#assessmentSubject').value,
    activity: clean($('#assessmentActivity').value),
    evidenceLabel,
    promptFocus: normalizePromptFocus($('#assessmentPromptFocus').value),
    optionalFields,
    standards,
    updatedAt: new Date().toISOString()
  };

  const previousAssessments = assessments;
  const index = assessments.findIndex(item => item.id === data.id);
  assessments = index >= 0
    ? assessments.map(item => item.id === data.id ? data : item)
    : [data, ...assessments];
  if (!saveAssessments()) {
    assessments = previousAssessments;
    return;
  }
  resetAssessmentForm();
  renderAssessmentList();
  renderAssessmentSelect(data.id);
  showToast(index >= 0 ? '수행평가를 수정했습니다.' : '수행평가를 등록했습니다.');
});

function resetAssessmentForm() {
  $('#assessmentForm').reset();
  $('#editingId').value = '';
  $('#formTitle').textContent = '새 수행평가';
  $('#saveButtonText').textContent = '수행평가 등록하기';
  $('#cancelEdit').classList.add('hidden');
  $('#assessmentEvidenceLabel').value = DEFAULT_EVIDENCE_LABEL;
  renderSubjectAreas();
  renderSubjectCourses(DEFAULT_SUBJECT_AREA);
  renderOptionalFieldConfig();
  renderStandards('');
}

$('#cancelEdit').addEventListener('click', resetAssessmentForm);
$('#exportAllData')?.addEventListener('click', exportFullBackup);
$('#importAllData')?.addEventListener('click', () => $('#fullBackupFileInput')?.click());
$('#fullBackupFileInput')?.addEventListener('change', event => importFullBackup(event.target.files[0]));
$('#recoverPreviousData')?.addEventListener('click', recoverPreviousData);

function editAssessment(id) {
  const item = assessments.find(assessment => assessment.id === id);
  if (!item) return;
  $('#editingId').value = item.id;
  $('#assessmentName').value = item.name;
  const subjectArea = item.subjectArea || findSubjectArea(item.subject);
  renderSubjectAreas(subjectArea);
  renderSubjectCourses(subjectArea, item.subject);
  $('#assessmentSubject').value = item.subject;
  $('#assessmentActivity').value = item.activity;
  $('#assessmentEvidenceLabel').value = item.evidenceLabel;
  $('#assessmentPromptFocus').value = item.promptFocus || '';
  renderOptionalFieldConfig(item.optionalFields);
  $('#formTitle').textContent = '수행평가 수정';
  $('#saveButtonText').textContent = '수정 내용 저장하기';
  $('#cancelEdit').classList.remove('hidden');
  renderStandards(item.subject, item.standards);
  window.scrollTo({ top: $('#assessmentForm').offsetTop - 20, behavior: 'smooth' });
}

function deleteAssessment(id) {
  const item = assessments.find(assessment => assessment.id === id);
  if (!item || !confirm(`‘${item.name}’ 수행평가를 삭제할까요?`)) return;
  const previousAssessments = assessments;
  assessments = assessments.filter(assessment => assessment.id !== id);
  if (!saveAssessments({ allowDecrease: true })) {
    assessments = previousAssessments;
    return;
  }
  renderAssessmentList();
  renderAssessmentSelect();
  showToast('수행평가를 삭제했습니다.');
}

function renderAssessmentList() {
  const container = $('#assessmentList');
  container.replaceChildren();
  $('#assessmentCount').textContent = `등록 ${assessments.length}개`;
  if (!assessments.length) {
    const empty = document.createElement('div');
    empty.className = 'list-empty';
    empty.innerHTML = '<div>∅</div><p>아직 등록된 수행평가가 없습니다.<br>왼쪽 양식을 작성해 첫 평가를 등록해 보세요.</p>';
    container.append(empty);
    return;
  }

  assessments.forEach(item => {
    const card = document.createElement('article');
    card.className = 'assessment-card';
    const top = document.createElement('div');
    top.className = 'assessment-top';
    const info = document.createElement('div');
    const tag = document.createElement('span'); tag.className = 'subject-tag'; tag.textContent = getSubjectPath(item);
    const title = document.createElement('h4'); title.textContent = item.name;
    info.append(tag, title);
    const menu = document.createElement('div'); menu.className = 'card-menu';
    const edit = document.createElement('button'); edit.type = 'button'; edit.title = '수정'; edit.textContent = '✎'; edit.addEventListener('click', () => editAssessment(item.id));
    const remove = document.createElement('button'); remove.type = 'button'; remove.title = '삭제'; remove.className = 'delete'; remove.textContent = '×'; remove.addEventListener('click', () => deleteAssessment(item.id));
    menu.append(edit, remove); top.append(info, menu);
    const activity = document.createElement('p'); activity.textContent = item.activity;
    const meta = document.createElement('span'); meta.className = 'assessment-meta'; meta.textContent = `성취기준 ${item.standards.length}개 · 작성 항목 ${1 + item.optionalFields.length}개`;
    const actions = document.createElement('div'); actions.className = 'assessment-actions';
    const useIndividual = document.createElement('button'); useIndividual.type = 'button'; useIndividual.className = 'use-button individual'; useIndividual.textContent = '이 평가로 개별 세특 만들기 →';
    useIndividual.addEventListener('click', () => { switchView('generate'); renderAssessmentSelect(item.id); });
    const useBatch = document.createElement('button'); useBatch.type = 'button'; useBatch.className = 'use-button batch'; useBatch.textContent = '이 평가로 학급 세특 만들기 →';
    useBatch.addEventListener('click', () => { switchView('batch'); renderBatchAssessmentSelect(item.id); });
    actions.append(useIndividual, useBatch);
    card.append(top, activity, meta, actions);
    container.append(card);
  });
}

function renderAssessmentSelect(selectedId = '') {
  const select = $('#assessmentSelect');
  const previous = selectedId || select.value;
  select.replaceChildren(new Option('등록한 수행평가를 선택하세요', ''));
  assessments.forEach(item => select.add(new Option(`[${getSubjectPath(item)}] ${item.name}`, item.id)));
  if (assessments.some(item => item.id === previous)) select.value = previous;
  renderSelectedAssessment();
}

function renderSelectedAssessment() {
  const item = assessments.find(assessment => assessment.id === $('#assessmentSelect').value);
  const box = $('#selectedAssessment');
  const promptButton = $('#copyAssessmentPrompt');
  const studentDataButton = $('#copyStudentData');
  box.replaceChildren();
  box.classList.toggle('hidden', !item);
  promptButton.disabled = !item;
  studentDataButton.disabled = !item;
  if (!item) {
    $('#studentEvidenceLabel').textContent = DEFAULT_EVIDENCE_LABEL;
    renderStudentOptionalFields();
    renderIndividualCompetencies();
    return;
  }
  const title = document.createElement('strong'); title.textContent = `${getSubjectPath(item)} · ${item.name}`;
  const desc = document.createElement('p'); desc.textContent = `${item.activity}  |  성취기준 ${item.standards.length}개  |  작성 항목 ${1 + item.optionalFields.length}개`;
  box.append(title, desc);
  $('#studentEvidenceLabel').textContent = item.evidenceLabel;
  renderStudentOptionalFields(item);
  renderIndividualCompetencies(item);
}

function renderStudentOptionalFields(item) {
  const container = $('#optionalStudentFields');
  container.replaceChildren();
  if (!item) return;

  item.optionalFields.forEach(field => {
    const label = document.createElement('label');
    label.className = 'field';
    const heading = document.createElement('span');
    heading.append(document.createTextNode(`${field.label} `));
    const optional = document.createElement('i');
    optional.className = 'optional';
    optional.textContent = '선택';
    heading.append(optional);

    const control = field.type === 'career' ? document.createElement('input') : document.createElement('textarea');
    control.dataset.studentFieldId = field.id;
    if (field.type === 'career') {
      control.setAttribute('list', 'careerTrackOptions');
      control.placeholder = '예: 공학, 자연과학, 의약학';
    } else {
      control.rows = field.type === 'teacher' ? 4 : 3;
      control.placeholder = field.type === 'teacher'
        ? '예: 복잡한 풀이도 끝까지 검토하며 오류를 스스로 수정하는 태도가 인상적임'
        : `${field.label}에 해당하는 내용을 입력하세요.`;
    }

    const guide = document.createElement('small');
    guide.textContent = field.type === 'career'
      ? '목록에서 고르거나 학생의 진로를 직접 입력할 수 있습니다.'
      : field.type === 'teacher'
        ? '학생의 성취, 태도, 성장 과정에 관한 교사의 종합 평가를 입력하세요.'
        : '이 학생에게 해당하는 내용을 입력하세요. 비워 두어도 초안을 만들 수 있습니다.';
    label.append(heading, control, guide);
    container.append(label);
  });
}

function getStudentFieldEntries(item) {
  const controls = $$('#optionalStudentFields [data-student-field-id]');
  return item.optionalFields.map(field => ({
    ...field,
    value: controls.find(control => control.dataset.studentFieldId === field.id)?.value.trim() || ''
  }));
}

$('#assessmentSelect').addEventListener('change', renderSelectedAssessment);

function removeSubjectWords(text) {
  return text
    .replace(/성실한 학생임/g, '성실성이 돋보임')
    .replace(/학생임/g, '태도가 돋보임')
    .replace(/학생(?:은|는|이|가|의|을|를|에게)\s*/g, '')
    .replace(/학생\s+/g, '')
    .replace(/(?:그는|그가|그의)\s*/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function replaceInnerLanguage(text) {
  return text
    .replace(/([^.!?]+?[을를])\s*(?:깨닫게\s*됨|깨달았음|깨달음)/g, '$1 자신의 언어로 구체적으로 설명함')
    .replace(/([^.!?]+?[을를])\s*(?:알게\s*됨|알았음)/g, '$1 구체적으로 확인하여 기록함')
    .replace(/([^.!?]+?)에\s*관심을\s*갖게\s*됨/g, '$1에 관한 자료를 자발적으로 탐색함')
    .replace(/([^.!?]+?)(?:라고|다고)\s*(?:생각함|생각했음)/g, '$1라는 견해를 구체적인 근거와 함께 표현함')
    .replace(/(?:깨닫게\s*됨|깨달았음|깨달음)/g, '관련 내용을 자신의 언어로 설명함')
    .replace(/(?:알게\s*됨|알았음)/g, '관련 내용을 구체적으로 확인하여 기록함')
    .replace(/(?:관심을\s*갖게\s*됨)/g, '관련 자료를 자발적으로 탐색하는 태도를 보임')
    .replace(/(?:느낀\s*점|느낌)/g, '관찰한 내용에 대한 견해')
    .replace(/(?:다짐함|다짐했음)/g, '실천 의지를 구체적으로 표현함')
    .replace(/(?:생각함|생각했음)/g, '자신의 견해를 구체적인 근거와 함께 표현함')
    .replace(/이해함함/g, '이해력을 보임')
    .replace(/이해하게\s*됨/g, '관련 개념을 적용하는 모습을 보임')
    .replace(/이해함/g, '이해력을 보임');
}

function observableEnding(text) {
  let sentence = clean(replaceInnerLanguage(removeSubjectWords(text)));
  if (!sentence) return '';
  sentence = sentence
    .replace(/\b(?:그리고|또한)\s+(?=(?:그리고|또한)\s+)/g, '')
    .replace(/하였으며/g, '하며').replace(/했으며/g, '하며').replace(/하였고/g, '하고').replace(/했고/g, '하고')
    .replace(/할\s*수\s*있었음$/g, '하는 능력을 보임').replace(/하는\s*것을\s*볼\s*수\s*있었음$/g, '하는 모습을 보임')
    .replace(/하였음$/g, '함').replace(/했음$/g, '함').replace(/하였음$/g, '함')
    .replace(/하였다$/g, '함').replace(/했다$/g, '함').replace(/한다$/g, '함')
    .replace(/보였다$/g, '보임').replace(/보였음$/g, '보임').replace(/보인다$/g, '보임')
    .replace(/되었다$/g, '됨').replace(/되었음$/g, '됨').replace(/된다$/g, '됨')
    .replace(/이었다$/g, '임').replace(/이다$/g, '임').replace(/있다$/g, '있음')
    .replace(/뛰어나다$/g, '뛰어남').replace(/우수하다$/g, '우수함').replace(/탁월하다$/g, '탁월함')
    .replace(/돋보인다$/g, '돋보임').replace(/두드러진다$/g, '두드러짐').replace(/드러난다$/g, '드러남');
  sentence = sentence.replace(/(분석|비교|설명|발표|작성|기록|계산|도출|제시|활용|검증|해석|탐구|정리|수정|시각화|분류|변환|설계|추론|입증|평가|제출|구체화)$/g, '$1함');
  if (!/(?:함|임|음|됨|보임|드러남|두드러짐|뛰어남|우수함|탁월함)$/u.test(sentence)) {
    sentence = /(?:을|를)$/u.test(sentence)
      ? `${sentence} 구체적으로 작성함`
      : `${sentence}에 관한 수행 내용을 구체적으로 기록함`;
  }
  return `${sentence}.`;
}

function observationSentences(raw, limit) {
  const parts = raw
    .split(/(?:\r?\n|[.!?。]+)\s*/)
    .map(part => clean(part)
      .replace(/^(?:그리고|또한|그래서)\s*/g, '')
      .replace(/\s*(?:하는 편임|인 것 같음)$/g, '하는 모습을 보임'))
    .filter(Boolean);
  const combined = [];
  parts.forEach(part => {
    if (combined.length && part.length < 12) combined[combined.length - 1] += `, ${part}`;
    else combined.push(part);
  });
  return combined.slice(0, limit).map(observableEnding).filter(Boolean);
}

function evidenceExpansion(raw, maximum = 1) {
  const candidates = [];
  const add = (pattern, sentence) => { if (pattern.test(raw) && !candidates.includes(sentence)) candidates.push(sentence); };
  add(/그래프|좌표|도형|곡선/, '식과 그래프 또는 도형 사이의 관계를 비교하여 변화 양상과 수학적 의미를 구체적으로 설명함.');
  add(/자료|데이터|통계|도표|표(?:를|로|와|에|의|가|는|에서|\s)|엑셀|지오지브라|공학\s*도구/, '자료에서 중요 정보를 가려내어 목적에 맞게 정리하고, 분석 결과를 수학적 근거와 함께 해석함.');
  add(/발표|설명|질문|답변|토론/, '핵심 개념과 해결 절차를 수학 용어와 기호를 사용해 명료하게 표현하고, 제기된 질문에 근거를 들어 답함.');
  add(/오류|수정|피드백|검토|재시도/, '오류가 발생한 지점을 찾아 원인을 분석하고, 피드백을 반영하여 풀이와 결과물을 정확하게 수정함.');
  add(/여러|다양|다른\s*풀이|대안|비교/, '하나의 방법에 머무르지 않고 여러 접근을 비교하여 조건에 적합한 해결 전략을 선택함.');
  add(/실생활|진로|경제|건축|인공지능|감염병/, '교과에서 학습한 수학 개념을 실제 맥락과 관계 짓고 그 활용 가능성을 구체적으로 제시함.');
  add(/모둠|팀|친구|동료|협업|조율/, '모둠 구성원의 의견을 경청하고 역할을 충실히 수행하며 공동의 해결책을 도출하는 데 기여함.');
  return candidates.slice(0, maximum);
}

function compactText(text, maximum = 58) {
  const value = clean(text);
  if (value.length <= maximum) return value;
  const shortened = value.slice(0, maximum + 1);
  const lastSpace = shortened.lastIndexOf(' ');
  return shortened.slice(0, lastSpace > maximum * 0.65 ? lastSpace : maximum).trim();
}

function assessmentIntro(item, length = 'medium') {
  const activityMaximum = { short: 75, medium: 125, long: 175 }[length] || 125;
  const activity = compactText(item.activity, activityMaximum);
  return `‘${compactText(item.name)}’ 수행평가에서 ‘${activity}’이라는 활동을 수행함.`;
}

function assessmentProcessSentence(item) {
  const context = `${item.name} ${item.activity}`;
  if (/발표|설명|토론|질문|답변/u.test(context)) return '수행 과정에서 핵심 내용과 해결 절차를 정리하고 이를 수학적 표현을 활용해 전달함.';
  if (/보고서|노트|활동지|기록|작성|서술/u.test(context)) return '활동 과정에서 사용한 개념과 해결 절차, 결과를 순서 있게 정리하여 산출물에 구체적으로 기록함.';
  if (/자료|데이터|통계|도표|표|그래프|공학\s*도구|엑셀|지오지브라/u.test(context)) return '주어진 자료에서 필요한 정보를 선별하고 표·식·그래프 등 적절한 수학적 표현으로 정리하여 결과를 해석함.';
  if (/탐구|조사|주제|실생활|진로/u.test(context)) return '수행 주제와 관련된 수학 개념을 찾아 실제 활동 내용과 연결하고 탐구 과정과 결과를 구체적으로 정리함.';
  if (/문제|문항|풀이|해결/u.test(context)) return '문제의 조건과 필요한 개념을 확인한 뒤 해결 절차를 단계적으로 적용하고 결과의 타당성을 점검함.';
  return '수행 과제의 조건을 확인하고 관련 수학 개념을 적용하여 활동 과정과 결과를 구체적으로 정리함.';
}

function assessmentSupportSentences(item, evidence) {
  const context = `${item.name} ${item.activity} ${evidence}`;
  const sentences = [
    '수행평가에서 제시한 활동의 목적과 조건을 확인하고 관찰 근거에 나타난 수행 과정을 중심으로 과제를 구체화함.',
    '활동 과정에서 사용한 수학 개념과 표현을 수행평가의 주제에 맞게 연결하여 해결 과정과 결과를 체계적으로 정리함.',
    '관찰된 활동 내용과 산출물의 특징을 바탕으로 핵심 수행과 세부 과정을 구분하여 기록함.'
  ];
  if (/보고서|노트|활동지|기록|작성|서술/u.test(context)) sentences.push('수행 과정에서 확인한 개념과 풀이의 근거를 순서 있게 배열하여 기록의 흐름이 드러나도록 산출물을 구성함.');
  if (/발표|설명|토론|질문|답변/u.test(context)) sentences.push('발표할 핵심 내용과 수학적 근거를 구분하여 정리하고 해결 과정이 전달되도록 표현을 다듬어 설명함.');
  if (/자료|데이터|통계|도표|표|그래프|엑셀|지오지브라|공학\s*도구/u.test(context)) sentences.push('자료의 특징을 비교하고 필요한 정보를 수학적 표현으로 변환하여 분석 과정과 결과의 의미가 드러나도록 정리함.');
  if (/탐구|조사|주제|실생활|진로/u.test(context)) sentences.push('수행 주제와 관련된 개념 및 사례의 관계를 살펴보고 탐구 과정에서 확인한 내용을 수학적 근거와 함께 구체화함.');
  if (/문제|문항|풀이|해결/u.test(context)) sentences.push('문제의 조건과 적용할 개념을 구분하고 풀이의 각 단계가 자연스럽게 이어지도록 해결 과정을 정리함.');
  return sentences;
}

function observationActivityContext(item, sentence) {
  const evidenceContext = sentence;
  const assessmentContext = `${item.name} ${item.activity}`;
  if (/발표|설명|토론|질문|답변/u.test(evidenceContext)) return '발표와 설명 과정';
  if (/보고서|노트|활동지|기록|작성|서술/u.test(evidenceContext)) return '산출물 작성 과정';
  if (/자료|데이터|통계|도표|표|그래프|엑셀|지오지브라|공학\s*도구/u.test(evidenceContext)) return '자료 분석 과정';
  if (/탐구|조사|주제|실생활|진로/u.test(evidenceContext)) return '주제 탐구 과정';
  if (/문제|문항|풀이|해결|계산/u.test(evidenceContext)) return '문제 해결 과정';
  if (/발표|설명|토론|질문|답변/u.test(assessmentContext)) return '발표와 설명 과정';
  if (/보고서|노트|활동지|기록|작성|서술/u.test(assessmentContext)) return '산출물 작성 과정';
  if (/자료|데이터|통계|도표|표|그래프|엑셀|지오지브라|공학\s*도구/u.test(assessmentContext)) return '자료 분석 과정';
  if (/탐구|조사|주제|실생활|진로/u.test(assessmentContext)) return '주제 탐구 과정';
  if (/문제|문항|풀이|해결|계산/u.test(assessmentContext)) return '문제 해결 과정';
  return '과제 수행 과정';
}

function contextualizeObservations(sentences, item) {
  const activity = item.activity;
  return sentences.map((sentence, index) => {
    let observation = sentence;
    if (/전\s*단원.*(?:제출|작성)/u.test(observation) && /배움\s*노트|성찰\s*노트/u.test(activity)) {
      observation = '전 단원의 배움노트와 성찰노트를 빠짐없이 성실하게 작성하여 제출함.';
    } else if (/성실히\s*제출함/u.test(observation)) {
      observation = observation.replace(/성실히\s*제출함/u, '빠짐없이 성실하게 작성하여 제출함');
    }
    const context = observationActivityContext(item, observation);
    const lead = index === 0
      ? `‘${compactText(item.name)}’ 수행평가의 ${context}에서`
      : `해당 수행평가의 ${context}에서`;
    return `${lead} ${observation.replace(/^\s+/, '')}`;
  });
}

function contextualCompetencySentence(key, context) {
  const hasWriting = /노트|보고서|활동지|작성|기록|서술/u.test(context);
  const hasSpeaking = /발표|설명|질문|답변|토론/u.test(context);
  const hasCorrection = /틀린|모르는|오류|수정|피드백|검토|재시도/u.test(context);
  const hasAlternatives = /다양한\s*방법|여러\s*방법|다른\s*풀이|대안|비교/u.test(context);
  const hasData = /자료|데이터|통계|도표|엑셀|지오지브라|공학\s*도구/u.test(context);
  const hasRealWorld = /실생활|진로|경제|건축|인공지능|감염병/u.test(context);

  if (key === 'communication' && hasWriting) return '관련 개념과 풀이 과정을 배움노트와 성찰노트에 순서 있게 정리하여 수학적 사고를 글로 표현하는 능력이 돋보임.';
  if (key === 'communication' && hasSpeaking) return '핵심 개념과 해결 과정을 수학 용어로 명료하게 설명하고 질문에 근거를 들어 답하는 의사소통능력이 돋보임.';
  if (key === 'problem' && hasCorrection) return '해결하지 못한 문제를 그대로 두지 않고 오류의 원인을 찾아 관련 개념을 재정리한 뒤 다시 해결하는 문제해결능력이 돋보임.';
  if (key === 'problem' && hasAlternatives) return '하나의 풀이에 머무르지 않고 여러 해결 방법을 비교하여 적절한 전략을 선택하는 문제해결능력이 돋보임.';
  if (key === 'reasoning' && hasWriting) return '풀이의 각 단계를 순서 있게 기록하고 사용한 개념과 근거를 분명히 밝혀 논리적 사고 과정을 구체적으로 드러냄.';
  if (key === 'connection' && hasAlternatives) return '문제에 적용할 수 있는 여러 개념과 풀이 방법의 관계를 살펴보고 이를 새로운 해결 과정으로 연결함.';
  if (key === 'connection' && hasRealWorld) return '교과에서 학습한 수학 개념을 실제 상황과 관계 짓고 그 활용 가능성을 구체적으로 제시함.';
  if (key === 'information' && hasData) return '자료에서 중요 정보를 추출하여 목적에 맞게 정리하고 분석 결과를 수학적 근거에 따라 해석함.';
  if (key === 'information' && hasWriting) return '단원별 학습 내용과 문제 해결 기록을 체계적으로 분류하고 재정리하는 정보처리 역량이 돋보임.';
  return veteranCompetencyText[key] ? pick(veteranCompetencyText[key], 0) : '';
}

function isUninformativeEvaluation(text) {
  return /^(?:평범함|보통임|특이\s*사항\s*없음|없음|무난함)[.!?。\s]*$/u.test(text.trim());
}

function objectParticle(text) {
  const value = text.trim();
  const last = value.charCodeAt(value.length - 1);
  const hasFinalConsonant = last >= 0xac00 && last <= 0xd7a3 && (last - 0xac00) % 28 !== 0;
  return `${value}${hasFinalConsonant ? '을' : '를'}`;
}

function customStudentSentence(label, value) {
  if (!label || !value) return '';
  const target = objectParticle(value);
  if (/주제/u.test(label)) return `${target} ${label}로 정하여 탐구 활동을 수행함.`;
  if (/제목/u.test(label)) return `${target} ${label}으로 정하여 탐구 활동을 수행함.`;
  if (/역할/u.test(label)) return `활동에서 ${value} 역할을 맡아 과제를 수행함.`;
  if (/개념|내용|대상|사례|문제|문항/u.test(label)) return `${target} ${label}으로 정하여 관련 활동을 수행함.`;
  return `${label}에 ${target} 기록하고 이를 바탕으로 활동을 수행함.`;
}

function restrainedLevelSentence(achievement) {
  const sentences = {
    excellent: '관찰된 과제 수행 과정에서 맡은 활동을 꾸준히 이어가고 결과물을 책임감 있게 완성하는 자기관리능력이 돋보임.',
    good: '주어진 활동을 성실하게 수행하고 정해진 절차에 따라 결과물을 충실히 완성함.',
    steady: '수업에서 안내한 절차를 따라 과제를 꾸준히 수행하고 결과물을 기한에 맞추어 제출함.',
    growth: '피드백과 재시도를 통해 부족한 부분을 보완하며 과제 수행의 완성도를 높여가는 모습을 보임.'
  };
  return sentences[achievement];
}

function applyAchievementExpression(sentence, achievement) {
  if (!sentence || !achievement) return sentence;
  const replacements = {
    excellent: {
      '수행함': '주도적이고 완성도 높게 수행함', '정리함': '논리적 구조가 선명하게 드러나도록 정리함',
      '기록함': '핵심과 세부가 명확히 드러나도록 기록함', '작성함': '논리적 흐름과 완성도를 갖추어 작성함',
      '설명함': '구체적인 근거를 들어 명료하게 설명함', '분석함': '여러 요소의 관계를 종합하여 분석함',
      '비교함': '공통점과 차이의 의미까지 짚어 비교함', '적용함': '새로운 조건에도 정확하고 능숙하게 적용함',
      '활용함': '목적에 맞게 능숙하고 효과적으로 활용함', '도출함': '타당한 근거를 바탕으로 정확하게 도출함',
      '제시함': '구체적인 근거와 함께 제시함', '수정함': '오류의 원인을 분석하여 정확하게 수정함',
      '구체화함': '근거와 세부 내용을 갖추어 구체화함', '제출함': '빠짐없이 완성도 있게 작성하여 제출함'
    },
    good: {
      '수행함': '충실하고 안정적으로 수행함', '정리함': '핵심이 드러나도록 체계적으로 정리함',
      '기록함': '과정과 결과가 드러나도록 충실히 기록함', '작성함': '정확한 내용과 흐름을 갖추어 작성함',
      '설명함': '핵심 개념과 근거를 정확하게 설명함', '분석함': '주요 요소의 관계를 정확하게 분석함',
      '비교함': '공통점과 차이를 기준에 따라 비교함', '적용함': '학습한 개념을 상황에 맞게 정확히 적용함',
      '활용함': '목적과 상황에 맞게 적절히 활용함', '도출함': '근거에 따라 타당한 결과를 도출함',
      '제시함': '핵심 근거를 갖추어 구체적으로 제시함', '수정함': '확인한 오류를 정확하게 수정함',
      '구체화함': '핵심 내용과 근거를 갖추어 구체화함', '제출함': '정해진 형식에 맞추어 충실히 제출함'
    },
    steady: {
      '수행함': '정해진 절차에 따라 꾸준히 수행함', '정리함': '배운 개념을 바탕으로 순서 있게 정리함',
      '기록함': '안내된 항목에 따라 차근차근 기록함', '작성함': '기본 내용과 절차를 갖추어 작성함',
      '설명함': '배운 개념을 바탕으로 핵심 내용을 설명함', '분석함': '주어진 기준에 따라 주요 내용을 분석함',
      '비교함': '제시된 기준에 따라 공통점과 차이를 비교함', '적용함': '기본 개념을 주어진 상황에 적용함',
      '활용함': '안내된 방법에 따라 필요한 표현을 활용함', '도출함': '풀이 절차에 따라 결과를 도출함',
      '제시함': '활동에서 확인한 내용을 중심으로 제시함', '수정함': '안내를 참고하여 잘못된 부분을 수정함',
      '구체화함': '배운 내용과 활동 과정을 바탕으로 구체화함', '제출함': '안내된 형식에 맞추어 제출함'
    },
    growth: {
      '수행함': '안내를 바탕으로 꾸준히 수행함', '정리함': '확인과 보완을 거쳐 차근차근 정리함',
      '기록함': '빠진 내용을 확인하고 보완하며 기록함', '작성함': '도움을 받아 부족한 부분을 보완하며 작성함',
      '설명함': '질문과 확인을 거쳐 자신의 말로 설명함', '분석함': '제시된 기준을 참고하여 필요한 내용을 분석함',
      '비교함': '안내에 따라 공통점과 차이를 찾아 비교함', '적용함': '도움을 받아 기본 개념을 상황에 적용함',
      '활용함': '사용 방법을 확인하며 필요한 표현을 활용함', '도출함': '풀이 과정을 점검하며 결과를 도출함',
      '제시함': '확인한 내용을 바탕으로 결과를 제시함', '수정함': '피드백을 반영하여 부족한 부분을 수정함',
      '구체화함': '질문과 보완을 거쳐 활동 내용을 구체화함', '제출함': '부족한 부분을 보완하여 제출함'
    }
  }[achievement];
  let result = sentence;
  for (const [ending, replacement] of Object.entries(replacements || {})) {
    const pattern = new RegExp(`${ending.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.?$`, 'u');
    if (pattern.test(result)) {
      result = result.replace(pattern, `${replacement}.`);
      break;
    }
  }
  if (achievement === 'excellent') result = result.replace(/(?:우수함|돋보임|두드러짐)\.?$/u, '매우 두드러짐.');
  if (achievement === 'good') result = result.replace(/탁월함\.?$/u, '우수함.');
  if (achievement === 'steady') result = result.replace(/(?:탁월함|우수함|돋보임|두드러짐)\.?$/u, '안정적으로 드러남.');
  if (achievement === 'growth') result = result.replace(/(?:탁월함|우수함|돋보임|두드러짐)\.?$/u, '꾸준히 향상됨.');
  return result;
}

function polishRecord(sentences) {
  const seen = new Set();
  return sentences
    .filter(Boolean)
    .map(sentence => observableEnding(sentence))
    .filter(sentence => {
      const key = sentence.replace(/\s/g, '');
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .join(' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/\.\s*\./g, '.')
    .trim();
}

function fitRecordLength(sentences, length, supportSentences = []) {
  const guide = {
    short: { minimum: 130, maximum: 170 },
    medium: { minimum: 220, maximum: 280 },
    long: { minimum: 400, maximum: 500 }
  }[length];
  const polished = [...sentences, ...supportSentences].filter(Boolean).map(observableEnding).filter(Boolean);
  const selected = [];
  polished.forEach(sentence => {
    const candidate = [...selected, sentence].join(' ');
    if (candidate.length <= guide.maximum || selected.join(' ').length < guide.minimum) selected.push(sentence);
  });
  return polishRecord(selected);
}

function composeMathOfflineRecord({ item, evidence, fieldEntries, competencies, achievement, length }) {
  const career = clean(fieldEntries.find(field => field.type === 'career')?.value || '');
  const teacherEvaluation = fieldEntries.find(field => field.type === 'teacher')?.value || '';
  const customEntries = fieldEntries.filter(field => field.type === 'custom' && field.value);
  const sourceLength = evidence.length + fieldEntries.reduce((sum, field) => sum + field.value.length, 0);
  const richThreshold = length === 'short' ? 170 : length === 'medium' ? 280 : 430;
  const hasRichEvidence = sourceLength >= richThreshold;
  const customLimit = length === 'short' ? 1 : length === 'medium' ? 2 : 4;
  const customSentences = customEntries.slice(0, customLimit).map(field => customStudentSentence(field.label, field.value));
  const observationLimit = length === 'short' ? 2 : length === 'medium' ? 5 : 8;
  const observations = contextualizeObservations(observationSentences(evidence, observationLimit), item);
  const teacherIsMeaningful = teacherEvaluation && !isUninformativeEvaluation(teacherEvaluation);
  const teacherObservations = teacherIsMeaningful ? observationSentences(teacherEvaluation, length === 'long' ? 3 : 2) : [];
  const careerLabel = career && !career.endsWith('계열') && career !== '진로 탐색 중' ? `${career} 계열` : career;
  const careerSentence = !career ? '' : career === '진로 탐색 중'
    ? '수행 주제와 연관된 다양한 진로 자료를 찾아 수학의 활용 장면을 구체적으로 정리함.'
    : `${careerLabel} 진로와 수행 주제의 연관성을 자료와 수학적 근거를 바탕으로 구체화함.`;
  const intro = assessmentIntro(item, length);
  const processSentence = assessmentProcessSentence(item);
  const competencyContext = `${item.activity} ${fieldEntries.map(field => field.value).join(' ')} ${evidence}`;
  const competenceSentences = competencies.map(key => contextualCompetencySentence(key, competencyContext)).filter(Boolean);
  const levelSentence = !achievement ? '' : evidence.length < 100
    ? restrainedLevelSentence(achievement)
    : pick(veteranLevelText[achievement], 1);
  const expansionCount = length === 'short' ? 1 : length === 'medium' ? (hasRichEvidence ? 2 : 3) : (hasRichEvidence ? 3 : 5);
  const expansions = evidenceExpansion(evidence, expansionCount);
  let sentences = [intro, ...customSentences, ...observations];

  if (length === 'short') {
    sentences.push(...teacherObservations.slice(0, 1), expansions[0], ...competenceSentences.slice(0, 1), levelSentence);
  } else if (length === 'medium') {
    sentences.push(processSentence, ...teacherObservations, ...expansions, ...competenceSentences.slice(0, 2), careerSentence, levelSentence);
  } else {
    sentences.push(
      processSentence,
      ...teacherObservations,
      ...expansions,
      ...competenceSentences,
      careerSentence,
      levelSentence
    );
  }

  const supportCount = length === 'short' ? 1 : length === 'medium' ? 6 : 8;
  const tonedSentences = sentences.map(sentence => applyAchievementExpression(sentence, achievement));
  const tonedSupport = assessmentSupportSentences(item, evidence)
    .slice(0, supportCount)
    .map(sentence => applyAchievementExpression(sentence, achievement));
  return fitRecordLength(tonedSentences, length, tonedSupport);
}

function subjectProcessSentence(item, evidence, profile) {
  const context = `${item.name} ${item.activity} ${evidence}`;
  return profile.processCues.find(cue => new RegExp(cue.keywords, 'u').test(context))?.sentence
    || profile.defaultProcess;
}

function subjectSupportSentences(item, evidence, profile) {
  const context = `${item.name} ${item.activity} ${evidence}`;
  const matched = profile.processCues
    .filter(cue => new RegExp(cue.keywords, 'u').test(context))
    .map(cue => cue.sentence);
  return [...new Set([...matched, ...profile.supportSentences])];
}

function subjectCompetencySentences(item, competencyKeys) {
  const selected = new Set(competencyKeys);
  return getSubjectCompetencies(item)
    .filter(competency => selected.has(competency.key))
    .map(competency => `${competency.label}과 관련된 수행 과정과 태도가 입력된 관찰 근거에서 구체적으로 드러남.`);
}

function composeSubjectOfflineRecord({ item, evidence, fieldEntries, competencies, achievement, length }) {
  const profile = getSubjectWritingProfile(item);
  const career = clean(fieldEntries.find(field => field.type === 'career')?.value || '');
  const teacherEvaluation = fieldEntries.find(field => field.type === 'teacher')?.value || '';
  const customEntries = fieldEntries.filter(field => field.type === 'custom' && field.value);
  const customLimit = length === 'short' ? 1 : length === 'medium' ? 2 : 4;
  const observationLimit = length === 'short' ? 2 : length === 'medium' ? 5 : 8;
  const observations = contextualizeObservations(observationSentences(evidence, observationLimit), item);
  const customSentences = customEntries.slice(0, customLimit).map(field => customStudentSentence(field.label, field.value));
  const teacherObservations = teacherEvaluation && !isUninformativeEvaluation(teacherEvaluation)
    ? observationSentences(teacherEvaluation, length === 'long' ? 3 : 2)
    : [];
  const careerLabel = career && !career.endsWith('계열') && career !== '진로 탐색 중' ? `${career} 계열` : career;
  const careerSentence = !career ? '' : career === '진로 탐색 중'
    ? `수행 주제와 연관된 다양한 진로 자료를 찾아 ${profile.careerLens}의 활용 장면을 구체적으로 정리함.`
    : `${careerLabel} 진로와 수행 주제의 관련성을 ${profile.careerLens} 관점에서 자료를 바탕으로 구체화함.`;
  const processSentence = subjectProcessSentence(item, evidence, profile);
  const competenceSentences = subjectCompetencySentences(item, competencies);
  const levelSentence = !achievement ? '' : restrainedLevelSentence(achievement);
  let sentences = [assessmentIntro(item, length), ...customSentences, ...observations];

  if (length === 'short') {
    sentences.push(...teacherObservations.slice(0, 1), ...competenceSentences.slice(0, 1), levelSentence);
  } else if (length === 'medium') {
    sentences.push(processSentence, ...teacherObservations, ...competenceSentences.slice(0, 2), careerSentence, levelSentence);
  } else {
    sentences.push(processSentence, ...teacherObservations, ...competenceSentences, careerSentence, levelSentence);
  }

  const supportCount = length === 'short' ? 1 : length === 'medium' ? 4 : 7;
  const tonedSentences = sentences.map(sentence => applyAchievementExpression(sentence, achievement));
  const tonedSupport = subjectSupportSentences(item, evidence, profile)
    .slice(0, supportCount)
    .map(sentence => applyAchievementExpression(sentence, achievement));
  return fitRecordLength(tonedSentences, length, tonedSupport);
}

function composeOfflineRecord(args) {
  return getSubjectArea(args.item) === 'math'
    ? composeMathOfflineRecord(args)
    : composeSubjectOfflineRecord(args);
}
function generateRecord() {
  const item = assessments.find(assessment => assessment.id === $('#assessmentSelect').value);
  if (!item) return showToast('등록한 수행평가를 선택해 주세요.');
  const evidence = $('#studentEvidence').value.trim();
  if (!evidence) return showToast(`‘${item.evidenceLabel}’ 항목을 입력해 주세요.`);
  const competencies = $$('#competencyChoices input:checked').map(input => input.value);
  const achievement = $('input[name="achievement"]:checked').value;
  const length = $('input[name="length"]:checked').value;
  const fieldEntries = getStudentFieldEntries(item);

  $('#result').value = composeOfflineRecord({ item, evidence, fieldEntries, competencies, achievement, length });
  $('#emptyState').classList.add('hidden');
  $('#resultArea').classList.remove('hidden');
  updateCount();
}

function createOfflineDraft() {
  variant = 0;
  generateRecord();
}

$('#generateOfflineDraft').addEventListener('click', createOfflineDraft);
$('#studentForm').addEventListener('submit', event => {
  event.preventDefault();
  createOfflineDraft();
});

let offlineDraftRefreshTimer;
function refreshVisibleOfflineDraft() {
  if ($('#resultArea').classList.contains('hidden')) return;
  window.clearTimeout(offlineDraftRefreshTimer);
  offlineDraftRefreshTimer = window.setTimeout(() => {
    if (!$('#assessmentSelect').value || !$('#studentEvidence').value.trim()) {
      $('#result').value = '';
      $('#resultArea').classList.add('hidden');
      $('#emptyState').classList.remove('hidden');
      updateCount();
      return;
    }
    variant = 0;
    generateRecord();
  }, 80);
}

$('#studentForm').addEventListener('input', refreshVisibleOfflineDraft);
$('#studentForm').addEventListener('change', refreshVisibleOfflineDraft);

$('#regenerate').addEventListener('click', () => { variant += 1; generateRecord(); });

function updateCount() {
  const text = $('#result').value;
  $('#charCount').textContent = `${text.length}자 · ${new TextEncoder().encode(text).length}바이트`;
}

$('#result').addEventListener('input', updateCount);

async function copyText(text) {
  try { await navigator.clipboard.writeText(text); }
  catch {
    const temporary = document.createElement('textarea');
    temporary.value = text;
    temporary.style.position = 'fixed';
    temporary.style.opacity = '0';
    document.body.append(temporary);
    temporary.select();
    document.execCommand('copy');
    temporary.remove();
  }
}

function buildStudentDataPrompt() {
  const item = assessments.find(assessment => assessment.id === $('#assessmentSelect').value);
  if (!item) return '';
  const competencies = getSubjectCompetencies(item);
  const competencyNames = Object.fromEntries(competencies.map(competency => [competency.key, competency.label]));
  const achievementNames = { excellent: '매우 우수', good: '우수', steady: '보통', growth: '성장 중' };
  const lengthGuide = {
    short: '간결하게(약 150자)', medium: '보통(약 250자)', long: '상세하게(약 450자)'
  };
  const selectedCompetencies = $$('#competencyChoices input:checked').map(input => competencyNames[input.value]).filter(Boolean);
  const achievement = $('input[name="achievement"]:checked').value;
  const length = $('input[name="length"]:checked').value;
  const optionalInputs = getStudentFieldEntries(item)
    .map(field => `- ${field.label}: ${field.value || '입력하지 않음'}`)
    .join('\n');
  const competencyLine = competencies.length
    ? `- 강조할 ${SUBJECT_PROFILES[getSubjectArea(item)].label} 핵심역량: ${selectedCompetencies.join(', ') || '선택하지 않음'}\n`
    : '';

  return `# 학생별 원본 자료
- 수행평가명: ${item.name}
- ${item.evidenceLabel}: ${$('#studentEvidence').value.trim()}
${optionalInputs ? `${optionalInputs}\n` : ''}${competencyLine}- 성취 수준: ${achievementNames[achievement]}
- 희망 분량: ${lengthGuide[length]}

# 요청
이 대화방에 먼저 입력된 수행평가 지침과 위 원본 자료만을 근거로 최종 세특 한 문단을 작성하세요. 입력에 없는 사실은 추가하지 마세요.`;
}
function buildCompetencyGuide(item) {
  const competencies = getSubjectCompetencies(item);
  if (!competencies.length) return '';
  const subjectLabel = SUBJECT_PROFILES[getSubjectArea(item)].label;
  const descriptions = competencies
    .map(competency => `- ${competency.label}\n  - 설명: ${competency.description}\n  - 평가요소: ${competency.evaluationElements.join(', ')}`)
    .join('\n');
  return `# ${subjectLabel} 핵심역량 해석 기준 — 내부 참고용
${descriptions}

학생 자료에서 선택된 역량의 이름을 그대로 칭찬 문구로 붙이지 마세요. 위 설명과 평가요소 중 학생 관찰 근거로 확인되는 구체적인 행동만 골라 수행 과정과 연결해 서술하고, 근거가 부족하면 선택된 역량도 억지로 넣지 마세요.`;
}

function buildWritingGuide(item) {
  const subjectLabel = SUBJECT_PROFILES[getSubjectArea(item)]?.label || '교과';
  const writingProfile = getSubjectWritingProfile(item);
  const subjectSpecificGuide = `# ${subjectLabel} 수행평가 해석 기준
- 평가 초점: ${writingProfile.evaluationFocus.join(', ')}
- 권장 서술어: ${writingProfile.recommendedVerbs.join(', ')}
${writingProfile.promptRules.map((rule, index) => `${index + 1}. ${rule}`).join('\n')}`;
  const hasCompetencies = getSubjectCompetencies(item).length > 0;
  const competencyGuide = buildCompetencyGuide(item);
  return `# 가장 중요한 원칙
1. 원본 자료의 관찰 사실을 최우선으로 보존하고, 입력에 없는 행동·성과·감정·수치·친구의 반응을 새로 만들지 마세요.
2. 학생별 메시지는 각각 독립된 기록입니다. 이전 학생의 활동이나 평가를 다음 학생의 문장에 절대 섞지 마세요.
3. 수행평가 설명은 배경 자료로만 사용하고 최종 문장에 전부 옮기지 마세요. 학생의 실제 활동을 이해하는 데 필요한 맥락만 짧게 반영하세요.
4. 어색한 나열과 반복을 줄이고, 관찰 행동 → 구체적 수행 과정 → ${hasCompetencies ? `드러난 ${subjectLabel} 핵심역량 또는 ` : ''}성장의 순서로 문장을 조직하세요.
5. 학생 관찰 근거의 문장을 그대로 복사해 나열하지 말고, 각 행동이 수행평가의 어느 활동·과정에서 나타났는지 연결하여 자연스러운 교사 관찰 문장으로 재구성하세요.

${subjectSpecificGuide}

${competencyGuide ? `${competencyGuide}\n\n` : ''}# 문체와 표현
1. ‘학생’, ‘그는’, ‘그가’, ‘그의’를 주어로 사용하지 마세요.
2. 품격 있고 신뢰감 있는 교사 관찰 문체를 사용하세요.
3. 모든 문장은 현재형 명사형 어미인 ‘~함’, ‘~음’, ‘~임’을 중심으로 끝내고 과거형·미래형 종결을 사용하지 마세요.
4. 깨달음·느낌·생각·다짐처럼 교사가 직접 확인할 수 없는 내면 상태를 단정하지 마세요.
5. ‘다짐함’, ‘느낌’, ‘생각함’, ‘깨닫게 됨’, ‘알게 됨’, ‘관심을 갖게 됨’, ‘이해함함’으로 문장을 끝내지 마세요.
6. 성취기준 코드나 원문, ‘성취기준에 따르면’ 같은 행정적 문구는 최종 문장에 노출하지 마세요.

# 서술어 선택 기준
1. 권장 서술어: ‘분석함’, ‘비교함’, ‘설명함’, ‘근거를 제시함’, ‘질문함’, ‘수정함’, ‘기록함’, ‘구체화함’, ‘태도를 보임’처럼 교사가 확인할 수 있는 행동을 사용하세요.
2. 피해야 할 서술어: ‘느꼈음’, ‘생각함’, ‘깨달음’, ‘알게 됨’, ‘관심을 갖게 됨’, ‘이해하게 됨’, ‘다짐함’처럼 관찰하기 어려운 내면 변화 표현을 사용하지 마세요.
3. ‘했다’, ‘하였다’, ‘할 것이다’, ‘할 수 있을 것이다’ 같은 과거형·미래형 종결 대신 현재형 관찰 기록으로 바꾸세요.
4. ‘탁월함’, ‘우수함’, ‘논리적 사고’, ‘자기주도성’, ‘문제해결능력’, ‘추론’, ‘표현력’, ‘성실성’, ‘끈기’ 등의 긍정어휘는 반드시 원본의 구체적인 근거가 있을 때만 절제하여 사용하세요.

# 내용 다듬기
1. 원본 자료가 짧으면 이미 기록된 사실과 수행평가 맥락의 범위 안에서 과정과 의미가 선명해지도록 자연스럽게 늘리세요.
2. 원본 자료가 길면 핵심 관찰 근거를 보존하면서 수행평가 설명, 중복 표현, 상투적인 칭찬을 과감히 줄이세요.
3. ${hasCompetencies ? `${subjectLabel} 핵심역량은 관찰 행동으로 뒷받침되는 경우에만 자연스럽게 드러내고 역량 이름을 기계적으로 나열하지 마세요.` : '교사가 관찰한 구체적인 수행 과정과 성장만 서술하세요.'}
4. 학생별 원본 자료에 표시된 희망 분량을 따르되, 사실을 늘어놓기보다 문장 완성도를 우선하세요.`;
}

function buildCommonPrompt(item) {
  const writingProfile = getSubjectWritingProfile(item);
  return `# 역할
앞으로 이 대화에서는 한국 고등학교 ${writingProfile.role}의 관점에서 교과세부능력 및 특기사항을 작성해 주세요. 사용자가 학생별 원본 자료를 보내면 아래 원칙에 따라 완성도 높은 최종 문장을 작성하세요.

${buildWritingGuide(item)}

# 매번의 출력 방식
사용자가 학생별 원본 자료를 보내면 설명, 제목, 수정 이유, 따옴표 없이 완성된 최종 세특 한 문단만 출력하세요. 답변 전에 사실 추가 여부, 학생 간 정보 혼합, 금지 주어, 관찰 불가능한 표현, 종결 어미, 성취기준 노출, 문장 중복을 내부적으로 점검하세요.`;
}
function buildAssessmentPrompt() {
  const item = assessments.find(assessment => assessment.id === $('#assessmentSelect').value);
  if (!item) return '';
  const standards = item.standards.map(code => {
    const standard = ACHIEVEMENT_STANDARDS[item.subject]?.find(entry => entry.code === code);
    return standard ? `[${standard.code}] ${standard.text}` : '';
  }).filter(Boolean).join('\n');
  const promptFocus = buildPromptFocusSection(item);

  return `${buildCommonPrompt(item)}

# 이 대화방에서 적용할 수행평가
- 과목: ${getSubjectPath(item)}
- 수행평가명: ${item.name}
- 수행평가 활동: ${item.activity}
- 학생별 필수 작성 항목: ${item.evidenceLabel}
- 학생별 선택 작성 항목: ${item.optionalFields.map(field => field.label).join(', ') || '없음'}

${promptFocus}
# 성취기준 — 해석을 위한 내부 참고용
${standards || '등록된 성취기준 없음'}

# 수행평가별 적용 원칙
1. 이후 전달되는 모든 원본 자료는 위 수행평가에 참여한 서로 다른 학생의 기록입니다.
2. 수행평가 활동과 성취기준은 원본 자료의 관찰 행동을 해석하는 배경으로만 활용하고, 수행평가 설명 전체를 최종 문장에 옮기지 마세요.
3. 최종 문장에는 성취기준 코드, 원문, ‘성취기준에 따르면’과 같은 표현을 절대 노출하지 마세요.
4. 학생별 원본 자료가 길면 핵심 행동 중심으로 요약하고, 짧으면 입력된 사실의 범위 안에서 과정과 의미를 구체화하세요. 원본에 없는 행동이나 성과는 추가하지 마세요.
5. 다른 수행평가로 넘어갈 때는 새 대화방에서 해당 평가의 전용 프롬프트를 다시 입력해야 합니다.

위 지침과 수행평가 맥락을 이해했다면 지금은 “준비되었습니다. 이 수행평가의 학생별 원본 자료를 보내주세요.”라고만 답하세요.`;
}

function buildPromptFocusSection(item) {
  const focus = normalizePromptFocus(item?.promptFocus);
  return focus
    ? `# 교사가 지정한 강조사항\n${focus}\n\n위 강조사항은 학생별 원본 자료에서 확인되는 내용에만 적용하고, 강조를 위해 입력에 없는 사실을 만들지 마세요.\n`
    : '';
}

$('#copyAssessmentPrompt').addEventListener('click', async () => {
  const prompt = buildAssessmentPrompt();
  if (!prompt) return showToast('수행평가를 먼저 선택해 주세요.');
  await copyText(prompt);
  showToast('수행평가별 프롬프트를 복사했습니다. 새 AI 대화방에 붙여넣으세요.');
});

$('#copyStudentData').addEventListener('click', async () => {
  if (!$('#assessmentSelect').value) return showToast('수행평가를 먼저 선택해 주세요.');
  if (!$('#studentEvidence').value.trim()) {
    const item = assessments.find(assessment => assessment.id === $('#assessmentSelect').value);
    return showToast(`‘${item?.evidenceLabel || DEFAULT_EVIDENCE_LABEL}’ 항목을 입력해 주세요.`);
  }
  const prompt = buildStudentDataPrompt();
  await copyText(prompt);
  showToast('AI용 학생 원본 자료를 복사했습니다. 같은 AI 대화방에 붙여넣으세요.');
});

$('#copyResult').addEventListener('click', async () => {
  await copyText($('#result').value);
  showToast('오프라인 보조 초안을 복사했습니다.');
});

function loadBatchDrafts() {
  try {
    const saved = JSON.parse(localStorage.getItem(BATCH_STORAGE_KEY));
    return saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {};
  } catch {
    return {};
  }
}

function saveBatchDrafts({ skipSnapshot = false } = {}) {
  try {
    if (!skipSnapshot) createRecoverySnapshot('학급 자료 저장 전 자동 보관');
    localStorage.setItem(BATCH_STORAGE_KEY, JSON.stringify(batchDrafts));
    updateDataSafetyStatus();
    return true;
  } catch {
    showToast('학급 입력 내용을 저장할 공간이 부족합니다.');
    return false;
  }
}

function createBatchRow(index = 0) {
  return {
    id: makeId(),
    localLabel: String(index + 1),
    evidence: '',
    optional: {},
    achievement: '',
    competencies: ''
  };
}

function createDefaultBatchRows() {
  return Array.from({ length: DEFAULT_BATCH_ROW_COUNT }, (_, index) => createBatchRow(index));
}

function normalizeBatchRow(row, index, item) {
  const savedLabel = typeof row?.localLabel === 'string' ? row.localLabel.trim() : '';
  const legacyNumber = savedLabel.match(/^학생\s*(\d+)$/u)?.[1];
  return {
    id: typeof row?.id === 'string' && row.id ? row.id : makeId(),
    localLabel: legacyNumber || savedLabel || String(index + 1),
    evidence: typeof row?.evidence === 'string' ? row.evidence : '',
    optional: row?.optional && typeof row.optional === 'object' && !Array.isArray(row.optional) ? row.optional : {},
    achievement: ['excellent', 'good', 'steady', 'growth'].includes(row?.achievement) ? row.achievement : '',
    competencies: normalizeBatchCompetencies(row?.competencies, item)
  };
}

function getBatchDraft(item) {
  const saved = batchDrafts[item.id];
  if (!saved || typeof saved !== 'object') {
    batchDrafts[item.id] = {
      length: 'medium',
      styleReference: '',
      rows: createDefaultBatchRows()
    };
    saveBatchDrafts();
  } else {
    saved.length = ['short', 'medium', 'long'].includes(saved.length) ? saved.length : 'medium';
    saved.styleReference = typeof saved.styleReference === 'string' ? saved.styleReference : '';
    const normalizedRows = Array.isArray(saved.rows) && saved.rows.length
      ? saved.rows.map((row, index) => normalizeBatchRow(row, index, item))
      : createDefaultBatchRows();
    if (normalizedRows.length === 5) {
      const startIndex = normalizedRows.length;
      normalizedRows.push(...Array.from(
        { length: DEFAULT_BATCH_ROW_COUNT - startIndex },
        (_, index) => createBatchRow(startIndex + index)
      ));
    }
    saved.rows = normalizedRows;
  }
  return batchDrafts[item.id];
}

function renderBatchAssessmentSelect(selectedId = '') {
  const select = $('#batchAssessmentSelect');
  const previous = selectedId || select.value;
  select.replaceChildren(new Option('등록한 수행평가를 선택하세요', ''));
  assessments.forEach(item => select.add(new Option(`[${getSubjectPath(item)}] ${item.name}`, item.id)));
  if (assessments.some(item => item.id === previous)) select.value = previous;
  renderBatchAssessment();
}

function renderBatchAssessment() {
  const item = assessments.find(assessment => assessment.id === $('#batchAssessmentSelect').value);
  const box = $('#batchSelectedAssessment');
  const editor = $('#batchEditorArea');
  box.replaceChildren();
  $('#batchTableContainer').replaceChildren();
  $('#batchChunkList').replaceChildren();
  $('#batchPasteInput').value = '';
  $('#batchStyleReference').value = '';
  $('#batchLength').value = 'medium';
  $('#batchPromptFocus').value = item?.promptFocus || '';
  $('#batchPromptFocus').disabled = !item;
  $('#batchPromptFocusStatus').textContent = item
    ? '선택한 수행평가의 강조사항과 연결되어 있습니다.'
    : '수행평가를 선택하면 강조사항을 수정할 수 있습니다.';
  editor.dataset.assessmentId = item?.id || '';
  box.classList.toggle('hidden', !item);
  editor.classList.toggle('hidden', !item);
  resetBatchOffline();
    renderBatchCompetencyControls(item);
  if (!item) return;

  const title = document.createElement('strong');
  title.textContent = `${getSubjectPath(item)} · ${item.name}`;
  const description = document.createElement('p');
  description.textContent = `학생별 작성 항목 ${1 + item.optionalFields.length}개 · 이 수행평가에 마지막으로 저장한 학급 입력을 불러왔습니다.`;
  box.append(title, description);
  $('#batchOfflineEmpty').textContent = `‘${item.evidenceLabel}’ 항목을 입력한 뒤 보조 초안을 만들 수 있습니다.`;

  const draft = getBatchDraft(item);
  $('#batchLength').value = draft.length;
  $('#batchStyleReference').value = draft.styleReference;
  updateBatchPasteGuide(item);
  renderBatchTable(item, draft);
  renderBatchChunks(item, draft);
  updateStyleLockStatus(draft);
}

function updateBatchPasteGuide(item) {
  const columns = getBatchColumnLabels(item);
  $('#batchPasteGuide').textContent = `열 순서: ${columns.join(' → ')}`;
  $('#batchPasteInput').placeholder = `${columns.join('\t')}\n엑셀에서 여러 행을 복사한 뒤 여기에 붙여넣으세요.`;
}

function getBatchColumnLabels(item) {
  const competencies = getSubjectCompetencies(item);
  return [
    '번호 / 구분(수정 가능)',
    item.evidenceLabel,
    ...item.optionalFields.map(field => field.label),
    '성취 수준',
    ...(competencies.length ? ['강조할 핵심역량(선택)'] : [])
  ];
}

function normalizeBatchHeaderText(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ');
}

function isBatchHeaderRow(row, evidenceLabel = DEFAULT_EVIDENCE_LABEL) {
  const cells = (row || []).map(normalizeBatchHeaderText);
  const firstCell = cells[0] || '';
  const secondCell = cells[1] || '';
  const expectedEvidenceLabel = normalizeBatchHeaderText(evidenceLabel);
  const hasIdentifierHeader = /^(?:교사용\s*)?번호\s*\/\s*(?:구분|표시)(?:\s*\(수정 가능\))?$/u.test(firstCell);

  if (hasIdentifierHeader && secondCell === expectedEvidenceLabel) return true;
  return cells.length === 1
    && /학생\s*관찰\s*근거/u.test(firstCell)
    && /학생\s*관찰\s*근거/u.test(expectedEvidenceLabel);
}
function normalizeBatchCompetencies(value, item) {
  const source = String(value ?? '').toLowerCase();
  return getSubjectCompetencies(item)
    .filter(competency => competency.matches.some(match => source.includes(String(match).toLowerCase())))
    .map(competency => competency.label)
    .join(', ');
}

function escapeXml(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[character]));
}

function excelColumnName(index) {
  let name = '';
  for (let value = index + 1; value; value = Math.floor((value - 1) / 26)) name = String.fromCharCode(65 + ((value - 1) % 26)) + name;
  return name;
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function makeZip(files) {
  const encoder = new TextEncoder();
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  const write16 = (view, at, value) => view.setUint16(at, value, true);
  const write32 = (view, at, value) => view.setUint32(at, value >>> 0, true);

  Object.entries(files).forEach(([name, content]) => {
    const nameBytes = encoder.encode(name);
    const data = typeof content === 'string' ? encoder.encode(content) : content;
    const checksum = crc32(data);
    const local = new Uint8Array(30 + nameBytes.length);
    const localView = new DataView(local.buffer);
    write32(localView, 0, 0x04034b50); write16(localView, 4, 20); write16(localView, 6, 0x0800); write16(localView, 8, 0);
    write32(localView, 14, checksum); write32(localView, 18, data.length); write32(localView, 22, data.length); write16(localView, 26, nameBytes.length);
    local.set(nameBytes, 30);
    localParts.push(local, data);

    const central = new Uint8Array(46 + nameBytes.length);
    const centralView = new DataView(central.buffer);
    write32(centralView, 0, 0x02014b50); write16(centralView, 4, 20); write16(centralView, 6, 20); write16(centralView, 8, 0x0800); write16(centralView, 10, 0);
    write32(centralView, 16, checksum); write32(centralView, 20, data.length); write32(centralView, 24, data.length); write16(centralView, 28, nameBytes.length); write32(centralView, 42, offset);
    central.set(nameBytes, 46);
    centralParts.push(central);
    offset += local.length + data.length;
  });

  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  write32(endView, 0, 0x06054b50); write16(endView, 8, centralParts.length); write16(endView, 10, centralParts.length);
  write32(endView, 12, centralSize); write32(endView, 16, offset);
  return new Blob([...localParts, ...centralParts, end], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

function buildBatchWorkbook(item, draft) {
  const columns = getBatchColumnLabels(item);
  const lastColumn = excelColumnName(columns.length - 1);
  const widths = columns.map((_, index) => index === 1 ? 45 : index === 0 ? 14 : index === columns.length - 1 ? 24 : 22);
  const cell = (reference, value, style = 0) => `<c r="${reference}" t="inlineStr"${style ? ` s="${style}"` : ''}><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`;
  const headerCells = columns.map((label, index) => cell(`${excelColumnName(index)}4`, label, 2)).join('');
  const achievementNames = { excellent: '매우 우수', good: '우수', steady: '보통', growth: '성장 중' };
  const filledRows = Array.from({ length: 40 }, (_, rowIndex) => {
    const rowNumber = rowIndex + 5;
    const row = draft.rows[rowIndex];
    const values = row
      ? [
          row.localLabel,
          row.evidence,
          ...item.optionalFields.map(field => row.optional[field.id] || ''),
          achievementNames[row.achievement] || '',
          ...(getSubjectCompetencies(item).length ? [normalizeBatchCompetencies(row.competencies, item)] : [])
        ]
      : Array(columns.length).fill('');
    return `<row r="${rowNumber}" ht="42" customHeight="1">${values.map((value, columnIndex) => cell(`${excelColumnName(columnIndex)}${rowNumber}`, value, 3)).join('')}</row>`;
  }).join('');
  const achievementColumn = excelColumnName(columns.length - (getSubjectCompetencies(item).length ? 2 : 1));
  const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:${lastColumn}44"/><sheetViews><sheetView workbookViewId="0"><pane ySplit="4" topLeftCell="A5" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="15"/><cols>${widths.map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`).join('')}</cols><sheetData><row r="1" ht="28" customHeight="1">${cell('A1', `${getSubjectPath(item)} · ${item.name} 학급 입력 자료`, 1)}</row><row r="2" ht="30" customHeight="1">${cell('A2', '현재 화면의 입력 내용을 담았습니다. 5행부터 이어서 수정할 수 있으며 열 제목은 바꾸지 마세요.', 4)}</row><row r="4" ht="24" customHeight="1">${headerCells}</row>${filledRows}</sheetData><autoFilter ref="A4:${lastColumn}44"/><mergeCells count="2"><mergeCell ref="A1:${lastColumn}1"/><mergeCell ref="A2:${lastColumn}2"/></mergeCells><dataValidations count="1"><dataValidation type="list" allowBlank="1" showErrorMessage="1" sqref="${achievementColumn}5:${achievementColumn}44"><formula1>"매우 우수,우수,보통,성장 중"</formula1></dataValidation></dataValidations></worksheet>`;
  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="3"><font><sz val="10"/><name val="맑은 고딕"/></font><font><b/><sz val="15"/><color rgb="FFFFFFFF"/><name val="맑은 고딕"/></font><font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="맑은 고딕"/></font></fonts><fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF246F4F"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFEAF3EE"/></patternFill></fill></fills><borders count="2"><border/><border><left style="thin"><color rgb="FFD9E4DC"/></left><right style="thin"><color rgb="FFD9E4DC"/></right><top style="thin"><color rgb="FFD9E4DC"/></top><bottom style="thin"><color rgb="FFD9E4DC"/></bottom></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="5"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center"/></xf><xf numFmtId="0" fontId="2" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf><xf numFmtId="0" fontId="0" fillId="3" borderId="0" xfId="0" applyFill="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
  return makeZip({
    '[Content_Types].xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`,
    '_rels/.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    'xl/workbook.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="학생 수행 정보" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    'xl/_rels/workbook.xml.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    'xl/styles.xml': styles,
    'xl/worksheets/sheet1.xml': sheet
  });
}

function downloadBatchTemplate() {
  const item = assessments.find(assessment => assessment.id === $('#batchAssessmentSelect').value);
  if (!item) return showToast('수행평가를 먼저 선택해 주세요.');
  const draft = getBatchDraft(item);
  const blob = buildBatchWorkbook(item, draft);
  const link = document.createElement('a');
  const safeName = item.name.replace(/[\\/:*?"<>|]/g, '').slice(0, 40) || '수행평가';
  link.href = URL.createObjectURL(blob);
  link.download = `${safeName}_학급입력자료.xlsx`;
  const downloadUrl = link.href;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
  showToast('현재 학급 입력 내용을 포함한 엑셀 파일을 만들었습니다.');
}

async function unzipWorkbook(buffer) {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  let endOffset = -1;
  for (let index = bytes.length - 22; index >= Math.max(0, bytes.length - 65557); index -= 1) {
    if (view.getUint32(index, true) === 0x06054b50) { endOffset = index; break; }
  }
  if (endOffset < 0) throw new Error('zip-end');
  const entries = {};
  const count = view.getUint16(endOffset + 10, true);
  let offset = view.getUint32(endOffset + 16, true);
  const decoder = new TextDecoder();
  for (let index = 0; index < count; index += 1) {
    if (view.getUint32(offset, true) !== 0x02014b50) throw new Error('zip-central');
    const method = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localOffset = view.getUint32(offset + 42, true);
    const name = decoder.decode(bytes.slice(offset + 46, offset + 46 + nameLength));
    const localNameLength = view.getUint16(localOffset + 26, true);
    const localExtraLength = view.getUint16(localOffset + 28, true);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const compressed = bytes.slice(dataStart, dataStart + compressedSize);
    if (method === 0) entries[name] = compressed;
    else if (method === 8) {
      const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
      entries[name] = new Uint8Array(await new Response(stream).arrayBuffer());
    }
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

function workbookRowsFromXml(entries, evidenceLabel = DEFAULT_EVIDENCE_LABEL) {
  const decoder = new TextDecoder();
  const sheetBytes = entries['xl/worksheets/sheet1.xml'];
  if (!sheetBytes) throw new Error('sheet-missing');
  const parse = text => new DOMParser().parseFromString(text, 'application/xml');
  const sheet = parse(decoder.decode(sheetBytes));
  if (sheet.querySelector('parsererror')) throw new Error('sheet-xml');
  const shared = entries['xl/sharedStrings.xml']
    ? [...parse(decoder.decode(entries['xl/sharedStrings.xml'])).querySelectorAll('si')].map(node => node.textContent || '')
    : [];
  const rows = [...sheet.querySelectorAll('sheetData > row')].map(row => {
    const values = [];
    row.querySelectorAll('c').forEach(cell => {
      const reference = cell.getAttribute('r') || 'A1';
      const letters = reference.match(/[A-Z]+/i)?.[0]?.toUpperCase() || 'A';
      let column = 0;
      for (const letter of letters) column = column * 26 + letter.charCodeAt(0) - 64;
      const type = cell.getAttribute('t');
      const raw = type === 'inlineStr' ? (cell.querySelector('is')?.textContent || '') : (cell.querySelector('v')?.textContent || '');
      values[column - 1] = type === 's' ? (shared[Number(raw)] || '') : raw;
    });
    return values.map(value => String(value ?? '').trim());
  });
  const headerIndex = rows.findIndex(row => isBatchHeaderRow(row, evidenceLabel));
  if (headerIndex < 0) throw new Error('header-missing');
  return rows.slice(headerIndex + 1).filter(row => row.some(value => value.trim())).slice(0, 40);
}

function createBatchTextControl(value, placeholder, onInput, multiline = true) {
  const control = multiline ? document.createElement('textarea') : document.createElement('input');
  control.value = value;
  control.placeholder = placeholder;
  if (multiline) control.rows = 3;
  control.addEventListener('input', event => onInput(event.target.value));
  return control;
}

function saveBatchHeaderLabel(item, fieldId, value) {
  const label = clean(value).slice(0, 40);
  if (!label) {
    showToast('항목 이름을 입력해 주세요.');
    return false;
  }

  const field = fieldId ? item.optionalFields.find(candidate => candidate.id === fieldId) : null;
  if (fieldId && !field) return false;
  const previousLabel = field ? field.label : item.evidenceLabel;
  if (label === previousLabel) {
    renderBatchTable(item, getBatchDraft(item));
    return true;
  }

  const otherLabels = [
    ...(fieldId ? [item.evidenceLabel] : []),
    ...item.optionalFields.filter(candidate => candidate.id !== fieldId).map(candidate => candidate.label)
  ];
  if (otherLabels.includes(label)) {
    showToast('필수 항목과 선택 항목의 이름은 서로 다르게 입력해 주세요.');
    return false;
  }

  const previousUpdatedAt = item.updatedAt;
  if (field) field.label = label;
  else item.evidenceLabel = label;
  item.updatedAt = new Date().toISOString();
  if (!saveAssessments()) {
    if (field) field.label = previousLabel;
    else item.evidenceLabel = previousLabel;
    item.updatedAt = previousUpdatedAt;
    return false;
  }

  if ($('#assessmentSelect').value === item.id) renderSelectedAssessment();
  $('#batchOfflineEmpty').textContent = `‘${item.evidenceLabel}’ 항목을 입력한 뒤 보조 초안을 만들 수 있습니다.`;
  updateBatchPasteGuide(item);
  resetBatchOffline();
  const draft = getBatchDraft(item);
  renderBatchTable(item, draft);
  renderBatchChunks(item, draft);
  showToast(`항목 이름을 ‘${label}’로 수정했습니다.`);
  return true;
}

function appendBatchEditableHeader(headRow, item, fieldId = '') {
  const field = fieldId ? item.optionalFields.find(candidate => candidate.id === fieldId) : null;
  const label = field ? field.label : item.evidenceLabel;
  const th = document.createElement('th');
  th.className = 'batch-editable-heading';
  const openEditor = document.createElement('button');
  openEditor.type = 'button';
  openEditor.className = 'batch-heading-open';
  openEditor.title = '클릭하여 항목 이름 수정';
  openEditor.setAttribute('aria-label', `${label} 항목 이름 수정`);
  const text = document.createElement('span');
  text.textContent = field ? label : `${label}(필수)`;
  const editIcon = document.createElement('i');
  editIcon.textContent = '✎';
  editIcon.setAttribute('aria-hidden', 'true');
  openEditor.append(text, editIcon);

  openEditor.addEventListener('click', () => {
    th.classList.add('is-editing');
    const editor = document.createElement('div');
    editor.className = 'batch-heading-editor';
    const input = document.createElement('input');
    input.type = 'text';
    input.maxLength = 40;
    input.value = label;
    input.setAttribute('aria-label', `${label} 항목 이름`);
    const confirmButton = document.createElement('button');
    confirmButton.type = 'button';
    confirmButton.className = 'batch-heading-confirm';
    confirmButton.title = '수정 내용 저장';
    confirmButton.setAttribute('aria-label', '수정 내용 저장');
    confirmButton.textContent = '✓';
    const closeEditor = () => {
      document.removeEventListener('pointerdown', closeWhenClickingOutside);
      th.classList.remove('is-editing');
      th.replaceChildren(openEditor);
    };
    const closeWhenClickingOutside = event => {
      if (!th.contains(event.target)) closeEditor();
    };
    confirmButton.addEventListener('click', () => {
      document.removeEventListener('pointerdown', closeWhenClickingOutside);
      if (!saveBatchHeaderLabel(item, fieldId, input.value)) {
        document.addEventListener('pointerdown', closeWhenClickingOutside);
      }
    });
    input.addEventListener('keydown', event => {
      if (event.key === 'Escape') closeEditor();
      if (event.key === 'Enter') event.preventDefault();
    });
    editor.append(input, confirmButton);
    th.replaceChildren(editor);
    input.focus();
    input.select();
    setTimeout(() => document.addEventListener('pointerdown', closeWhenClickingOutside), 0);
  });

  th.append(openEditor);
  headRow.append(th);
}
function renderBatchTable(item, draft) {
  const container = $('#batchTableContainer');
  const table = document.createElement('table');
  table.className = 'batch-table';
  const head = document.createElement('thead');
  const headRow = document.createElement('tr');
  const appendFixedHeader = label => {
    const th = document.createElement('th');
    th.textContent = label;
    headRow.append(th);
  };
  appendFixedHeader('번호 / 구분(수정 가능)');
  appendBatchEditableHeader(headRow, item);
  item.optionalFields.forEach(field => appendBatchEditableHeader(headRow, item, field.id));
  appendFixedHeader('성취 수준');
  if (getSubjectCompetencies(item).length) appendFixedHeader('핵심역량(선택)');
  appendFixedHeader('삭제');
  head.append(headRow);
  table.append(head);

  const body = document.createElement('tbody');
  draft.rows.forEach((row, rowIndex) => {
    const tr = document.createElement('tr');
    const labelCell = document.createElement('td');
    labelCell.className = 'batch-label-cell';
    const labelInput = createBatchTextControl(row.localLabel, '번호 또는 구분', value => {
      row.localLabel = value;
      saveBatchDrafts();
    }, false);
    labelCell.append(labelInput);
    tr.append(labelCell);

    const evidenceCell = document.createElement('td');
    evidenceCell.className = 'evidence-cell';
    evidenceCell.append(createBatchTextControl(row.evidence, `${item.evidenceLabel} 내용을 입력하세요.`, value => {
      row.evidence = value;
      saveBatchDrafts();
      renderBatchChunks(item, draft);
    }));
    tr.append(evidenceCell);

    item.optionalFields.forEach(field => {
      const td = document.createElement('td');
      td.append(createBatchTextControl(row.optional[field.id] || '', field.label, value => {
        row.optional[field.id] = value;
        saveBatchDrafts();
        renderBatchChunks(item, draft);
      }));
      tr.append(td);
    });

    const achievementCell = document.createElement('td');
    const achievement = document.createElement('select');
    [['', '선택 안 함'], ['excellent', '매우 우수'], ['good', '우수'], ['steady', '보통'], ['growth', '성장 중']].forEach(([value, label]) => achievement.add(new Option(label, value)));
    achievement.value = row.achievement;
    achievement.addEventListener('change', event => {
      row.achievement = event.target.value;
      saveBatchDrafts();
      renderBatchChunks(item, draft);
    });
    achievementCell.append(achievement);
    tr.append(achievementCell);

    const subjectCompetencies = getSubjectCompetencies(item);
    if (subjectCompetencies.length) {
      const competencyCell = document.createElement('td');
      const competencyPicker = document.createElement('div');
      competencyPicker.className = 'batch-competency-picker';
      const selectedCompetencies = new Set(normalizeBatchCompetencies(row.competencies, item).split(', ').filter(Boolean));
      subjectCompetencies.forEach(competency => {
        const label = document.createElement('label');
        const input = document.createElement('input');
        const text = document.createElement('span');
        input.type = 'checkbox';
        input.value = competency.label;
        input.checked = selectedCompetencies.has(competency.label);
        text.textContent = shortCompetencyLabel(competency.label);
        input.title = competency.description;
        input.addEventListener('change', () => {
          row.competencies = [...competencyPicker.querySelectorAll('input:checked')].map(control => control.value).join(', ');
          saveBatchDrafts();
          renderBatchChunks(item, draft);
        });
        label.append(input, text);
        competencyPicker.append(label);
      });
      competencyCell.append(competencyPicker);
      tr.append(competencyCell);
    }

    const deleteCell = document.createElement('td');
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'batch-delete-row';
    remove.title = '이 학생 행 삭제';
    remove.setAttribute('aria-label', `${rowIndex + 1}번째 학생 행 삭제`);
    remove.textContent = '×';
    remove.addEventListener('click', () => {
      if (row.evidence.trim() && !confirm(`${row.localLabel || rowIndex + 1} 학생의 입력 내용을 삭제할까요?`)) return;
      draft.rows.splice(rowIndex, 1);
      if (!draft.rows.length) draft.rows.push(createBatchRow(0));
      saveBatchDrafts();
      renderBatchTable(item, draft);
      renderBatchChunks(item, draft);
    });
    deleteCell.append(remove);
    tr.append(deleteCell);
    body.append(tr);
  });
  table.append(body);
  container.replaceChildren(table);
}

function setBatchCompetenciesForAll(clear = false) {
  const item = assessments.find(assessment => assessment.id === $('#batchAssessmentSelect').value);
  if (!item) return showToast('수행평가를 먼저 선택해 주세요.');

  const selected = clear
    ? []
    : $$('#batchBulkCompetencies input:checked').map(input => input.value);
  if (!clear && !selected.length) return showToast('전체 적용할 강조 역량을 하나 이상 선택해 주세요.');

  const draft = getBatchDraft(item);
  const competencies = selected.join(', ');
  draft.rows.forEach(row => { row.competencies = competencies; });
  saveBatchDrafts();
  renderBatchTable(item, draft);
  renderBatchChunks(item, draft);

  if (clear) {
      renderBatchCompetencyControls(item);
    showToast('모든 학생의 강조 역량을 해제했습니다.');
    return;
  }
  showToast(`선택한 ${selected.length}개 역량을 현재 표의 ${draft.rows.length}명에게 적용했습니다.`);
}

function achievementFromText(text) {
  const value = clean(text || '');
  const map = { '매우 우수': 'excellent', '우수': 'good', '보통': 'steady', '성장 중': 'growth', excellent: 'excellent', good: 'good', steady: 'steady', growth: 'growth' };
  return map[value] || '';
}

function applyBatchPaste() {
  const item = assessments.find(assessment => assessment.id === $('#batchAssessmentSelect').value);
  const raw = $('#batchPasteInput').value.trim();
  if (!item) return showToast('수행평가를 먼저 선택해 주세요.');
  if (!raw) return showToast('엑셀에서 복사한 내용을 붙여넣어 주세요.');
  const lines = raw.split(/\r?\n/).filter(line => line.trim());
  let rows = lines.map(line => line.split('\t'));
  if (isBatchHeaderRow(rows[0], item.evidenceLabel)) rows = rows.slice(1);
  if (replaceBatchRows(item, rows, '붙여넣은 표')) $('#batchPasteInput').value = '';
}

function replaceBatchRows(item, rows, sourceName) {
  if (!rows.length) { showToast('반영할 학생 자료가 없습니다.'); return false; }
  const draft = getBatchDraft(item);
  if (draft.rows.some(row => row.evidence.trim()) && !confirm('현재 학급 입력 내용을 새로 불러온 자료로 바꿀까요?')) return false;

  draft.rows = rows.map((cells, index) => {
    const singleColumn = cells.length === 1;
    const row = createBatchRow(index);
    row.localLabel = singleColumn ? String(index + 1) : (cells[0]?.trim() || String(index + 1));
    row.evidence = (singleColumn ? cells[0] : cells[1])?.trim() || '';
    const optionalStart = singleColumn ? 1 : 2;
    item.optionalFields.forEach((field, fieldIndex) => { row.optional[field.id] = cells[optionalStart + fieldIndex]?.trim() || ''; });
    row.achievement = achievementFromText(cells[optionalStart + item.optionalFields.length] || '');
    row.competencies = getSubjectCompetencies(item).length ? normalizeBatchCompetencies(cells[optionalStart + item.optionalFields.length + 1], item) : '';
    return row;
  });
  saveBatchDrafts();
  renderBatchTable(item, draft);
  renderBatchChunks(item, draft);
  const tablePanel = $('.batch-direct-panel');
  tablePanel.classList.remove('batch-data-updated');
  requestAnimationFrame(() => tablePanel.classList.add('batch-data-updated'));
  tablePanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  showToast(`${sourceName}에서 ${draft.rows.length}명의 자료를 반영했습니다.`);
  return true;
}

async function importBatchWorkbook(file) {
  const item = assessments.find(assessment => assessment.id === $('#batchAssessmentSelect').value);
  if (!item) return showToast('수행평가를 먼저 선택해 주세요.');
  if (!file) return;
  if (!/\.xlsx$/i.test(file.name)) return showToast('.xlsx 형식의 엑셀 파일을 선택해 주세요.');
  if (file.size > 5 * 1024 * 1024) return showToast('엑셀 파일은 5MB 이하만 불러올 수 있습니다.');
  try {
    const entries = await unzipWorkbook(await file.arrayBuffer());
    const rows = workbookRowsFromXml(entries, item.evidenceLabel);
    replaceBatchRows(item, rows, '엑셀 파일');
  } catch {
    showToast('양식의 열 제목을 확인하거나 새 양식을 다시 받아 주세요.');
  } finally {
    $('#batchWorkbookInput').value = '';
  }
}

function getFilledBatchRows(draft) {
  return draft.rows.map((row, index) => ({
    row,
    studentNumber: index + 1,
    studentLabel: formatBatchStudentLabel(row.localLabel, index + 1)
  })).filter(entry => entry.row.evidence.trim());
}

function formatBatchStudentLabel(localLabel, fallbackNumber) {
  let label = String(localLabel || '').trim() || String(fallbackNumber);
  label = label.replace(/^학생\s*/u, '').trim();
  if (/^\d+$/u.test(label)) label = label.padStart(2, '0');
  return `학생 ${label}`;
}

function resetBatchOffline() {
  $('#batchOfflineResult').value = '';
  $('#batchOfflineResult').dataset.students = '0';
  $('#batchOfflineResultArea').classList.add('hidden');
  $('#batchOfflineEmpty').classList.remove('hidden');
  updateBatchOfflineCount();
}

function updateBatchOfflineCount() {
  const result = $('#batchOfflineResult');
  const students = Number(result.dataset.students || 0);
  const text = result.value;
  $('#batchOfflineCount').textContent = `${students}명 · ${text.length}자 · ${new TextEncoder().encode(text).length}바이트`;
}

function generateBatchOfflineDrafts() {
  const item = assessments.find(assessment => assessment.id === $('#batchAssessmentSelect').value);
  if (!item) return showToast('수행평가를 먼저 선택해 주세요.');
  const draft = getBatchDraft(item);
  const entries = getFilledBatchRows(draft);
  if (!entries.length) return showToast(`‘${item.evidenceLabel}’ 항목을 한 명 이상 입력해 주세요.`);
  const previousVariant = variant;
  const records = entries.map(({ row, studentLabel }, index) => {
    variant = index;
    const fieldEntries = item.optionalFields.map(field => ({
      ...field,
      value: String(row.optional[field.id] || '').trim()
    }));
    const competencies = getSubjectCompetencies(item)
      .filter(competency => row.competencies.includes(competency.label))
      .map(competency => competency.key);
    const record = composeOfflineRecord({
      item,
      evidence: row.evidence.trim(),
      fieldEntries,
      competencies,
      achievement: row.achievement,
      length: draft.length
    });
    return `[${studentLabel}]\n${record}`;
  });
  variant = previousVariant;
  const result = $('#batchOfflineResult');
  result.value = records.join('\n\n');
  result.dataset.students = String(entries.length);
  $('#batchOfflineEmpty').classList.add('hidden');
  $('#batchOfflineResultArea').classList.remove('hidden');
  updateBatchOfflineCount();
  showToast(`${entries.length}명의 오프라인 보조 초안을 만들었습니다.`);
}

function buildBatchPrompt(item, entries, draft) {
  const achievementNames = { excellent: '매우 우수', good: '우수', steady: '보통', growth: '성장 중' };
  const lengthNames = { short: '약 150자', medium: '약 250자', long: '약 450자' };
  const standards = item.standards.map(code => {
    const standard = ACHIEVEMENT_STANDARDS[item.subject]?.find(entry => entry.code === code);
    return standard ? `[${standard.code}] ${standard.text}` : '';
  }).filter(Boolean).join('\n');
  const studentBlocks = entries.map(({ row, studentLabel }) => {
    const optionalLines = item.optionalFields
      .filter(field => (row.optional[field.id] || '').trim())
      .map(field => `- ${field.label}: ${row.optional[field.id].trim()}`)
      .join('\n');
    const competencyLine = getSubjectCompetencies(item).length
      ? `- 강조할 ${SUBJECT_PROFILES[getSubjectArea(item)].label} 핵심역량: ${row.competencies.trim() || '선택하지 않음'}\n`
      : '';
    return `## ${studentLabel}\n- ${item.evidenceLabel}: ${row.evidence.trim()}\n${optionalLines ? `${optionalLines}\n` : ''}- 성취 수준: ${achievementNames[row.achievement] || '선택하지 않음'}\n${competencyLine}- 희망 분량: ${lengthNames[draft.length]}`;
  }).join('\n\n');
  const outputLabels = entries.map(({ studentLabel }) => `[${studentLabel}]\n(완성된 세특 한 문단)`).join('\n\n');
  const styleReferenceContent = draft.styleReference.trim()
    ? `# 문체 기준 잠금\n아래 문장은 문장 길이, 어조, 구성만 참고하는 예시입니다. 예시 속 학생의 행동·성과·주제·수치 등 내용은 이번 학생들에게 절대 옮기지 마세요.\n\n${draft.styleReference.trim()}\n`
    : `# 문체 기준 잠금\n모든 학생에게 품격 있는 교사 관찰 문체, 현재형 명사형 종결(~함·~음·~임), 비슷한 문장 밀도와 완성도를 일관되게 적용하세요.\n`;
  const styleReference = `${buildPromptFocusSection(item)}${styleReferenceContent}`;

  const subjectLabel = SUBJECT_PROFILES[getSubjectArea(item)]?.label || '교과';
  return `# 역할\n한국 고등학교 ${getSubjectWritingProfile(item).role}의 관점에서 아래 학생별 원본 자료를 바탕으로 교과세부능력 및 특기사항을 작성하세요.\n\n# 수행평가 공통 정보\n- 과목: ${getSubjectPath(item)}\n- 수행평가명: ${item.name}\n- 수행평가 활동: ${item.activity}\n\n# 성취기준 — 내부 참고용\n${standards || '등록된 성취기준 없음'}\n\n${buildWritingGuide(item)}\n\n${styleReference}\n# 학급 일괄 작성 추가 규칙\n1. 각 학생을 서로 완전히 독립된 기록으로 처리하고 다른 학생의 행동·평가·주제를 섞지 마세요.\n2. 앞 학생과 뒤 학생의 글자 수, 문장 밀도, 문체 완성도를 같은 기준으로 유지하세요. 뒤쪽 학생을 더 짧게 쓰거나 형식을 생략하지 마세요.\n3. 문체 기준 예시는 문장 길이·어조·구성만 참고하고, 예시 속 학생의 행동·성과·주제·수치 등 내용은 옮기지 마세요.\n4. 설명, 제목, 작성 이유 없이 학생별 완성 문단만 출력하세요.\n5. 학생 식별 번호는 원본 자료에 표시된 번호를 그대로 유지하고, 결번이 있어도 순서대로 다시 번호를 매기지 마세요.\n\n# 학생별 원본 자료\n${studentBlocks}\n\n# 출력 형식\n아래 학생 번호와 순서를 정확히 지키고 모든 학생을 빠짐없이 출력하세요.\n\n${outputLabels}\n\n출력 전에 사실 추가 여부, 학생 간 정보 혼합, 학생 번호 유지, 뒤쪽 학생 분량 축소, 금지 주어, 관찰 불가능한 표현, 종결 어미, 성취기준 노출, 문체 변화, 형식 누락이 없는지 점검하세요.`;
}

function renderBatchChunks(item, draft) {
  const container = $('#batchChunkList');
  container.replaceChildren();
  const filled = getFilledBatchRows(draft);
  if (!filled.length) {
    const empty = document.createElement('div');
    empty.className = 'batch-chunk-empty';
    empty.textContent = `‘${item.evidenceLabel}’ 항목을 입력하면 5명 단위 복사 버튼이 만들어집니다.`;
    container.append(empty);
    return;
  }

  for (let index = 0; index < filled.length; index += 5) {
    const entries = filled.slice(index, index + 5);
    const card = document.createElement('article');
    card.className = 'batch-chunk-card';
    const header = document.createElement('header');
    const title = document.createElement('strong');
    title.textContent = `학생 ${entries.map(entry => entry.studentLabel.replace(/^학생\s*/u, '')).join(', ')}`;
    const status = document.createElement('small');
    status.textContent = `${entries.length}명 · ${draft.styleReference.trim() ? '문체 잠금 적용' : '기본 문체'}`;
    header.append(title, status);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'prompt-button';
    button.innerHTML = '<span>✦</span> 새 AI 대화방용 프롬프트 복사';
    button.addEventListener('click', async () => {
      await copyText(buildBatchPrompt(item, entries, draft));
      showToast(`${title.textContent} 묶음 프롬프트를 복사했습니다. 새 AI 대화방에 붙여넣으세요.`);
    });
    card.append(header, button);
    container.append(card);
  }
}

function updateStyleLockStatus(draft) {
  $('#styleLockStatus').textContent = draft.styleReference.trim()
    ? '문체 기준이 잠겼습니다. 모든 묶음 프롬프트에 같은 기준이 포함됩니다.'
    : '기준 문장이 없으면 모든 묶음에 동일한 기본 문체 규칙이 적용됩니다.';
}

$('#batchAssessmentSelect').addEventListener('change', renderBatchAssessment);
$('#batchLength').addEventListener('change', event => {
  const item = assessments.find(assessment => assessment.id === $('#batchAssessmentSelect').value);
  if (!item) return;
  const draft = getBatchDraft(item);
  draft.length = event.target.value;
  saveBatchDrafts();
  renderBatchChunks(item, draft);
});

let batchPromptFocusSaveTimer = null;
$('#batchPromptFocus').addEventListener('input', event => {
  const item = assessments.find(assessment => assessment.id === $('#batchAssessmentSelect').value);
  if (!item) return;
  item.promptFocus = normalizePromptFocus(event.target.value);
  if ($('#editingId').value === item.id) $('#assessmentPromptFocus').value = event.target.value;
  const draft = getBatchDraft(item);
  renderBatchChunks(item, draft);
  $('#batchPromptFocusStatus').textContent = '묶음 프롬프트에 즉시 반영됨 · 수행평가에 저장하는 중입니다.';
  window.clearTimeout(batchPromptFocusSaveTimer);
  batchPromptFocusSaveTimer = window.setTimeout(() => {
    if (!saveAssessments()) return;
    renderAssessmentList();
    if ($('#batchAssessmentSelect').value === item.id) {
      $('#batchPromptFocusStatus').textContent = '수행평가 등록 내용에 저장되었습니다. 묶음 프롬프트를 다시 복사하세요.';
    }
  }, 450);
});

$('#batchStyleReference').addEventListener('input', event => {
  const item = assessments.find(assessment => assessment.id === $('#batchAssessmentSelect').value);
  if (!item) return;
  const draft = getBatchDraft(item);
  draft.styleReference = event.target.value;
  saveBatchDrafts();
  updateStyleLockStatus(draft);
  renderBatchChunks(item, draft);
});
$('#addBatchStudent').addEventListener('click', () => {
  const item = assessments.find(assessment => assessment.id === $('#batchAssessmentSelect').value);
  if (!item) return showToast('수행평가를 먼저 선택해 주세요.');
  const draft = getBatchDraft(item);
  if (draft.rows.length >= 40) return showToast('한 학급은 최대 40명까지 입력할 수 있습니다.');
  draft.rows.push(createBatchRow(draft.rows.length));
  saveBatchDrafts();
  renderBatchTable(item, draft);
  renderBatchChunks(item, draft);
});
$('#addFiveBatchRows').addEventListener('click', () => {
  const item = assessments.find(assessment => assessment.id === $('#batchAssessmentSelect').value);
  if (!item) return showToast('수행평가를 먼저 선택해 주세요.');
  const draft = getBatchDraft(item);
  const addCount = Math.min(5, 40 - draft.rows.length);
  if (addCount <= 0) return showToast('한 학급은 최대 40명까지 입력할 수 있습니다.');
  const startIndex = draft.rows.length;
  draft.rows.push(...Array.from({ length: addCount }, (_, index) => createBatchRow(startIndex + index)));
  saveBatchDrafts();
  renderBatchTable(item, draft);
  renderBatchChunks(item, draft);
  showToast(`표 아래에 빈 행 ${addCount}개를 추가했습니다.`);
});
$('#clearBatchStudents').addEventListener('click', () => {
  const item = assessments.find(assessment => assessment.id === $('#batchAssessmentSelect').value);
  if (!item) return showToast('수행평가를 먼저 선택해 주세요.');
  const draft = getBatchDraft(item);
  const confirmed = confirm(`‘${item.name}’ 수행평가의 학생 입력 내용을 모두 삭제할까요?\n\n다른 수행평가의 학급 자료와 현재 분량·문체 기준은 유지됩니다.`);
  if (!confirmed) return;
  const previousRows = draft.rows;
  draft.rows = createDefaultBatchRows();
  if (!saveBatchDrafts()) {
    draft.rows = previousRows;
    return;
  }
  $('#batchPasteInput').value = '';
    renderBatchCompetencyControls(item);
  resetBatchOffline();
  renderBatchTable(item, draft);
  renderBatchChunks(item, draft);
  showToast(`‘${item.name}’ 수행평가의 학급 입력 내용을 모두 삭제했습니다.`);
});
$('#applyBatchPaste').addEventListener('click', applyBatchPaste);
$('#applyBulkCompetencies')?.addEventListener('click', () => setBatchCompetenciesForAll(false));
$('#clearBulkCompetencies')?.addEventListener('click', () => setBatchCompetenciesForAll(true));
$('#downloadBatchTemplate').addEventListener('click', downloadBatchTemplate);
$('#uploadBatchWorkbook').addEventListener('click', () => $('#batchWorkbookInput').click());
$('#batchWorkbookInput').addEventListener('change', event => importBatchWorkbook(event.target.files?.[0]));
$('#generateBatchOffline').addEventListener('click', generateBatchOfflineDrafts);
$('#batchOfflineResult').addEventListener('input', updateBatchOfflineCount);
$('#copyBatchOffline').addEventListener('click', async () => {
  const text = $('#batchOfflineResult').value.trim();
  if (!text) return showToast('먼저 오프라인 보조 초안을 만들어 주세요.');
  await copyText(text);
  showToast('학급 오프라인 보조 초안 전체를 복사했습니다.');
});


const batchTipModal = $('#batchTipModal');
const batchTipSlides = $$('.batch-tip-slide');
const batchTipDots = [];
let batchTipStep = 0;
let batchTipReturnFocus = null;
let batchTipAutoShown = false;

function getBatchTipDismissed() {
  try { return localStorage.getItem(BATCH_TIP_STORAGE_KEY) === '1'; }
  catch { return false; }
}

function saveBatchTipPreference() {
  try {
    if ($('#batchTipDontShow').checked) localStorage.setItem(BATCH_TIP_STORAGE_KEY, '1');
    else localStorage.removeItem(BATCH_TIP_STORAGE_KEY);
  } catch {}
}

function setBatchTipStep(nextStep) {
  batchTipStep = Math.max(0, Math.min(batchTipSlides.length - 1, nextStep));
  $('#batchTipTrack').style.transform = `translateX(-${batchTipStep * 100}%)`;
  $('#batchTipStepLabel').textContent = `${batchTipStep + 1} / ${batchTipSlides.length}`;
  batchTipSlides.forEach((slide, index) => slide.setAttribute('aria-hidden', String(index !== batchTipStep)));
  batchTipDots.forEach((dot, index) => {
    dot.classList.toggle('active', index === batchTipStep);
    dot.setAttribute('aria-current', index === batchTipStep ? 'step' : 'false');
  });
  $('#batchTipPrev').disabled = batchTipStep === 0;
  $('#batchTipNext').textContent = batchTipStep === batchTipSlides.length - 1 ? '학급 입력 시작' : '다음';
}

function openBatchTip() {
  batchTipReturnFocus = document.activeElement;
  $('#batchTipDontShow').checked = getBatchTipDismissed();
  setBatchTipStep(0);
  batchTipModal.classList.remove('hidden');
  document.body.classList.add('modal-open');
  $('#closeBatchTip').focus();
}

function closeBatchTip() {
  saveBatchTipPreference();
  batchTipModal.classList.add('hidden');
  document.body.classList.remove('modal-open');
  batchTipReturnFocus?.focus();
}

function maybeOpenBatchTip() {
  if (batchTipAutoShown || getBatchTipDismissed()) return;
  batchTipAutoShown = true;
  window.setTimeout(() => {
    if ($('#batchView').classList.contains('active')) openBatchTip();
  }, 220);
}

batchTipSlides.forEach((_, index) => {
  const dot = document.createElement('button');
  dot.type = 'button';
  dot.className = 'batch-tip-dot';
  dot.setAttribute('aria-label', `${index + 1}단계 보기`);
  dot.addEventListener('click', () => setBatchTipStep(index));
  $('#batchTipDots').append(dot);
  batchTipDots.push(dot);
});
setBatchTipStep(0);

$('#openBatchTip').addEventListener('click', openBatchTip);
$('#closeBatchTip').addEventListener('click', closeBatchTip);
$('#batchTipBackdrop').addEventListener('click', closeBatchTip);
$('#batchTipPrev').addEventListener('click', () => setBatchTipStep(batchTipStep - 1));
$('#batchTipNext').addEventListener('click', () => {
  if (batchTipStep === batchTipSlides.length - 1) closeBatchTip();
  else setBatchTipStep(batchTipStep + 1);
});

const helpModal = $('#helpModal');
let helpReturnFocus = null;

function openHelp() {
  helpReturnFocus = document.activeElement;
  helpModal.classList.remove('hidden');
  document.body.classList.add('modal-open');
  $('#closeHelp').focus();
}

function closeHelp() {
  helpModal.classList.add('hidden');
  document.body.classList.remove('modal-open');
  helpReturnFocus?.focus();
}

$('#helpButton')?.addEventListener('click', openHelp);
$('#openGuideTop')?.addEventListener('click', openHelp);
$('#openGuideInline')?.addEventListener('click', openHelp);
$('#closeHelp').addEventListener('click', closeHelp);
$('#dismissHelp').addEventListener('click', closeHelp);
$('#helpBackdrop').addEventListener('click', closeHelp);
document.addEventListener('keydown', event => {
  if (!batchTipModal.classList.contains('hidden')) {
    if (event.key === 'Escape') closeBatchTip();
    if (event.key === 'ArrowLeft') setBatchTipStep(batchTipStep - 1);
    if (event.key === 'ArrowRight') setBatchTipStep(batchTipStep + 1);
    return;
  }
  if (event.key === 'Escape' && !helpModal.classList.contains('hidden')) closeHelp();
});

renderSubjectAreas();
renderSubjectCourses(DEFAULT_SUBJECT_AREA);
renderAssessmentList();
renderAssessmentSelect();
renderBatchAssessmentSelect();
renderOptionalFieldConfig();
renderStandards('');
window.setTimeout(() => {
  createRecoverySnapshot('앱 시작 시 자동 보관', true);
  updateDataSafetyStatus();
}, 0);
