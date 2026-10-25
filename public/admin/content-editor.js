const statusEl = document.getElementById("status");
let original = null;
let retentionDays = { photoAfterDecision: 30, photoIfUnreviewed: 30, statusMetadata: 60 };
let previousPreviewModel = null;

const COPY_FIELDS = {
  hero: [
    ["brandSub", "상단 브랜드 안내"], ["headerHelp", "상단 상담 버튼"],
    ["heroEyebrow", "첫 화면 작은 제목"], ["heroApplyLabel", "상담 신청 버튼"],
    ["heroChatNote", "상담 신청 버튼 아래 안내"], ["payoutNote", "지급 안내 아래 문구"], ["payoutAriaLabel", "지급 기준 설명 이름"]
  ],
  contact: [
    ["contactKicker", "상담 제목 위 문구"], ["contactTitle", "상담 화면 제목"],
    ["contactIntro", "상담 화면 안내"], ["contactLookupPrompt", "조회 링크 앞 안내"],
    ["contactLookupLabel", "상담 화면 조회 버튼"], ["channelReady", "연결된 채널이 있을 때 안내"],
    ["channelMissing", "연결된 채널이 없을 때 안내"], ["channelStart", "상담 연결 버튼 문구"],
    ["channelNotReady", "연결되지 않은 채널 문구"], ["channelUnavailableTitle", "미연결 채널 알림 제목"],
    ["channelUnavailableMessage", "미연결 채널 알림 내용"], ["consultationSafety", "사진 보낼 때 주의 문구"],
    ["emailLinkLabel", "이메일 버튼 문구"]
  ],
  guide: [
    ["guideSummary", "참여 안내 접기 제목"], ["guideTitle", "참여 안내 제목"],
    ["guideIntro", "참여 안내 설명"], ["stepsTitle", "참여 순서 제목"],
    ["lookupStepLabel", "조회 단계 버튼"], ["contactStepLabel", "상담 단계 버튼"], ["faqTitle", "자주 묻는 질문 제목"]
  ],
  status: [
    ["statusDisclosure", "기존 접수 조회 열기 문구"], ["statusTitle", "기존 접수 조회 제목"],
    ["statusHelp", "기존 접수 조회 설명"], ["statusIdLabel", "접수번호 입력 이름"],
    ["statusTokenLabel", "조회 코드 입력 이름"], ["statusSubmit", "조회 버튼"],
    ["statusLoading", "조회 중 안내"], ["statusResultPrefix", "결과 앞 문구"],
    ["statusReviewedAtLabel", "검토 시각 앞 문구"], ["statusTimezoneLabel", "시간대 표시"],
    ["statusUnknown", "알 수 없는 상태 문구"], ["statusErrorTitle", "조회 오류 알림 제목"], ["statusErrorMessage", "조회 오류 안내 내용"],
    ["statusPending", "대기 상태 문구"], ["statusApproved", "승인 상태 문구"],
    ["statusRejected", "반려 상태 문구"], ["statusExpired", "보관 기간 만료 문구"]
  ],
  privacy: [
    ["privacySummary", "개인정보 안내 열기 문구"], ["privacyCollectionLabel", "수집 항목 제목"],
    ["privacyPurposeLabel", "이용 목적 제목"],
    ["privacyPhotoRetentionLabel", "사진 보관 기간 제목"], ["privacyStatusRetentionLabel", "접수 상태 보관 기간 제목"],
    ["privacyStorageLabel", "보관 방법 제목"], ["privacyOperatorLabel", "책임자 제목"],
    ["privacyConsentLabel", "동의 거부 제목"], ["privacyProviderLabel", "처리 서비스 제목"]
  ],
  footer: [
    ["footerBrand", "하단 브랜드 문구"], ["footerTerms", "하단 지급 안내"],
    ["operatorSummary", "운영자 정보 펼치기 문구"], ["operatorCompanyLabel", "법인명 앞 문구"],
    ["operatorRepresentativeLabel", "대표자 앞 문구"], ["operatorEmailLabel", "이메일 앞 문구"]
  ]
};

const SEO_FIELDS = [
  ["title", "검색 결과 제목", 160], ["description", "검색 결과 설명", 500],
  ["socialTitle", "공유 미리보기 제목", 160], ["socialDescription", "공유 미리보기 설명", 500]
];

function setStatus(message, error = false) {
  statusEl.textContent = message;
  statusEl.classList.toggle("error", error);
}

function formatMoney(amount) {
  return Number.isInteger(amount) && amount >= 10000 && amount % 10000 === 0
    ? `${amount / 10000}만원`
    : `${new Intl.NumberFormat("ko-KR").format(amount)}원`;
}

function expandText(value, model) {
  if (typeof value !== "string" || !model?.payout || !model?.lookup || !model?.operator) return value || "";
  const perCase = model.payout.milestones.reduce((sum, item) => sum + item.amount, 0);
  const values = {
    MAX_TOTAL: formatMoney(perCase * model.payout.maxCases),
    MAX_PER_CASE: formatMoney(perCase),
    MAX_CASES: String(model.payout.maxCases),
    EMAIL: model.operator.email,
    LOOKUP_LABEL: model.lookup.label
  };
  model.payout.milestones.forEach((item, index) => {
    values[`DAYS_${index + 1}`] = String(item.days);
    values[`AMOUNT_${index + 1}`] = formatMoney(item.amount);
  });
  return value.replace(/\{\{([A-Z0-9_]+)\}\}/g, (match, key) => Object.hasOwn(values, key) ? values[key] : match);
}

function previewModel() {
  if (!original) return null;
  const email = document.getElementById("operatorEmail").value.trim() || original.operator.email;
  const label = document.getElementById("lookupLabel").value.trim() || original.lookup.label;
  return {
    ...original,
    payout: readPayout(),
    operator: { ...original.operator, email },
    lookup: { ...original.lookup, label }
  };
}

function templateValue(visibleValue, storedValue, model = previewModel()) {
  return visibleValue === expandText(storedValue, model) ? storedValue : visibleValue;
}

function createField(label, id, value, { max = 500, rows = 2, type = "textarea", required = true } = {}) {
  const wrap = document.createElement("div");
  wrap.className = "field";
  const labelEl = document.createElement("label");
  labelEl.htmlFor = id;
  labelEl.textContent = label;
  const input = document.createElement(type === "textarea" ? "textarea" : "input");
  input.id = id;
  input.maxLength = max;
  input.required = required;
  if (type !== "textarea") input.type = type;
  else input.rows = rows;
  input.value = value || "";
  wrap.append(labelEl, input);
  return { wrap, input };
}

function renderCopyFields(containerId, entries, copy, model) {
  const container = document.getElementById(containerId);
  container.replaceChildren();
  for (const [key, label] of entries) {
    const long = copy[key].length > 72 || /Intro|Safety|Collection|Purpose|Storage|Consent|Provider|Message|Terms|Help/.test(key);
    const field = createField(label, `copy-${key}`, expandText(copy[key], model), { rows: long ? 3 : 2 });
    field.input.dataset.sourceText = copy[key];
    container.append(field.wrap);
  }
}

function renderSeoFields(seo, model) {
  const container = document.getElementById("seoFields");
  container.replaceChildren();
  for (const [key, label, max] of SEO_FIELDS) {
    const field = createField(label, `seo-${key}`, expandText(seo[key], model), { max, rows: key.toLowerCase().includes("description") ? 3 : 2 });
    field.input.dataset.sourceText = seo[key];
    container.append(field.wrap);
  }
}

function renderPayoutFields(payout) {
  const container = document.getElementById("payoutFields");
  container.replaceChildren();
  payout.milestones.forEach((item, index) => {
    const block = document.createElement("div");
    block.className = "entry";
    const heading = document.createElement("h3");
    heading.textContent = `${index + 1}단계`;
    const day = createField("유지 기간 (일)", `milestone-${index}-days`, item.days, { type: "number", max: 3 });
    day.input.min = "1";
    day.input.max = "365";
    day.input.step = "1";
    const amount = createField("지급 금액 (원)", `milestone-${index}-amount`, item.amount, { type: "number", max: 10 });
    amount.input.min = "0";
    amount.input.max = "1000000";
    amount.input.step = "1000";
    block.append(heading, day.wrap, amount.wrap);
    container.append(block);
  });
  updatePayoutSummary();
}

function readPayout() {
  return {
    milestones: [0, 1, 2].map(index => ({
      days: Number(document.getElementById(`milestone-${index}-days`).value),
      amount: Number(document.getElementById(`milestone-${index}-amount`).value)
    })),
    maxCases: Number(document.getElementById("maxCases").value)
  };
}

function formatWon(amount) {
  return Number.isInteger(amount) && amount >= 10000 && amount % 10000 === 0
    ? `${amount / 10000}만원`
    : `${new Intl.NumberFormat("ko-KR").format(amount)}원`;
}

function updatePayoutSummary() {
  const summary = document.getElementById("payoutSummary");
  if (!summary) return;
  const milestones = [0, 1, 2].map(index => ({
    days: Number(document.getElementById(`milestone-${index}-days`)?.value),
    amount: Number(document.getElementById(`milestone-${index}-amount`)?.value)
  }));
  const maxCases = Number(document.getElementById("maxCases")?.value);
  if (!milestones.every(item => Number.isFinite(item.days) && Number.isFinite(item.amount)) || !Number.isFinite(maxCases)) return;
  const perCase = milestones.reduce((sum, item) => sum + item.amount, 0);
  summary.textContent = `한 건 최대 ${formatWon(perCase)} · 최대 ${maxCases}건 · 전체 최대 ${formatWon(perCase * maxCases)}`;
}

function refreshDerivedPreviews() {
  if (!original) return;
  const next = previewModel();
  const prior = previousPreviewModel || next;
  const headline = document.getElementById("headline");
  if (headline.value === expandText(original.headline, prior)) headline.value = expandText(original.headline, next);
  for (const group of Object.keys(COPY_FIELDS)) {
    for (const [key] of COPY_FIELDS[group]) {
      const field = document.getElementById(`copy-${key}`);
      if (field.value === expandText(original.copy[key], prior)) field.value = expandText(original.copy[key], next);
    }
  }
  for (const [key] of SEO_FIELDS) {
    const field = document.getElementById(`seo-${key}`);
    if (field.value === expandText(original.seo[key], prior)) field.value = expandText(original.seo[key], next);
  }
  [...document.getElementById("faqs").querySelectorAll(".entry")].forEach(block => {
    const sourceIndex = Number(block.dataset.sourceIndex);
    const item = Number.isInteger(sourceIndex) ? original.faqs[sourceIndex] : null;
    const answer = block.querySelector("textarea");
    if (!item || !answer) return;
    if (item.key === "payoutSchedule") answer.value = payoutFaqText(next);
    else if (answer.value === expandText(item.answer, prior)) answer.value = expandText(item.answer, next);
  });
  previousPreviewModel = next;
  updatePayoutSummary();
}

function payoutFaqText(model) {
  const stages = model.payout.milestones.map((item, index) => `${item.days}일 유지 후 ${formatMoney(item.amount)}${index ? " 추가" : ""}`).join(", ");
  const perCase = model.payout.milestones.reduce((sum, item) => sum + item.amount, 0);
  return `각 유지 기간이 확인되면 단계별 지급 대상이 됩니다: ${stages}.\n한 사람 최대 ${model.payout.maxCases}건이며, 모든 조건을 충족하면 최대 ${formatMoney(perCase * model.payout.maxCases)}입니다.\n실제 지급 여부와 시점은 신청 내용과 유지 조건 확인 후 결정됩니다.`;
}

function renderEntries(container, items, type, model = original) {
  container.replaceChildren();
  items.forEach((item, index) => {
    const block = document.createElement("div");
    block.className = "entry";
    block.dataset.index = String(index);
    if (Number.isInteger(item._sourceIndex)) block.dataset.sourceIndex = String(item._sourceIndex);
    if (item.key) block.dataset.key = item.key;
    const heading = document.createElement("h3");
    heading.textContent = `${type === "faq" ? "질문" : "참여 단계"} ${index + 1}`;
    block.append(heading);
    const title = createField(type === "faq" ? "질문" : "단계 제목", `entry-${type}-${index}-title`, type === "faq" ? item.question : item.title, { max: type === "faq" ? 160 : 80, type: "text" });
    const sourceBody = item.answer ?? item.body;
    const displayedBody = item.key === "payoutSchedule" ? payoutFaqText(model) : (type === "faq" ? expandText(sourceBody, model) : sourceBody);
    const body = createField(type === "faq" ? "답변" : "설명" , `entry-${type}-${index}-body`, displayedBody, { max: type === "faq" ? 400 : 300, rows: 3, required: item.key !== "payoutSchedule" });
    body.input.dataset.sourceText = sourceBody;
    if (item.key === "payoutSchedule") {
      body.input.readOnly = true;
      body.input.placeholder = "지급 기준에서 자동으로 계산됩니다.";
      const note = document.createElement("small");
      note.textContent = "이 답변은 위 지급 기준에 따라 자동으로 표시됩니다.";
      body.wrap.append(note);
    }
    block.append(title.wrap, body.wrap);
    if (type === "faq") {
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "btn danger";
      remove.textContent = "질문 삭제";
      remove.addEventListener("click", () => {
        if (container.children.length <= 1) return setStatus("질문은 하나 이상 남겨야 합니다.", true);
        const currentItems = readEntries(container, type, previewModel(), true);
        currentItems.splice(index, 1);
        renderEntries(container, currentItems, type, previewModel());
      });
      block.append(remove);
    }
    container.append(block);
  });
}

function readEntries(container, type, model = previewModel(), preserveSourceIndex = false) {
  return [...container.querySelectorAll(".entry")].map(block => {
    const inputs = block.querySelectorAll("input,textarea");
    const source = type === "faq" ? block.querySelector("textarea")?.dataset.sourceText || "" : "";
    const editorSource = preserveSourceIndex && Number.isInteger(Number(block.dataset.sourceIndex))
      ? { _sourceIndex: Number(block.dataset.sourceIndex) }
      : {};
    return type === "faq"
      ? { ...editorSource, ...(block.dataset.key ? { key: block.dataset.key } : {}), question: inputs[0].value.trim(), answer: block.dataset.key === "payoutSchedule" ? "" : templateValue(inputs[1].value.trim(), source, model) }
      : { title: inputs[0].value.trim(), body: inputs[1].value.trim() };
  });
}

function updateChannelStatus() {
  const count = ["telegramLink", "lineLink", "channeltalkLink"].filter(id => document.getElementById(id).value.trim()).length;
  document.getElementById("channelStatus").textContent = count
    ? `${count}개 채널 주소가 입력되어 있습니다. 실제로 사진 전송과 답장이 가능한지 확인한 뒤 저장하세요.`
    : "연결된 상담 채널이 없습니다. 사용자가 사진을 보내려면 주소를 하나 이상 등록하세요.";
}

function contentOnly(data) {
  const { cmsReady, updatedAt, legacyContent, retentionDays, error, ...content } = data;
  return content;
}

function fill(data) {
  original = structuredClone(contentOnly(data));
  retentionDays = data.retentionDays || retentionDays;
  document.getElementById("headline").value = expandText(data.headline, data);
  document.getElementById("headline").dataset.sourceText = data.headline;
  document.getElementById("introText").value = data.intro;
  document.getElementById("telegramLink").value = data.supportLinks?.telegram || "";
  document.getElementById("lineLink").value = data.supportLinks?.line || "";
  document.getElementById("channeltalkLink").value = data.supportLinks?.channeltalk || "";
  document.getElementById("lookupUrl").value = data.lookup.url;
  document.getElementById("lookupLabel").value = data.lookup.label;
  document.getElementById("maxCases").value = data.payout.maxCases;
  document.getElementById("operatorCompany").value = data.operator.company;
  document.getElementById("operatorRepresentative").value = data.operator.representative;
  document.getElementById("operatorEmail").value = data.operator.email;
  renderPayoutFields(data.payout);
  const model = previewModel();
  previousPreviewModel = model;
  renderCopyFields("heroCopyFields", COPY_FIELDS.hero, data.copy, model);
  renderCopyFields("contactCopyFields", COPY_FIELDS.contact, data.copy, model);
  renderCopyFields("guideCopyFields", COPY_FIELDS.guide, data.copy, model);
  renderCopyFields("statusCopyFields", COPY_FIELDS.status, data.copy, model);
  renderCopyFields("privacyCopyFields", COPY_FIELDS.privacy, data.copy, model);
  renderCopyFields("footerCopyFields", COPY_FIELDS.footer, data.copy, model);
  renderSeoFields(data.seo, model);
  renderEntries(document.getElementById("checklist"), data.checklist, "check", model);
  renderEntries(document.getElementById("faqs"), data.faqs.map((item, index) => ({ ...item, _sourceIndex: index })), "faq", model);
  document.getElementById("retentionNote").textContent = `보관 기간은 자동 삭제 기준과 연결되어 고정됩니다. 사진: 검토 결정 후 ${retentionDays.photoAfterDecision}일, 미검토 접수 후 ${retentionDays.photoIfUnreviewed}일 · 기존 접수 상태 정보: ${retentionDays.statusMetadata}일.`;
  updateChannelStatus();
  updatePayoutSummary();
}

function readCopy() {
  const model = previewModel();
  return {
    ...original.copy,
    ...Object.fromEntries(Object.keys(COPY_FIELDS).flatMap(group => COPY_FIELDS[group].map(([key]) => [key, templateValue(document.getElementById(`copy-${key}`).value.trim(), original.copy[key], model)])))
  };
}

function readSeo() {
  const model = previewModel();
  return Object.fromEntries(SEO_FIELDS.map(([key]) => [key, templateValue(document.getElementById(`seo-${key}`).value.trim(), original.seo[key], model)]));
}

for (const id of ["telegramLink", "lineLink", "channeltalkLink"]) document.getElementById(id).addEventListener("input", updateChannelStatus);
document.getElementById("maxCases").addEventListener("input", refreshDerivedPreviews);
document.getElementById("payoutFields").addEventListener("input", refreshDerivedPreviews);
document.getElementById("operatorEmail").addEventListener("input", refreshDerivedPreviews);
document.getElementById("lookupLabel").addEventListener("input", refreshDerivedPreviews);
document.getElementById("addFaq").addEventListener("click", () => {
  const container = document.getElementById("faqs");
  if (container.children.length >= 10) return setStatus("자주 묻는 질문은 최대 10개까지 등록할 수 있습니다.", true);
  const items = readEntries(container, "faq", previewModel(), true);
  items.push({ question: "", answer: "" });
  renderEntries(container, items, "faq", previewModel());
});
document.getElementById("reset").addEventListener("click", () => { if (original) fill(original); });

fetch("/api/content", { credentials: "same-origin", cache: "no-store", headers: { Accept: "application/json" } })
  .then(async response => {
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || (response.status === 401 ? "로그인 시간이 만료됐습니다. 다시 로그인해 주세요." : "공개 화면 내용을 불러오지 못했습니다."));
    fill(data);
    if (!data.cmsReady) {
      document.getElementById("save").disabled = true;
      setStatus("저장 공간이 연결되지 않아 편집할 수 없습니다.", true);
      return;
    }
    if (data.legacyContent) {
      const notice = document.getElementById("legacyNotice");
      notice.hidden = false;
      notice.textContent = "저장된 공개 문구를 새 관리 화면으로 옮겼습니다. 연결된 조회·상담 링크와 기존 편집 내용을 확인한 뒤 저장해 주세요.";
    }
    setStatus("공개 화면 내용을 불러왔습니다. 바꾼 뒤 저장해 주세요.");
  })
  .catch(error => {
    document.getElementById("save").disabled = true;
    setStatus(error.message, true);
  });

document.getElementById("editor").addEventListener("submit", async event => {
  event.preventDefault();
  const button = document.getElementById("save");
  button.disabled = true;
  setStatus("저장 중입니다…");
  const data = {
    ...original,
    schemaVersion: 4,
    headline: templateValue(document.getElementById("headline").value.trim(), original.headline, previewModel()),
    intro: document.getElementById("introText").value.trim(),
    checklist: readEntries(document.getElementById("checklist"), "check"),
    faqs: readEntries(document.getElementById("faqs"), "faq", previewModel()),
    supportLinks: {
      telegram: document.getElementById("telegramLink").value.trim(),
      line: document.getElementById("lineLink").value.trim(),
      channeltalk: document.getElementById("channeltalkLink").value.trim()
    },
    lookup: { ...original.lookup, url: document.getElementById("lookupUrl").value.trim(), label: document.getElementById("lookupLabel").value.trim() },
    payout: { ...readPayout(), maxCases: Number(document.getElementById("maxCases").value) },
    copy: readCopy(),
    seo: readSeo(),
    operator: {
      company: document.getElementById("operatorCompany").value.trim(),
      representative: document.getElementById("operatorRepresentative").value.trim(),
      email: document.getElementById("operatorEmail").value.trim()
    }
  };
  try {
    const response = await fetch("/api/content", { method: "PUT", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || "저장하지 못했습니다. 입력 내용을 확인해 주세요.");
    fill({ ...result.content, cmsReady: true, retentionDays });
    document.getElementById("legacyNotice").hidden = true;
    document.getElementById("savedAt").textContent = "마지막 저장: " + new Date(result.updatedAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }) + " KST";
    setStatus("저장했습니다. 공개 홈페이지에 바로 반영됩니다.");
  } catch (error) {
    setStatus(error.message, true);
  } finally {
    button.disabled = false;
  }
});
