// 교과군별 핵심역량 프로필
// competencies가 빈 배열인 교과군은 앱에서 핵심역량 선택 영역을 표시하지 않습니다.
const SUBJECT_COMPETENCY_PROFILES = {
  math: [
    { key: 'problem', label: '문제해결', description: '수학의 개념, 원리, 법칙을 활용하여 주어진 문제 상황을 분석하고 적절한 해결 전략을 찾아 해결하는 능력', evaluationElements: ['문제 조건과 정보 분석', '적절한 수학 개념 적용', '해결 전략 탐색', '풀이 과정의 타당성', '결과 검토 및 반성', '자신감 있는 참여', '끈기 있는 도전'] },
    { key: 'reasoning', label: '추론', description: '수학적 사실을 관찰하고 규칙을 찾아 추측하며, 논리적 근거를 바탕으로 정당화하는 능력', evaluationElements: ['개념·원리 이해', '논리적 절차 수행', '규칙 발견', '추측과 일반화', '근거 제시', '정당화 과정', '체계적 사고', '수학적 증거에 기반한 비판적 태도'] },
    { key: 'communication', label: '의사소통', description: '수학적 아이디어와 풀이 과정을 말, 글, 기호, 표, 그래프 등으로 표현하고 타인의 수학적 설명을 이해하는 능력', evaluationElements: ['수학 용어·기호·표·그래프의 정확한 사용', '표현 방식 선택', '표현 간 변환', '풀이 과정 설명', '타인의 의견 이해', '수학적 표현의 편리성 인식', '의견 존중'] },
    { key: 'connection', label: '연결', description: '수학 내부의 여러 개념을 연결하고, 수학을 실생활이나 타 교과와 관련지어 해석·활용하는 능력', evaluationElements: ['영역 간 개념 연결', '학년·단원 간 원리 관련짓기', '새로운 지식 생성', '실생활 문제에 수학 적용', '타 교과 자료의 수학적 해석', '수학의 유용성 인식'] },
    { key: 'information', label: '정보처리', description: '자료와 정보를 목적에 맞게 수집·정리·분석하고, 공학 도구나 교구를 활용하여 합리적으로 판단하는 능력', evaluationElements: ['자료 수집', '자료 변환·정리', '결론 도출', '공학 도구 활용', '통계·그래프 해석', '수학적 근거에 따른 의사 결정'] }
  ],
  korean: [
    { key: 'criticalCreative', label: '비판적·창의적 사고 역량', description: '글, 담화, 문학, 매체 자료를 비판적으로 이해하고 새로운 의미를 구성·표현하는 능력', evaluationElements: ['내용의 타당성 판단', '근거의 적절성 분석', '관점 비교', '창의적 해석', '주체적 의견 형성', '논리적 표현'] },
    { key: 'digitalMedia', label: '디지털·미디어 역량', description: '디지털 매체 환경에서 자료를 비판적으로 수용하고 목적에 맞게 활용·제작·소통하는 능력', evaluationElements: ['매체 자료 검색과 선정', '정보의 신뢰성 판단', '디지털 도구 활용', '매체 표현 방식 분석', '카드뉴스·영상·발표 자료 제작', '저작권과 매체 윤리 인식'] },
    { key: 'communication', label: '의사소통 역량', description: '듣기·말하기·읽기·쓰기 활동에서 목적, 상황, 청자와 독자를 고려하여 의미를 주고받는 능력', evaluationElements: ['주제와 목적에 맞는 표현', '경청과 반응', '질문과 답변', '토의·토론 참여', '글의 구성력', '표현의 명료성', '상호작용 태도'] },
    { key: 'communityRelation', label: '공동체·대인 관계 역량', description: '언어활동을 통해 타인과 협력하고 공동체의 문제를 이해하며 관계를 형성하는 능력', evaluationElements: ['협력적 과제 수행', '타인 의견 존중', '역할 분담', '갈등 조정', '공동체 문제에 대한 관심', '배려 있는 언어 사용'] },
    { key: 'cultureEnjoyment', label: '문화 향유 역량', description: '문학과 언어문화를 이해하고 감상하며, 문화적 가치를 자신의 삶과 연결하는 능력', evaluationElements: ['작품 감상', '문학적 표현 이해', '문화적 맥락 파악', '작품에 대한 주체적 해석', '감상 공유', '문화적 다양성 존중'] },
    { key: 'selfReflection', label: '자기 성찰·계발 역량', description: '자신의 언어생활과 학습 과정을 돌아보고 표현 능력을 개선해 가는 능력', evaluationElements: ['글쓰기 과정 점검', '말하기 태도 성찰', '피드백 반영', '고쳐쓰기', '학습 과정 기록', '자기 평가', '개선 계획 수립'] }
  ],
  english: [
    { key: 'englishCommunication', label: '영어 의사소통 역량', description: '언어와 문화 배경이 다른 사람들과 영어로 이해·표현·상호작용하는 능력', evaluationElements: ['목적과 상황에 맞는 듣기·말하기·읽기·쓰기', '영어 표현의 정확성과 적절성', '실제 맥락에서의 과업 수행', '상호작용 태도', '문화 다양성 이해', '자기주도적 영어 학습', '디지털 영어 자료 검색·분석·활용'] }
  ],
  social: [
    { key: 'creativeThinking', label: '창의적 사고력', description: '사회현상이나 사회문제를 새로운 관점에서 바라보고 가치 있는 아이디어를 생성하는 능력', evaluationElements: ['새로운 해결 방안 제안', '다양한 관점 탐색', '사회문제에 대한 대안 구성', '창의적 발표·보고서 작성'] },
    { key: 'criticalThinking', label: '비판적 사고력', description: '사회현상, 자료, 주장, 쟁점을 분석적으로 평가하는 능력', evaluationElements: ['자료의 신뢰성 판단', '주장과 근거 분석', '편향성 파악', '사회 쟁점에 대한 비판적 해석', '타당한 근거 제시'] },
    { key: 'problemDecision', label: '문제 해결력 및 의사 결정력', description: '다양한 사회문제를 합리적으로 분석하고 적절한 해결 방안을 선택하는 능력', evaluationElements: ['사회문제 원인 분석', '대안 비교', '판단 기준 설정', '합리적 의사 결정', '해결 방안 제시', '실천 가능성 검토'] },
    { key: 'communicationCollaboration', label: '의사소통 및 협업 능력', description: '자신의 견해를 분명히 표현하고 타인과 효과적으로 상호작용하며 공동 과제를 수행하는 능력', evaluationElements: ['토의·토론 참여', '발표', '경청', '의견 조율', '모둠 활동 기여도', '협력적 문제 해결 과정'] },
    { key: 'informationUse', label: '정보 활용 능력', description: '다양한 자료와 테크놀로지를 활용하여 정보를 수집, 해석, 활용, 창조하는 능력', evaluationElements: ['지도·통계·신문·사료·디지털 자료 활용', '자료 수집과 분석', '정보 시각화', '근거 기반 주장', '디지털 도구 활용'] }
  ],
  information: [
    { key: 'computationalThinking', label: '컴퓨팅 사고력', description: '컴퓨팅을 활용해 문제를 발견·분석하고, 실생활과 다양한 학문 분야의 문제를 해결하는 능력', evaluationElements: ['문제 분해', '핵심 요소 추출', '알고리즘 설계', '데이터 표현', '프로그램 구현', '문제 해결 과정 설명', '결과 검토'] },
    { key: 'digitalCulture', label: '디지털 문화 소양', description: '디지털 사회의 구성원으로서 윤리의식과 시민성을 갖추고, 디지털 기술을 기반으로 의사소통하고 협업하는 능력', evaluationElements: ['디지털 윤리', '개인정보와 저작권 이해', '온라인 협업', '디지털 의사소통', '디지털 사회 문제 토론', '책임 있는 기술 사용'] },
    { key: 'aiLiteracy', label: '인공지능 소양', description: '인간과 인공지능의 공존을 이해하고, 데이터와 인공지능을 활용하여 문제를 해결하는 능력', evaluationElements: ['데이터 이해와 활용', '인공지능 원리 이해', 'AI 도구 활용', 'AI 결과 해석', '인공지능 윤리', '사람 중심의 활용 태도'] }
  ],
  secondLanguage: [
    { key: 'communication', label: '의사소통 역량', description: '제2외국어의 기본 표현을 이해하고 상황과 목적에 맞게 활용하여 소통하는 능력', evaluationElements: ['발음과 억양', '기본 어휘와 표현 사용', '듣기·말하기·읽기·쓰기 통합 수행', '상황에 맞는 표현', '유창성과 정확성', '상호작용 태도'] },
    { key: 'intercultural', label: '상호문화 이해 역량', description: '해당 언어권의 문화를 이해하고 자신의 문화와 비교하며, 문화적 차이를 존중하는 능력', evaluationElements: ['문화 정보 이해', '자문화와 타문화 비교', '문화 차이에 대한 존중', '편견 없는 태도', '상호문화적 관점의 발표·토의'] },
    { key: 'digitalInformation', label: '디지털 기반 정보 활용 역량', description: '다양한 디지털 매체와 자료를 활용하여 언어와 문화 정보를 탐색·정리·활용하는 능력', evaluationElements: ['디지털 자료 검색', '정보 선별', '자료 정리와 발표', '온라인 도구 활용', '문화 자료 제작', '출처와 정보 윤리 인식'] }
  ],
  science: [],
  ethics: []
};

Object.entries(SUBJECT_COMPETENCY_PROFILES).forEach(([key, competencies]) => {
  if (SUBJECT_PROFILES[key]) SUBJECT_PROFILES[key].competencies = competencies.map(competency => ({
    ...competency,
    matches: [competency.label, competency.label.replace(/\s|역량|능력|사고력|소양/g, ''), competency.key]
  }));
});
