/*!
 * 클라임유심 라이브 활동 위젯 (순수 클라이언트 사이드 시뮬레이션)
 * - 누적 상담 문의 카운터: 날짜 기반 결정론적 기본값 + localStorage 보정 + 자연 증가
 * - 실시간 신청 토스트: 풀네임 기준 중복 없는 이름 엔진, 표시는 마지막 글자 마스킹(김민*)
 * - 온라인 인원 지표: 20~90 사이 평균 회귀 랜덤 워크
 * 백엔드 호출 없음. prefers-reduced-motion 시 자동 토스트/애니메이션 비활성.
 * 탭이 숨겨지면 카운터·온라인·토스트 예약은 멈추고, 다시 보이면 남은 시간부터 이어진다.
 */
(() => {
  "use strict";

  /* ------------------------------------------------------------------ *
   * 이름 엔진: 성씨 풀 × 이름 풀 = 수십만 유니크 조합
   * 중복 방지: (start + n*step) mod TOTAL 순회 (step은 TOTAL과 서로소)
   * → 한 사이클(TOTAL회) 동안 같은 조합이 두 번 나오지 않음.
   * 진행 상태는 localStorage에 저장해 재방문·새로고침 간에도 이어짐.
   * ------------------------------------------------------------------ */

  // 실제 한국 성씨 (빈도 상위 + 실존 희소 성씨, 복성 포함)
  const SURNAMES = [
    "김","이","박","최","정","강","조","윤","장","임",
    "한","오","서","신","권","황","안","송","류","홍",
    "전","고","문","양","손","배","백","허","유","남",
    "심","노","하","곽","성","차","주","우","구","라",
    "진","지","엄","채","원","천","방","공","현","함",
    "변","염","여","추","도","소","석","선","설","마",
    "길","연","위","표","명","기","반","왕","금","옥",
    "육","인","맹","제","모","탁","국","경","은","어",
    "편","부","예","나","민","사","수","승","시","아",
    "악","애","온","완","외","요","욱","운","웅","월",
    "위","을","음","익","일","자","저","점","종","즈",
    "창","청","초","탄","파","판","평","포","풍","피",
    "필","학","항","해","헌","형","화","환","회","효",
    "후","흠","희","감","간","견","계","곡","교","궁",
    "근","륭","단","담","당","대","돈","동","두","등",
    "락","랑","려","렴","령","로","뢰","루","리","림",
    "만","망","매","면","목","묘","미","빈","산","세",
    "솔","순","봉","태","낭","뇌","능","독","번","법",
    "보","본","비","삭","상","암","야","열","영","옹",
    "적","치","취","토","행","흥","관","규","엽","림"
  ];
  // 참고: 복성(남궁·선우 등)은 "선우+솔" = "선+우솔"처럼 문자열 충돌을
  // 일으켜 표기 중복이 생길 수 있어 의도적으로 제외한다 (모든 성씨 1글자).

  // 실제 사용되는 한국인 이름 (세대별 어감을 섞은 큐레이션)
  const GIVEN_CORE = [
    "민수","민호","민재","민규","민우","민석","민철","민기","민식","민환",
    "민준","민영","민정","민아","민지","민주","민하","민솔","민채","민서",
    "지훈","지호","지후","지우","지민","지윤","지연","지아","지은","지현",
    "지영","지온","지완","지안","지수","지인","지혜","지경","지선","지유",
    "서연","서윤","서현","서은","서진","서아","서인","서영","서율","서안",
    "서준","서호","서우","서빈","서혁","서경","시연","시윤","시은","시아",
    "시현","시온","시우","시훈","시원","시영","하윤","하은","하연","하준",
    "하늘","하온","하린","하성","하영","하원","하율","하빈","하나","하경",
    "채연","채윤","채은","채아","채원","채이","채린","채희","채준","채호",
    "윤서","윤아","윤연","윤재","윤찬","윤하","윤호","윤슬","윤성","윤정",
    "윤수","윤미","윤경","윤희","예은","예진","예서","예원","예준","예찬",
    "예성","예인","예빈","예나","예림","예솔","예랑","예강","예담","다은",
    "다연","다현","다인","다윤","다온","다빈","다솜","다혜","다경","다영",
    "다원","다희","다정","다민","다운","소연","소윤","소은","소민","소율",
    "소현","소정","소희","소리","소망","소원","소영","소미","소담","소훈",
    "나연","나윤","나은","나현","나희","나린","나경","나리","나원","나준",
    "나빈","나호","유진","유나","유민","유정","유현","유리","유림","유은",
    "유하","유빈","유주","유경","유영","유미","유진","유찬","유성","유솔",
    "현우","현준","현호","현수","현석","현민","현정","현진","현지","현아",
    "현서","현주","현태","현기","현철","현영","현미","현희","현빈","현규",
    "준호","준영","준혁","준석","준수","준태","준성","준기","준모","준일",
    "준범","준식","준용","준권","준필","준희","준미","준아","준연","도현",
    "도윤","도훈","도영","도진","도원","도민","도경","도하","도연","도은",
    "건우","건호","건영","건희","건아","건율","건하","선우","선호","선영",
    "선미","선희","선경","선아","선주","선민","선재","선옥","선자","연우",
    "연호","연수","연정","연희","연미","연경","연주","연아","정우","정민",
    "정호","정훈","정수","정현","정진","정원","정미","정희","정연","정아",
    "정환","정식","정남","정옥","정숙","정자","정임","정애","정분","정덕",
    "승현","승우","승호","승민","승준","승기","승재","승원","승희","승미",
    "승연","승아","승훈","승혁","은우","은호","은수","은정","은희","은미",
    "은경","은영","은주","은아","은서","은비","은솔","은채","은하","은결",
    "재민","재훈","재호","재석","재수","재영","재현","재진","재원","재희",
    "재미","재연","재아","재인","재욱","재웅","재홍","재필","재선","재숙",
    "동현","동호","동수","동민","동훈","동석","동기","동원","동우","동혁",
    "동희","동미","동연","동주","동하","동윤","영수","영호","영철","영식",
    "영민","영석","영기","영환","영복","영만","영덕","영길","영웅","영일",
    "영미","영희","영자","영숙","영옥","영순","영분","영애","영임","영화",
    "상훈","상호","상수","상민","상철","상기","상원","상우","상혁","상준",
    "상미","상희","상연","상아","경수","경호","경민","경훈","경석","경철",
    "경희","경미","경연","경아","경자","경숙","경옥","경분","경애","경화",
    "태희","태호","태수","태민","태영","태현","태우","태준","태연","태아",
    "태경","태양","태윤","태오","태인","태림","성민","성호","성수","성훈",
    "성현","성우","성준","성진","성원","성희","성미","성연","성아","성경",
    "성자","성숙","성옥","성분","성애","진우","진호","진수","진훈","진영",
    "진희","진미","진연","진아","진경","진주","진서","진솔","진하","진원",
    "기훈","기호","기수","기영","기석","기철","기남","기복","기덕","기만",
    "기연","기희","병철","병호","병수","병민","병기","병우","병국","병만",
    "병희","병미","광수","광호","광민","광석","광철","광복","광자","광순",
    "광희","광미","용호","용수","용민","용석","용철","용기","용복","용만",
    "용준","용우","용희","용미","용환","인수","인호","인민","인석","인철",
    "인기","인희","인미","인자","인숙","인옥","종민","종호","종수","종석",
    "종철","종기","종복","종만","종희","종미","종국","종인","종환","종배",
    "찬우","찬호","찬수","찬민","찬영","찬희","찬미","찬웅","규현","규호",
    "규민","규석","규철","규영","규희","규미","규연","규원","규빈","미영",
    "미경","미희","미연","미정","미숙","미자","미옥","미분","미애","미화",
    "미래","미소","미선","미주","미아","미현","미원","미솔","혜진","혜영",
    "혜미","혜연","혜정","혜원","혜주","혜아","혜린","혜경","혜숙","혜옥",
    "혜인","혜솔","혜빈","수진","수빈","수영","수정","수희","수미","수연",
    "수경","수아","수민","수호","수혁","수한","수안","수온","현정","현미",
    "현희","현주","현숙","현자","현옥","현경","옥순","옥자","옥희","옥분",
    "옥임","옥애","옥화","옥경","순자","순희","순영","순옥","순분","순애",
    "순임","순화","순남","순덕","순복","순길","말자","말순","말희","말분",
    "복순","복자","복희","복영","복수","복남","복만","복기","춘자","춘희",
    "춘순","춘수","춘호","춘복","춘남","덕순","덕자","덕희","덕수","덕호",
    "덕만","덕기","덕남","만수","만호","만석","만기","만복","만길","만덕",
    "봉수","봉호","봉석","봉기","봉만","봉덕","봉길","길자","길순","길희",
    "길영","길수","길호","길복","길남","판수","판호","판석","판기","판길",
    "분이","갑순","갑자","갑돌","갑수","갑호","칠수","칠복","칠남","팔수",
    "팔복","구자","구순","구수","두식","두호","두만","삼수","삼호","삼복",
    "사랑","한별","한빛","한솔","한결","한울","새봄","윤슬","온누리","라온",
    "마루","새롬","아람","나린","가람","가을","봄","별","빛","솔","율",
    "강민","강호","강석","강철","강현","강우","강준","강훈","강빈","태웅",
    "태건","태권","태완","태율","태하","태서","태솔","태빈","준우","준강",
    "준휘","휘민","휘준","휘성","휘영","휘경","휘훈","승빈","승환","승제",
    "승주","승완","찬민","찬규","찬진","찬솔","찬빈","경현","경우","경진",
    "경찬","경완","경택","인성","인재","인혁","인찬","인홍","우성","우찬",
    "우혁","우석","우형","우경","우람","윤건","윤혁","윤모","창민","창호",
    "창수","창현","창우","창훈","창희","창연","홍기","홍석","홍준","가현",
    "가은","가윤","가연","가민","가빈","가희","나예","나임","담희","라임",
    "라희","라은","라연","라윤","리나","리아","리안","리은","루아","루하",
    "아윤","아현","아정","아민","아빈","세아","세연","세윤","세은","세빈",
    "세희","세영","세린","세하","세온","윤지","윤진","윤영","윤설","은설",
    "하임","하인","해린","해솔","솔빈","채빈","채민","채영","채현","채정",
    "채솔","채온",    "초희","갑용","갑희","삼숙","삼자","팔순","칠자","구복",
    "두성","석남","석윤","병달","옥녀","길녀","말동","복동","춘동","덕배",
    "만배","배기","칠성","팔봉"
  ];

  // 생성 풀: 자연스럽게 어울리는 앞·뒤 글자 조합 (현대식)
  const MODERN_FIRST = [
    "서","시","하","채","윤","예","다","소","나","유",
    "지","민","현","수","아","은","정","연","우","승",
    "재","도","준","건","선","라","리","온","한","려",
    "가","루","두","려","혜","효","세","주","태","한"
  ];
  const MODERN_SECOND = [
    "연","윤","은","아","우","서","현","재","준","호",
    "훈","민","영","정","경","희","빈","원","율","온",
    "림","결","솔","빛","하","나","안","담","인","주"
  ];
  // 단어·지명·가상 인물처럼 읽히는 조합은 생성하지 않는다
  const GIVEN_DENY = new Set([
    "미식","애상","병상","석상","동상","인상","재상","기동","분화","재심",
    "명심","성심","인권","상식","인식","복수","자수","분수","자숙","기자",
    "상자","학자","동자","병자","판자","철자","기미","가나","가호","가정",
    "소원","하원","현재","예민","주민","수원","길동","새우","옥상","하아",
    "자필"
  ]);
  // 생성 풀: 자연스럽게 어울리는 앞·뒤 글자 조합 (중장년식)
  const CLASSIC_FIRST = [
    "영","정","순","옥","말","복","춘","덕","만","봉",
    "길","철","판","석","기","상","경","미","은","희",
    "수","광","용","인","종","병","태","성","진","재",
    "명","학","선","숙","자","분","애","임","화","동"
  ];
  const CLASSIC_SECOND = [
    "숙","자","순","희","영","수","철","호","식","남",
    "분","옥","덕","래","경","정","미","은","애","임",
    "규","동","상","용","권","필","심","섭","화","복"
  ];

  function buildGivenPool() {
    const pool = new Set(GIVEN_CORE);
    for (const a of MODERN_FIRST) {
      for (const b of MODERN_SECOND) {
        if (a === b) continue; // "수수" 같은 반복 조합 제외
        const name = a + b;
        if (GIVEN_DENY.has(name)) continue;
        pool.add(name);
      }
    }
    for (const a of CLASSIC_FIRST) {
      for (const b of CLASSIC_SECOND) {
        if (a === b) continue;
        const name = a + b;
        if (GIVEN_DENY.has(name)) continue;
        pool.add(name);
      }
    }
    return [...pool];
  }

  const SURNAMES_UNIQUE = [...new Set(SURNAMES)];
  // 조합 풀은 첫 파싱에서 만들지 않는다. 생성 비용이 메인 스레드를 한 번 막지 않게
  // 토스트가 필요해지기 전에 유휴 시간에 채운다.
  let GIVEN = null;
  let S = 0;
  let G = 0;
  let TOTAL = 0;
  function ensurePool() {
    if (GIVEN) return;
    GIVEN = buildGivenPool();
    S = SURNAMES_UNIQUE.length;
    G = GIVEN.length;
    TOTAL = S * G;
    if (nameState && nameState.n >= TOTAL) nameState = freshNameState();
  }
  function schedulePoolBuild() {
    if (GIVEN) return;
    const kick = () => ensurePool();
    if (typeof requestIdleCallback === "function") requestIdleCallback(kick, { timeout: 1500 });
    else setTimeout(kick, 1);
  }

  /* ---------- 결정론적 PRNG (mulberry32) ---------- */
  function mulberry32(seed) {
    let a = seed >>> 0;
    return () => {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function gcd(a, b) {
    while (b) { const t = a % b; a = b; b = t; }
    return a;
  }

  const STORE = {
    names: "climeLive.v1.names",
    counter: "climeLive.v1.counter",
    toasts: "climeLive.v1.toastCount"
  };

  function readStore(key, session) {
    try {
      const raw = (session ? sessionStorage : localStorage).getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }
  function writeStore(key, value, session) {
    try {
      (session ? sessionStorage : localStorage).setItem(key, JSON.stringify(value));
    } catch { /* 사생활 보호 모드 등에서는 무시 */ }
  }

  /* ---------- 이름 순회 상태 ---------- */
  function freshNameState() {
    const entropy = (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
    return { seed: entropy, n: 0 };
  }

  function derivePermutation(seed) {
    ensurePool();
    const rnd = mulberry32(seed);
    const start = Math.floor(rnd() * TOTAL);
    // 골든 레이시오 홉: 연속 선택이 풀 전체에 고르게 퍼지도록
    let step = Math.floor(TOTAL * 0.6180339887498949) | 1;
    while (gcd(step, TOTAL) !== 1) step = (step + 2) % TOTAL;
    return { start, step };
  }

  let nameState = readStore(STORE.names) || freshNameState();
  if (!Number.isInteger(nameState.n) || nameState.n < 0 || !Number.isInteger(nameState.seed)) {
    nameState = freshNameState();
  }
  let lastName = "";

  function pickName() {
    ensurePool();
    for (let attempt = 0; attempt < 3; attempt += 1) {
      // 탭 여러 개가 열려 있어도 같은 커서를 두 번 소비하지 않도록
      // 매번 저장소의 최신 값을 읽고-증가-기록한다.
      const latest = readStore(STORE.names);
      if (latest && latest.seed === nameState.seed && Number.isInteger(latest.n) && latest.n > nameState.n) {
        nameState.n = latest.n;
      }
      nameState.n += 1;
      if (nameState.n >= TOTAL) {
        // 한 사이클 소진 → 새 시드로 다음 사이클 시작 (직전 이름과 겹치지 않게)
        nameState = { seed: (nameState.seed ^ 0x9e3779b9) >>> 0, n: 1 };
      }
      const { start, step } = derivePermutation(nameState.seed);
      const idx = (start + nameState.n * step) % TOTAL;
      const name = SURNAMES_UNIQUE[Math.floor(idx / G)] + GIVEN[idx % G];
      writeStore(STORE.names, nameState);
      if (name !== lastName) {
        lastName = name;
        return name;
      }
    }
    return lastName;
  }

  /* ---------- 누적 상담 문의 카운터 ---------- */
  const COUNTER_EPOCH = Date.UTC(2026, 0, 1); // 2026-01-01 UTC
  const COUNTER_BASE = 512_300;
  const COUNTER_DAILY = 1_137;

  function baseCount(now = Date.now()) {
    const elapsed = Math.max(0, now - COUNTER_EPOCH);
    const days = Math.floor(elapsed / 86_400_000);
    const frac = (elapsed % 86_400_000) / 86_400_000;
    return COUNTER_BASE + days * COUNTER_DAILY + Math.floor(frac * COUNTER_DAILY * 0.92);
  }

  function currentCount(now = Date.now()) {
    const base = baseCount(now);
    const stored = readStore(STORE.counter);
    const value = stored && Number.isInteger(stored.v) ? Math.max(base, stored.v) : base;
    if (!stored || value !== stored.v) writeStore(STORE.counter, { v: value, t: now });
    return value;
  }

  function bumpCount() {
    const stored = readStore(STORE.counter);
    const next = (stored && Number.isInteger(stored.v) ? Math.max(stored.v, baseCount()) : baseCount()) +
      1 + Math.floor(Math.pow(Math.random(), 2.2) * 7); // 1~7, 작은 수에 가중치
    writeStore(STORE.counter, { v: next, t: Date.now() });
    return next;
  }

  /**
   * 화면 표시용 이름 변환: 마지막 글자만 가린다 (예: 김민수 → 김민*).
   * 내부 식별(중복 방지)에는 풀네임을 그대로 쓰고, 표기가 필요한 곳에서만 사용.
   */
  function maskName(fullName) {
    const name = String(fullName || "");
    return name ? name.slice(0, -1) + "*" : "";
  }

  /* ---------- 토스트 행동·시간 라벨 (토스체: 짧고 선명하게) ---------- */
  const ACTIONS = [
    "상담 신청", "사진 전송 완료", "혜택 조건 확인", "혜택 안내 확인",
    "상담 연결", "조건 문의", "안내 자료 열람", "유지 조건 확인",
    "혜택 대상 확인", "상담 내용 확인"
  ];
  const TIMES = ["방금", "방금", "1분 전", "1분 전", "2분 전", "2분 전", "3분 전", "4분 전", "5분 전", "7분 전"];
  // 이름은 마스킹 없이 실명 풀네임을 그대로 표시한다 (명시된 제품 요구사항).

  /* ---------- DOM 구동부 (브라우저 전용) ---------- */
  const KO = new Intl.NumberFormat("ko-KR");
  const timers = new Set();
  const scheduled = new Set();
  let timersPaused = typeof document !== "undefined" && document.visibilityState === "hidden";
  let counterAnim = 0;

  function pageVisible() {
    return typeof document === "undefined" || document.visibilityState !== "hidden";
  }
  function arm(task) {
    task.delay = task.remaining;
    task.started = Date.now();
    task.id = setTimeout(() => {
      timers.delete(task.id);
      task.id = 0;
      if (timersPaused || !pageVisible()) {
        task.remaining = 0;
        return;
      }
      scheduled.delete(task);
      task.fn();
    }, task.delay);
    timers.add(task.id);
  }
  function later(fn, ms) {
    const task = { fn, remaining: ms, delay: ms, started: 0, id: 0 };
    scheduled.add(task);
    if (!timersPaused && pageVisible()) arm(task);
    return task.id;
  }
  function pauseTimers() {
    const now = Date.now();
    timersPaused = true;
    for (const task of scheduled) {
      if (!task.id) continue;
      clearTimeout(task.id);
      timers.delete(task.id);
      task.remaining = Math.max(0, task.delay - (now - task.started));
      task.id = 0;
    }
  }
  function resumeTimers() {
    if (!pageVisible()) return;
    timersPaused = false;
    for (const task of [...scheduled]) {
      if (!task.id) arm(task);
    }
  }
  function clearAllTimers() {
    timersPaused = true;
    for (const id of timers) clearTimeout(id);
    timers.clear();
    scheduled.clear();
  }

  function animateNumber(el, from, to, duration) {
    const gen = counterAnim;
    if (from === to) { el.textContent = KO.format(to); return; }
    const t0 = performance.now();
    const step = now => {
      if (gen !== counterAnim) return;
      const p = Math.min(1, (now - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = KO.format(Math.round(from + (to - from) * eased));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  function bootCounter(reducedMotion) {
    const mounts = document.querySelectorAll("[data-live-counter]");
    if (!mounts.length) return;
    let value = currentCount();
    const paint = next => {
      for (const el of mounts) el.textContent = KO.format(next);
    };
    paint(value);
    // 숨기는 동안 진행 중이던 숫자 애니메이션이 복귀 직후 예전 값으로 덮어쓰지 않게 끊는다.
    // 다시 보일 때는 날짜 기준값까지만 즉시 맞추고, 눈에 보이는 증가는 그대로 1~7이다.
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") {
        counterAnim += 1;
        paint(value);
        return;
      }
      counterAnim += 1;
      value = currentCount();
      paint(value);
    });
    if (reducedMotion) {
      // 움직임 없이 아주 가끔만 갱신
      later(function tick() {
        value = bumpCount();
        paint(value);
        later(tick, 12_000 + Math.random() * 8_000);
      }, 12_000);
      return;
    }
    later(function tick() {
      const next = bumpCount();
      counterAnim += 1;
      for (const el of mounts) animateNumber(el, value, next, 700);
      value = next;
      later(tick, 3_500 + Math.random() * 4_500);
    }, 3_500 + Math.random() * 3_000);
  }

  function bootOnline(reducedMotion) {
    const mounts = document.querySelectorAll("[data-live-online]");
    if (!mounts.length) return;
    const rnd = mulberry32((Date.now() & 0x7fffffff) >>> 0);
    const kstHour = (new Date().getUTCHours() + 9) % 24;
    const hourBias = (kstHour >= 11 && kstHour <= 14) || (kstHour >= 19 && kstHour <= 23) ? 14 : (kstHour >= 2 && kstHour <= 6) ? -6 : 0;
    let v = Math.round(Math.min(88, Math.max(20, 34 + rnd() * 34 + hourBias)));
    const render = () => {
      for (const el of mounts) {
        const tpl = el.getAttribute("data-live-online-template") || "지금 %n명이 상담 알아보는 중";
        el.textContent = tpl.replace("%n", KO.format(v));
      }
    };
    render();
    if (reducedMotion) return;
    later(function tick() {
      v = Math.round(Math.min(90, Math.max(20, v + (Math.random() - 0.5) * 7 + (54 - v) * 0.04)));
      render();
      later(tick, 3_000 + Math.random() * 3_000);
    }, 3_000 + Math.random() * 2_000);
  }

  const TOAST_MAX_PER_SESSION = 6;

  function bootToasts(reducedMotion) {
    if (reducedMotion) return; // 자동 토스트 비활성
    if (document.body && document.body.getAttribute("data-live-toasts") === "off") return;
    let shown = (readStore(STORE.toasts, true) || { n: 0 }).n;
    if (shown >= TOAST_MAX_PER_SESSION) return;

    const wrap = document.createElement("div");
    wrap.className = "la-toasts";
    wrap.setAttribute("role", "status");
    wrap.setAttribute("aria-live", "polite");
    document.body.append(wrap);

    let hideTimer = 0;
    const scheduleNext = first => {
      later(show, first ? 4_000 + Math.random() * 3_000 : 8_000 + Math.random() * 12_000);
    };

    function show() {
      if (document.visibilityState === "hidden") { scheduleNext(false); return; }
      if (shown >= TOAST_MAX_PER_SESSION) return;
      shown += 1;
      writeStore(STORE.toasts, { n: shown }, true);

      const name = pickName(); // 중복 방지는 풀네임 기준
      const shownName = maskName(name); // 표시는 마지막 글자 마스킹 (김민수 → 김민*)
      const action = ACTIONS[Math.floor(Math.random() * ACTIONS.length)];
      const time = TIMES[Math.floor(Math.random() * TIMES.length)];

      const toast = document.createElement("div");
      toast.className = "la-toast";
      const avatar = document.createElement("span");
      avatar.className = "la-toast__avatar la-avatar-" + (1 + (name.charCodeAt(0) % 5));
      avatar.setAttribute("aria-hidden", "true");
      avatar.textContent = name[0];
      const body = document.createElement("span");
      body.className = "la-toast__body";
      const line = document.createElement("strong");
      line.textContent = `${shownName}님 ${action}`;
      const sub = document.createElement("span");
      sub.textContent = time;
      body.append(line, sub);
      const close = document.createElement("button");
      close.type = "button";
      close.className = "la-toast__close";
      close.setAttribute("aria-label", "알림 닫기");
      close.textContent = "×";
      close.addEventListener("click", () => dismiss(toast));
      toast.append(avatar, body, close);
      wrap.append(toast);
      requestAnimationFrame(() => toast.classList.add("is-in"));

      clearTimeout(hideTimer);
      hideTimer = setTimeout(() => dismiss(toast), 5_200);
      scheduleNext(false);
    }

    function dismiss(toast) {
      if (!toast.isConnected) return;
      toast.classList.remove("is-in");
      toast.classList.add("is-out");
      setTimeout(() => toast.remove(), 420);
    }

    scheduleNext(true);
  }

  function boot() {
    const reducedMotion = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    if (document.body) {
      document.body.classList.add("la-ready");
      // 스티키 CTA가 있으면 토스트가 그 위에 뜨도록 오프셋 클래스 부여
      if (document.querySelector(".sticky-cta")) document.body.classList.add("has-sticky-cta");
    }
    const toastsOff = document.body && document.body.getAttribute("data-live-toasts") === "off";
    if (!reducedMotion && !toastsOff) schedulePoolBuild();
    bootCounter(reducedMotion);
    bootOnline(reducedMotion);
    bootToasts(reducedMotion);
  }

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", boot, { once: true });
    } else {
      boot();
    }
    window.addEventListener("pagehide", clearAllTimers);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") pauseTimers();
      else resumeTimers();
    });
  }

  /* ---------- 테스트·재사용용 공개 API ---------- */
  window.ClimeLiveActivity = {
    pickName,
    maskName,
    baseCount,
    currentCount,
    bumpCount,
    ACTIONS,
    TIMES,
    get pool() {
      ensurePool();
      return { surnames: S, given: G, total: TOTAL };
    },
    _derivePermutation: derivePermutation,
    _resetForTest(state) { nameState = state; lastName = ""; },
    version: "2026-10-27.4"
  };
})();
