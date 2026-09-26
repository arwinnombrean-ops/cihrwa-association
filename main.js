/* =============================================================
   MAIN — login, router, startup
   ============================================================= */
(function () {
  const show = (id) => {
    for (const v of ["login-view", "pending-view", "app-view"]) document.getElementById(v).hidden = v !== id;
  };

  App.render = async function () {
    const [name, param] = (location.hash.slice(1) || "dashboard").split("/");
    const page = App.pages[name] || App.pages.dashboard;
    const navName = { member: "members", meeting: "meetings" }[name] || name;
    document.querySelectorAll("nav a").forEach((a) => a.classList.toggle("active", a.dataset.route === navName));
    document.getElementById("nav").classList.remove("open");

    // fresh <main> matag page aron dili magdoble ang event listeners
    const old = document.getElementById("main");
    const main = old.cloneNode(false);
    old.replaceWith(main);
    main.innerHTML = `<p class="muted">Nag-load…</p>`;
    try {
      await page(main, param);
    } catch (e) {
      console.error(e);
      main.innerHTML = `<div class="panel"><h2>Naay problema</h2><p class="error">${esc(errMsg(e))}</p>
        <button class="btn" onclick="App.render()">Sulayi pag-usab</button></div>`;
    }
    main.focus({ preventScroll: true });
  };

  async function enter(session) {
    App.session = session;
    if (!session) {
      App.profile = null;
      return show("login-view");
    }
    try {
      App.profile = await db(App.sb.from("profiles").select("*").eq("id", session.user.id).single());
    } catch (e) {
      document.getElementById("login-error").textContent = errMsg(e);
      return show("login-view");
    }
    if (App.profile.role === "pending") {
      document.getElementById("pending-email").textContent = App.profile.email;
      return show("pending-view");
    }
    await loadSettings();
    document.title = App.settings.association_name + " — Records";
    document.getElementById("brand-name").textContent = App.settings.association_name;
    document.getElementById("brand-user").textContent = `${App.profile.full_name || App.profile.email} · ${ROLES[App.profile.role]}`;
    show("app-view");
    App.render();
  }

  async function start() {
    initModal();
    const cfg = window.APP_CONFIG || {};
    if (!cfg.SUPABASE_URL || /YOUR-PROJECT/.test(cfg.SUPABASE_URL) || !window.supabase) {
      show("login-view");
      document.getElementById("login-error").textContent = !window.supabase
        ? "Wala ma-load ang Supabase library. Susiha ang internet."
        : "I-set una ang SUPABASE_URL ug SUPABASE_ANON_KEY sa js/config.js.";
      document.querySelector("#login-form button").disabled = true;
      return;
    }
    App.sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);

    document.getElementById("login-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const err = document.getElementById("login-error");
      const btn = e.target.querySelector("button");
      err.textContent = "";
      btn.disabled = true;
      const o = formToObj(e.target);
      const { error } = await App.sb.auth.signInWithPassword({ email: o.email, password: o.password });
      btn.disabled = false;
      if (error) err.textContent = errMsg(error);
    });

    const logout = async () => {
      await App.sb.auth.signOut();
      location.hash = "";
    };
    document.getElementById("logout-btn").addEventListener("click", logout);
    document.getElementById("pending-logout").addEventListener("click", logout);
    document.getElementById("nav-toggle").addEventListener("click", (e) => {
      const nav = document.getElementById("nav");
      nav.classList.toggle("open");
      e.target.setAttribute("aria-expanded", nav.classList.contains("open"));
    });
    window.addEventListener("hashchange", () => App.session && App.profile?.role !== "pending" && App.render());

    let lastUser = null;
    App.sb.auth.onAuthStateChange((event, session) => {
      const uid = session?.user?.id || null;
      if (uid === lastUser && event !== "SIGNED_OUT") return; // token refresh — walay kausaban
      lastUser = uid;
      setTimeout(() => enter(session), 0);
    });
  }

  start();
})();
