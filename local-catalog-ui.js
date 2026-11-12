const localDialog = $('#localCatalogPanel');
let editingLocalSubject = '';
function renderLocalCourses(selected = '') {
  const area = $('#localCatalogArea').value;
  const select = $('#localCatalogCourse');
  select.replaceChildren(new Option('새 과목 만들기', ''));
  (SUBJECT_PROFILES[area]?.courses || []).forEach(course => select.add(new Option(course.label, course.value)));
  select.value = selected;
}
function renderLocalEntries(selected = '') {
  const select = $('#localCatalogEntry');
  select.replaceChildren(new Option('새로 추가', ''));
  localCatalog.forEach(entry => select.add(new Option(`${SUBJECT_PROFILES[entry.area].label} / ${entry.subject} 수정·삭제`, entry.subject)));
  select.value = selected;
}
function loadLocalEntry() {
  editingLocalSubject = $('#localCatalogEntry').value;
  const entry = localCatalog.find(item => item.subject === editingLocalSubject);
  $('#localCatalogStatus').textContent = '';
  $('#localAreaName').value = '';
  $('#localAreaNameField').classList.add('hidden');
  $('#localCatalogArea').disabled = Boolean(entry);
  $('#localCatalogCourse').disabled = Boolean(entry);
  $('#deleteLocalCatalog').classList.toggle('hidden', !entry);
  if (entry) {
    $('#localCatalogArea').value = entry.area;
    renderLocalCourses(entry.subject);
    $('#localCourseName').value = Object.hasOwn(catalogBaseStandards, entry.subject) ? '' : entry.subject;
    $('#localCourseName').disabled = Object.hasOwn(catalogBaseStandards, entry.subject);
    $('#localStandardText').value = entry.standards.map(item => `[${localStandardDisplayCode(entry.subject, item.code)}] ${item.text}`).join('\n');
  } else {
    $('#localCourseName').disabled = false;
    $('#localCourseName').value = '';
    $('#localStandardText').value = '';
    renderLocalCourses($('#assessmentSubject').value);
  }
}
function localReferences() {
  // 저장하지 않은 입력창의 임시 선택은 사용 중인 자료로 취급하지 않는다.
  return assessments;
}

function refreshLocalSelection(area, subject, codes) {
  renderSubjectAreas(area);
  renderSubjectCourses(area, subject);
  renderStandards(subject, codes);
}
function openLocalCatalog(newArea = false) {
  $('#localCatalogArea').replaceChildren(...Object.entries(SUBJECT_PROFILES).map(([key, profile]) => new Option(profile.label, key)));
  $('#localCatalogArea').add(new Option('＋ 교과군 직접 입력', '__new_area__'));
  $('#localCatalogArea').value = $('#assessmentSubjectArea').value || DEFAULT_SUBJECT_AREA;
  renderLocalEntries();
  loadLocalEntry();
  if (newArea) {
    $('#localCatalogArea').value = '__new_area__';
    $('#localAreaNameField').classList.remove('hidden');
    renderLocalCourses();
  }
  localDialog.showModal();
}
$('#closeLocalCatalog').addEventListener('click', () => localDialog.close());
localDialog.addEventListener('click', event => { if (event.target === localDialog) {
  const rect = localDialog.getBoundingClientRect();
  if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) localDialog.close();
} });
$('#localCatalogEntry').addEventListener('change', loadLocalEntry);
$('#localCatalogArea').addEventListener('change', () => {
  $('#localAreaNameField').classList.toggle('hidden', $('#localCatalogArea').value !== '__new_area__');
  renderLocalCourses();
});
$('#saveLocalStandards').addEventListener('click', () => {
  const status = $('#localCatalogStatus');
  const areaName = $('#localAreaName').value.trim();
  const enteredArea = $('#localCatalogArea').value === '__new_area__';
  const existingArea = Object.keys(SUBJECT_PROFILES).find(key => SUBJECT_PROFILES[key].label === areaName);
  const area = enteredArea ? (existingArea || localAreaKey(areaName)) : $('#localCatalogArea').value;
  const areaLabel = enteredArea ? areaName : SUBJECT_PROFILES[area]?.label;
  const subject = $('#localCourseName').value.trim() || $('#localCatalogCourse').value;
  const lines = $('#localStandardText').value.split(/\r?\n/u).map(line => line.trim()).filter(Boolean);
  try {
    if ((enteredArea && (!areaName || areaName.length > 80)) || !area || !subject || !lines.length) throw new Error('교과군, 과목명, 성취기준을 입력해 주세요. 전체 삭제는 삭제 버튼을 사용하세요.');
    const existing = ACHIEVEMENT_STANDARDS[subject] || [];
    const usedCodes = new Set(existing.flatMap(item => [item.code, localStandardDisplayCode(subject, item.code)]));
    lines.forEach(line => { const match = line.match(/^\[([^\]]+)\]/u); if (match) usedCodes.add(match[1].trim()); });
    let autoNumber = 1;
    const standards = lines.map(line => {
      const match = line.match(/^\[([^\]]+)\]\s*(.+)$/u);
      if (line.startsWith('[') && !match) throw new Error('성취기준을 [코드] 내용 형식으로 입력해 주세요.');
      if (match) {
        const original = existing.find(item => localStandardDisplayCode(subject, item.code) === match[1].trim());
        return { code: original?.code || match[1], text: match[2] };
      }
      while (usedCodes.has(`직접-${autoNumber}`)) autoNumber++;
      const code = `직접-${autoNumber++}`;
      usedCodes.add(code);
      return { code, text: line };
    });
    if (new Set(standards.map(item => item.code.trim())).size !== standards.length) throw new Error('중복된 성취기준 코드가 있습니다.');
    const selected = subject === $('#assessmentSubject').value ? $$('#standardsList input:checked').map(input => input.value) : [];
    const next = prepareLocalCatalogChange(editingLocalSubject, { area, areaLabel, subject, standards }, localReferences());
    persistLocalCatalog(next);
    renderSubjectAreas(area);
    refreshLocalSelection(area, subject, [...new Set([...selected, ...standards.map(item => item.code)])]);
    $('#localCatalogArea').replaceChildren(...Object.entries(SUBJECT_PROFILES).map(([key, profile]) => new Option(profile.label, key)), new Option('＋ 교과군 직접 입력', '__new_area__'));
    renderLocalEntries(subject);
    loadLocalEntry();
    status.textContent = '저장했습니다. 전체 저장하기로 백업해 두세요.';
    renderAssessmentList();
    renderAssessmentSelect();
    renderBatchAssessmentSelect();
    localDialog.close();
    showToast('과목·성취기준을 저장했습니다.');
  } catch (error) {
    status.textContent = error.message.startsWith('invalid') || error.message.startsWith('duplicate') || error.message === 'empty-course'
      ? '과목명·성취기준의 길이와 중복 코드, 기존 과목의 교과군을 확인해 주세요.' : error.message;
  }
});
$('#deleteLocalCatalog').addEventListener('click', () => {
  try {
    const next = prepareLocalCatalogChange(editingLocalSubject, null, localReferences());
    if (!window.confirm('선택한 과목의 직접 추가 자료를 삭제할까요? 기본 제공 자료는 유지됩니다.')) return;
    const area = $('#assessmentSubjectArea').value;
    const subject = $('#assessmentSubject').value;
    const codes = $$('#standardsList input:checked').map(input => input.value);
    persistLocalCatalog(next);
    refreshLocalSelection(Object.hasOwn(SUBJECT_PROFILES, area) ? area : DEFAULT_SUBJECT_AREA, Object.hasOwn(ACHIEVEMENT_STANDARDS, subject) ? subject : '', codes);
    $('#localCatalogArea').replaceChildren(...Object.entries(SUBJECT_PROFILES).map(([key, profile]) => new Option(profile.label, key)), new Option('＋ 교과군 직접 입력', '__new_area__'));
    $('#localCatalogArea').value = $('#assessmentSubjectArea').value;
    renderLocalEntries();
    loadLocalEntry();
    $('#localCatalogStatus').textContent = '직접 추가한 자료를 삭제했습니다.';
  } catch (error) { $('#localCatalogStatus').textContent = error.message; }
});
$('#localStorageInfoButton').addEventListener('click', () => {
  const button = $('#localStorageInfoButton');
  const expanded = button.getAttribute('aria-expanded') !== 'true';
  button.setAttribute('aria-expanded', String(expanded));
  $('#localStorageInfo').classList.toggle('hidden', !expanded);
});
