(() => {
  const list = document.getElementById("reviewsList");
  const statsEl = document.getElementById("reviewsStats");
  const histogramEl = document.getElementById("reviewsHistogram");
  const statusEl = document.getElementById("reviewsStatus");
  const moreBtn = document.getElementById("reviewsMore");
  let ratingFilter = "";
  let cursor = null;
  let loading = false;

  function stars(n) {
    return "★".repeat(n) + "☆".repeat(5 - n);
  }

  function formatDate(iso) {
    const d = new Date(iso);
    return Number.isNaN(d.valueOf()) ? "" : d.toLocaleDateString("ko-KR", { year: "numeric", month: "short", day: "numeric" });
  }

  function renderHistogram(histogram, total) {
    if (!histogram || !total) {
      histogramEl.replaceChildren();
      return;
    }
    histogramEl.replaceChildren();
    for (const key of ["5", "4", "3", "2", "1"]) {
      const count = Number(histogram[key] || 0);
      const row = document.createElement("div");
      row.className = "reviews-bar-row";
      row.innerHTML = `<span>★${key}</span><span class="reviews-bar"><i style="width:${total ? (count / total) * 100 : 0}%"></i></span><span>${count.toLocaleString("ko-KR")}</span>`;
      histogramEl.append(row);
    }
  }

  async function loadStats() {
    try {
      const res = await fetch("/api/reviews/stats", { headers: { Accept: "application/json" } });
      if (!res.ok) throw new Error();
      const data = await res.json();
      statsEl.textContent = `이용 후기 ${Number(data.total).toLocaleString("ko-KR")}건 · 평균 ${data.avgRating}`;
      renderHistogram(data.histogram, data.total);
    } catch {
      statsEl.textContent = "후기 집계를 불러오지 못했습니다.";
    }
  }

  function renderItem(item) {
    const li = document.createElement("li");
    li.className = "reviews-card";
    li.innerHTML = `
      <div class="reviews-card__head">
        <span class="reviews-stars" aria-label="별점 ${item.rating}점">${stars(item.rating)}</span>
        <time datetime="${item.publishedAt}">${formatDate(item.publishedAt)}</time>
      </div>
      <p class="reviews-snippet">${item.snippet}</p>
      <footer><span class="reviews-name">${item.displayName}</span></footer>`;
    li.querySelector(".reviews-snippet").addEventListener("click", async () => {
      if (li.dataset.expanded === "1") return;
      try {
        const res = await fetch(`/api/reviews/${encodeURIComponent(item.id)}`, { headers: { Accept: "application/json" } });
        if (!res.ok) return;
        const detail = await res.json();
        li.querySelector(".reviews-snippet").textContent = detail.body;
        li.dataset.expanded = "1";
      } catch {}
    });
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
      const res = await fetch(`/api/reviews?${params}`, { headers: { Accept: "application/json" } });
      if (!res.ok) throw new Error();
      const data = await res.json();
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
