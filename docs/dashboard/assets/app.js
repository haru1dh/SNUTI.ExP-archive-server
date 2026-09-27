(() => {
  "use strict";

  const REFRESH_INTERVAL_MS = 30_000;
  const API_URL_KEY = "snuti-exp-archive-api-url";
  const TOKEN_KEY = "snuti-exp-archive-access-token";

  const elements = {
    apiForm: document.querySelector("#api-config-form"),
    apiInput: document.querySelector("#api-base-url"),
    healthEndpoint: document.querySelector("#health-endpoint"),
    healthRefresh: document.querySelector("#health-refresh"),
    healthState: document.querySelector("#health-state"),
    healthCopy: document.querySelector("#health-copy"),
    healthCheckedAt: document.querySelector("#health-checked-at"),
    healthLatency: document.querySelector("#health-latency"),
    connectionChip: document.querySelector("#connection-chip"),
    loginForm: document.querySelector("#login-form"),
    email: document.querySelector("#email"),
    password: document.querySelector("#password"),
    sessionLabel: document.querySelector("#session-label"),
    logout: document.querySelector("#logout-button"),
    interestPanel: document.querySelector("#interest-panel"),
    interestForm: document.querySelector("#interest-form"),
    interestRefresh: document.querySelector("#interest-refresh"),
    interestCopy: document.querySelector("#interest-copy"),
    interestTagList: document.querySelector("#interest-tag-list"),
    showInterestLectures: document.querySelector("#show-interest-lectures"),
    archiveModeButtons: document.querySelectorAll("[data-archive-mode]"),
    lectureSearch: document.querySelector("#lecture-search"),
    lectureRefresh: document.querySelector("#lecture-refresh"),
    lectureSummary: document.querySelector("#lecture-summary"),
    lectureList: document.querySelector("#lecture-list"),
    lectureDetail: document.querySelector("#lecture-detail"),
    swaggerLink: document.querySelector("#swagger-link"),
    toast: document.querySelector("#toast")
  };

  const state = {
    apiBaseUrl: "",
    token: sessionStorage.getItem(TOKEN_KEY) || "",
    lectures: [],
    availableTags: [],
    interestTagIds: new Set(),
    archiveMode: "recent"
  };

  function configuredUrl() {
    const deployed = window.EXP_ARCHIVE_API_BASE_URL;
    const saved = localStorage.getItem(API_URL_KEY);
    const candidate = deployed && deployed !== "__EXP_ARCHIVE_API_BASE_URL__" ? deployed : saved;
    return normaliseApiUrl(candidate || "");
  }

  function normaliseApiUrl(input) {
    const raw = input.trim().replace(/\/+$/, "");
    if (!raw) return "";

    try {
      const url = new URL(raw);
      if (!["http:", "https:"].includes(url.protocol)) throw new Error("protocol");
      return url.toString().replace(/\/$/, "");
    } catch {
      return "";
    }
  }

  function apiUrl(path) {
    return `${state.apiBaseUrl}${path}`;
  }

  function headers(includeAuth = false) {
    const result = { Accept: "application/json" };
    if (includeAuth && state.token) result.Authorization = `Bearer ${state.token}`;
    return result;
  }

  async function request(path, options = {}) {
    if (!state.apiBaseUrl) throw new Error("API 주소를 먼저 설정하세요.");

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 10_000);
    try {
      const response = await fetch(apiUrl(path), {
        cache: "no-store",
        ...options,
        signal: controller.signal
      });
      const contentType = response.headers.get("content-type") || "";
      const body = contentType.includes("application/json") ? await response.json() : await response.text();
      if (!response.ok) {
        const message = typeof body === "object" && body
          ? body.message || body.error || JSON.stringify(body)
          : body;
        throw new Error(message || `요청 실패 (HTTP ${response.status})`);
      }
      return body;
    } finally {
      window.clearTimeout(timeout);
    }
  }

  function setStatus(kind, title, copy) {
    const dotClass = kind === "up" ? "status-dot--up" : kind === "down" ? "status-dot--down" : "status-dot--neutral";
    const chipTitle = kind === "up" ? "서버 정상" : kind === "down" ? "서버 확인 필요" : "연결 대상 설정 필요";
    elements.healthState.innerHTML = `<span class="status-dot ${dotClass}"></span><strong>${escapeHtml(title)}</strong>`;
    elements.healthCopy.textContent = copy;
    elements.connectionChip.innerHTML = `<span class="status-dot ${dotClass}"></span><span>${chipTitle}</span>`;
  }

  function updateConnectionUi() {
    elements.apiInput.value = state.apiBaseUrl;
    elements.healthEndpoint.textContent = state.apiBaseUrl
      ? `${state.apiBaseUrl}/actuator/health`
      : "설정 전";
    if (state.apiBaseUrl) {
      elements.swaggerLink.href = `${state.apiBaseUrl}/swagger-ui/index.html`;
      elements.swaggerLink.hidden = false;
    } else {
      elements.swaggerLink.hidden = true;
    }
    updateSessionUi();
  }

  function updateSessionUi() {
    const signedIn = Boolean(state.token);
    elements.sessionLabel.textContent = signedIn ? "현재 탭에서 로그인됨" : "로그인하지 않음";
    elements.logout.hidden = !signedIn;
    elements.interestPanel.hidden = !signedIn;
    updateArchiveModeUi();
  }

  async function checkHealth({ quiet = false } = {}) {
    if (!state.apiBaseUrl) {
      setStatus("neutral", "대기 중", "Cloud Run API 주소를 설정하면 상태를 확인합니다.");
      return;
    }

    const startedAt = performance.now();
    setStatus("neutral", "확인 중", "서버 상태를 확인하고 있습니다.");
    try {
      const body = await request("/actuator/health");
      const latency = Math.round(performance.now() - startedAt);
      const status = typeof body === "object" && body ? body.status : "UP";
      const isUp = status === "UP";
      setStatus(isUp ? "up" : "down", isUp ? "정상 작동" : `상태: ${status}`, isUp
        ? "애플리케이션 및 Health check가 응답했습니다."
        : "서버는 응답했지만 health 상태가 UP이 아닙니다.");
      elements.healthCheckedAt.textContent = new Date().toLocaleTimeString("ko-KR");
      elements.healthLatency.textContent = `${latency} ms`;
    } catch (error) {
      setStatus("down", "연결 실패", "주소, CORS 허용 목록 또는 Cloud Run 배포 상태를 확인하세요.");
      elements.healthCheckedAt.textContent = new Date().toLocaleTimeString("ko-KR");
      elements.healthLatency.textContent = "—";
      if (!quiet) showToast(toErrorMessage(error), true);
    }
  }

  async function login(event) {
    event.preventDefault();
    if (!state.apiBaseUrl) {
      showToast("먼저 Cloud Run API 주소를 저장하세요.", true);
      elements.apiInput.focus();
      return;
    }

    const email = elements.email.value.trim();
    const password = elements.password.value;
    if (!email || !password) return;

    try {
      const body = await request("/auth/login", {
        method: "POST",
        headers: { ...headers(), "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      if (!body || !body.accessToken) throw new Error("로그인 응답에 accessToken이 없습니다.");

      state.token = body.accessToken;
      sessionStorage.setItem(TOKEN_KEY, state.token);
      elements.password.value = "";
      updateSessionUi();
      showToast("로그인되었습니다. 강연을 불러옵니다.");
      await Promise.all([
        checkHealth({ quiet: true }),
        refreshLectures(),
        loadInterestSettings({ quiet: true })
      ]);
    } catch (error) {
      showToast(`로그인 실패: ${toErrorMessage(error)}`, true);
    }
  }

  function logout() {
    state.token = "";
    state.lectures = [];
    state.availableTags = [];
    state.interestTagIds = new Set();
    state.archiveMode = "recent";
    sessionStorage.removeItem(TOKEN_KEY);
    updateSessionUi();
    elements.lectureList.innerHTML = "";
    elements.lectureSummary.textContent = "로그아웃했습니다. 다시 로그인하면 강연을 불러옵니다.";
    elements.lectureDetail.innerHTML = '<p class="empty-state">왼쪽 목록에서 강연을 선택하세요.</p>';
    elements.interestTagList.innerHTML = "";
    elements.interestCopy.textContent = "로그인한 뒤 관심 키워드를 선택하세요.";
    showToast("로그아웃했습니다.");
  }

  async function refreshLectures({ quiet = false } = {}) {
    if (!state.token) {
      elements.lectureSummary.textContent = "로그인하면 최신 강연을 불러옵니다.";
      elements.lectureList.innerHTML = "";
      return;
    }

    const isInterestMode = state.archiveMode === "interest";
    const keyword = elements.lectureSearch.value.trim();
    const query = isInterestMode
      ? "/lectures/recommended?page=0&size=12"
      : keyword
        ? "/lectures/search?keyword=" + encodeURIComponent(keyword) + "&page=0&size=12"
        : "/lectures?page=0&size=12&sort=lectureDate,desc";

    elements.lectureSummary.textContent = isInterestMode
      ? "관심 강좌를 불러오는 중…"
      : keyword
        ? "“" + keyword + "” 검색 중…"
        : "최근 강연을 불러오는 중…";

    try {
      const body = await request(query, { headers: headers(true) });
      state.lectures = Array.isArray(body?.content) ? body.content : [];
      renderLectures(body, keyword, isInterestMode);
    } catch (error) {
      const message = toErrorMessage(error);
      if (/401|403|Unauthorized|Access Denied/i.test(message)) logout();
      elements.lectureSummary.textContent = "강연을 불러오지 못했습니다.";
      if (!quiet) showToast(message, true);
    }
  }

  function renderLectures(page, keyword, isInterestMode) {
    const count = Number.isFinite(page?.totalElements) ? page.totalElements : state.lectures.length;
    elements.lectureSummary.textContent = isInterestMode
      ? count
        ? "관심 키워드와 일치하는 강연 " + count + "개"
        : "선택한 관심 키워드와 일치하는 공개 강연이 없습니다."
      : keyword
        ? "검색 결과 " + count + "개"
        : "총 " + count + "개 중 최근 " + state.lectures.length + "개";

    if (!state.lectures.length) {
      elements.lectureList.innerHTML = '<p class="empty-state">표시할 강연이 없습니다.</p>';
      return;
    }

    elements.lectureList.innerHTML = state.lectures.map((lecture) => {
      const tags = Array.isArray(lecture.tags) ? lecture.tags.filter((tag) => tag?.name) : [];
      const matchingTags = tags.filter((tag) => state.interestTagIds.has(Number(tag.id)));
      const badgeTag = isInterestMode && matchingTags.length ? matchingTags[0] : tags[0];
      const date = formatDate(lecture.lectureDate);
      const presenter = lecture.lecturerName || lecture.topic || "강연 정보";
      return [
        '<button class="lecture-card" type="button" data-lecture-id="', Number(lecture.id), '">',
        '<span>',
        '<strong class="lecture-card__title">', escapeHtml(lecture.title || "제목 없음"), '</strong>',
        '<span class="lecture-card__meta">', escapeHtml(date), ' · ', escapeHtml(presenter), '</span>',
        '</span>',
        badgeTag ? '<span class="lecture-card__tag">#' + escapeHtml(badgeTag.name) + '</span>' : "",
        '</button>'
      ].join("");
    }).join("");

    elements.lectureList.querySelectorAll("[data-lecture-id]").forEach((button) => {
      button.addEventListener("click", () => loadLectureDetail(button.dataset.lectureId));
    });
  }

  async function loadInterestSettings({ quiet = false } = {}) {
    if (!state.token || !state.apiBaseUrl) return;

    elements.interestCopy.textContent = "관심 키워드 목록을 불러오는 중…";
    try {
      const results = await Promise.all([
        request("/tags", { headers: headers(true) }),
        request("/users/me/interests", { headers: headers(true) })
      ]);
      state.availableTags = Array.isArray(results[0]) ? results[0] : [];
      state.interestTagIds = new Set(
        (Array.isArray(results[1]) ? results[1] : [])
          .map((tag) => Number(tag.id))
          .filter(Number.isFinite)
      );
      renderInterestTags();
    } catch (error) {
      elements.interestCopy.textContent = "관심 키워드를 불러오지 못했습니다.";
      if (!quiet) showToast(toErrorMessage(error), true);
    }
  }

  function renderInterestTags() {
    const count = state.interestTagIds.size;
    elements.interestCopy.textContent = state.availableTags.length
      ? "관심 키워드 " + count + "개 선택됨 · 저장하면 모든 기기에서 같은 추천을 볼 수 있습니다."
      : "관리자가 등록한 키워드가 아직 없습니다.";

    if (!state.availableTags.length) {
      elements.interestTagList.innerHTML = '<p class="empty-state">선택할 키워드가 없습니다.</p>';
      return;
    }

    elements.interestTagList.innerHTML = state.availableTags.map((tag) => {
      const id = Number(tag.id);
      const checked = state.interestTagIds.has(id) ? " checked" : "";
      return '<label class="interest-chip"><input type="checkbox" value="' + id + '"' + checked + '><span>#' + escapeHtml(tag.name || "") + '</span></label>';
    }).join("");

    elements.interestTagList.querySelectorAll("input[type=checkbox]").forEach((input) => {
      input.addEventListener("change", () => {
        const tagId = Number(input.value);
        if (input.checked) {
          state.interestTagIds.add(tagId);
        } else {
          state.interestTagIds.delete(tagId);
        }
        renderInterestTags();
      });
    });
  }

  async function saveInterestTags(event) {
    event.preventDefault();
    if (!state.token) return;

    const tagIds = [...state.interestTagIds].filter(Number.isFinite);
    try {
      const savedTags = await request("/users/me/interests", {
        method: "PUT",
        headers: { ...headers(true), "Content-Type": "application/json" },
        body: JSON.stringify({ tagIds })
      });
      state.interestTagIds = new Set(
        (Array.isArray(savedTags) ? savedTags : [])
          .map((tag) => Number(tag.id))
          .filter(Number.isFinite)
      );
      renderInterestTags();
      showToast(tagIds.length ? "관심 키워드를 저장했습니다." : "관심 키워드를 모두 해제했습니다.");
      if (state.archiveMode === "interest") refreshLectures();
    } catch (error) {
      showToast(toErrorMessage(error), true);
    }
  }

  function selectArchiveMode(mode) {
    state.archiveMode = mode === "interest" ? "interest" : "recent";
    updateArchiveModeUi();
    refreshLectures();
  }

  function updateArchiveModeUi() {
    const isInterestMode = state.archiveMode === "interest";
    elements.archiveModeButtons.forEach((button) => {
      const active = button.dataset.archiveMode === state.archiveMode;
      button.classList.toggle("button--active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    elements.lectureSearch.disabled = isInterestMode;
    elements.lectureSearch.placeholder = isInterestMode
      ? "관심 강좌 보기 중"
      : "제목·주제 검색";
  }

  async function loadLectureDetail(id) {
    if (!id || !state.token) return;
    elements.lectureDetail.innerHTML = '<p class="empty-state">강연 상세를 불러오는 중…</p>';
    try {
      const lecture = await request(`/lectures/${encodeURIComponent(id)}`, { headers: headers(true) });
      renderLectureDetail(lecture);
    } catch (error) {
      elements.lectureDetail.innerHTML = '<p class="empty-state">강연 상세를 불러오지 못했습니다.</p>';
      showToast(toErrorMessage(error), true);
    }
  }

  function renderLectureDetail(lecture) {
    const tags = Array.isArray(lecture.tags) ? lecture.tags : [];
    const articles = Array.isArray(lecture.articles) ? lecture.articles : [];
    const videos = Array.isArray(lecture.videos) ? lecture.videos : [];
    const meta = [formatDate(lecture.lectureDate), lecture.location, lecture.lecturerName, lecture.topic]
      .filter(Boolean)
      .map(escapeHtml)
      .join(" · ");

    elements.lectureDetail.innerHTML = `
      <h3 class="detail-title">${escapeHtml(lecture.title || "제목 없음")}</h3>
      <p class="detail-meta">${meta || "상세 정보 없음"}</p>
      ${lecture.lectureSummary ? `<p class="detail-summary">${escapeHtml(lecture.lectureSummary)}</p>` : ""}
      ${tags.length ? `<div class="tag-list">${tags.map((tag) => `<span class="tag">${escapeHtml(tag.name || "")}</span>`).join("")}</div>` : ""}
      <section class="detail-section">
        <h3>아티클 (${articles.length})</h3>
        ${articles.length ? articles.map(renderArticle).join("") : '<p class="empty-state">등록된 아티클이 없습니다.</p>'}
      </section>
      <section class="detail-section">
        <h3>영상 (${videos.length})</h3>
        ${videos.length ? videos.map((video) => {
          const link = safeUrl(video.videoUrl);
          const label = escapeHtml(video.caption || "영상 열기");
          return link ? `<p><a href="${link}" target="_blank" rel="noreferrer">${label} ↗</a></p>` : "";
        }).join("") : '<p class="empty-state">등록된 영상이 없습니다.</p>'}
      </section>
    `;
  }

  function renderArticle(article) {
    const blocks = Array.isArray(article.blocks) ? [...article.blocks].sort((a, b) => a.orderIndex - b.orderIndex) : [];
    const blockHtml = blocks.map((block) => {
      if (block.type === "IMAGE") {
        const url = safeUrl(block.imageUrl);
        return url ? `<img class="detail-image" src="${url}" alt="${escapeHtml(block.originalFileName || "아티클 이미지")}" loading="lazy">` : "";
      }
      return block.textContent ? `<p>${escapeHtml(block.textContent)}</p>` : "";
    }).join("");
    return `
      <article class="detail-article">
        <h4>${escapeHtml(article.articleTitle || "제목 없는 아티클")}</h4>
        ${article.author ? `<p class="detail-meta">${escapeHtml(article.author)}</p>` : ""}
        ${blockHtml || '<p class="empty-state">표시할 본문이 없습니다.</p>'}
      </article>
    `;
  }

  function safeUrl(value) {
    try {
      const url = new URL(value);
      return ["http:", "https:"].includes(url.protocol) ? escapeAttribute(url.href) : "";
    } catch {
      return "";
    }
  }

  function formatDate(value) {
    if (!value) return "날짜 미정";
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? String(value)
      : new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short" }).format(date);
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function escapeAttribute(value) {
    return escapeHtml(value);
  }

  function toErrorMessage(error) {
    if (error?.name === "AbortError") return "10초 안에 응답하지 않았습니다.";
    return error?.message || "알 수 없는 오류가 발생했습니다.";
  }

  let toastTimer;
  function showToast(message, isError = false) {
    window.clearTimeout(toastTimer);
    elements.toast.textContent = message;
    elements.toast.classList.toggle("toast--error", isError);
    elements.toast.hidden = false;
    toastTimer = window.setTimeout(() => { elements.toast.hidden = true; }, 5_000);
  }

  function saveApiUrl(event) {
    event.preventDefault();
    const next = normaliseApiUrl(elements.apiInput.value);
    if (!next) {
      showToast("https://로 시작하는 올바른 API 주소를 입력하세요.", true);
      return;
    }
    const changed = next !== state.apiBaseUrl;
    state.apiBaseUrl = next;
    localStorage.setItem(API_URL_KEY, next);
    if (changed) logout();
    updateConnectionUi();
    checkHealth();
  }

  function initialise() {
    state.apiBaseUrl = configuredUrl();
    updateConnectionUi();
    elements.apiForm.addEventListener("submit", saveApiUrl);
    elements.healthRefresh.addEventListener("click", () => checkHealth());
    elements.loginForm.addEventListener("submit", login);
    elements.logout.addEventListener("click", logout);
    elements.interestForm.addEventListener("submit", saveInterestTags);
    elements.interestRefresh.addEventListener("click", () => loadInterestSettings());
    elements.showInterestLectures.addEventListener("click", () => selectArchiveMode("interest"));
    elements.archiveModeButtons.forEach((button) => {
      button.addEventListener("click", () => selectArchiveMode(button.dataset.archiveMode));
    });
    elements.lectureRefresh.addEventListener("click", () => refreshLectures());
    elements.lectureSearch.addEventListener("search", () => refreshLectures());
    elements.lectureSearch.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        refreshLectures();
      }
    });

    if (state.apiBaseUrl) checkHealth({ quiet: true });
    if (state.token) {
      refreshLectures({ quiet: true });
      loadInterestSettings({ quiet: true });
    }
  }

  initialise();
})();
