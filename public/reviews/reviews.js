(() => {
  "use strict";
  const list = document.getElementById("reviewsList");
  const statsEl = document.getElementById("reviewsStats");
  const avgEl = document.getElementById("reviewsAvg");
  const starsEl = document.getElementById("reviewsStars");
  const histogramEl = document.getElementById("reviewsHistogram");
  const statusEl = document.getElementById("reviewsStatus");
  const moreBtn = document.getElementById("reviewsMore");
  const reducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const KO = new Intl.NumberFormat("ko-KR");
  let ratingFilter = "";
  let cursor = null;
  let loading = false;

  /* A static host has no Pages Function. HTML/404 means "try /reviews/data".
     A JSON error from the API is a real failure and stays on the error copy. */
  async function fetchApiJson(url) {
    try {
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      const type = (res.headers.get("content-type") || "").toLowerCase();
      if (!type.includes("json")) return { unavailable: true };
      if (!res.ok) return { failed: true };
      try {
        return { data: await res.json() };
      } catch {
        return { unavailable: true };
      }
    } catch {
      return { unavailable: true };
    }
  }

  function staticReviews() {
    return import("/reviews/static-fallback.js");
  }

  function starRating(rating, size) {
    const el = document.createElement("span");
    el.className = "stars";
    el.style.setProperty("--pct", String(Math.max(0, Math.min(100, (rating / 5) * 100))));
    if (size) el.style.setProperty("--size", `${size}px`);
    el.setAttribute("role", "img");
    el.setAttribute("aria-label", `별점 5점 만점에 ${rating}점`);
    return el;
  }

  function avatarFor(name) {
    const el = document.createElement("span");
    const seed = String(name || "참").codePointAt(0) || 0;
    el.className = `review-avatar av-${1 + (seed % 5)}`;
    el.setAttribute("aria-hidden", "true");
    el.textContent = (name || "참").trim()[0] || "참";
    return el;
  }

  function chip(text, kind) {
    const el = document.createElement("span");
    el.className = `chip chip--${kind}`;
    el.textContent = text;
    return el;
  }

  function formatDate(iso) {
    const d = new Date(iso);
    return Number.isNaN(d.valueOf())
      ? ""
      : d.toLocaleDateString("ko-KR", {
          timeZone: "Asia/Seoul",
          year: "numeric",
          month: "short",
          day: "numeric"
        });
  }

  /* 후기 본문을 문장 단위로 끊어 한두 문장마다 줄을 나눔 (데이터는 그대로, 표시만 포맷) */
  function appendFormattedBody(el, text) {
    el.replaceChildren();
    const sentences = String(text || "")
      .split(/(?<=[.!?…])\s+|\n+/)
      .map(s => s.trim())
      .filter(Boolean);
    if (!sentences.length) { el.textContent = text || ""; return; }
    for (let i = 0; i < sentences.length; i += 2) {
      const line = document.createElement("span");
      line.className = "line";
      line.textContent = sentences.slice(i, i + 2).join(" ");
      el.append(line);
    }
  }

  function countUp(el, to, decimals) {
    const render = v => { el.textContent = v.toFixed(decimals); };
    if (reducedMotion) { render(to); return; }
    const duration = 900;
    const t0 = performance.now();
    const step = now => {
      const p = Math.min(1, (now - t0) / duration);
      render(to * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  function renderHistogram(histogram, total) {
    histogramEl.replaceChildren();
    if (!histogram || !total) return;
    const rows = [];
    for (const key of ["5", "4", "3", "2", "1"]) {
      const count = Number(histogram[key] || 0);
      const pct = total ? (count / total) * 100 : 0;
      const row = document.createElement("div");
      row.className = "hist-row";
      const label = document.createElement("span");
      label.className = "hist-row__label";
      label.textContent = `${key}점`;
      const bar = document.createElement("span");
      bar.className = "hist-row__bar";
      const fill = document.createElement("i");
      fill.className = "hist-row__fill";
      bar.append(fill);
      const countEl = document.createElement("span");
      countEl.className = "hist-row__count";
      countEl.textContent = KO.format(count);
      row.append(label, bar, countEl);
      rows.push({ fill, pct });
      histogramEl.append(row);
    }
    // width를 다음 프레임에 지정해 그라데이션 바 애니메이션 트랜지션 발동
    requestAnimationFrame(() => {
      for (const { fill, pct } of rows) fill.style.width = `${pct}%`;
    });
  }

  async function loadStats() {
    try {
      const api = await fetchApiJson("/api/reviews/stats");
      if (api.failed) throw new Error();
      const data = api.unavailable ? await (await staticReviews()).staticReviewStats() : api.data;
      if (!data || data.total == null) throw new Error();
      const avg = Number(data.avgRating);
      const total = Number(data.total);
      countUp(avgEl, avg, 1);
      starsEl.style.setProperty("--pct", String((avg / 5) * 100));
      starsEl.style.setProperty("--size", "24px");
      starsEl.setAttribute("aria-label", `별점 5점 만점에 ${avg}점`);
      statsEl.replaceChildren();
      const strong = document.createElement("strong");
      strong.textContent = `${KO.format(total)}건`;
      statsEl.append(document.createTextNode("총 "), strong, document.createTextNode("의 이용 후기"));
      renderHistogram(data.histogram, total);
    } catch {
      avgEl.textContent = "–";
      statsEl.textContent = "후기 집계를 불러오지 못했습니다.";
    }
  }

  function renderItem(item) {
    const li = document.createElement("li");
    li.className = "review-card";
    if (item.featured) li.classList.add("review-card--featured");

    const head = document.createElement("div");
    head.className = "review-card__head";
    const who = document.createElement("div");
    who.className = "review-card__who";
    const name = document.createElement("span");
    name.className = "review-card__name";
    name.textContent = item.displayName || "참여자";
    const date = document.createElement("time");
    date.className = "review-card__date";
    date.dateTime = item.publishedAt;
    date.textContent = formatDate(item.publishedAt);
    who.append(name, date);
    const starsWrap = document.createElement("span");
    starsWrap.className = "review-card__stars";
    starsWrap.append(starRating(item.rating, 15));
    head.append(avatarFor(item.displayName), who, starsWrap);

    const body = document.createElement("p");
    body.className = "review-card__body is-clamped";
    appendFormattedBody(body, item.snippet);

    const foot = document.createElement("div");
    foot.className = "review-card__foot";
    if (item.featured) foot.append(chip("추천 후기", "featured"));
    const persona = item.tags && typeof item.tags === "object" ? item.tags.persona : "";
    if (persona) foot.append(chip(persona, "persona"));
    foot.append(chip(`${item.rating}점`, "rating"));
    const more = document.createElement("span");
    more.className = "review-card__more";
    more.textContent = "전문 보기 ›";
    foot.append(more);

    body.addEventListener("click", async () => {
      if (li.dataset.expanded === "1") return;
      try {
        const api = await fetchApiJson(`/api/reviews/${encodeURIComponent(item.id)}`);
        if (api.failed) return;
        const detail = api.unavailable
          ? await (await staticReviews()).staticReviewDetail(item.id)
          : api.data;
        if (!detail || typeof detail.body !== "string") return;
        appendFormattedBody(body, detail.body);
        body.classList.remove("is-clamped");
        li.classList.add("is-expanded");
        li.dataset.expanded = "1";
      } catch { /* 네트워크 오류 시 스니펫 유지 */ }
    });

    li.append(head, body, foot);
    return li;
  }

  async function loadPage(reset) {
    if (loading) return;
    loading = true;
    moreBtn.disabled = true;
    statusEl.textContent = reset ? "후기를 불러오는 중…" : "";
    try {
      const params = new URLSearchParams({ limit: "20" });
      if (ratingFilter) params.set("rating", ratingFilter);
      if (!reset && cursor) params.set("cursor", cursor);
      const api = await fetchApiJson(`/api/reviews?${params}`);
      if (api.failed) throw new Error();
      const data = api.unavailable
        ? await (await staticReviews()).queryStaticReviews({
            limit: 20,
            rating: ratingFilter ? Number(ratingFilter) : null,
            cursor: reset ? null : cursor
          })
        : api.data;
      if (!data || !Array.isArray(data.items)) throw new Error();
      if (reset) list.replaceChildren();
      for (const item of data.items || []) list.append(renderItem(item));
      cursor = data.nextCursor;
      moreBtn.hidden = !cursor;
      statusEl.textContent = list.childElementCount ? "" : "표시할 후기가 없습니다.";
    } catch {
      statusEl.textContent = "후기 목록을 불러오지 못했습니다.";
      moreBtn.hidden = true;
    } finally {
      loading = false;
      moreBtn.disabled = false;
    }
  }

  document.querySelectorAll(".reviews-filter").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".reviews-filter").forEach(b => b.classList.remove("is-active"));
      btn.classList.add("is-active");
      ratingFilter = btn.dataset.rating || "";
      cursor = null;
      loadPage(true);
    });
  });
  moreBtn.addEventListener("click", () => loadPage(false));

  loadStats();
  loadPage(true);
})();
