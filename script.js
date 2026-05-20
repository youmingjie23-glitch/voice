const KEYS = {
  users: "political_sections_v3_users",
  posts: "political_sections_v3_posts",
  comments: "political_sections_v3_comments",
  likes: "political_sections_v3_likes",
  currentUser: "political_sections_v3_current_user"
};

const categories = ["政治金句", "政壇迷因", "人物觀察", "理性吐槽"];
const avatarOptions = ["🧑‍💼", "🗣️", "🕵️", "😂", "📰", "🎤", "🎭", "🗳️", "🐎", "🥬", "🕶️", "🌺"];

function isImageUrl(value = "") {
  return /^https?:\/\//i.test(String(value).trim());
}

function renderAvatarContent(avatar = "🎤") {
  const safeAvatar = escapeHtml(avatar || "🎤");
  if (isImageUrl(avatar)) {
    return `<img class="avatar-img" src="${safeAvatar}" alt="使用者頭像" onerror="this.replaceWith(document.createTextNode('🎤'))" />`;
  }
  return `<span>${safeAvatar}</span>`;
}
let currentView = "home";
let currentPostId = null;
let currentSection = "forum";
let searchKeyword = "";
let selectedCategory = "全部分類";
let searchDebounceTimer = null;
let isSearchComposing = false;
let pendingLoginUserId = null;
let twoFactorChallenge = null;
let twoFactorStep = 1;
const TWO_FACTOR_TOTAL_STEPS = 2;

function id(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function getData(key) {
  return JSON.parse(localStorage.getItem(KEYS[key]) || "[]");
}

function setData(key, value) {
  localStorage.setItem(KEYS[key], JSON.stringify(value));
}

function getCurrentUserId() {
  return localStorage.getItem(KEYS.currentUser);
}

function getCurrentUser() {
  return getData("users").find(user => user.id === getCurrentUserId()) || null;
}

function escapeHtml(text = "") {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatTime(value) {
  return new Date(value).toLocaleString("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function initData() {
  if (localStorage.getItem(KEYS.users)) return;

  const now = Date.now();

  const users = [
    { id: "u_admin", username: "admin", password: "123456", nickname: "政壇觀察員", bio: "專業旁觀，理性吐槽。", avatar: "🧑‍💼" },
    { id: "u_lai", username: "lai", password: "123456", nickname: "萊爾校長", bio: "本校專長：把政見考成申論題。", avatar: "🎓" },
    { id: "u_xi", username: "xi", password: "123456", nickname: "席維尼", bio: "蜂蜜不是政策，但可以安撫情緒。", avatar: "🍯" },
    { id: "u_trump", username: "trump", password: "123456", nickname: "川建國", bio: "口頭禪：這個牆，我有想法。", avatar: "🧱" },
    { id: "u_biden", username: "biden", password: "123456", nickname: "拜登老爺爺", bio: "我不是忘記，我是在載入中。", avatar: "👴" },
    { id: "u_obama", username: "obama", password: "123456", nickname: "歐巴麻辣燙", bio: "Yes we can，但先加小辣。", avatar: "🌶️" },
    { id: "u_ko", username: "kp", password: "123456", nickname: "柯學家P", bio: "一切都要用數據說話，除了冷笑話。", avatar: "🧪" },
    { id: "u_han", username: "han", password: "123456", nickname: "韓導總召", bio: "人生如戲，記得準時開鏡。", avatar: "🎬" },
    { id: "u_tsai", username: "tsai", password: "123456", nickname: "小英便當局長", bio: "政策很複雜，便當先加滷蛋。", avatar: "🍱" },
    { id: "u_ma", username: "ma", password: "123456", nickname: "馬上好冷", bio: "我的冷笑話比民調還低溫。", avatar: "🥶" }
  ];

  const posts = [
    {
      id: "p_001",
      kind: "forum",
      title: "萊爾校長宣布：本週小考改考政見記憶力",
      politician: "萊爾校長",
      category: "理性吐槽",
      content: "今天校長上台說：同學們，政治不是背多分，是忘了也要講得很像。全場安靜三秒後，大家默默把課本換成競選公報。這篇純屬幽默創作，請勿當成新聞。",
      authorId: "u_lai",
      createdAt: new Date(now - 1000 * 60 * 60 * 28).toISOString(),
      updatedAt: new Date(now - 1000 * 60 * 60 * 28).toISOString()
    },
    {
      id: "p_002",
      kind: "forum",
      title: "席維尼開會：每人發一罐蜂蜜，民主先放旁邊",
      politician: "席維尼",
      category: "政壇迷因",
      content: "會議重點：第一，蜂蜜要甜；第二，掌聲要齊；第三，大家都說非常同意。底下有人問能不能提不同意見，主持人說：可以，但要先通過蜂蜜品質檢查。諧音梗、地獄梗，請勿上綱。",
      authorId: "u_xi",
      createdAt: new Date(now - 1000 * 60 * 60 * 24).toISOString(),
      updatedAt: new Date(now - 1000 * 60 * 60 * 24).toISOString()
    },
    {
      id: "p_003",
      kind: "forum",
      title: "川建國說要蓋牆，結果先把留言區蓋起來",
      politician: "川建國",
      category: "政治金句",
      content: "他說：我們要有最棒的牆，最漂亮的牆，連酸民都翻不過去的牆。結果第一面牆出現在留言區，大家只能按讚不能留言。這種政策執行速度，確實非常牆。",
      authorId: "u_trump",
      createdAt: new Date(now - 1000 * 60 * 60 * 18).toISOString(),
      updatedAt: new Date(now - 1000 * 60 * 60 * 18).toISOString()
    },
    {
      id: "p_004",
      kind: "forum",
      title: "拜登老爺爺發表演說：講稿在哪，我先問一下空氣",
      politician: "拜登老爺爺",
      category: "人物觀察",
      content: "整場演說最有戲的是提詞機跟空氣握手的默契。雖然節奏慢，但有一種阿公在家庭聚餐突然開始講古的親切感。請注意：這是誇張式幽默，不是事實報導。",
      authorId: "u_biden",
      createdAt: new Date(now - 1000 * 60 * 60 * 12).toISOString(),
      updatedAt: new Date(now - 1000 * 60 * 60 * 12).toISOString()
    },
    {
      id: "p_005",
      kind: "forum",
      title: "柯學家P：這不是變色龍，這叫政治光譜自適應",
      politician: "柯學家P",
      category: "理性吐槽",
      content: "有些人說立場變來變去，他說：你們不懂，這叫即時運算。支持度低的時候偏左，鏡頭來的時候偏中，票要來的時候偏右。這已經不是政治，是全自動導航。",
      authorId: "u_ko",
      createdAt: new Date(now - 1000 * 60 * 60 * 9).toISOString(),
      updatedAt: new Date(now - 1000 * 60 * 60 * 9).toISOString()
    },
    {
      id: "p_006",
      kind: "forum",
      title: "韓導總召開記者會：今天劇本走溫情路線",
      politician: "韓導總召",
      category: "人物觀察",
      content: "他一開口，全場以為是政策發表，聽到一半發現像年終晚會主持稿。優點是氣氛很滿，缺點是政策不知道坐在哪一桌。",
      authorId: "u_han",
      createdAt: new Date(now - 1000 * 60 * 60 * 6).toISOString(),
      updatedAt: new Date(now - 1000 * 60 * 60 * 6).toISOString()
    },
    {
      id: "p_007",
      kind: "image",
      title: "當川建國看到留言區又吵起來",
      politician: "川建國",
      category: "政壇迷因",
      content: "表情大概是：很好，很熱鬧，這流量我喜歡。圖片引用公開來源，僅作課堂展示與迷因風格呈現。",
      imageUrl: "https://commons.wikimedia.org/wiki/Special:FilePath/Donald_Trump_official_portrait.jpg?width=520",
      authorId: "u_trump",
      createdAt: new Date(now - 1000 * 60 * 50).toISOString(),
      updatedAt: new Date(now - 1000 * 60 * 50).toISOString()
    },
    {
      id: "p_008",
      kind: "image",
      title: "拜登老爺爺：我剛剛要講什麼來著？",
      politician: "拜登老爺爺",
      category: "政壇迷因",
      content: "適合配文：當老師問你報告做到哪，你打開資料夾發現叫做『新資料夾(12)』。",
      imageUrl: "https://commons.wikimedia.org/wiki/Special:FilePath/Joe_Biden_presidential_portrait.jpg?width=520",
      authorId: "u_biden",
      createdAt: new Date(now - 1000 * 60 * 42).toISOString(),
      updatedAt: new Date(now - 1000 * 60 * 42).toISOString()
    },
    {
      id: "p_009",
      kind: "image",
      title: "小英便當局長：先吃飯，再談國家大事",
      politician: "小英便當局長",
      category: "政治金句",
      content: "最穩的政策不是白皮書，是中午準時有便當。此為幽默貼文，請勿解讀成正式政見。",
      imageUrl: "https://commons.wikimedia.org/wiki/Special:FilePath/%E8%94%A1%E8%8B%B1%E6%96%87%E5%AE%98%E6%96%B9%E5%85%83%E9%A6%96%E8%82%96%E5%83%8F%E7%85%A7_%28cropped%29.png?width=520",
      authorId: "u_tsai",
      createdAt: new Date(now - 1000 * 60 * 31).toISOString(),
      updatedAt: new Date(now - 1000 * 60 * 31).toISOString()
    },
    {
      id: "p_010",
      kind: "image",
      title: "馬上好冷：一開口，冷氣省電模式自動啟動",
      politician: "馬上好冷",
      category: "理性吐槽",
      content: "冷笑話強度：三顆雪花。適合夏天打開來看，節能減碳。",
      imageUrl: "https://commons.wikimedia.org/wiki/Special:FilePath/President_Ma_Ying-jeou_official_portrait.png?width=520",
      authorId: "u_ma",
      createdAt: new Date(now - 1000 * 60 * 23).toISOString(),
      updatedAt: new Date(now - 1000 * 60 * 23).toISOString()
    },
    {
      id: "p_011",
      kind: "image",
      title: "歐巴麻辣燙：Yes we can，湯底要加辣",
      politician: "歐巴麻辣燙",
      category: "政治金句",
      content: "當政治演說遇到宵夜店菜單，群眾瞬間團結：老闆，我也要一份。",
      imageUrl: "https://commons.wikimedia.org/wiki/Special:FilePath/President_Barack_Obama.jpg?width=520",
      authorId: "u_obama",
      createdAt: new Date(now - 1000 * 60 * 17).toISOString(),
      updatedAt: new Date(now - 1000 * 60 * 17).toISOString()
    },
    {
      id: "p_012",
      kind: "image",
      title: "萊爾校長：集合！今天早自習讀競選公報",
      politician: "萊爾校長",
      category: "人物觀察",
      content: "學生最怕的不是段考，是校長突然說：大家來分享一下你對公共政策的看法。",
      imageUrl: "https://commons.wikimedia.org/wiki/Special:FilePath/%E8%B3%B4%E6%B8%85%E5%BE%B7%E7%B8%BD%E7%B5%B1_1.jpg?width=520",
      authorId: "u_lai",
      createdAt: new Date(now - 1000 * 60 * 8).toISOString(),
      updatedAt: new Date(now - 1000 * 60 * 8).toISOString()
    }
  ];

  const comments = [
    { id: "c_001", postId: "p_001", authorId: "u_ko", content: "這題我會，答案是：先看民調再決定怎麼答。", createdAt: new Date(now - 1000 * 60 * 60 * 20).toISOString() },
    { id: "c_002", postId: "p_002", authorId: "u_trump", content: "蜂蜜品質檢查聽起來很嚴格，我喜歡。", createdAt: new Date(now - 1000 * 60 * 60 * 18).toISOString() },
    { id: "c_003", postId: "p_003", authorId: "u_han", content: "留言區蓋牆這招很有戲劇張力。", createdAt: new Date(now - 1000 * 60 * 60 * 10).toISOString() },
    { id: "c_004", postId: "p_005", authorId: "u_ma", content: "光譜自適應，冷到我都想加外套。", createdAt: new Date(now - 1000 * 60 * 60 * 5).toISOString() },
    { id: "c_005", postId: "p_009", authorId: "u_admin", content: "便當政策我可以支持，至少肚子會投贊成票。", createdAt: new Date(now - 1000 * 60 * 20).toISOString() },
    { id: "c_006", postId: "p_012", authorId: "u_biden", content: "早自習太硬了，我可能先打瞌睡。", createdAt: new Date(now - 1000 * 60 * 5).toISOString() }
  ];

  const likes = [
    { id: "l_001", postId: "p_001", userId: "u_admin" },
    { id: "l_002", postId: "p_001", userId: "u_ko" },
    { id: "l_003", postId: "p_002", userId: "u_trump" },
    { id: "l_004", postId: "p_003", userId: "u_han" },
    { id: "l_005", postId: "p_005", userId: "u_ma" },
    { id: "l_006", postId: "p_007", userId: "u_admin" },
    { id: "l_007", postId: "p_007", userId: "u_biden" },
    { id: "l_008", postId: "p_009", userId: "u_ko" },
    { id: "l_009", postId: "p_010", userId: "u_tsai" },
    { id: "l_010", postId: "p_011", userId: "u_lai" },
    { id: "l_011", postId: "p_012", userId: "u_obama" }
  ];

  setData("users", users);
  setData("posts", posts);
  setData("comments", comments);
  setData("likes", likes);
}

function renderAuthArea() {
  const area = document.getElementById("authArea");
  const user = getCurrentUser();

  if (!user) {
    area.innerHTML = `
      <button onclick="navigate('login')">登入</button>
      <button onclick="navigate('register')">註冊</button>
    `;
    return;
  }

  area.innerHTML = `
    <span class="user-chip"><span class="mini-avatar">${renderAvatarContent(user.avatar || "🎤")}</span> ${escapeHtml(user.nickname)}</span>
    <button onclick="logout()">登出</button>
  `;
}

function navigate(view, postId = null) {
  currentView = view;
  currentPostId = postId;
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function setSection(section) {
  currentSection = section;
  currentView = "home";
  render();
}

function handleSearchInput(input) {
  searchKeyword = input.value;
  if (isSearchComposing) return;
  clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(() => render(), 250);
}

function handleSearchCompositionStart() {
  isSearchComposing = true;
  clearTimeout(searchDebounceTimer);
}

function handleSearchCompositionEnd(input) {
  isSearchComposing = false;
  searchKeyword = input.value;
  clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(() => render(), 120);
}

function runSearchNow() {
  clearTimeout(searchDebounceTimer);
  render();
}

function requireLogin(callback) {
  if (!getCurrentUser()) return openLoginModal();
  callback();
}

function openLoginModal() {
  document.getElementById("loginModal").classList.remove("hidden");
}

function closeLoginModal() {
  document.getElementById("loginModal").classList.add("hidden");
}

function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.remove("hidden");
  setTimeout(() => toast.classList.add("hidden"), 2200);
}

function render() {
  renderAuthArea();
  const app = document.getElementById("app");

  if (currentView === "home") app.innerHTML = renderHome();
  if (currentView === "login") app.innerHTML = renderLogin();
  if (currentView === "register") app.innerHTML = renderRegister();
  if (currentView === "create") app.innerHTML = renderCreatePost();
  if (currentView === "detail") app.innerHTML = renderPostDetail(currentPostId);
  if (currentView === "profile") app.innerHTML = renderProfile(currentPostId);
}

function renderHome() {
  const users = getData("users");
  const comments = getData("comments");
  const likes = getData("likes");
  let posts = getData("posts")
    .filter(post => (post.kind || "forum") === currentSection)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const keyword = searchKeyword.trim().toLowerCase();
  if (keyword) {
    posts = posts.filter(post =>
      post.title.toLowerCase().includes(keyword) ||
      post.content.toLowerCase().includes(keyword) ||
      post.politician.toLowerCase().includes(keyword)
    );
  }

  if (selectedCategory !== "全部分類") {
    posts = posts.filter(post => post.category === selectedCategory);
  }

  const cards = posts.map(post => renderPostCard(post, users, comments, likes)).join("");
  const title = currentSection === "forum" ? "論壇區" : "圖片區";
  const subtitle = currentSection === "forum"
    ? "文字討論、金句分享、人物觀察都放這裡。"
    : "政壇迷因、梗圖、海報吐槽都放這裡。圖片可使用網址。";

  return `
    <section class="hero">
      <h1>政壇哈哈鏡｜${title}</h1>
      <p>${subtitle} 用幽默看政壇，用理性聊人物。</p>
    </section>

    <div class="section-tabs">
      <button class="${currentSection === "forum" ? "active" : ""}" onclick="setSection('forum')">💬 論壇區</button>
      <button class="${currentSection === "image" ? "active" : ""}" onclick="setSection('image')">🖼️ 圖片區</button>
    </div>

    <section class="toolbar">
      <input class="form-control" value="${escapeHtml(searchKeyword)}" placeholder="搜尋標題、人物或內容..." oncompositionstart="handleSearchCompositionStart()" oncompositionend="handleSearchCompositionEnd(this)" oninput="handleSearchInput(this)" onkeydown="if(event.key==='Enter') runSearchNow()" />
      <select class="form-control" onchange="selectedCategory = this.value; render()">
        <option ${selectedCategory === "全部分類" ? "selected" : ""}>全部分類</option>
        ${categories.map(category => `<option ${selectedCategory === category ? "selected" : ""}>${category}</option>`).join("")}
      </select>
    </section>

    ${cards ? `<section class="post-grid">${cards}</section>` : `<div class="empty">目前${title}風平浪靜，還沒有人開麥。</div>`}
  `;
}

function renderPostCard(post, users, comments, likes) {
  const author = users.find(user => user.id === post.authorId);
  const likeCount = likes.filter(like => like.postId === post.id).length;
  const commentCount = comments.filter(comment => comment.postId === post.id).length;
  const preview = post.content.length > 76 ? post.content.slice(0, 76) + "……" : post.content;
  const user = getCurrentUser();
  const liked = user && likes.some(like => like.postId === post.id && like.userId === user.id);
  const isImage = (post.kind || "forum") === "image";

  return `
    <article class="card post-card">
      <span class="kind-pill">${isImage ? "🖼️ 圖片區" : "💬 論壇區"}</span>
      <span class="badge">${escapeHtml(post.category)}</span>
      ${isImage ? renderImage(post.imageUrl) : ""}
      <h2>${escapeHtml(post.title)}</h2>
      <div class="meta">
        <span>主角：${escapeHtml(post.politician)}</span>
        <button class="text-link" onclick="navigate('profile', '${author?.id || ''}')">作者：${escapeHtml(author?.nickname || "匿名觀眾")}</button>
        <span>${formatTime(post.createdAt)}</span>
      </div>
      <p class="content-preview">${escapeHtml(preview)}</p>
      <div class="meta">
        <span>👏 ${likeCount} 個掌聲</span>
        <span>💬 ${commentCount} 則吐槽</span>
      </div>
      <div class="card-actions">
        <button class="primary-btn" onclick="navigate('detail', '${post.id}')">查看全文</button>
        <button class="secondary-btn" onclick="toggleLike('${post.id}')">${liked ? "收回掌聲" : "笑死給讚"}</button>
      </div>
    </article>
  `;
}

function renderImage(url) {
  if (!url) return `<div class="image-box"><div class="image-fallback">🖼️</div></div>`;
  return `<div class="image-box"><img src="${escapeHtml(url)}" alt="貼文圖片" onerror="this.parentElement.innerHTML='<div class=&quot;image-fallback&quot;>圖片載入失敗</div>'" /></div>`;
}

function renderLogin() {
  return `
    <section class="card form-page">
      <h1>登入政壇觀眾席</h1>
      <p class="help-text">預設帳號：admin / 123456</p>
      <form onsubmit="login(event)">
        <div class="form-group"><label>帳號</label><input class="form-control" id="loginUsername" required /></div>
        <div class="form-group"><label>密碼</label><input class="form-control" id="loginPassword" type="password" required /></div>
        <div class="form-actions">
          <button class="primary-btn" type="submit">登入</button>
          <button class="secondary-btn" type="button" onclick="navigate('register')">還沒有帳號？註冊</button>
        </div>
      </form>
    </section>
  `;
}

function login(event) {
  event.preventDefault();
  const username = document.getElementById("loginUsername").value.trim();
  const password = document.getElementById("loginPassword").value;
  const user = getData("users").find(item => item.username === username && item.password === password);

  if (!user) return showToast("帳號或密碼錯了，政壇觀眾席還進不去。");
  startTwoFactor(user.id, "登入前請先完成雙重認證");
}

function renderRegister() {
  return `
    <section class="card form-page">
      <h1>註冊新帳號</h1>
      <form onsubmit="register(event)">
        <div class="form-group"><label>暱稱</label><input class="form-control" id="registerNickname" required /></div>
        <div class="form-group"><label>帳號</label><input class="form-control" id="registerUsername" required /></div>
        <div class="form-group"><label>密碼</label><input class="form-control" id="registerPassword" type="password" required /></div>
        <div class="form-group"><label>確認密碼</label><input class="form-control" id="registerConfirm" type="password" required /></div>
        <div class="form-actions">
          <button class="primary-btn" type="submit">註冊</button>
          <button class="secondary-btn" type="button" onclick="navigate('login')">已有帳號？登入</button>
        </div>
      </form>
    </section>
  `;
}

function register(event) {
  event.preventDefault();
  const nickname = document.getElementById("registerNickname").value.trim();
  const username = document.getElementById("registerUsername").value.trim();
  const password = document.getElementById("registerPassword").value;
  const confirmPassword = document.getElementById("registerConfirm").value;
  const users = getData("users");

  if (password !== confirmPassword) return showToast("兩次密碼不一樣，請重新確認。");
  if (users.some(user => user.username === username)) return showToast("這個帳號已經有人卡位了。");

  const newUser = { id: id("u"), username, password, nickname, bio: "剛加入的政壇觀眾。", avatar: "🎤" };
  users.push(newUser);
  setData("users", users);
  showToast("註冊成功，請先完成雙重認證。");
  startTwoFactor(newUser.id, "註冊完成，請通過雙重認證");
}


function startTwoFactor(userId, title = "雙重認證") {
  pendingLoginUserId = userId;
  twoFactorStep = 1;
  buildTwoFactorChallenge(title);
  document.getElementById("twoFactorModal").classList.remove("hidden");
}

function cancelTwoFactor() {
  pendingLoginUserId = null;
  twoFactorChallenge = null;
  twoFactorStep = 1;
  document.getElementById("twoFactorModal").classList.add("hidden");
  showToast("已取消雙重認證。你還在政壇觀眾席外面。");
}

const politicianCaptchaPool = [
  {
    name: "蔡英文",
    image: "https://commons.wikimedia.org/wiki/Special:FilePath/%E8%94%A1%E8%8B%B1%E6%96%87%E5%AE%98%E6%96%B9%E5%85%83%E9%A6%96%E8%82%96%E5%83%8F%E7%85%A7_%28cropped%29.png?width=420",
    source: "Wikimedia Commons"
  },
  {
    name: "馬英九",
    image: "https://commons.wikimedia.org/wiki/Special:FilePath/President_Ma_Ying-jeou_official_portrait.png?width=420",
    source: "Wikimedia Commons"
  },
  {
    name: "賴清德",
    image: "https://commons.wikimedia.org/wiki/Special:FilePath/%E8%B3%B4%E6%B8%85%E5%BE%B7%E7%B8%BD%E7%B5%B1_1.jpg?width=420",
    source: "Wikimedia Commons"
  },
  {
    name: "柯文哲",
    image: "https://commons.wikimedia.org/wiki/Special:FilePath/%E6%9F%AF%E6%96%87%E5%93%B2%E5%B8%82%E9%95%B7.jpg?width=420",
    source: "Wikimedia Commons"
  },
  {
    name: "韓國瑜",
    image: "https://commons.wikimedia.org/wiki/Special:FilePath/Han_Kuo-yu_in_2024_-_%E9%9F%93%E5%9C%8B%E7%91%9C%E7%AB%8B%E6%B3%95%E9%99%A2%E9%95%B7_%28cropped%29.jpg?width=420",
    source: "Wikimedia Commons"
  },
  {
    name: "川普",
    image: "https://commons.wikimedia.org/wiki/Special:FilePath/Donald_Trump_official_portrait.jpg?width=420",
    source: "Wikimedia Commons"
  },
  {
    name: "拜登",
    image: "https://commons.wikimedia.org/wiki/Special:FilePath/Joe_Biden_presidential_portrait.jpg?width=420",
    source: "Wikimedia Commons"
  },
  {
    name: "歐巴馬",
    image: "https://commons.wikimedia.org/wiki/Special:FilePath/President_Barack_Obama.jpg?width=420",
    source: "Wikimedia Commons"
  },
  {
    name: "賀錦麗",
    image: "https://commons.wikimedia.org/wiki/Special:FilePath/Kamala_Harris_Vice_Presidential_Portrait.jpg?width=420",
    source: "Wikimedia Commons"
  }
];

function shuffleList(list) {
  return [...list].sort(() => Math.random() - 0.5);
}

function buildTwoFactorChallenge(title) {
  const target = politicianCaptchaPool[Math.floor(Math.random() * politicianCaptchaPool.length)];
  const targetCount = Math.floor(Math.random() * 3) + 1; // 1 到 3 張正確答案，不固定
  const targetTiles = Array.from({ length: targetCount }, (_, index) => ({
    ...target,
    tileId: `${target.name}_${index}_${Date.now()}`,
    target: true,
    selected: false
  }));
  const distractors = shuffleList(politicianCaptchaPool.filter(person => person.name !== target.name))
    .slice(0, 9 - targetCount)
    .map((person, index) => ({
      ...person,
      tileId: `${person.name}_${index}_${Date.now()}`,
      target: false,
      selected: false
    }));

  twoFactorChallenge = {
    label: target.name,
    answerCount: targetCount,
    tiles: shuffleList([...targetTiles, ...distractors])
  };

  document.getElementById("twoFactorTitle").textContent = `${title}（第 ${twoFactorStep} / ${TWO_FACTOR_TOTAL_STEPS} 次）`;
  document.getElementById("twoFactorHint").textContent = `請選出所有「${target.name}」的圖片，正確答案可能不只一張。`;
  renderTwoFactorGrid();
}

function renderTwoFactorGrid() {
  const grid = document.getElementById("twoFactorGrid");
  if (!twoFactorChallenge) return;

  grid.innerHTML = twoFactorChallenge.tiles.map((tile, index) => `
    <button type="button" class="verify-tile real-person-tile ${tile.selected ? "selected" : ""}" onclick="toggleVerifyTile(${index})" aria-label="政治人物驗證圖片 ${index + 1}">
      <img src="${escapeHtml(tile.image)}" alt="政治人物驗證圖片" loading="lazy" onerror="this.parentElement.classList.add('image-error'); this.replaceWith(document.createTextNode('圖片載入失敗'))" />
      <span class="check-mark">✓</span>
    </button>
  `).join("");
}

function toggleVerifyTile(index) {
  if (!twoFactorChallenge) return;
  twoFactorChallenge.tiles[index].selected = !twoFactorChallenge.tiles[index].selected;
  renderTwoFactorGrid();
}

function verifyTwoFactor() {
  if (!twoFactorChallenge || !pendingLoginUserId) return;
  const passed = twoFactorChallenge.tiles.every(tile => tile.selected === tile.target);

  if (!passed) {
    showToast("驗證失敗，兩次驗證會重新開始。請選出所有正確圖片。");
    twoFactorStep = 1;
    buildTwoFactorChallenge("雙重認證再挑戰");
    return;
  }

  if (twoFactorStep < TWO_FACTOR_TOTAL_STEPS) {
    twoFactorStep += 1;
    showToast("第一關通過，還要再驗證一次圖片。");
    buildTwoFactorChallenge("第二次圖片驗證");
    return;
  }

  localStorage.setItem(KEYS.currentUser, pendingLoginUserId);
  pendingLoginUserId = null;
  twoFactorChallenge = null;
  twoFactorStep = 1;
  document.getElementById("twoFactorModal").classList.add("hidden");
  showToast("兩次雙重認證成功，可以開始理性吐槽了！");
  navigate("home");
}

function logout() {
  localStorage.removeItem(KEYS.currentUser);
  showToast("已登出，回到政壇觀眾席。");
  navigate("home");
}

function renderCreatePost() {
  const user = getCurrentUser();
  if (!user) return "";

  return `
    <section class="card form-page">
      <h1>我要開麥</h1>
      <p class="help-text">可以選擇發到論壇區或圖片區。圖片區請貼圖片網址，適合梗圖或海報分享。</p>
      <form onsubmit="createPost(event)">
        <div class="create-kind-box">
          <label class="kind-option"><input type="radio" name="postKind" value="forum" checked onchange="toggleImageField()" />💬 論壇區<br><span class="help-text">文字討論、金句、人物觀察</span></label>
          <label class="kind-option"><input type="radio" name="postKind" value="image" onchange="toggleImageField()" />🖼️ 圖片區<br><span class="help-text">梗圖、海報、圖片吐槽</span></label>
        </div>
        <div class="form-group"><label>貼文標題</label><input class="form-control" id="postTitle" required placeholder="例如：今天的政壇金句又來了" /></div>
        <div class="form-group"><label>政治人物名稱</label><input class="form-control" id="postPolitician" required placeholder="請使用虛構或公開人物名稱" /></div>
        <div class="form-group"><label>分類</label><select class="form-control" id="postCategory" required>${categories.map(category => `<option>${category}</option>`).join("")}</select></div>
        <div id="imageUrlGroup" class="form-group hidden"><label>圖片網址</label><input class="form-control" id="postImageUrl" placeholder="貼上圖片網址，例如 https://...jpg" /></div>
        <div class="form-group"><label>貼文內容</label><textarea class="form-control" id="postContent" required placeholder="寫下你的政壇觀察紀錄..."></textarea></div>
        <div class="form-actions">
          <button class="primary-btn" type="submit">發布貼文</button>
          <button class="ghost-btn" type="button" onclick="navigate('home')">取消</button>
        </div>
      </form>
    </section>
  `;
}

function toggleImageField() {
  const kind = document.querySelector('input[name="postKind"]:checked')?.value || "forum";
  document.getElementById("imageUrlGroup")?.classList.toggle("hidden", kind !== "image");
}

function createPost(event) {
  event.preventDefault();
  const user = getCurrentUser();
  if (!user) return openLoginModal();

  const kind = document.querySelector('input[name="postKind"]:checked')?.value || "forum";
  const imageUrl = document.getElementById("postImageUrl")?.value.trim() || "";
  if (kind === "image" && !imageUrl) return showToast("圖片區需要填圖片網址。沒有圖就像政見沒有重點，會空空的。");

  const posts = getData("posts");
  posts.push({
    id: id("p"),
    kind,
    title: document.getElementById("postTitle").value.trim(),
    politician: document.getElementById("postPolitician").value.trim(),
    category: document.getElementById("postCategory").value,
    content: document.getElementById("postContent").value.trim(),
    imageUrl,
    authorId: user.id,
    createdAt: new Date().toISOString()
  });

  setData("posts", posts);
  currentSection = kind;
  showToast("發布成功，政壇又多一則觀察紀錄！");
  navigate("home");
}

function renderPostDetail(postId) {
  const users = getData("users");
  const posts = getData("posts");
  const comments = getData("comments");
  const likes = getData("likes");
  const post = posts.find(item => item.id === postId);
  const user = getCurrentUser();

  if (!post) return `<div class="empty">找不到這篇貼文，可能已經被政壇風吹走了。</div>`;

  const author = users.find(item => item.id === post.authorId);
  const postComments = comments.filter(comment => comment.postId === post.id);
  const likeCount = likes.filter(like => like.postId === post.id).length;
  const liked = user && likes.some(like => like.postId === post.id && like.userId === user.id);
  const isOwner = user && user.id === post.authorId;
  const isImage = (post.kind || "forum") === "image";

  return `
    <article class="card detail-card">
      <span class="kind-pill">${isImage ? "🖼️ 圖片區" : "💬 論壇區"}</span>
      <span class="badge">${escapeHtml(post.category)}</span>
      ${isImage ? renderImage(post.imageUrl) : ""}
      <h1>${escapeHtml(post.title)}</h1>
      <div class="meta"><span>主角：${escapeHtml(post.politician)}</span><button class="text-link" onclick="navigate('profile', '${author?.id || ''}')">作者：${escapeHtml(author?.nickname || "匿名觀眾")}</button><span>${formatTime(post.createdAt)}</span></div>
      <div class="detail-content">${escapeHtml(post.content)}</div>
      <div class="meta"><span>👏 ${likeCount} 個掌聲</span><span>💬 ${postComments.length} 則吐槽</span></div>
      <div class="card-actions">
        <button class="secondary-btn" onclick="toggleLike('${post.id}')">${liked ? "收回掌聲" : "笑死給讚"}</button>
        ${isOwner ? `<button class="danger-btn" onclick="deletePost('${post.id}')">刪除我的貼文</button>` : ""}
        <button class="ghost-btn" onclick="navigate('home')">返回${isImage ? "圖片區" : "論壇區"}</button>
      </div>
    </article>

    <section class="card">
      <h2 class="section-title">理性吐槽區</h2>
      ${user ? `<form onsubmit="addComment(event, '${post.id}')"><textarea class="form-control" id="commentInput" required placeholder="留下你的理性吐槽..."></textarea><div class="form-actions" style="margin-top: 10px;"><button class="primary-btn" type="submit">送出留言</button></div></form>` : `<button class="secondary-btn" onclick="openLoginModal()">想留言？請先登入</button>`}
      <div class="comment-list">${postComments.length ? postComments.map(comment => renderComment(comment, users, user)).join("") : `<div class="empty">還沒有人開第一槍，理性那種。</div>`}</div>
    </section>
  `;
}

function renderComment(comment, users, user) {
  const author = users.find(item => item.id === comment.authorId);
  const canDelete = user && user.id === comment.authorId;
  return `
    <div class="comment">
      <div class="comment-head"><button class="text-link strong-link" onclick="navigate('profile', '${author?.id || ''}')">${escapeHtml(author?.nickname || "匿名觀眾")}</button><span>${formatTime(comment.createdAt)}</span></div>
      <div>${escapeHtml(comment.content)}</div>
      ${canDelete ? `<div style="margin-top: 10px;"><button class="danger-btn" onclick="deleteComment('${comment.id}')">刪除留言</button></div>` : ""}
    </div>
  `;
}

function addComment(event, postId) {
  event.preventDefault();
  const user = getCurrentUser();
  if (!user) return openLoginModal();

  const comments = getData("comments");
  comments.push({ id: id("c"), postId, authorId: user.id, content: document.getElementById("commentInput").value.trim(), createdAt: new Date().toISOString() });
  setData("comments", comments);
  showToast("留言成功，理性吐槽已上線！");
  render();
}

function deleteComment(commentId) {
  setData("comments", getData("comments").filter(comment => comment.id !== commentId));
  showToast("留言已刪除。");
  render();
}

function toggleLike(postId) {
  const user = getCurrentUser();
  if (!user) return openLoginModal();

  let likes = getData("likes");
  const found = likes.find(like => like.postId === postId && like.userId === user.id);
  if (found) {
    likes = likes.filter(like => like.id !== found.id);
    showToast("已收回掌聲。");
  } else {
    likes.push({ id: id("l"), postId, userId: user.id });
    showToast("笑死給讚成功！");
  }
  setData("likes", likes);
  render();
}

function deletePost(postId) {
  if (!confirm("確定要刪除這篇政壇觀察紀錄嗎？")) return;
  setData("posts", getData("posts").filter(post => post.id !== postId));
  setData("comments", getData("comments").filter(comment => comment.postId !== postId));
  setData("likes", getData("likes").filter(like => like.postId !== postId));
  showToast("貼文已刪除。");
  navigate("home");
}

function renderProfile(profileUserId = null) {
  const current = getCurrentUser();
  const users = getData("users");
  const targetUser = profileUserId
    ? users.find(user => user.id === profileUserId)
    : current;

  if (!targetUser) return `<div class="empty">找不到這位使用者，可能已經離開政壇觀眾席了。</div>`;

  const isOwner = current && current.id === targetUser.id;
  const posts = getData("posts");
  const likes = getData("likes");
  const comments = getData("comments");
  const userPosts = posts.filter(post => post.authorId === targetUser.id);
  const likedPostIds = likes.filter(like => like.userId === targetUser.id).map(like => like.postId);
  const likedPosts = posts.filter(post => likedPostIds.includes(post.id));
  const totalLikes = likes.filter(like => userPosts.some(post => post.id === like.postId)).length;
  const userCommentCount = comments.filter(comment => comment.authorId === targetUser.id).length;

  const editForm = isOwner ? `
      <form class="profile-editor" onsubmit="updateProfile(event)">
        <h2>修改個人頭像</h2>
        <p class="help-text">可以選 emoji 頭像，也可以貼圖片網址。按下儲存後，上方個人首頁與導覽列會立刻更新。</p>
        <div class="avatar-preview-row">
          <div class="avatar avatar-preview" id="avatarPreview">${renderAvatarContent(targetUser.avatar || "🎤")}</div>
          <div class="form-group avatar-url-group">
            <label>自訂頭像圖片網址，可空白</label>
            <input class="form-control" id="profileAvatarUrl" value="${isImageUrl(targetUser.avatar) ? escapeHtml(targetUser.avatar) : ""}" placeholder="例如：https://example.com/avatar.png" oninput="previewAvatar()" />
          </div>
        </div>
        <label class="mini-label">或選擇一個 emoji 頭像</label>
        <div class="avatar-options">
          ${avatarOptions.map(icon => `
            <label class="avatar-option ${targetUser.avatar === icon ? "selected" : ""}" onclick="setAvatarEmoji('${icon}')">
              <input type="radio" name="avatarChoice" value="${icon}" ${targetUser.avatar === icon || (!isImageUrl(targetUser.avatar) && !targetUser.avatar && icon === "🎤") ? "checked" : ""} />
              <span>${icon}</span>
            </label>
          `).join("")}
        </div>
        <div class="profile-editor-grid">
          <div class="form-group"><label>暱稱</label><input class="form-control" id="profileNickname" value="${escapeHtml(targetUser.nickname)}" required /></div>
          <div class="form-group"><label>自我介紹</label><input class="form-control" id="profileBio" value="${escapeHtml(targetUser.bio || "")}" placeholder="例如：專業旁觀，理性吐槽。" /></div>
        </div>
        <button class="primary-btn" type="submit">儲存頭像與資料</button>
      </form>` : `
      <div class="profile-public-note">
        你正在查看別人的個人首頁。可以看到他的公開資料、發文與按讚紀錄，但不能修改他的頭像。
      </div>`;

  return `
    <section class="card">
      <div class="profile-head">
        <div class="avatar avatar-large">${renderAvatarContent(targetUser.avatar || "🎤")}</div>
        <div>
          <h1 class="section-title">${escapeHtml(targetUser.nickname)} 的個人首頁</h1>
          <p class="help-text">帳號：${escapeHtml(targetUser.username)}</p>
          <p>${escapeHtml(targetUser.bio || "這位觀眾很神秘，還沒有自我介紹。")}</p>
        </div>
      </div>
      ${editForm}
      <div class="stats">
        <div class="stat"><strong>${userPosts.length}</strong><span>${isOwner ? "我的貼文" : "公開貼文"}</span></div>
        <div class="stat"><strong>${totalLikes}</strong><span>獲得掌聲</span></div>
        <div class="stat"><strong>${userCommentCount}</strong><span>${isOwner ? "我的留言" : "公開留言"}</span></div>
      </div>
    </section>
    <section class="card" style="margin-top: 16px;"><h2 class="section-title">${isOwner ? "我的政壇觀察紀錄" : "他的政壇觀察紀錄"}</h2>${userPosts.length ? userPosts.map(post => smallPostItem(post)).join("") : `<div class="empty">目前還沒有開麥。</div>`}</section>
    <section class="card" style="margin-top: 16px;"><h2 class="section-title">${isOwner ? "我按讚過的貼文" : "他按讚過的貼文"}</h2>${likedPosts.length ? likedPosts.map(post => smallPostItem(post)).join("") : `<div class="empty">目前還沒有給任何掌聲。</div>`}</section>
  `;
}

function setAvatarEmoji(icon) {
  const urlInput = document.getElementById("profileAvatarUrl");
  if (urlInput) urlInput.value = "";
  previewAvatar(icon);
}

function previewAvatar(forcedEmoji = null) {
  const preview = document.getElementById("avatarPreview");
  if (!preview) return;
  const url = document.getElementById("profileAvatarUrl")?.value.trim();
  const selectedEmoji = forcedEmoji || document.querySelector('input[name="avatarChoice"]:checked')?.value || "🎤";
  preview.innerHTML = renderAvatarContent(url || selectedEmoji);
}

function updateProfile(event) {
  event.preventDefault();
  const current = getCurrentUser();
  if (!current) return openLoginModal();

  const avatarUrl = document.getElementById("profileAvatarUrl")?.value.trim();
  const avatarEmoji = document.querySelector('input[name="avatarChoice"]:checked')?.value || current.avatar || "🎤";
  const avatar = avatarUrl || avatarEmoji;
  const nickname = document.getElementById("profileNickname").value.trim();
  const bio = document.getElementById("profileBio").value.trim();

  const users = getData("users").map(user => {
    if (user.id !== current.id) return user;
    return { ...user, avatar, nickname, bio };
  });

  setData("users", users);
  showToast("頭像已更新，政壇形象重新包裝完成！");
  render();
}

function smallPostItem(post) {
  return `
    <div class="comment" style="margin-bottom: 10px;">
      <div class="comment-head"><strong>${escapeHtml(post.title)}</strong><span>${(post.kind || "forum") === "image" ? "圖片區" : "論壇區"}｜${escapeHtml(post.category)}</span></div>
      <div class="help-text">主角：${escapeHtml(post.politician)}｜${formatTime(post.createdAt)}</div>
      <div style="margin-top: 10px;"><button class="secondary-btn" onclick="navigate('detail', '${post.id}')">查看</button></div>
    </div>
  `;
}

initData();
render();
