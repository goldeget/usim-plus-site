(() => {
  const statusEl = document.getElementById("status");
  const statsBar = document.getElementById("statsBar");
  const listEl = document.getElementById("reviewsList");
  const loadMoreBtn = document.getElementById("loadMore");
  const statusFilter = document.getElementById("statusFilter");
  let listPage = null;

  function setStatus(message, isError = false) {
    statusEl.textContent = message;
    statusEl.classList.toggle("error", isError);
  }

  async function api(path, options = {}) {
    const response = await fetch(path, {
      credentials: "same-origin",
      cache: "no-store",
      headers: { Accept: "application/json", ...(options.body ? { "Content-Type": "application/json" } : {}) },
      ...options
    });
    const data = await response.json().catch(() => ({}));
    if (response.status === 401) {
      location.replace("/admin/login");
      throw new Error("unauthorized");
    }
    if (!response.ok) throw new Error(data.error || "요청에 실패했습니다.");
    return data;
  }

  async function loadStats() {
    try {
      const stats = await api("/api/reviews/stats");
      statsBar.hidden = false;
      statsBar.replaceChildren();
      const total = document.createElement("span");
      total.textContent = `게시 ${new Intl.NumberFormat("ko-KR").format(stats.total)}건`;
      const avg = document.createElement("span");
      avg.textContent = `평균 ${stats.avgRating}점`;
      statsBar.append(total, avg);
    } catch {
      /* public stats optional on admin host */
    }
  }

  function formatPublishedAt(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    return Number.isNaN(d.valueOf())
      ? iso
      : d.toLocaleString("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "short", day: "numeric" });
  }

  function renderRow(item) {
    const row = document.createElement("article");
    row.className = "reviews-admin-row";
    row.dataset.id = item.id;
    const main = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = `★${item.rating} · ${item.displayName || "참여자"}`;
    const meta = document.createElement("small");
    meta.textContent = formatPublishedAt(item.publishedAt);
    const snippet = document.createElement("p");
    snippet.textContent = item.snippet;
    main.append(title, meta, snippet);
    const controls = document.createElement("div");
    controls.style.display = "flex";
    controls.style.flexDirection = "column";
    controls.style.gap = "6px";
    const statusSelect = document.createElement("select");
    for (const value of ["published", "hidden", "draft"]) {
      const opt = document.createElement("option");
      opt.value = value;
      opt.textContent = value === "published" ? "게시" : value === "hidden" ? "숨김" : "작성 중";
      if (item.status === value) opt.selected = true;
      statusSelect.append(opt);
    }
    const featuredLabel = document.createElement("label");
    featuredLabel.style.fontSize = "12px";
    const featured = document.createElement("input");
    featured.type = "checkbox";
    featured.checked = Boolean(item.featured);
    featuredLabel.append(featured, " 홈에 추천");
    const boostLabel = document.createElement("label");
    boostLabel.style.fontSize = "12px";
    const boost = document.createElement("input");
    boost.type = "number";
    boost.value = String(item.sortBoost || 0);
    boost.style.width = "72px";
    boostLabel.append(" 추천 순서 ", boost);
    const save = document.createElement("button");
    save.type = "button";
    save.className = "btn secondary";
    save.textContent = "저장";
    save.addEventListener("click", async () => {
      save.disabled = true;
      try {
        await api(`/api/admin/reviews/${encodeURIComponent(item.id)}`, {
          method: "PATCH",
          body: JSON.stringify({
            status: statusSelect.value,
            featured: featured.checked,
            sortBoost: Number(boost.value) || 0
          })
        });
        setStatus("저장했습니다.");
      } catch (error) {
        setStatus(error.message, true);
      } finally {
        save.disabled = false;
      }
    });
    controls.append(statusSelect, featuredLabel, boostLabel, save);
    row.append(main, controls);
    return row;
  }

  async function loadList(reset = false) {
    if (reset) {
      listPage = null;
      listEl.replaceChildren();
    }
    const params = new URLSearchParams({ limit: "30", status: statusFilter.value });
    if (listPage) params.set("cursor", listPage);
    const data = await api(`/api/admin/reviews?${params}`);
    for (const item of data.items) listEl.append(renderRow(item));
    listPage = data.nextCursor;
    loadMoreBtn.hidden = !listPage;
  }

  document.getElementById("importBtn").addEventListener("click", async () => {
    const raw = document.getElementById("importJson").value.trim();
    if (!raw) return setStatus("붙여 넣은 내용이 비어 있습니다.", true);
    let payload;
    try {
      const parsed = JSON.parse(raw);
      payload = Array.isArray(parsed) ? { reviews: parsed } : parsed;
    } catch {
      return setStatus("형식을 확인해 주세요. 운영 가이드 예시와 같은 구조인지 봐 주세요.", true);
    }
    const btn = document.getElementById("importBtn");
    btn.disabled = true;
    try {
      const result = await api("/api/admin/reviews", { method: "POST", body: JSON.stringify(payload) });
      setStatus(
        `등록했습니다. 반영 ${result.ok || 0}건, 이미 있던 내용 ${result.duplicate || 0}건, 확인 필요 ${result.invalid || 0}건`
      );
      await loadStats();
      await loadList(true);
    } catch (error) {
      setStatus(error.message, true);
    } finally {
      btn.disabled = false;
    }
  });

  document.getElementById("rebuildStatsBtn").addEventListener("click", async () => {
    const btn = document.getElementById("rebuildStatsBtn");
    btn.disabled = true;
    try {
      await api("/api/admin/reviews/rebuild-stats", { method: "POST" });
      setStatus("집계를 다시 맞췄습니다.");
      await loadStats();
    } catch (error) {
      setStatus(error.message, true);
    } finally {
      btn.disabled = false;
    }
  });

  loadMoreBtn.addEventListener("click", () => loadList(false).catch(e => setStatus(e.message, true)));
  statusFilter.addEventListener("change", () => loadList(true).catch(e => setStatus(e.message, true)));

  (async () => {
    try {
      await loadStats();
      await loadList(true);
      setStatus("후기 목록을 불러왔습니다.");
    } catch (error) {
      setStatus(error.message, true);
    }
  })();
})();
