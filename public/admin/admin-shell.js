(() => {
  const page = document.querySelector("main[data-admin-page]");
  if (!page) return;

  const currentPage = page.dataset.adminPage;
  const pageTitles = {
    dashboard: "운영 현황",
    review: "미검토 신청",
    applications: "전체 신청",
    duplicates: "중복 의심 검토",
    content: "안내 콘텐츠",
    reviews: "이용 후기"
  };
  const groups = [
    { title: "현황", items: [{ id: "dashboard", label: "대시보드", href: "/", icon: "⌂" }] },
    { title: "신청 관리", items: [
      { id: "review", label: "미검토 신청", href: "/admin/review.html", icon: "◷", badge: "queue" },
      { id: "applications", label: "전체 신청", href: "/admin/applications.html", icon: "▤" },
      { id: "duplicates", label: "중복 의심", href: "/admin/duplicates.html", icon: "◎", badge: "duplicates" }
    ] },
    { title: "사이트 운영", items: [
      { id: "content", label: "안내 콘텐츠", href: "/admin/content.html", icon: "▧" },
      { id: "reviews", label: "이용 후기", href: "/admin/reviews.html", icon: "★" }
    ] }
  ];
  const oldHeader = document.querySelector("header.bar");
  oldHeader?.remove();

  const layout = document.createElement("div");
  layout.className = "admin-layout";
  layout.innerHTML = `
    <div class="admin-scrim" data-admin-close hidden></div>
    <aside class="admin-sidebar" id="adminNavigation" aria-label="운영 메뉴">
      <button class="admin-sidebar-close" type="button" data-admin-menu-close aria-label="운영 메뉴 닫기">×</button>
      <a class="admin-brand" href="/" aria-label="USIM PLUS 운영 콘솔 홈"><span class="admin-brand__mark">U+</span><span><strong>USIM PLUS</strong><small>운영 콘솔</small></span></a>
      <nav class="admin-nav" aria-label="주요 메뉴"></nav>
      <div class="admin-sidebar__foot"><span class="admin-online-dot"></span><span>안전한 관리자 세션</span></div>
    </aside>
    <div class="admin-frame">
      <header class="admin-topbar">
        <button class="admin-menu-toggle" type="button" aria-label="운영 메뉴 열기" aria-controls="adminNavigation" aria-expanded="false">☰</button>
        <div class="admin-topbar__title"><span>USIM PLUS</span><strong></strong></div>
        <div class="admin-topbar__actions"><a href="https://climekr.com" target="_blank" rel="noopener noreferrer">사이트 보기 <span aria-hidden="true">↗</span></a><button class="admin-logout" type="button" data-admin-logout>로그아웃</button></div>
      </header>
      <div class="admin-page-content"><p class="admin-channel-notice" style="padding:16px;border:1px solid #b9d8dc;border-radius:12px;line-height:1.8;background:#eaf5f5;color:#174453">신규 상담과 사진은 LINE·텔레그램·채널톡 대화창에서 확인하세요. 이곳의 신청 목록은 기존 홈페이지 접수입니다. <a href="/admin/content.html">상담 주소 등록·변경하기</a></p></div>
    </div>`;

  const nav = layout.querySelector(".admin-nav");
  groups.forEach(group => {
    const section = document.createElement("section");
    section.className = "admin-nav__group";
    const heading = document.createElement("h2");
    heading.textContent = group.title;
    const list = document.createElement("ul");
    group.items.forEach(item => {
      const row = document.createElement("li");
      const link = document.createElement("a");
      link.className = "admin-nav__link";
      link.href = item.href;
      if (item.id === currentPage) link.setAttribute("aria-current", "page");
      const icon = document.createElement("span");
      icon.className = "admin-nav__icon";
      icon.setAttribute("aria-hidden", "true");
      icon.textContent = item.icon;
      const label = document.createElement("span");
      label.textContent = item.label;
      link.append(icon, label);
      if (item.badge) {
        const badge = document.createElement("span");
        badge.className = "admin-nav__badge";
        badge.dataset.adminCount = item.badge;
        badge.hidden = true;
        badge.textContent = "0";
        link.append(badge);
      }
      row.append(link);
      list.append(row);
    });
    section.append(heading, list);
    nav.append(section);
  });

  layout.querySelector(".admin-topbar__title strong").textContent = pageTitles[currentPage] || "운영 관리";
  layout.querySelector(".admin-page-content").append(page);
  document.body.classList.add("has-admin-shell");
  document.body.prepend(layout);

  const menuButton = layout.querySelector(".admin-menu-toggle");
  const sidebarCloseButton = layout.querySelector("[data-admin-menu-close]");
  const scrim = layout.querySelector(".admin-scrim");
  const sidebar = layout.querySelector(".admin-sidebar");
  const frame = layout.querySelector(".admin-frame");
  const mobileQuery = matchMedia("(max-width: 780px)");
  sidebar.inert = mobileQuery.matches;
  sidebar.setAttribute("aria-hidden", String(mobileQuery.matches));
  const closeMenu = () => {
    const wasOpen = sidebar.classList.contains("is-open");
    sidebar.classList.remove("is-open");
    scrim.hidden = true;
    sidebar.inert = mobileQuery.matches;
    sidebar.setAttribute("aria-hidden", String(mobileQuery.matches));
    frame.inert = false;
    document.body.style.overflow = "";
    menuButton.setAttribute("aria-expanded", "false");
    menuButton.setAttribute("aria-label", "운영 메뉴 열기");
    if (wasOpen && mobileQuery.matches) menuButton.focus();
  };
  menuButton.addEventListener("click", () => {
    const opening = !sidebar.classList.contains("is-open");
    sidebar.classList.toggle("is-open", opening);
    scrim.hidden = !opening;
    sidebar.inert = !opening && mobileQuery.matches;
    sidebar.setAttribute("aria-hidden", String(!opening && mobileQuery.matches));
    frame.inert = opening;
    document.body.style.overflow = opening ? "hidden" : "";
    menuButton.setAttribute("aria-expanded", String(opening));
    menuButton.setAttribute("aria-label", opening ? "운영 메뉴 닫기" : "운영 메뉴 열기");
    if (opening) sidebarCloseButton.focus();
  });
  sidebarCloseButton.addEventListener("click", closeMenu);
  sidebar.addEventListener("keydown", event => {
    if (event.key !== "Tab" || !sidebar.classList.contains("is-open")) return;
    const focusable = [...sidebar.querySelectorAll('a[href],button:not([disabled]),[tabindex]:not([tabindex="-1"])')]
      .filter(element => element.getClientRects().length > 0);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });
  scrim.addEventListener("click", closeMenu);
  sidebar.addEventListener("click", event => { if (event.target.closest("a")) closeMenu(); });
  document.addEventListener("keydown", event => { if (event.key === "Escape") closeMenu(); });
  mobileQuery.addEventListener?.("change", closeMenu);
})();
