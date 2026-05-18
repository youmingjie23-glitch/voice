const KEYS = {
  users: "political_sections_users",
  posts: "political_sections_posts",
  comments: "political_sections_comments",
  likes: "political_sections_likes",
  currentUser: "political_sections_current_user"
};

const categories = ["政治金句", "政壇迷因", "人物觀察", "理性吐槽"];
let currentView = "home";
let currentPostId = null;
let currentSection = "forum";
let searchKeyword = "";
let selectedCategory = "全部分類";
let pendingLoginUserId = null;
let twoFactorChallenge = null;

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

  const adminId = "u_admin";
  const guestId = "u_guest";
  const now = Date.now();

  setData("users", [
    { id: adminId, username: "admin", password: "123456", nickname: "政壇觀察員", bio: "專業旁觀，理性吐槽。", avatar: "🧑‍💼" },
    { id: guestId, username: "guest", password: "123456", nickname: "路過選民", bio: "我只是來看大家怎麼說。", avatar: "📰" }
  ]);

  setData("posts", [
    {
      id: "p_1",
      kind: "forum",
      title: "王大明又說出會議室級金句",
      politician: "王大明",
      category: "政治金句",
      content: "王大明今天在公開場合表示：「我們不是慢，是正在用穩健的速度前進。」現場一片安靜，但網友已經開始準備做梗圖。",
      imageUrl: "",
      authorId: adminId,
      createdAt: new Date(now - 1000 * 60 * 60 * 6).toISOString()
    },
    {
      id: "p_2",
      kind: "forum",
      title: "李小華的表情管理是不是滿分？",
      politician: "李小華",
      category: "人物觀察",
      content: "每次鏡頭帶到李小華，她都能保持一種『我懂，但我先不說』的微笑。這種表情管理值得列入公民課教材。",
      imageUrl: "",
      authorId: guestId,
      createdAt: new Date(now - 1000 * 60 * 60 * 13).toISOString()
    },
    {
      id: "p_3",
      kind: "image",
      title: "林美月海報三連貼圖感",
      politician: "林美月",
      category: "政壇迷因",
      content: "這張海報的手勢很適合配上『我先觀望』、『我不同意但我尊重』、『這題先跳過』三連標語。",
      imageUrl: "https://images.unsplash.com/photo-1495020689067-958852a7765e?auto=format&fit=crop&w=900&q=80",
      authorId: guestId,
      createdAt: new Date(now - 1000 * 60 * 60 * 20).toISOString()
    },
    {
      id: "p_4",
      kind: "image",
      title: "陳阿強政策說明會：逗號離家出走版",
      politician: "陳阿強",
      category: "理性吐槽",
      content: "政策其實有重點，只是句子長到像一條沒有紅綠燈的馬路。",
      imageUrl: "https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?auto=format&fit=crop&w=900&q=80",
      authorId: adminId,
      createdAt: new Date(now - 1000 * 60 * 60 * 31).toISOString()
    }
  ]);

  setData("comments", [
    { id: "c_1", postId: "p_1", authorId: guestId, content: "這句真的很適合印在馬克杯上。", createdAt: new Date(now - 1000 * 60 * 40).toISOString() },
    { id: "c_2", postId: "p_4", authorId: guestId, content: "逗號離家出走這句太狠了。", createdAt: new Date(now - 1000 * 60 * 25).toISOString() }
  ]);

  setData("likes", [
    { id: "l_1", postId: "p_1", userId: guestId },
    { id: "l_2", postId: "p_1", userId: adminId },
    { id: "l_3", postId: "p_3", userId: adminId }
  ]);
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
    <span class="user-chip">${escapeHtml(user.avatar || "🎤")} ${escapeHtml(user.nickname)}</span>
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
  if (currentView === "profile") app.innerHTML = renderProfile();
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
      <input class="form-control" value="${escapeHtml(searchKeyword)}" placeholder="搜尋標題、人物或內容..." oninput="searchKeyword = this.value; render()" />
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
        <span>作者：${escapeHtml(author?.nickname || "匿名觀眾")}</span>
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
  buildTwoFactorChallenge(title);
  document.getElementById("twoFactorModal").classList.remove("hidden");
}

function cancelTwoFactor() {
  pendingLoginUserId = null;
  twoFactorChallenge = null;
  document.getElementById("twoFactorModal").classList.add("hidden");
  showToast("已取消雙重認證。你還在政壇觀眾席外面。");
}

function buildTwoFactorChallenge(title) {
  const politicians = [
    { name: "蔡英文", emoji: "🌺", partyTone: "tone-green" },
    { name: "馬英九", emoji: "🐎", partyTone: "tone-blue" },
    { name: "賴清德", emoji: "🏥", partyTone: "tone-green" },
    { name: "柯文哲", emoji: "🩺", partyTone: "tone-teal" },
    { name: "韓國瑜", emoji: "🥬", partyTone: "tone-blue" },
    { name: "川普", emoji: "🦅", partyTone: "tone-red" },
    { name: "拜登", emoji: "🕶️", partyTone: "tone-blue" },
    { name: "歐巴馬", emoji: "🎙️", partyTone: "tone-purple" },
    { name: "梅克爾", emoji: "🇩🇪", partyTone: "tone-gray" },
    { name: "邱吉爾", emoji: "🎩", partyTone: "tone-brown" }
  ];

  const picked = politicians[Math.floor(Math.random() * politicians.length)];
  const targetTiles = [0, 1, 2].map(number => ({
    ...picked,
    pose: ["公開演說", "新聞畫面", "政壇鏡頭"][number],
    target: true,
    selected: false
  }));

  const distractorTiles = politicians
    .filter(person => person.name !== picked.name)
    .sort(() => Math.random() - 0.5)
    .slice(0, 6)
    .map((person, index) => ({
      ...person,
      pose: ["政見發表", "媒體聯訪", "國會現場", "選前造勢", "記者會", "國際場合"][index],
      target: false,
      selected: false
    }));

  twoFactorChallenge = {
    label: picked.name,
    tiles: [...targetTiles, ...distractorTiles].sort(() => Math.random() - 0.5)
  };

  document.getElementById("twoFactorTitle").textContent = title;
  document.getElementById("twoFactorHint").textContent = `請選取所有包含「${picked.name}」的政治人物圖片，確認你不是政壇機器人。`;
  renderTwoFactorGrid();
}

function renderTwoFactorGrid() {
  const grid = document.getElementById("twoFactorGrid");
  if (!twoFactorChallenge) return;

  grid.innerHTML = twoFactorChallenge.tiles.map((tile, index) => `
    <button type="button" class="verify-tile politician-tile ${tile.partyTone} ${tile.selected ? "selected" : ""}" onclick="toggleVerifyTile(${index})" aria-label="${escapeHtml(tile.name)} 驗證圖片">
      <div class="politician-photo">
        <span class="politician-emoji">${escapeHtml(tile.emoji)}</span>
        <span class="politician-silhouette">👤</span>
      </div>
      <strong>${escapeHtml(tile.name)}</strong>
      <small>${escapeHtml(tile.pose)}</small>
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
    showToast("驗證失敗，請重新選一次。政壇機器人先不要混進來。");
    buildTwoFactorChallenge("雙重認證再挑戰");
    return;
  }

  localStorage.setItem(KEYS.currentUser, pendingLoginUserId);
  pendingLoginUserId = null;
  twoFactorChallenge = null;
  document.getElementById("twoFactorModal").classList.add("hidden");
  showToast("雙重認證成功，可以開始理性吐槽了！");
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
      <div class="meta"><span>主角：${escapeHtml(post.politician)}</span><span>作者：${escapeHtml(author?.nickname || "匿名觀眾")}</span><span>${formatTime(post.createdAt)}</span></div>
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
      <div class="comment-head"><strong>${escapeHtml(author?.nickname || "匿名觀眾")}</strong><span>${formatTime(comment.createdAt)}</span></div>
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

function renderProfile() {
  const user = getCurrentUser();
  if (!user) return "";

  const posts = getData("posts");
  const likes = getData("likes");
  const comments = getData("comments");
  const myPosts = posts.filter(post => post.authorId === user.id);
  const likedPostIds = likes.filter(like => like.userId === user.id).map(like => like.postId);
  const likedPosts = posts.filter(post => likedPostIds.includes(post.id));
  const totalLikes = likes.filter(like => myPosts.some(post => post.id === like.postId)).length;
  const myCommentCount = comments.filter(comment => comment.authorId === user.id).length;

  return `
    <section class="card">
      <div class="profile-head">
        <div class="avatar">${escapeHtml(user.avatar || "🎤")}</div>
        <div>
          <h1 class="section-title">${escapeHtml(user.nickname)} 的個人首頁</h1>
          <p class="help-text">帳號：${escapeHtml(user.username)}</p>
          <p>${escapeHtml(user.bio || "這位觀眾很神秘，還沒有自我介紹。")}</p>
        </div>
      </div>
      <form class="profile-editor" onsubmit="updateProfile(event)">
        <h2>修改頭像</h2>
        <div class="avatar-options">
          ${["🧑‍💼", "🗣️", "🕵️", "😂", "📰", "🎤", "🎭", "🗳️", "🐎", "🥬", "🕶️", "🌺"].map(icon => `
            <label class="avatar-option ${user.avatar === icon ? "selected" : ""}">
              <input type="radio" name="avatarChoice" value="${icon}" ${user.avatar === icon ? "checked" : ""} />
              <span>${icon}</span>
            </label>
          `).join("")}
        </div>
        <div class="profile-editor-grid">
          <div class="form-group"><label>暱稱</label><input class="form-control" id="profileNickname" value="${escapeHtml(user.nickname)}" required /></div>
          <div class="form-group"><label>自我介紹</label><input class="form-control" id="profileBio" value="${escapeHtml(user.bio || "")}" placeholder="例如：專業旁觀，理性吐槽。" /></div>
        </div>
        <button class="primary-btn" type="submit">儲存頭像與資料</button>
      </form>
      <div class="stats">
        <div class="stat"><strong>${myPosts.length}</strong><span>我的貼文</span></div>
        <div class="stat"><strong>${totalLikes}</strong><span>獲得掌聲</span></div>
        <div class="stat"><strong>${myCommentCount}</strong><span>我的留言</span></div>
      </div>
    </section>
    <section class="card" style="margin-top: 16px;"><h2 class="section-title">我的政壇觀察紀錄</h2>${myPosts.length ? myPosts.map(post => smallPostItem(post)).join("") : `<div class="empty">你還沒有開麥。</div>`}</section>
    <section class="card" style="margin-top: 16px;"><h2 class="section-title">我按讚過的貼文</h2>${likedPosts.length ? likedPosts.map(post => smallPostItem(post)).join("") : `<div class="empty">你目前還沒有給任何掌聲。</div>`}</section>
  `;
}

function updateProfile(event) {
  event.preventDefault();
  const current = getCurrentUser();
  if (!current) return openLoginModal();

  const avatar = document.querySelector('input[name="avatarChoice"]:checked')?.value || current.avatar || "🎤";
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
