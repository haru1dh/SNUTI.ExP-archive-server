(() => {
  "use strict";

  const REFRESH_INTERVAL_MS = 30_000;
  const REQUEST_TIMEOUT_MS = 10_000;
  const API_URL_KEY = "snuti-exp-archive-api-url";
  const TOKEN_KEY = "snuti-exp-archive-access-token";
  const EMAIL_KEY = "snuti-exp-archive-email";

  const elements = {
    appMain: document.querySelector("#app-main"),
    views: document.querySelectorAll(".view"),
    navButtons: document.querySelectorAll(".nav-button"),
    connectionIndicator: document.querySelector("#connection-indicator"),
    connectionLabel: document.querySelector("#connection-label"),
    homeIntro: document.querySelector("#home-intro"),
    homeStatus: document.querySelector("#home-status"),
    homeUpdatedAt: document.querySelector("#home-updated-at"),
    homeList: document.querySelector("#home-lecture-list"),
    homeRefresh: document.querySelector("#home-refresh"),
    searchForm: document.querySelector("#search-form"),
    searchInput: document.querySelector("#lecture-search"),
    searchSummary: document.querySelector("#search-summary"),
    searchList: document.querySelector("#search-lecture-list"),
    searchRefresh: document.querySelector("#search-refresh"),
    interestForm: document.querySelector("#interest-form"),
    interestTagList: document.querySelector("#interest-tag-list"),
    interestHelp: document.querySelector("#interest-help"),
    interestSave: document.querySelector("#interest-save"),
    interestRefresh: document.querySelector("#interest-refresh"),
    interestLecturesRefresh: document.querySelector("#interest-lectures-refresh"),
    interestSummary: document.querySelector("#interest-summary"),
    interestList: document.querySelector("#interest-lecture-list"),
    signedOutCard: document.querySelector("#signed-out-card"),
    signedInCard: document.querySelector("#signed-in-card"),
    loginForm: document.querySelector("#login-form"),
    email: document.querySelector("#email"),
    password: document.querySelector("#password"),
    accountEmail: document.querySelector("#account-email"),
    accountRole: document.querySelector("#account-role"),
    logout: document.querySelector("#logout-button"),
    swaggerLink: document.querySelector("#swagger-link"),
    apiForm: document.querySelector("#api-config-form"),
    apiInput: document.querySelector("#api-base-url"),
    healthRefresh: document.querySelector("#health-refresh"),
    healthState: document.querySelector("#health-state"),
    healthLatency: document.querySelector("#health-latency"),
    healthCheckedAt: document.querySelector("#health-checked-at"),
    healthCopy: document.querySelector("#health-copy"),
    frontendRevision: document.querySelector("#frontend-revision"),
    backendRevision: document.querySelector("#backend-revision"),
    frontendDeployedAt: document.querySelector("#frontend-deployed-at"),
    versionCopy: document.querySelector("#version-copy"),
    detailSheet: document.querySelector("#detail-sheet"),
    detailContent: document.querySelector("#lecture-detail"),
    toast: document.querySelector("#toast")
  };

  const deployment = window.SNUTI_DASHBOARD_DEPLOYMENT || {};
  const state = {
    apiBaseUrl: "",
    token: sessionStorage.getItem(TOKEN_KEY) || "",
    email: sessionStorage.getItem(EMAIL_KEY) || "",
    role: "USER",
    activeView: "home",
    recentLectures: [],
    searchLectures: [],
    recommendedLectures: [],
    availableTags: [],
    interestTagIds: new Set(),
    backendRevision: "",
    lastHomeRefresh: null,
    refreshTimer: null
  };

  function configuredUrl() {
    const deployed = window.EXP_ARCHIVE_API_BASE_URL;
    const saved = localStorage.getItem(API_URL_KEY);
    const candidate = deployed && deployed !== "__EXP_ARCHIVE_API_BASE_URL__" ? deployed : saved;
    return normaliseApiUrl(candidate || "");
  }

  function normaliseApiUrl(value) {
    const raw = String(value || "").trim().replace(/\/+$/, "");
    if (!raw) return "";
    try {
      const url = new URL(raw);
      if (!["http:", "https:"].includes(url.protocol)) return "";
      return url.toString().replace(/\/$/, "");
    } catch {
      return "";
    }
  }

  function apiUrl(path) {
    return state.apiBaseUrl + path;
  }

  function isSignedIn() {
    return Boolean(state.token);
  }

  function headers(includeAuth = false) {
    const value = { Accept: "application/json" };
    if (includeAuth && state.token) value.Authorization = "Bearer " + state.token;
    return value;
  }

  async function request(path, options = {}) {
    if (!state.apiBaseUrl) throw new Error("먼저 Cloud Run API 주소를 저장하세요.");

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(apiUrl(path), {
        cache: "no-store",
        ...options,
        signal: controller.signal
      });
      if (response.status === 204) return null;

      const contentType = response.headers.get("content-type") || "";
      const body = contentType.includes("application/json")
        ? await response.json()
        : await response.text();
      if (!response.ok) {
        const message = typeof body === "object" && body
          ? body.message || body.error || JSON.stringify(body)
          : body;
        const error = new Error(message || "요청 실패 (HTTP " + response.status + ")");
        error.status = response.status;
        throw error;
      }
      return body;
    } finally {
      window.clearTimeout(timeout);
    }
  }

  function setConnection(kind, copy) {
    const dotClass = kind === "up"
      ? "status-dot--up"
      : kind === "down"
        ? "status-dot--down"
        : "status-dot--neutral";
    const label = kind === "up" ? "서버 정상" : kind === "down" ? "연결 확인" : "연결 확인 중";
    elements.connectionIndicator.innerHTML = '<span class="status-dot ' + dotClass + '"></span><span id="connection-label">' + label + "</span>";
    elements.healthState.textContent = kind === "up" ? "정상" : kind === "down" ? "연결 실패" : "확인 중";
    elements.healthCopy.textContent = copy;
  }

  function updateConfigurationUi() {
    elements.apiInput.value = state.apiBaseUrl;
    elements.swaggerLink.hidden = !state.apiBaseUrl || !isSignedIn();
    if (state.apiBaseUrl) elements.swaggerLink.href = state.apiBaseUrl + "/swagger-ui/index.html";
    updateSessionUi();
  }

  function updateSessionUi() {
    const signedIn = isSignedIn();
    elements.signedOutCard.hidden = signedIn;
    elements.signedInCard.hidden = !signedIn;
    if (signedIn) {
      elements.accountEmail.textContent = state.email || "로그인한 사용자";
      elements.accountRole.textContent = state.role === "ADMIN" ? "관리자 계정" : "일반 사용자";
    }
    elements.swaggerLink.hidden = !state.apiBaseUrl || !signedIn;
  }

  function switchView(nextView) {
    if (!nextView || nextView === state.activeView) {
      loadActiveView({ quiet: true });
      return;
    }
    state.activeView = nextView;
    elements.views.forEach((view) => {
      const active = view.dataset.view === nextView;
      view.hidden = !active;
      view.classList.toggle("view--active", active);
    });
    elements.navButtons.forEach((button) => {
      const active = button.dataset.viewTarget === nextView;
      button.classList.toggle("nav-button--active", active);
      if (active) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    });
    elements.appMain.scrollTop = 0;
    loadActiveView();
  }

  async function loadActiveView({ quiet = false } = {}) {
    if (state.activeView === "home") return loadRecentLectures({ quiet });
    if (state.activeView === "search") return runSearch({ quiet });
    if (state.activeView === "interests") {
      if (!isSignedIn()) {
        renderInterestSignedOut();
        return;
      }
      await Promise.all([loadInterestSettings({ quiet }), loadRecommendedLectures({ quiet })]);
    }
  }

  async function checkHealth({ quiet = false } = {}) {
    if (!state.apiBaseUrl) {
      setConnection("neutral", "공개 API 주소를 저장하면 서버 상태를 확인합니다.");
      elements.healthLatency.textContent = "—";
      elements.healthCheckedAt.textContent = "—";
      return false;
    }

    const startedAt = performance.now();
    setConnection("neutral", "서버 상태를 확인하고 있습니다.");
    try {
      const result = await request("/actuator/health");
      const isUp = !result || result.status === "UP";
      const latency = Math.round(performance.now() - startedAt);
      setConnection(
        isUp ? "up" : "down",
        isUp ? "Cloud Run API가 응답했습니다." : "서버는 응답했지만 health 상태가 UP이 아닙니다."
      );
      elements.healthLatency.textContent = latency + " ms";
      elements.healthCheckedAt.textContent = timeNow();
      return isUp;
    } catch (error) {
      setConnection("down", "주소, CORS 허용 목록 또는 Cloud Run 배포 상태를 확인하세요.");
      elements.healthLatency.textContent = "—";
      elements.healthCheckedAt.textContent = timeNow();
      if (!quiet) showToast(toErrorMessage(error), true);
      return false;
    }
  }

  async function loadBackendRelease({ quiet = true } = {}) {
    if (!state.apiBaseUrl) {
      state.backendRevision = "";
      renderBuildInfo();
      return;
    }
    try {
      const result = await request("/public/release");
      state.backendRevision = String(result?.revision || "");
    } catch (error) {
      state.backendRevision = "";
      if (!quiet) showToast("서버 버전을 확인하지 못했습니다: " + toErrorMessage(error), true);
    }
    renderBuildInfo();
  }

  async function loadRecentLectures({ quiet = false } = {}) {
    if (!isSignedIn()) {
      elements.homeStatus.textContent = "로그인하면 실제 강연 데이터를 불러옵니다.";
      elements.homeUpdatedAt.textContent = "내 정보 탭에서 로그인하세요.";
      elements.homeIntro.textContent = "공개 강연과 아티클을 한곳에서 찾아보세요.";
      renderEmpty(elements.homeList, "로그인 후 최근 강연이 여기에 표시됩니다.", "account");
      return;
    }
    if (!state.apiBaseUrl) {
      elements.homeStatus.textContent = "API 주소가 필요합니다.";
      elements.homeUpdatedAt.textContent = "내 정보 탭에서 Cloud Run API 주소를 저장하세요.";
      renderEmpty(elements.homeList, "연결할 API 주소를 먼저 설정하세요.", "account");
      return;
    }

    elements.homeStatus.textContent = "최근 강연을 불러오는 중입니다.";
    try {
      const page = await request("/lectures?page=0&size=8", { headers: headers(true) });
      state.recentLectures = pageContent(page);
      state.lastHomeRefresh = new Date();
      elements.homeStatus.textContent = state.recentLectures.length
        ? "실제 서버의 최근 강연 " + state.recentLectures.length + "개"
        : "표시할 공개 강연이 없습니다.";
      elements.homeUpdatedAt.textContent = "마지막 동기화 " + timeNow(state.lastHomeRefresh);
      elements.homeIntro.textContent = "로그인한 계정으로 실제 강연 데이터를 보고 있습니다.";
      renderLectureFeed(elements.homeList, state.recentLectures, "최근 강연이 없습니다.");
    } catch (error) {
      handleRequestError(error, "최근 강연을 불러오지 못했습니다.", quiet);
      renderEmpty(elements.homeList, "강연을 불러오지 못했습니다. 연결 설정을 확인하세요.", "account");
    }
  }

  async function runSearch({ quiet = false } = {}) {
    const keyword = elements.searchInput.value.trim();
    if (!isSignedIn()) {
      elements.searchSummary.textContent = "로그인이 필요합니다";
      renderEmpty(elements.searchList, "로그인하면 실제 강연을 검색할 수 있습니다.", "account");
      return;
    }
    if (!state.apiBaseUrl) {
      elements.searchSummary.textContent = "API 주소가 필요합니다";
      renderEmpty(elements.searchList, "연결할 API 주소를 먼저 설정하세요.", "account");
      return;
    }

    elements.searchSummary.textContent = keyword ? "검색 중…" : "최근 강연 불러오는 중…";
    try {
      const endpoint = keyword
        ? "/lectures/search?keyword=" + encodeURIComponent(keyword) + "&page=0&size=20"
        : "/lectures?page=0&size=20";
      const page = await request(endpoint, { headers: headers(true) });
      state.searchLectures = pageContent(page);
      const count = pageTotal(page, state.searchLectures.length);
      elements.searchSummary.textContent = keyword
        ? '“' + keyword + '” 검색 결과 ' + count + "개"
        : "최근 공개 강연 " + count + "개";
      renderLectureFeed(elements.searchList, state.searchLectures, keyword ? "검색 결과가 없습니다." : "강연이 없습니다.");
    } catch (error) {
      handleRequestError(error, "강연 검색에 실패했습니다.", quiet);
      renderEmpty(elements.searchList, "강연을 불러오지 못했습니다.", "account");
    }
  }

  async function loadInterestSettings({ quiet = false } = {}) {
    if (!isSignedIn()) {
      renderInterestSignedOut();
      return;
    }
    if (!state.apiBaseUrl) {
      elements.interestHelp.textContent = "내 정보 탭에서 Cloud Run API 주소를 저장하세요.";
      elements.interestTagList.innerHTML = "";
      elements.interestSave.disabled = true;
      return;
    }
    try {
      const [tags, interests] = await Promise.all([
        request("/tags", { headers: headers(true) }),
        request("/users/me/interests", { headers: headers(true) })
      ]);
      state.availableTags = Array.isArray(tags) ? tags : [];
      state.interestTagIds = new Set((Array.isArray(interests) ? interests : []).map((tag) => Number(tag.id)));
      renderInterestTags();
    } catch (error) {
      handleRequestError(error, "관심 키워드를 불러오지 못했습니다.", quiet);
    }
  }

  function renderInterestSignedOut() {
    elements.interestTagList.innerHTML = "";
    elements.interestHelp.textContent = "관심 키워드를 저장하려면 로그인하세요.";
    elements.interestSave.disabled = true;
    elements.interestSummary.textContent = "로그인이 필요합니다";
    renderEmpty(elements.interestList, "로그인하면 선택한 키워드에 맞는 강연을 추천합니다.", "account");
  }

  function renderInterestTags() {
    elements.interestSave.disabled = false;
    if (!state.availableTags.length) {
      elements.interestTagList.innerHTML = '<p class="empty-state">관리자가 아직 선택 가능한 태그를 등록하지 않았습니다.</p>';
      elements.interestHelp.textContent = "태그가 등록되면 여기에서 관심 주제를 선택할 수 있습니다.";
      return;
    }
    elements.interestTagList.innerHTML = state.availableTags.map((tag) => {
      const id = Number(tag.id);
      const checked = state.interestTagIds.has(id) ? " checked" : "";
      return '<label class="keyword-chip"><input type="checkbox" name="interest-tag" value="' + id + '"' + checked + '><span>#' + escapeHtml(tag.name || "") + "</span></label>";
    }).join("");
    elements.interestHelp.textContent = state.interestTagIds.size
      ? "선택한 " + state.interestTagIds.size + "개 키워드를 서버 계정에 저장합니다."
      : "최대 30개를 선택할 수 있습니다. 선택하지 않으면 추천은 비어 있습니다.";
  }

  async function saveInterestSettings(event) {
    event.preventDefault();
    if (!isSignedIn()) {
      showToast("로그인 후 관심 키워드를 저장할 수 있습니다.", true);
      switchView("account");
      return;
    }
    const checked = [...document.querySelectorAll('input[name="interest-tag"]:checked')]
      .map((input) => Number(input.value))
      .filter(Number.isFinite);
    if (checked.length > 30) {
      showToast("관심 키워드는 최대 30개까지 선택할 수 있습니다.", true);
      return;
    }
    elements.interestSave.disabled = true;
    try {
      const saved = await request("/users/me/interests", {
        method: "PUT",
        headers: { ...headers(true), "Content-Type": "application/json" },
        body: JSON.stringify({ tagIds: checked })
      });
      state.interestTagIds = new Set((Array.isArray(saved) ? saved : []).map((tag) => Number(tag.id)));
      renderInterestTags();
      showToast("관심 키워드를 저장했습니다.");
      await loadRecommendedLectures({ quiet: true });
    } catch (error) {
      handleRequestError(error, "관심 키워드 저장에 실패했습니다.", false);
    } finally {
      elements.interestSave.disabled = false;
    }
  }

  async function loadRecommendedLectures({ quiet = false } = {}) {
    if (!isSignedIn()) return;
    if (!state.apiBaseUrl) return;
    elements.interestSummary.textContent = "추천 강연을 불러오는 중…";
    try {
      const page = await request("/lectures/recommended?page=0&size=12", { headers: headers(true) });
      state.recommendedLectures = pageContent(page);
      const count = pageTotal(page, state.recommendedLectures.length);
      elements.interestSummary.textContent = count
        ? "관심 키워드와 맞는 강연 " + count + "개"
        : "아직 추천할 강연이 없습니다";
      renderLectureFeed(
        elements.interestList,
        state.recommendedLectures,
        state.interestTagIds.size
          ? "선택한 키워드와 일치하는 공개 강연이 없습니다."
          : "관심 키워드를 저장하면 맞춤 강연을 추천합니다."
      );
    } catch (error) {
      handleRequestError(error, "관심 강좌를 불러오지 못했습니다.", quiet);
      renderEmpty(elements.interestList, "관심 강좌를 불러오지 못했습니다.", "account");
    }
  }

  function renderLectureFeed(container, lectures, emptyMessage) {
    if (!lectures.length) {
      renderEmpty(container, emptyMessage);
      return;
    }
    container.innerHTML = lectures.map((lecture, index) => {
      const tags = Array.isArray(lecture.tags) ? lecture.tags : [];
      const tag = tags[0]?.name ? "#" + escapeHtml(tags[0].name) : "ARCHIVE";
      const title = escapeHtml(lecture.title || "제목 없는 강연");
      const presenter = escapeHtml(lecture.lecturerName || lecture.topic || "SNUTI ExP Archive");
      const date = escapeHtml(formatDate(lecture.lectureDate));
      const number = String(index + 1).padStart(2, "0");
      return '<button class="lecture-card" type="button" data-open-lecture="' + Number(lecture.id) + '">'
        + '<span class="lecture-card__number">' + number + "</span>"
        + '<span class="lecture-card__body"><strong>' + title + "</strong><span>" + presenter + " · " + date + "</span></span>"
        + '<span class="lecture-card__tag">' + tag + "</span>"
        + '<span class="lecture-card__arrow" aria-hidden="true">→</span>'
        + "</button>";
    }).join("");
  }

  function renderEmpty(container, message, actionView) {
    const action = actionView
      ? '<button class="empty-action" type="button" data-view-target="' + actionView + '">내 정보로 이동</button>'
      : "";
    container.innerHTML = '<div class="empty-state"><p>' + escapeHtml(message) + "</p>" + action + "</div>";
  }

  async function openLectureDetail(id) {
    if (!isSignedIn()) {
      showToast("강연 상세를 보려면 로그인하세요.", true);
      switchView("account");
      return;
    }
    elements.detailSheet.hidden = false;
    document.body.classList.add("detail-open");
    elements.detailContent.innerHTML = '<p class="empty-state">강연 상세를 불러오는 중입니다…</p>';
    try {
      const lecture = await request("/lectures/" + encodeURIComponent(id), { headers: headers(true) });
      renderLectureDetail(lecture);
    } catch (error) {
      elements.detailContent.innerHTML = '<p class="empty-state">강연 상세를 불러오지 못했습니다.</p>';
      handleRequestError(error, "강연 상세를 불러오지 못했습니다.", false);
    }
  }

  function closeLectureDetail() {
    elements.detailSheet.hidden = true;
    document.body.classList.remove("detail-open");
  }

  function renderLectureDetail(lecture) {
    const tags = Array.isArray(lecture?.tags) ? lecture.tags : [];
    const articles = Array.isArray(lecture?.articles) ? lecture.articles : [];
    const videos = Array.isArray(lecture?.videos) ? lecture.videos : [];
    const metadata = [
      formatDate(lecture?.lectureDate),
      lecture?.location,
      lecture?.lecturerName,
      lecture?.topic
    ].filter(Boolean).map(escapeHtml).join(" · ");
    elements.detailContent.innerHTML = '<p class="eyebrow">LECTURE</p>'
      + '<h2 id="detail-title">' + escapeHtml(lecture?.title || "제목 없는 강연") + "</h2>"
      + '<p class="detail-meta">' + metadata + "</p>"
      + (lecture?.lectureSummary ? '<p class="detail-summary">' + escapeHtml(lecture.lectureSummary) + "</p>" : "")
      + (tags.length ? '<div class="detail-tags">' + tags.map((tag) => '<span>#' + escapeHtml(tag?.name || "") + "</span>").join("") + "</div>" : "")
      + '<section class="detail-section"><div class="section-heading section-heading--tight"><div><p class="eyebrow">ARTICLE</p><h3>아티클 ' + articles.length + "개</h3></div></div>"
      + (articles.length ? articles.map(renderArticle).join("") : '<p class="empty-state">등록된 아티클이 없습니다.</p>')
      + "</section>"
      + '<section class="detail-section"><div class="section-heading section-heading--tight"><div><p class="eyebrow">VIDEO</p><h3>영상 ' + videos.length + "개</h3></div></div>"
      + (videos.length ? videos.map(renderVideo).join("") : '<p class="empty-state">등록된 영상이 없습니다.</p>')
      + "</section>";
  }

  function renderArticle(article) {
    const blocks = Array.isArray(article?.blocks) ? [...article.blocks].sort((a, b) => Number(a.orderIndex) - Number(b.orderIndex)) : [];
    const content = blocks.map((block) => {
      if (block?.type === "IMAGE") {
        const url = safeUrl(block.imageUrl);
        return url ? '<img class="article-image" src="' + url + '" alt="' + escapeHtml(block.originalFileName || "아티클 이미지") + '" loading="lazy">' : "";
      }
      return block?.textContent ? '<p>' + escapeHtml(block.textContent) + "</p>" : "";
    }).join("");
    return '<article class="article-card"><h4>' + escapeHtml(article?.articleTitle || "제목 없는 아티클") + "</h4>"
      + (article?.author ? '<span>' + escapeHtml(article.author) + "</span>" : "")
      + (content || '<p class="empty-state">표시할 본문이 없습니다.</p>')
      + "</article>";
  }

  function renderVideo(video) {
    const url = safeUrl(video?.videoUrl);
    if (!url) return "";
    return '<a class="video-link" href="' + url + '" target="_blank" rel="noreferrer"><span>▶</span><strong>'
      + escapeHtml(video?.caption || "영상 열기") + "</strong><span>↗</span></a>";
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
      const result = await request("/auth/login", {
        method: "POST",
        headers: { ...headers(), "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      if (!result?.accessToken) throw new Error("로그인 응답에 accessToken이 없습니다.");
      state.token = result.accessToken;
      state.email = email;
      state.role = decodeRole(result.accessToken);
      sessionStorage.setItem(TOKEN_KEY, state.token);
      sessionStorage.setItem(EMAIL_KEY, state.email);
      elements.password.value = "";
      updateConfigurationUi();
      showToast("로그인되었습니다.");
      await Promise.all([
        checkHealth({ quiet: true }),
        loadBackendRelease({ quiet: true }),
        loadRecentLectures({ quiet: true }),
        loadInterestSettings({ quiet: true })
      ]);
      switchView("home");
    } catch (error) {
      showToast("로그인 실패: " + toErrorMessage(error), true);
    }
  }

  function logout({ quiet = false } = {}) {
    state.token = "";
    state.email = "";
    state.role = "USER";
    state.recentLectures = [];
    state.searchLectures = [];
    state.recommendedLectures = [];
    state.availableTags = [];
    state.interestTagIds = new Set();
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(EMAIL_KEY);
    updateConfigurationUi();
    renderInterestSignedOut();
    if (!quiet) showToast("로그아웃했습니다.");
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
    if (changed && isSignedIn()) logout({ quiet: true });
    updateConfigurationUi();
    Promise.all([checkHealth(), loadBackendRelease({ quiet: true })]);
  }

  function renderBuildInfo() {
    const frontend = String(deployment.revision || "local-preview");
    const backend = state.backendRevision;
    elements.frontendRevision.textContent = shortRevision(frontend);
    elements.backendRevision.textContent = backend ? shortRevision(backend) : "서버 미확인";
    elements.frontendDeployedAt.textContent = deployment.deployedAt ? formatDate(deployment.deployedAt) : "로컬 미리보기";

    if (!state.apiBaseUrl) {
      elements.versionCopy.textContent = "API 주소를 저장하면 웹 화면과 서버 버전을 함께 확인합니다.";
    } else if (!backend) {
      elements.versionCopy.textContent = "API가 아직 release 정보를 제공하지 않습니다. 서버 PR도 배포하면 revision을 비교할 수 있습니다.";
    } else if (shortRevision(frontend) === shortRevision(backend)) {
      elements.versionCopy.textContent = "웹 화면과 API 서버가 같은 GitHub revision으로 배포되었습니다.";
    } else {
      elements.versionCopy.textContent = "웹 화면과 API 서버 revision이 다릅니다. 서버 배포 완료 또는 브라우저 새로고침을 확인하세요.";
    }
  }

  function startPolling() {
    window.clearInterval(state.refreshTimer);
    state.refreshTimer = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      checkHealth({ quiet: true });
      loadBackendRelease({ quiet: true });
      if (isSignedIn()) loadActiveView({ quiet: true });
    }, REFRESH_INTERVAL_MS);
  }

  function handleRequestError(error, fallback, quiet) {
    if (Number(error?.status) === 401 || Number(error?.status) === 403) {
      logout({ quiet: true });
      switchView("account");
      if (!quiet) showToast("로그인 시간이 만료되었거나 권한이 없습니다. 다시 로그인하세요.", true);
      return;
    }
    if (!quiet) showToast(fallback + " " + toErrorMessage(error), true);
  }

  function pageContent(page) {
    return Array.isArray(page?.content) ? page.content : [];
  }

  function pageTotal(page, fallback) {
    return Number.isFinite(Number(page?.totalElements)) ? Number(page.totalElements) : fallback;
  }

  function decodeRole(token) {
    try {
      const encoded = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
      const json = decodeURIComponent(atob(encoded).split("").map((char) => "%" + ("00" + char.charCodeAt(0).toString(16)).slice(-2)).join(""));
      const payload = JSON.parse(json);
      return payload.role === "ADMIN" ? "ADMIN" : "USER";
    } catch {
      return "USER";
    }
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

  function timeNow(date = new Date()) {
    return new Intl.DateTimeFormat("ko-KR", { timeStyle: "short" }).format(date);
  }

  function shortRevision(value) {
    const source = String(value || "").trim();
    return source && source !== "unknown" ? source.slice(0, 7) : "미확인";
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

  function bindEvents() {
    document.addEventListener("click", (event) => {
      const viewButton = event.target.closest("[data-view-target]");
      if (viewButton) {
        event.preventDefault();
        switchView(viewButton.dataset.viewTarget);
        return;
      }
      const lecture = event.target.closest("[data-open-lecture]");
      if (lecture) openLectureDetail(lecture.dataset.openLecture);
      if (event.target.closest("[data-close-detail]")) closeLectureDetail();
    });
    elements.homeRefresh.addEventListener("click", () => loadRecentLectures());
    elements.searchForm.addEventListener("submit", (event) => {
      event.preventDefault();
      runSearch();
    });
    elements.searchInput.addEventListener("search", () => runSearch({ quiet: true }));
    elements.searchRefresh.addEventListener("click", () => runSearch());
    elements.interestForm.addEventListener("submit", saveInterestSettings);
    elements.interestRefresh.addEventListener("click", () => loadInterestSettings());
    elements.interestLecturesRefresh.addEventListener("click", () => loadRecommendedLectures());
    elements.loginForm.addEventListener("submit", login);
    elements.logout.addEventListener("click", () => logout());
    elements.apiForm.addEventListener("submit", saveApiUrl);
    elements.healthRefresh.addEventListener("click", () => {
      checkHealth();
      loadBackendRelease({ quiet: true });
    });
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        checkHealth({ quiet: true });
        loadBackendRelease({ quiet: true });
        if (isSignedIn()) loadActiveView({ quiet: true });
      }
    });
    window.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeLectureDetail();
    });
  }

  function initialise() {
    state.apiBaseUrl = configuredUrl();
    state.role = state.token ? decodeRole(state.token) : "USER";
    updateConfigurationUi();
    renderBuildInfo();
    bindEvents();
    checkHealth({ quiet: true });
    loadBackendRelease({ quiet: true });
    loadActiveView({ quiet: true });
    startPolling();
  }

  initialise();
})();
