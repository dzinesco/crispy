/* =============================================================
   Netscape Navigator 3 — Web Edition
   Vanilla JS. The browser is real: pages, history, menus,
   bookmarks, find, print, drag — every control does something.
   ============================================================= */

(() => {
  'use strict';

  // ============================================================
  // PAGE REGISTRY
  //
  // Each page is identified by a URL string. The browser maps the
  // URL to a renderer function. A page may also declare a title
  // (used in the title bar and bookmarks) and a favicon-glyph
  // letter for the bookmarks bar.
  // ============================================================
  const PAGES = {
    'home://welcome': {
      title: 'Welcome to Netscape',
      glyph: 'W',
      render: renderWelcome,
    },
    'home://about': {
      title: 'About This Browser',
      glyph: 'A',
      render: renderAboutPortfolio,
    },
    'home://portfolio': {
      title: 'Portfolio — Tyler Martinez',
      glyph: 'P',
      render: renderPortfolio,
    },
    'home://networks': {
      title: 'Networks — News & Weather',
      glyph: 'N',
      render: renderNews,
    },
    'home://netscape-history': {
      title: 'The Rise and Fall of Netscape',
      glyph: 'H',
      render: renderNetscapeHistory,
    },
    'home://javascript': {
      title: 'JavaScript — Live Demos',
      glyph: 'J',
      render: renderJavaScriptDemos,
    },
    'article://netscape-navigator': {
      title: 'Netscape Navigator — Wikipedia',
      glyph: 'N',
      render: renderWikipediaArticle,
    },
    'article://history-of-the-web': {
      title: 'A Brief History of the World Wide Web',
      glyph: 'W',
      render: renderHistoryWeb,
    },
  };

  // Pretty labels for the Location dropdown / status messages
  const PAGE_LABELS = Object.fromEntries(
    Object.entries(PAGES).map(([url, p]) => [url, p.title])
  );

  // ============================================================
  // STATE
  // ============================================================
  const HOME_URL = 'home://welcome';

  const state = {
    // History stack of URLs. `currentIndex` points to the page shown.
    history: [HOME_URL],
    currentIndex: 0,

    // Last URL typed into the URL bar (so we can restore it).
    typedUrl: HOME_URL,

    // Whether "Load Images" mode is on.
    showImages: true,

    // Bookmarks (persisted in localStorage).
    bookmarks: [],

    // Find state.
    find: {
      query: '',
      matches: [],     // DOM nodes that contain the text
      current: -1,
    },

    // Loading simulation.
    loading: {
      active: false,
      timer: null,
      start: 0,
      duration: 0,
    },

    // Drag state for title bars.
    drag: null,

    // Active menu popup, if any.
    activeMenu: null,
  };

  // Storage keys
  const STORAGE = {
    bookmarks: 'netscape.bookmarks.v1',
    showImages: 'netscape.showImages.v1',
  };

  // ============================================================
  // DOM HELPERS
  // ============================================================
  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function el(tag, attrs = {}, ...children) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class')   e.className = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
      else if (k === 'html') e.innerHTML = v;
      else if (k === 'text') e.textContent = v;
      else if (k.startsWith('on') && typeof v === 'function') {
        e.addEventListener(k.slice(2).toLowerCase(), v);
      } else if (v === false || v == null) {
        /* skip */
      } else if (v === true) {
        e.setAttribute(k, '');
      } else {
        e.setAttribute(k, String(v));
      }
    }
    for (const c of children.flat()) {
      if (c == null || c === false) continue;
      e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    }
    return e;
  }

  // ============================================================
  // STORAGE
  // ============================================================
  function loadBookmarks() {
    try {
      const raw = localStorage.getItem(STORAGE.bookmarks);
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) return arr.filter(b => PAGES[b.url]);
      }
    } catch (_) {}
    // Seed with a few default bookmarks (the rest can be added via "+ Add")
    return [
      { url: 'home://welcome',                  title: 'Welcome' },
      { url: 'article://netscape-navigator',    title: 'Netscape Navigator (Wikipedia)' },
      { url: 'home://javascript',               title: 'JavaScript Demos' },
      { url: 'home://netscape-history',         title: 'Netscape History' },
    ];
  }
  function saveBookmarks() {
    try { localStorage.setItem(STORAGE.bookmarks, JSON.stringify(state.bookmarks)); } catch (_) {}
  }
  function loadShowImages() {
    const v = localStorage.getItem(STORAGE.showImages);
    return v === null ? true : v === '1';
  }
  function saveShowImages() {
    try { localStorage.setItem(STORAGE.showImages, state.showImages ? '1' : '0'); } catch (_) {}
  }

  // ============================================================
  // NAVIGATION
  // ============================================================
  function navigate(url, { push = true } = {}) {
    // Resolve URLs the user might type (no protocol, etc.)
    url = resolveUrl(url);
    if (!PAGES[url]) {
      showAlert(
        'Netscape: Unable to open location',
        `The location "${url}" could not be opened. Try one of the bookmarks or a URL like:\n\n` +
        Object.keys(PAGES).slice(0, 5).map(u => '  ' + u).join('\n')
      );
      return;
    }

    if (push) {
      // Truncate forward history if user navigated from middle
      state.history = state.history.slice(0, state.currentIndex + 1);
      state.history.push(url);
      state.currentIndex = state.history.length - 1;
    } else {
      state.currentIndex = url === state.history[state.currentIndex]
        ? state.currentIndex
        : state.currentIndex;
    }

    loadPage(url);
  }

  function resolveUrl(input) {
    const s = String(input).trim();
    if (!s) return '';
    // Direct hit
    if (PAGES[s]) return s;
    // bare token like "welcome" -> home://welcome
    const token = s.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    for (const url of Object.keys(PAGES)) {
      if (url.endsWith('://' + token)) return url;
      const slug = url.split('://')[1];
      if (slug === token) return url;
    }
    return s; // unknown
  }

  function back() {
    if (state.currentIndex <= 0) return;
    state.currentIndex--;
    loadPage(state.history[state.currentIndex], { recordNav: false });
  }

  function forward() {
    if (state.currentIndex >= state.history.length - 1) return;
    state.currentIndex++;
    loadPage(state.history[state.currentIndex], { recordNav: false });
  }

  function home() { navigate(HOME_URL); }

  function reload() {
    const url = state.history[state.currentIndex];
    loadPage(url);
  }

  function stopLoading() {
    if (!state.loading.active) return;
    clearTimeout(state.loading.timer);
    setLoadingState(false);
    setProgress(0);
    setStatus('Document: Stopped.');
  }

  // ============================================================
  // PAGE LOADING (simulated network)
  // ============================================================
  function loadPage(url) {
    stopLoading();
    state.typedUrl = url;

    // Update URL bar
    $('#url-bar').value = url;

    // Update title bar
    const page = PAGES[url];
    $('#title-text').textContent = `Netscape: ${page.title}`;

    // Update toolbar button states
    refreshNavButtons();

    // Show loading animation
    setLoadingState(true);
    setStatus(`Opening location: ${url}`);
    setProgress(5);

    // Each page has a "load time" that scales with how much content
    // it has. Big article feels like a heavier page.
    const loadMs = page.title.length > 20 ? 900 : 600;

    state.loading.start = performance.now();
    state.loading.duration = loadMs;

    // Animate progress
    const tick = () => {
      const t = (performance.now() - state.loading.start) / loadMs;
      const pct = Math.min(100, Math.round(t * 100));
      setProgress(pct);
      if (t >= 1) {
        finishLoad(url);
      } else {
        state.loading.timer = setTimeout(tick, 80);
      }
    };
    state.loading.timer = setTimeout(tick, 80);
  }

  function finishLoad(url) {
    setLoadingState(false);
    setProgress(100);
    setStatus('Document: Done.');

    // Render the page into the content area
    const page = PAGES[url];
    const content = $('#content');
    content.innerHTML = '';
    content.scrollTop = 0;
    const root = document.createElement('div');
    root.className = 'page';
    page.render(root);

    // If images are off, swap all <img> for placeholders
    if (!state.showImages) {
      $$('img', root).forEach(img => {
        const ph = document.createElement('span');
        ph.className = 'noimg';
        ph.textContent = `[image: ${img.alt || 'off'}]`;
        img.replaceWith(ph);
      });
    }

    // Wire internal links so they navigate within the browser
    $$('a[data-url]', root).forEach(a => {
      a.addEventListener('click', (e) => {
        e.preventDefault();
        navigate(a.dataset.url);
      });
    });

    content.appendChild(root);
    content.focus();

    // Update "Add Bookmark" affordance
    updateBookmarkUI();
  }

  function setLoadingState(loading) {
    state.loading.active = loading;
    const nlogo = $('#title-nlogo');
    const ldot = $('#title-loading');
    if (loading) {
      nlogo.classList.add('loading');
      ldot.hidden = false;
      $('#btn-stop').disabled = false;
      $('#btn-reload').disabled = true;
    } else {
      nlogo.classList.remove('loading');
      ldot.hidden = true;
      $('#btn-stop').disabled = true;
      $('#btn-reload').disabled = false;
      setProgress(0);
    }
  }

  function setProgress(pct) {
    $('#status-progress-fill').style.width = `${pct}%`;
  }

  function setStatus(text) {
    $('#status-text').textContent = text;
  }

  // ============================================================
  // PAGE RENDERERS
  // ============================================================

  // ----- Welcome -----
  function renderWelcome(root) {
    root.innerHTML = `
      <div class="lede">
        <h1 style="border:none;margin:0 0 4px;">🌐 Welcome to <span style="color:var(--ns-blue-1);">Netscape</span></h1>
        <p style="margin:0;color:#303030;font-family:var(--font-ui);font-size:13px;">
          You are using <b>Netscape Navigator 3.04</b>, the world's most popular web browser.
        </p>
      </div>

      <div style="background:#f0f4fa;border:1px solid var(--ns-blue-1);padding:10px 14px;margin:0 0 16px;">
        <div style="font-weight:bold;color:var(--ns-blue-1);margin-bottom:4px;">What's New</div>
        <ul style="margin:0;">
          <li><a data-url="home://about" href="#">About this recreation</a></li>
          <li><a data-url="home://portfolio" href="#">Built for Tyler Martinez's portfolio</a></li>
          <li><a data-url="article://netscape-navigator" href="#">Read about the original Netscape Navigator on Wikipedia</a></li>
        </ul>
      </div>

      <h2>Where would you like to go today?</h2>

      <table style="width:100%;border-collapse:collapse;font-family:var(--font-ui);font-size:13px;">
        <tr>
          <td style="padding:8px;border:1px solid #ccc;width:33%;vertical-align:top;background:#fafafa;">
            <div style="font-weight:bold;color:var(--ns-blue-1);">📜 History</div>
            <p style="margin:4px 0;">Read the story of the browser that started the web revolution.</p>
            <a data-url="home://netscape-history" href="#">The Rise and Fall of Netscape ›</a>
          </td>
          <td style="padding:8px;border:1px solid #ccc;width:33%;vertical-align:top;background:#fafafa;">
            <div style="font-weight:bold;color:var(--ns-blue-1);">📰 News</div>
            <p style="margin:4px 0;">Headlines, weather, and what's hot on the Information Superhighway.</p>
            <a data-url="home://networks" href="#">News &amp; Weather ›</a>
          </td>
          <td style="padding:8px;border:1px solid #ccc;width:33%;vertical-align:top;background:#fafafa;">
            <div style="font-weight:bold;color:var(--ns-blue-1);">⚙️ Try it!</div>
            <p style="margin:4px 0;">Live JavaScript demos running inside this 1996 browser shell.</p>
            <a data-url="home://javascript" href="#">JavaScript Demos ›</a>
          </td>
        </tr>
      </table>

      <h2>Search the Web</h2>
      <form id="welcome-search" style="font-family:var(--font-ui);">
        <input type="text" id="welcome-search-q" placeholder="Search the web..."
          style="width:60%;padding:3px 6px;border:1px solid var(--chrome-dark);font-size:13px;" />
        <button type="submit"
          style="font-family:var(--font-ui);padding:3px 10px;background:var(--chrome-light);border:1px solid var(--chrome-dark);cursor:pointer;">
          Search
        </button>
      </form>
      <p style="font-family:var(--font-ui);font-size:12px;color:#303030;margin-top:6px;">
        Tip: type any of the page URLs (e.g. <code>welcome</code>, <code>netscape-history</code>) into
        the <b>Location</b> bar above, or use the <b>Open</b> button. Use <b>Find</b> to search the current page.
      </p>

      <hr/>

      <h2>Getting Around</h2>
      <table style="width:100%;border-collapse:collapse;font-family:var(--font-ui);font-size:13px;">
        <tr style="background:#e8e8e8;">
          <th style="text-align:left;padding:6px;border:1px solid #ccc;">Toolbar</th>
          <th style="text-align:left;padding:6px;border:1px solid #ccc;">What it does</th>
        </tr>
        <tr>
          <td style="padding:6px;border:1px solid #ccc;"><b>Back / Forward</b></td>
          <td style="padding:6px;border:1px solid #ccc;">Move through the pages you've already visited.</td>
        </tr>
        <tr>
          <td style="padding:6px;border:1px solid #ccc;"><b>Reload</b></td>
          <td style="padding:6px;border:1px solid #ccc;">Fetch the current page again.</td>
        </tr>
        <tr>
          <td style="padding:6px;border:1px solid #ccc;"><b>Home</b></td>
          <td style="padding:6px;border:1px solid #ccc;">Return to this welcome page.</td>
        </tr>
        <tr>
          <td style="padding:6px;border:1px solid #ccc;"><b>Images</b></td>
          <td style="padding:6px;border:1px solid #ccc;">Toggle whether inline images load.</td>
        </tr>
        <tr>
          <td style="padding:6px;border:1px solid #ccc;"><b>Open</b></td>
          <td style="padding:6px;border:1px solid #ccc;">Open a location by typing its URL.</td>
        </tr>
        <tr>
          <td style="padding:6px;border:1px solid #ccc;"><b>Print</b></td>
          <td style="padding:6px;border:1px solid #ccc;">"Print" the current page (it's a demo).</td>
        </tr>
        <tr>
          <td style="padding:6px;border:1px solid #ccc;"><b>Find</b></td>
          <td style="padding:6px;border:1px solid #ccc;">Search the current page for a word or phrase.</td>
        </tr>
        <tr>
          <td style="padding:6px;border:1px solid #ccc;"><b>Stop</b></td>
          <td style="padding:6px;border:1px solid #ccc;">Cancel the current page load.</td>
        </tr>
      </table>

      <p style="font-family:var(--font-ui);font-size:11px;color:#303030;margin-top:18px;text-align:center;">
        © 1996 Netscape Communications Corporation. This page is part of a portfolio recreation.
      </p>
    `;

    // Wire the search form
    const form = root.querySelector('#welcome-search');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const q = root.querySelector('#welcome-search-q').value.trim();
      if (!q) return;
      // Demo: simulate a Netscape Search result page
      loadDemoSearchPage(q);
    });
  }

  function loadDemoSearchPage(query) {
    // Build a "search results" page on the fly
    const fakeUrl = `home://netscape-history`;
    navigate(fakeUrl);
    setStatus(`Search results for "${query}"`);
  }

  // ----- About this Browser -----
  function renderAboutPortfolio(root) {
    root.innerHTML = `
      <h1>About This Browser</h1>
      <p class="lede">
        What you're looking at is a portfolio recreation of
        <b>Netscape Navigator 3.04</b> &mdash; the 1996 browser that
        brought the web to millions of desktops. It's built in pure
        HTML, CSS, and vanilla JavaScript. No frameworks, no build,
        no images.
      </p>

      <h2>What's implemented</h2>
      <ul>
        <li>All nine toolbar buttons do something real (Back, Forward,
          Reload, Home, Images, Open, Print, Find, Stop).</li>
        <li>Working menus: File, Edit, View, Go, Bookmarks, Options,
          Directory, Window, Help.</li>
        <li>A real history stack &mdash; Back and Forward walk through
          pages you've visited.</li>
        <li>Bookmarks bar with add/remove; persistent across reloads.</li>
        <li>Find-in-page with prev / next / highlight-all.</li>
        <li>The classic animated <b>N</b> logo in the title bar while
          pages "load."</li>
        <li>Progress bar in the status bar that fills as pages load.</li>
        <li>Open Location, Print, Bookmarks Manager, and About dialogs.</li>
        <li>Multiple navigable pages, including a Wikipedia article on
          Netscape Navigator itself.</li>
        <li>Light CRT overlay for retro vibes.</li>
        <li>Keyboard shortcuts: <b>Alt</b>+&lt;letter&gt; to open menus,
          <b>Ctrl+F</b> to find, <b>Ctrl+L</b> for the Location bar,
          <b>Backspace</b> for Back.</li>
      </ul>

      <h2>Why Netscape?</h2>
      <p>
        Netscape Navigator is the rare piece of software that genuinely
        changed the world. It brought the web out of academia and into
        ordinary people's living rooms. The browser wars that followed
        &mdash; with Microsoft's bundled Internet Explorer &mdash; were the
        central event of the late-1990s tech industry and led directly
        to the antitrust case against Microsoft.
      </p>
      <p>
        Recreating it is a small tribute to the team that made Mosaic,
        then Navigator, then open-sourced the codebase as
        <b>Mozilla</b> &mdash; the project that eventually gave us Firefox.
      </p>

      <blockquote>
        "The Web as I envisioned it, we have not seen it yet. The future
        is much bigger than the past."
        <br/>&mdash; Tim Berners-Lee
      </blockquote>

      <h2>Source</h2>
      <p>
        All source code lives next to this page in three plain files.
        Read them in order:
      </p>
      <ol>
        <li><code>index.html</code> &mdash; the window chrome</li>
        <li><code>styles.css</code> &mdash; the 1996 look</li>
        <li><code>app.js</code> &mdash; the browser logic</li>
      </ol>

      <p style="font-family:var(--font-ui);font-size:12px;color:#303030;margin-top:18px;">
        Continue to the
        <a data-url="home://portfolio" href="#">portfolio index</a>
        or jump straight to the
        <a data-url="article://netscape-navigator" href="#">Wikipedia article about Netscape Navigator</a>.
      </p>
    `;
  }

  // ----- Portfolio -----
  function renderPortfolio(root) {
    root.innerHTML = `
      <h1>Tyler Martinez &mdash; Portfolio</h1>
      <p class="lede">
        Welcome. This portfolio is a collection of faithful web
        recreations of classic software &mdash; the kind of interfaces
        that defined computing in the 90s and early 2000s.
      </p>

      <table style="width:100%;border-collapse:collapse;font-family:var(--font-ui);font-size:13px;">
        <tr style="background:#e8e8e8;">
          <th style="text-align:left;padding:8px;border:1px solid #ccc;width:60%;">Project</th>
          <th style="text-align:left;padding:8px;border:1px solid #ccc;">Status</th>
        </tr>
        <tr>
          <td style="padding:8px;border:1px solid #ccc;">
            <b>Netscape Navigator 3</b><br/>
            <span style="color:#303030;">The 1996 web browser, rebuilt in vanilla JS.</span>
          </td>
          <td style="padding:8px;border:1px solid #ccc;color:#006400;font-weight:bold;">● You're here</td>
        </tr>
        <tr>
          <td style="padding:8px;border:1px solid #ccc;">
            <b>Windows 98 Setup Challenge</b><br/>
            <span style="color:#303030;">Install Win98 from a floppy disk, one step at a time.</span>
          </td>
          <td style="padding:8px;border:1px solid #ccc;">Released</td>
        </tr>
        <tr>
          <td style="padding:8px;border:1px solid #ccc;">
            <b>Winamp 2 Web Edition</b><br/>
            <span style="color:#303030;">The classic MP3 player, reborn.</span>
          </td>
          <td style="padding:8px;border:1px solid #ccc;">Released</td>
        </tr>
        <tr>
          <td style="padding:8px;border:1px solid #ccc;">
            <b>iPod (4th Gen) Web Edition</b><br/>
            <span style="color:#303030;">Click Wheel music player with Spotify integration.</span>
          </td>
          <td style="padding:8px;border:1px solid #ccc;">Released</td>
        </tr>
        <tr>
          <td style="padding:8px;border:1px solid #ccc;">
            <b>The Oregon Trail</b><br/>
            <span style="color:#303030;">The 1971 educational game, with extra dysentery.</span>
          </td>
          <td style="padding:8px;border:1px solid #ccc;">Released</td>
        </tr>
      </table>

      <h2>What's in this Netscape clone</h2>
      <p>
        You can <a data-url="home://javascript" href="#">run JavaScript demos</a>,
        read the <a data-url="article://netscape-navigator" href="#">Wikipedia article
        about Netscape Navigator</a>, browse a fake
        <a data-url="home://networks" href="#">news page</a>,
        or learn the <a data-url="home://netscape-history" href="#">history
        of Netscape</a>.
      </p>
      <p>
        Try the menus at the top, especially <b>Bookmarks</b> &rarr;
        <b>Manage Bookmarks</b>, and <b>Options</b>.
      </p>
    `;
  }

  // ----- News -----
  function renderNews(root) {
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
    root.innerHTML = `
      <h1 style="margin-bottom:4px;">📰 Netscape Networks</h1>
      <p style="font-family:var(--font-ui);font-size:11px;color:#303030;margin:0 0 14px;">
        ${dateStr} &mdash; Today's headlines from the Information Superhighway
      </p>

      <div style="background:#ffffe0;border:1px solid #c0a040;padding:6px 10px;font-family:var(--font-ui);font-size:12px;margin:0 0 16px;">
        <b>BREAKING:</b> Netscape announces JavaScript 1.2 with full
        support for the DOM specification.
      </div>

      <table style="width:100%;border-collapse:collapse;font-family:var(--font-ui);">
        <tr style="background:#204080;color:#fff;">
          <th style="text-align:left;padding:6px;">Story</th>
          <th style="text-align:left;padding:6px;width:80px;">Section</th>
          <th style="text-align:right;padding:6px;width:60px;">Time</th>
        </tr>
        <tr><td style="padding:6px;border-bottom:1px solid #ddd;"><a href="#" onclick="return false">Microsoft releases Internet Explorer 3.0 for Windows 95</a></td><td style="padding:6px;border-bottom:1px solid #ddd;">Tech</td><td style="padding:6px;border-bottom:1px solid #ddd;text-align:right;">9:14 AM</td></tr>
        <tr><td style="padding:6px;border-bottom:1px solid #ddd;"><a href="#" onclick="return false">Compuserve and AOL both sign deals with Netscape</a></td><td style="padding:6px;border-bottom:1px solid #ddd;">Business</td><td style="padding:6px;border-bottom:1px solid #ddd;text-align:right;">8:42 AM</td></tr>
        <tr><td style="padding:6px;border-bottom:1px solid #ddd;"><a href="#" onclick="return false">Sun Microsystems ships Java Development Kit 1.1</a></td><td style="padding:6px;border-bottom:1px solid #ddd;">Software</td><td style="padding:6px;border-bottom:1px solid #ddd;text-align:right;">7:30 AM</td></tr>
        <tr><td style="padding:6px;border-bottom:1px solid #ddd;"><a href="#" onclick="return false">Netscape announces "Constellation" web OS project</a></td><td style="padding:6px;border-bottom:1px solid #ddd;">Tech</td><td style="padding:6px;border-bottom:1px solid #ddd;text-align:right;">Yesterday</td></tr>
        <tr><td style="padding:6px;border-bottom:1px solid #ddd;"><a href="#" onclick="return false">HTML 3.2 standard reaches "Proposed Recommendation"</a></td><td style="padding:6px;border-bottom:1px solid #ddd;">Standards</td><td style="padding:6px;border-bottom:1px solid #ddd;text-align:right;">Yesterday</td></tr>
        <tr><td style="padding:6px;border-bottom:1px solid #ddd;"><a href="#" onclick="return false">Yahoo directory hits 100,000 listings</a></td><td style="padding:6px;border-bottom:1px solid #ddd;">Web</td><td style="padding:6px;border-bottom:1px solid #ddd;text-align:right;">2 days ago</td></tr>
      </table>

      <h2>Today's Weather</h2>
      <table style="width:100%;border-collapse:collapse;font-family:var(--font-ui);font-size:13px;">
        <tr style="background:#e8e8e8;">
          <th style="text-align:left;padding:6px;">City</th>
          <th style="text-align:left;padding:6px;">Conditions</th>
          <th style="text-align:right;padding:6px;">High / Low</th>
        </tr>
        <tr><td style="padding:6px;border-bottom:1px solid #ddd;">Mountain View, CA</td><td style="padding:6px;border-bottom:1px solid #ddd;">☀️ Sunny</td><td style="padding:6px;border-bottom:1px solid #ddd;text-align:right;">72° / 55°</td></tr>
        <tr><td style="padding:6px;border-bottom:1px solid #ddd;">Redmond, WA</td><td style="padding:6px;border-bottom:1px solid #ddd;">🌧️ Light Rain</td><td style="padding:6px;border-bottom:1px solid #ddd;text-align:right;">58° / 48°</td></tr>
        <tr><td style="padding:6px;border-bottom:1px solid #ddd;">Cupertino, CA</td><td style="padding:6px;border-bottom:1px solid #ddd;">⛅ Partly Cloudy</td><td style="padding:6px;border-bottom:1px solid #ddd;text-align:right;">70° / 53°</td></tr>
        <tr><td style="padding:6px;border-bottom:1px solid #ddd;">Research Triangle Park, NC</td><td style="padding:6px;border-bottom:1px solid #ddd;">☀️ Sunny</td><td style="padding:6px;border-bottom:1px solid #ddd;text-align:right;">78° / 60°</td></tr>
      </table>

      <h2>Stock Quotes</h2>
      <table style="width:100%;border-collapse:collapse;font-family:var(--font-ui);font-size:13px;">
        <tr><td><b>NETSCAPE</b></td><td style="text-align:right;color:#006400;">↑ $58.75 (+2.25)</td></tr>
        <tr><td><b>MSFT</b></td><td style="text-align:right;color:#800000;">↓ $86.50 (-1.00)</td></tr>
        <tr><td><b>AAPL</b></td><td style="text-align:right;color:#006400;">↑ $22.00 (+0.50)</td></tr>
        <tr><td><b>IBM</b></td><td style="text-align:right;color:#303030;">— $110.25 (unch)</td></tr>
      </table>

      <p style="font-family:var(--font-ui);font-size:11px;color:#303030;text-align:center;margin-top:18px;">
        Quotes delayed 15 minutes. © 1996 Netscape Networks.
      </p>
    `;
  }

  // ----- Netscape History (custom) -----
  function renderNetscapeHistory(root) {
    root.innerHTML = `
      <h1>The Rise and Fall of Netscape</h1>
      <p class="lede">
        In 1994, two guys in Mountain View, California set out to
        build a better web browser. Within two years, their company
        was the most important on the Internet. Within four, it was
        gone. This is the story.
      </p>

      <h2>1993 &mdash; The Spark</h2>
      <p>
        <b>Marc Andreessen</b> was a part-time student at the
        National Center for Supercomputing Applications at the
        University of Illinois. He'd helped write Mosaic, the first
        popular graphical web browser. After graduating, he drove
        west and met <b>Jim Clark</b>, the recently-resigned founder
        of Silicon Graphics.
      </p>
      <p>
        Clark saw the web's commercial potential and wrote a check.
        Andreessen recruited a team. They set up shop, initially
        calling themselves <b>Mosaic Communications Corporation</b>.
        The University of Illinois objected, so they renamed the
        company to <b>Netscape Communications</b> and their browser
        to <b>Netscape Navigator</b>.
      </p>

      <h2>1994 &mdash; A Free Browser for the World</h2>
      <p>
        Navigator 1.0 shipped in December 1994. The press release
        said non-commercial users could use it free. Universities
        and libraries downloaded it by the truckload. By the time
        version 2.0 shipped in 1995, Netscape had a 50%+ share of
        the browser market.
      </p>

      <h2>1995 &mdash; The IPO Heard Round the World</h2>
      <p>
        On August 9, 1995, Netscape went public. The stock opened
        at $28 and ended its first day at $58.75. By year-end it
        was above $130. Netscape had done something nobody had ever
        done: taken a software company public without ever making a
        profit. The era of the Internet company had begun.
      </p>

      <h2>1995 &mdash; Microsoft Wakes Up</h2>
      <p>
        Microsoft had been dismissive of the Internet. Bill Gates'
        famous May 1995 "Internet Tidal Wave" memo finally got the
        company's attention. They licensed the original Mosaic code
        from Spyglass and built <b>Internet Explorer</b>.
      </p>

      <h2>1996 &mdash; The Browser Wars</h2>
      <p>
        Microsoft shipped IE 3.0 and bundled it with Windows 95.
        IE 4.0 came in 1997. Both Netscape and Microsoft added
        proprietary extensions to HTML &mdash; frames, marquees,
        blink, VML, ActiveX &mdash; trying to lock web developers
        into their platform. The web was fragmenting into
        "Best viewed in Netscape" and "Best viewed in Internet
        Explorer."
      </p>

      <h2>1998 &mdash; Open Sourcing Mozilla</h2>
      <p>
        Netscape was losing share fast. In January 1998, they did
        something extraordinary: they open-sourced the entire
        browser engine as the <b>Mozilla</b> project. Within a
        year, AOL bought Netscape. The Mozilla codebase was
        eventually rewritten around a new layout engine called
        <b>Gecko</b>, and from that project came <b>Firefox</b>,
        <b>Thunderbird</b>, and the modern Mozilla Corporation.
      </p>

      <h2>2008 &mdash; End of the Line</h2>
      <p>
        AOL discontinued development of Netscape Navigator on
        December 28, 2007, and pulled the plug on support on March
        1, 2008. The browser that had started the web revolution
        was finally gone. But the legacy lived on &mdash; in
        JavaScript, in open-source browsers, and in every
        developer who ever typed
        <code>navigator.userAgent</code>.
      </p>

      <blockquote>
        "The best way to predict the future is to invent it."
        <br/>&mdash; Alan Kay
      </blockquote>

      <p>
        Continue to the
        <a data-url="article://netscape-navigator" href="#">Wikipedia article on Netscape Navigator</a>
        or
        <a data-url="article://history-of-the-web" href="#">A Brief History of the World Wide Web</a>.
      </p>
    `;
  }

  // ----- JavaScript demos -----
  function renderJavaScriptDemos(root) {
    root.innerHTML = `
      <h1>JavaScript &mdash; Live Demos</h1>
      <p class="lede">
        JavaScript was invented at Netscape in 1995. Here are some
        live demos running inside this page.
      </p>

      <h2>1. Hello, <span id="js1-name">world</span>!</h2>
      <p>
        Type your name:
        <input type="text" id="js1-input" placeholder="your name"
          style="padding:3px 6px;border:1px solid var(--chrome-dark);" />
      </p>
      <p id="js1-out" style="font-family:monospace;background:#f4f4f4;padding:8px;">
        Output will appear here.
      </p>

      <h2>2. Counter</h2>
      <p>
        <button id="js2-dec"
          style="font-family:var(--font-ui);padding:3px 10px;background:var(--chrome-light);border:1px solid var(--chrome-dark);cursor:pointer;">
          &minus;
        </button>
        <span id="js2-val" style="display:inline-block;width:60px;text-align:center;font-family:monospace;font-size:20px;font-weight:bold;">0</span>
        <button id="js2-inc"
          style="font-family:var(--font-ui);padding:3px 10px;background:var(--chrome-light);border:1px solid var(--chrome-dark);cursor:pointer;">
          +
        </button>
      </p>

      <h2>3. Show / Hide</h2>
      <p>
        <button id="js3-toggle"
          style="font-family:var(--font-ui);padding:3px 10px;background:var(--chrome-light);border:1px solid var(--chrome-dark);cursor:pointer;">
          Toggle secret message
        </button>
      </p>
      <div id="js3-secret" style="display:none;background:#ffffe0;border:1px dashed #c0a040;padding:8px;font-family:monospace;">
        🎉 Easter egg! The year is ${new Date().getFullYear()}.
        <br/>JavaScript was born in <b>May 1995</b> at Netscape.
      </div>

      <h2>4. LocalStorage</h2>
      <p>
        Things you bookmark here are stored in <code>localStorage</code>:
      </p>
      <pre style="background:#f4f4f4;padding:8px;font-size:12px;">localStorage keys: <span id="js4-keys"></span></pre>

      <h2>5. Date &amp; Time</h2>
      <p id="js5-clock" style="font-family:monospace;font-size:18px;"></p>
    `;

    // Demo 1: live name
    const nameOut = root.querySelector('#js1-name');
    const nameInput = root.querySelector('#js1-input');
    const out = root.querySelector('#js1-out');
    function update1() {
      const n = nameInput.value.trim() || 'world';
      nameOut.textContent = n;
      out.textContent = `console.log("Hello, ${n}!");\n// -> Hello, ${n}!`;
    }
    nameInput.addEventListener('input', update1);
    update1();

    // Demo 2: counter
    let count = 0;
    const cVal = root.querySelector('#js2-val');
    root.querySelector('#js2-inc').addEventListener('click', () => { count++; cVal.textContent = count; });
    root.querySelector('#js2-dec').addEventListener('click', () => { count--; cVal.textContent = count; });

    // Demo 3: toggle
    const secret = root.querySelector('#js3-secret');
    root.querySelector('#js3-toggle').addEventListener('click', () => {
      secret.style.display = secret.style.display === 'none' ? 'block' : 'none';
    });

    // Demo 4: localStorage
    const keysOut = root.querySelector('#js4-keys');
    function update4() {
      try {
        const keys = Object.keys(localStorage);
        keysOut.textContent = keys.length ? keys.join(', ') : '(none)';
      } catch (_) { keysOut.textContent = '(localStorage unavailable)'; }
    }
    update4();
    window.addEventListener('storage', update4);
    // Update when the page is loaded (in case bookmarks changed meanwhile)
    state._refreshJs4 = update4;

    // Demo 5: clock
    const clock = root.querySelector('#js5-clock');
    function tick5() {
      const d = new Date();
      clock.textContent = d.toLocaleString();
    }
    tick5();
    setInterval(tick5, 1000);
  }

  // ----- Wikipedia article: Netscape Navigator -----
  function renderWikipediaArticle(root) {
    root.innerHTML = `
      <div class="infobox">
        <h4>Netscape Navigator</h4>
        <div style="text-align:center;background:#fff;padding:8px;border:1px solid #888;">
          <div class="ascii-art">+----------+
|    N     |
|     &gt;    |
|  1994    |
+----------+</div>
        </div>
        <table>
          <tr><th>Developer</th><td>Netscape</td></tr>
          <tr><th>Initial release</th><td>15 December 1994</td></tr>
          <tr><th>Final release</th><td>9.0.0.6 (20 Feb 2008)</td></tr>
          <tr><th>Type</th><td>Web browser</td></tr>
          <tr><th>Engine</th><td>Originally Netscape; later Gecko</td></tr>
          <tr><th>OS</th><td>Windows, Mac, Linux, OS/2, many Unix</td></tr>
        </table>
      </div>

      <h1>Netscape Navigator</h1>
      <p class="lede">
        <b>Netscape Navigator</b> was a brand of web browsers first
        developed and sold by <a href="#" onclick="return false">Netscape Communications Corporation</a>
        in 1994 that was progressively developed until its
        discontinuation in the late 1990s before the brand was
        briefly revived for the release of <a href="#" onclick="return false">Netscape Navigator 9</a>
        under AOL in 2007. It was the flagship product of the
        Netscape Communications Corporation and was the dominant
        web browser in terms of usage share in the 1990s, but by
        around 2003 its user base had all but disappeared. This
        was partly because Microsoft bundled <a href="#" onclick="return false">Internet Explorer</a>
        with the Windows operating system.
      </p>
      <p>
        The business demise of Netscape was a central premise of
        <a href="#" onclick="return false">Microsoft's antitrust trial</a>, wherein
        the Court ruled that Microsoft's bundling of Internet
        Explorer with the Windows operating system was a
        monopolistic and illegal business practice. The decision
        came too late for Netscape, however, as Internet Explorer
        had by then become the dominant web browser for Windows.
      </p>
      <p>
        Initially a standalone product, the Netscape Navigator
        browser was incorporated into the <a href="#" onclick="return false">Netscape Communicator</a>
        internet suite in 1997.
      </p>
      <p>
        After primary development of the browser engine transitioned
        to the open source <a href="#" onclick="return false">Mozilla project</a>, which included
        a rewrite of the engine source code, the Netscape Navigator
        brand name returned in 2007 when AOL announced Netscape
        Navigator 9. On December 28, 2007, AOL canceled its
        development but continued supporting the web browser with
        security updates until March 1, 2008. AOL allows downloading
        of archived versions of the Netscape Navigator web browser
        family.
      </p>

      <h2>History and development</h2>

      <h3>Origin</h3>
      <p>
        Netscape Navigator was inspired by the success of
        <a href="#" onclick="return false">NCSA Mosaic</a>, which was co-written by
        <a href="#" onclick="return false">Marc Andreessen</a>, a part-time employee of the
        National Center for Supercomputing Applications at the
        University of Illinois. After Andreessen graduated in
        1993, he moved to California and there met
        <a href="#" onclick="return false">Jim Clark</a>, the recently departed
        founder of Silicon Graphics. Clark believed that the
        Mosaic browser had great commercial possibilities and
        provided the seed money. Soon Mosaic Communications
        Corporation was in business in Mountain View, California,
        with Andreessen as a vice-president. Since the University
        of Illinois was unhappy with the company's use of the
        Mosaic name, the company changed its name to Netscape
        Communications (suggested by product manager Greg Sands)
        and named its flagship web browser Netscape Navigator.
      </p>
      <p>
        Netscape announced in its first press release
        (October 13, 1994) that it would make Navigator available
        without charge to all non-commercial users, and beta
        versions of version 1.0 and 1.1 were freely downloadable
        in November 1994 and March 1995, with the full version
        1.0 available in December 1994. However, two months later,
        the company announced that only educational and non-profit
        institutions could use version 1.0 at no charge.
      </p>
      <p>
        The reversal was complete with the availability of version
        1.1 beta on March 6, 1995, in which a press release states
        that the final 1.1 release would be available at no cost
        only for academic and non-profit organizational use.
      </p>
      <p>
        The first few releases of the product were made available
        in "commercial" and "evaluation" versions; for example,
        version "1.0" and version "1.0N". The "N" evaluation
        versions were identical to the commercial versions; the
        letter was intended as a reminder to people to pay for
        the browser once they felt they had tried it long enough
        and were satisfied with it. This distinction was formally
        dropped within a year of the initial release, and the
        full version of the browser continued to be made available
        for free online, with boxed versions available on floppy
        disks (and later CDs) in stores along with a period of
        phone support. During this era, "Internet Starter Kit"
        books were popular, and usually included a floppy disk or
        CD containing internet software, and this was a popular
        means of obtaining Netscape's and other browsers. Email
        support was initially free and remained so for a year or two
        until the volume of support requests grew too high.
      </p>
      <p>
        During development, the Netscape browser was known by the
        code name <b>Mozilla</b>, which became the name of a
        Godzilla-like cartoon dragon mascot used prominently on
        the company's website. The Mozilla name was also used as
        the User-Agent in HTTP requests by the browser. Other web
        browsers claimed to be compatible with Netscape's
        extensions to HTML and therefore used the same name in
        their User-Agent identifiers so that web servers would send
        them the same pages as were sent to Netscape browsers.
        Mozilla is now a generic name for matters related to the
        open source successor to Netscape Communicator and is
        most identified with the browser Firefox.
      </p>

      <h3>Rise</h3>
      <p>
        When the consumer Internet revolution arrived in the
        mid-1990s, Netscape was well-positioned to take advantage
        of it and the influx of new users it brought. With a good
        mix of features and an attractive licensing scheme that
        allowed free use for non-commercial purposes, the Netscape
        browser soon became the de facto standard, particularly on
        the Windows platform. Internet service providers and
        computer magazine publishers helped make Navigator readily
        available.
      </p>
      <p>
        An innovation that Netscape introduced in 1994 was the
        <b>on-the-fly display of web pages</b>, where text and
        graphics appeared on the screen as the web page
        downloaded. Earlier web browsers would not display a page
        until all graphics on it had been loaded over the network
        connection; this meant a user might have only a blank page
        for several minutes. With Netscape, people using dial-up
        connections could begin reading the text of a web page
        within seconds of entering an address, even before the
        rest of the text and graphics had finished downloading.
        This made the web much more tolerable to the average user.
      </p>
      <p>
        Through the late 1990s, Netscape made sure that Navigator
        remained the technical leader among web browsers. New
        features included cookies, frames, proxy auto-config, and
        JavaScript (in version 2.0). Although those and other
        innovations eventually became open standards of the
        <a href="#" onclick="return false">W3C</a> and <a href="#" onclick="return false">ECMA</a> and were emulated
        by other browsers, they were often viewed as controversial.
        Netscape, according to critics, was more interested in
        bending the web to its own de facto "standards"
        (bypassing standards committees and thus marginalizing
        the commercial competition) than it was in fixing bugs in
        its products. Consumer rights advocates were particularly
        critical of cookies and of commercial websites using them
        to invade individual privacy.
      </p>
      <p>
        In the marketplace, however, these concerns made little
        difference. Netscape Navigator remained the market leader
        with more than 50% usage share. Navigator releases were
        supported on a wide range of operating systems, including
        Windows (3.1, 95, 98, NT), Macintosh, Linux, OS/2, and
        many versions of Unix including OSF/1, Sun Solaris,
        BSD/OS, IRIX, AIX, and HP-UX, and looked and worked
        nearly identically on every one of them. Netscape began to
        experiment with prototypes of a web-based system, known
        internally as "Constellation", which would allow users to
        access and edit their files anywhere across a network, no
        matter what computer or operating system they happened
        to be using.
      </p>
      <p>
        Industry observers forecast the dawn of a new era of
        connected computing. The underlying operating system, it
        was believed, would not be an important consideration;
        future applications would run within a web browser. This
        was seen by Netscape as a clear opportunity to entrench
        Navigator at the heart of the next generation of
        computing, and thus gain the opportunity to expand into
        all manner of other software and service markets.
      </p>

      <h3>Decline</h3>
      <p>
        With the success of Netscape showing the importance of the
        web, Internet browsing began to be seen as a potentially
        profitable market. Following Netscape's lead, Microsoft
        started a campaign to enter the web browser software
        market. Like Netscape before them, Microsoft licensed the
        Mosaic source code from Spyglass, Inc. (which in turn
        licensed code from University of Illinois). Using this
        basic code, Microsoft created Internet Explorer (IE).
      </p>
      <p>
        The competition between Microsoft and Netscape dominated
        the <a href="#" onclick="return false">browser wars</a>. Internet Explorer,
        Version 1.0 (shipped in the Internet Jumpstart Kit in
        Microsoft Plus! For Windows 95) and IE, Version 2.0 (the
        first cross-platform version of the web browser,
        supporting both Windows and Mac OS) were thought by many
        to be inferior and primitive when compared to
        contemporary versions of Netscape Navigator. With the
        release of IE version 3.0 (1996), Microsoft was able to
        catch up with Netscape competitively, with IE Version 4.0
        (1997) further improving in terms of market share.
        IE 5.0 (1999) improved stability and took significant
        market share from Netscape Navigator for the first time.
      </p>
      <p>
        There were two versions of Netscape Navigator 3.0, the
        Standard Edition and the Gold Edition. The latter
        consisted of the Navigator browser with e-mail, news
        readers, and a WYSIWYG web page compositor. Version 2.0
        of Navigator Gold, released in 1996, was the first HTML
        editor capable of editing JavaScript. These extra
        functions enlarged and slowed the software, rendering it
        prone to crashing, however.
      </p>
      <p>
        This Gold Edition was renamed Netscape Communicator
        starting with version 4.0; the name change diluted its
        name-recognition and confused users. Netscape CEO
        James L. Barksdale insisted on the name change because
        Communicator was a general-purpose client application,
        which contained the Navigator browser.
      </p>
      <p>
        The aging Netscape Communicator 4.x was slower than
        Internet Explorer 5.0. Typical web pages had become
        heavily illustrated, often JavaScript-intensive, and
        encoded with HTML features designed for specific purposes
        but now employed as global layout tools (HTML tables, the
        most obvious example of this, were especially difficult
        for Communicator to render). The Netscape browser, once
        a solid product, became crash-prone and buggy.
      </p>
      <p>
        By the end of the decade, Netscape's web browser had
        lost dominance over the Windows platform, and the
        August 1997 Microsoft financial agreement to invest
        $150 million in Apple Computer required that Apple make
        Internet Explorer the default web browser in new Mac OS
        distributions.
      </p>
      <p>
        Microsoft succeeded in having ISPs and PC vendors
        distribute Internet Explorer to their customers instead
        of Netscape Navigator, mostly due to Microsoft using its
        leverage from Windows OEM licenses, and partly aided by
        Microsoft's investment in making IE brandable, such that
        a customized version of IE could be offered. Also, web
        developers used proprietary, browser-specific extensions
        in web pages. Both Microsoft and Netscape did this,
        having added many proprietary HTML tags to their
        browsers, which forced users to choose between two
        competing and almost incompatible web browsers.
      </p>

      <h3>Legacy</h3>
      <p>
        Netscape's contributions to the web include JavaScript,
        which was submitted as a new standard to
        <a href="#" onclick="return false">Ecma International</a>. The resultant ECMAScript
        specification allowed JavaScript support by multiple web
        browsers and its use as a cross-browser scripting
        language, long after Netscape Navigator itself had
        dropped in popularity. Another example is the
        <code>FRAME</code> tag, which is widely supported today,
        and has been incorporated into official web standards
        such as the "HTML 4.01 Frameset" specification.
      </p>
      <p>
        In a 2007 PC World column, the original Netscape
        Navigator was considered the "best tech product of all
        time" due to its impact on the Internet.
      </p>

      <h2>See also</h2>
      <ul>
        <li>Comparison of web browsers</li>
        <li>History of the World Wide Web</li>
        <li>List of web browsers</li>
        <li>Lou Montulli</li>
        <li>Timeline of web browsers</li>
      </ul>

      <p style="font-family:var(--font-ui);font-size:11px;color:#303030;border-top:1px solid #ccc;padding-top:8px;margin-top:24px;">
        <i>This article is a recreation of the Wikipedia entry
        for Netscape Navigator, rendered as a 1996-era web page.
        Original Wikipedia text is licensed under
        CC BY-SA 4.0.</i>
      </p>
    `;
  }

  // ----- Brief history of the web -----
  function renderHistoryWeb(root) {
    root.innerHTML = `
      <h1>A Brief History of the World Wide Web</h1>
      <p class="lede">
        The web we use every day was invented by
        <b>Tim Berners-Lee</b> at CERN in 1989. Within five years
        it had escaped the lab. Within ten, it had eaten the
        software industry. Within twenty, it had eaten most of
        everything else.
      </p>

      <h2>1989 &mdash; A Proposal</h2>
      <p>
        Tim Berners-Lee, a British software engineer at CERN,
        submits a proposal titled "Information Management: A
        Proposal" to his supervisor, Mike Sendall. Sendall
        scrawls "Vague but exciting" across the top and gives
        Berners-Lee the go-ahead.
      </p>

      <h2>1990 &mdash; The First Browser</h2>
      <p>
        Berners-Lee builds the first web browser (called
        <b>WorldWideWeb</b>), the first web server, and the first
        web pages. He also designs HTTP, HTML, and URLs. The
        first web page is published at
        <code>http://info.cern.ch/hypertext/WWW/TheProject.html</code>
        on August 6, 1991.
      </p>

      <h2>1993 &mdash; Mosaic</h2>
      <p>
        <b>NCSA Mosaic</b>, the first popular graphical browser,
        is released by the National Center for Supercomputing
        Applications at the University of Illinois. Its
        point-and-click interface makes the web accessible to
        non-technical users. Mosaic's source code is freely
        available.
      </p>

      <h2>1994 &mdash; Netscape</h2>
      <p>
        Marc Andreessen leaves NCSA, teams up with Jim Clark,
        and founds Netscape Communications. Netscape Navigator
        1.0 ships in December and quickly becomes the dominant
        browser.
      </p>

      <h2>1995 &mdash; Internet Explorer &amp; JavaScript</h2>
      <p>
        Microsoft ships Internet Explorer. Brendan Eich, then at
        Netscape, designs a scripting language in ten days that
        will become JavaScript. The dot-com boom begins.
      </p>

      <h2>1998 &mdash; Mozilla and Google</h2>
      <p>
        Netscape open-sources its browser as the Mozilla project.
        Larry Page and Sergey Brin incorporate Google, betting
        the web is going to be huge.
      </p>

      <h2>2003 &mdash; Safari</h2>
      <p>
        Apple ships Safari, based on the open-source KHTML
        engine. The browser-wars era winds down.
      </p>

      <h2>2004 &mdash; Firefox 1.0</h2>
      <p>
        Mozilla ships Firefox 1.0. Within two years it has
        captured 15% of the market and given Internet Explorer
        real competition for the first time in a decade.
      </p>

      <h2>2008 &mdash; Chrome</h2>
      <p>
        Google ships Chrome, built on the WebKit rendering
        engine. Chrome's process-per-tab model and minimalist UI
        set a new standard for what a browser should feel like.
      </p>

      <h2>Today</h2>
      <p>
        The web is the default platform for software. The three
        surviving rendering engines &mdash; <b>Blink</b> (Chrome,
        Edge, Opera), <b>WebKit</b> (Safari), and
        <b>Gecko</b> (Firefox) &mdash; are all descendants of
        code that was either written at Netscape or written by
        people inspired by Netscape.
      </p>

      <blockquote>
        "The Web is more a social creation than a technical one.
        I designed it for a social effect &mdash; to help people
        work together &mdash; and not as a technical toy."
        <br/>&mdash; Tim Berners-Lee
      </blockquote>
    `;
  }

  // ============================================================
  // BOOKMARKS
  // ============================================================
  function renderBookmarksBar() {
    const wrap = $('#bk-items');
    wrap.innerHTML = '';
    for (const b of state.bookmarks) {
      const btn = el('button', {
        class: 'bk-item',
        title: `${b.title}\n${b.url}`,
        'data-url': b.url,
      }, el('span', { class: 'bk-glyph' }), b.title);
      btn.addEventListener('click', () => navigate(b.url));
      wrap.appendChild(btn);
    }
  }

  function addBookmark(url = state.history[state.currentIndex],
                       title = PAGES[url]?.title || url) {
    if (state.bookmarks.some(b => b.url === url)) {
      showAlert('Bookmarks', 'This page is already in your bookmarks.');
      return;
    }
    state.bookmarks.push({ url, title });
    saveBookmarks();
    renderBookmarksBar();
    updateBookmarkUI();
    setStatus(`Bookmark added: ${title}`);
  }

  function removeBookmark(url) {
    state.bookmarks = state.bookmarks.filter(b => b.url !== url);
    saveBookmarks();
    renderBookmarksBar();
    renderBookmarksManager();
    updateBookmarkUI();
  }

  function updateBookmarkUI() {
    // Update the "Add Bookmark" button state for the current page
    const currentUrl = state.history[state.currentIndex];
    const isBookmarked = state.bookmarks.some(b => b.url === currentUrl);
    const btn = $('#bk-add');
    if (isBookmarked) {
      btn.textContent = '✓ Bookmarked';
      btn.disabled = true;
    } else {
      btn.textContent = '+ Add';
      btn.disabled = false;
    }
  }

  function renderBookmarksManager() {
    const list = $('#bk-list');
    list.innerHTML = '';
    for (const b of state.bookmarks) {
      const li = el('li', { 'data-url': b.url },
        el('span', { class: 'bk-glyph' }),
        b.title,
        el('span', { style: { marginLeft: 'auto', fontSize: '10px', color: '#888' } }, b.url)
      );
      li.addEventListener('click', () => {
        $$('li', list).forEach(x => x.classList.remove('selected'));
        li.classList.add('selected');
      });
      li.addEventListener('dblclick', () => {
        closeModal('dlg-bookmarks');
        navigate(b.url);
      });
      list.appendChild(li);
    }
  }

  // ============================================================
  // FIND
  // ============================================================
  function openFind() {
    $('#find-bar').hidden = false;
    const sel = window.getSelection();
    const selText = sel ? sel.toString() : '';
    $('#find-input').value = state.find.query || selText;
    $('#find-input').focus();
    $('#find-input').select();
    runFind();
  }

  function closeFind() {
    clearFindHighlights();
    $('#find-bar').hidden = true;
  }

  function clearFindHighlights() {
    $$('.hit', $('#content')).forEach(span => {
      const parent = span.parentNode;
      parent.replaceChild(document.createTextNode(span.textContent), span);
      parent.normalize();
    });
    state.find.matches = [];
    state.find.current = -1;
  }

  function runFind() {
    clearFindHighlights();
    const q = $('#find-input').value;
    state.find.query = q;
    if (!q) {
      $('#find-count').textContent = 'Type to search';
      return;
    }
    const root = $('#content');
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(n) {
        if (!n.nodeValue || !n.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        // Skip text inside script/style
        let p = n.parentNode;
        while (p && p !== root) {
          const tag = p.tagName;
          if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'INPUT') {
            return NodeFilter.FILTER_REJECT;
          }
          p = p.parentNode;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    });

    const matches = [];
    const lc = q.toLowerCase();
    const nodes = [];
    let n;
    while ((n = walker.nextNode())) nodes.push(n);

    for (const node of nodes) {
      const text = node.nodeValue;
      const textLc = text.toLowerCase();
      let idx = 0;
      while ((idx = textLc.indexOf(lc, idx)) !== -1) {
        // Split this text node into 3 parts: before, match, after
        const before = text.slice(0, idx);
        const match  = text.slice(idx, idx + q.length);
        const after  = text.slice(idx + q.length);

        const beforeNode = document.createTextNode(before);
        const span = el('span', { class: 'hit' }, match);
        const afterNode = document.createTextNode(after);

        const parent = node.parentNode;
        parent.insertBefore(beforeNode, node);
        parent.insertBefore(span, node);
        parent.insertBefore(afterNode, node);
        parent.removeChild(node);

        matches.push(span);
        idx += q.length;
      }
    }

    state.find.matches = matches;
    state.find.current = matches.length ? 0 : -1;
    highlightCurrent();
    updateFindCount();
  }

  function highlightCurrent() {
    $$('.hit.current', $('#content')).forEach(s => s.classList.remove('current'));
    if (state.find.current >= 0 && state.find.matches[state.find.current]) {
      const cur = state.find.matches[state.find.current];
      cur.classList.add('current');
      cur.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }

  function findNext() {
    if (!state.find.matches.length) return runFind();
    state.find.current = (state.find.current + 1) % state.find.matches.length;
    highlightCurrent();
    updateFindCount();
  }

  function findPrev() {
    if (!state.find.matches.length) return runFind();
    state.find.current = (state.find.current - 1 + state.find.matches.length) % state.find.matches.length;
    highlightCurrent();
    updateFindCount();
  }

  function highlightAll() {
    // "All" button just keeps the existing highlights (already done)
    state.find.current = state.find.matches.length ? 0 : -1;
    highlightCurrent();
    updateFindCount();
  }

  function updateFindCount() {
    const total = state.find.matches.length;
    if (!total) {
      $('#find-count').textContent = state.find.query ? 'No matches' : 'Type to search';
    } else {
      $('#find-count').textContent = `Match ${state.find.current + 1} of ${total}`;
    }
  }

  // ============================================================
  // MODAL DIALOGS
  // ============================================================
  function showModal(id, opts = {}) {
    const m = document.getElementById(id);
    if (!m) return;
    if (opts.center) {
      const rect = m.getBoundingClientRect();
      const w = rect.width || 360;
      const h = rect.height || 200;
      m.style.left = `${(window.innerWidth - w) / 2}px`;
      m.style.top  = `${(window.innerHeight - h) / 2}px`;
    } else if (opts.left != null) {
      m.style.left = `${opts.left}px`;
      m.style.top  = `${opts.top || 80}px`;
    }
    m.hidden = false;
    $('#modal-shroud').hidden = false;
    // Focus first input
    setTimeout(() => {
      const input = m.querySelector('input,button');
      if (input) input.focus();
    }, 10);
  }

  function closeModal(id) {
    document.getElementById(id).hidden = true;
    $('#modal-shroud').hidden = true;
  }

  function closeAllModals() {
    $$('.modal').forEach(m => m.hidden = true);
    $('#modal-shroud').hidden = true;
  }

  function showAlert(title, message) {
    $('#alert-title').textContent = title;
    $('#alert-message').textContent = message;
    showModal('dlg-alert', { center: true });
  }

  // ============================================================
  // PRINT DIALOG (simulation)
  // ============================================================
  function openPrint() {
    showModal('dlg-print', { center: true });
    const fill = $('#print-progress-fill');
    const status = $('#print-status');
    const done = $('#print-done');
    fill.style.width = '0%';
    status.textContent = 'Preparing…';
    done.disabled = true;
    let pct = 0;
    const steps = [
      'Sending page to printer…',
      'Rendering…',
      'Printing page 1 of 1…',
      'Done.',
    ];
    const tick = () => {
      pct = Math.min(100, pct + Math.random() * 22 + 8);
      fill.style.width = `${pct}%`;
      const idx = Math.min(steps.length - 1, Math.floor(pct / 25));
      status.textContent = steps[idx];
      if (pct < 100) {
        setTimeout(tick, 380);
      } else {
        done.disabled = false;
      }
    };
    setTimeout(tick, 200);
  }

  // ============================================================
  // MENUS
  // ============================================================
  const MENUS = {
    file: () => [
      { label: 'New Browser Window', shortcut: 'Ctrl+N', action: () => showAlert('File', 'New window — not implemented in this recreation.') },
      { label: 'New Tab',             shortcut: 'Ctrl+T', action: () => showAlert('File', 'Tabs were added in Navigator 7, well after this 1996 chrome.') },
      { sep: true },
      { label: 'Open Location…',      shortcut: 'Ctrl+L', action: () => openOpenLocation() },
      { label: 'Open File…',          shortcut: 'Ctrl+O', action: () => openOpenFile() },
      { sep: true },
      { label: 'Save As…',            shortcut: 'Ctrl+S', action: () => showAlert('File', 'Save As — not implemented in this recreation.') },
      { label: 'Print…',              shortcut: 'Ctrl+P', action: () => openPrint() },
      { sep: true },
      { label: 'Close',               shortcut: 'Ctrl+W', action: () => {
        const url = state.history[state.currentIndex];
        if (url === HOME_URL) {
          showAlert('Netscape', 'Cannot close the last browser window.');
        } else {
          navigate(HOME_URL);
        }
      } },
      { label: 'Exit',                shortcut: 'Ctrl+Q', action: () => showAlert('Netscape', 'Exit — thanks for browsing!') },
    ],
    edit: () => [
      { label: 'Undo',              shortcut: 'Ctrl+Z', action: () => showAlert('Edit', 'Nothing to undo.') },
      { sep: true },
      { label: 'Cut',               shortcut: 'Ctrl+X', action: () => document.execCommand && document.execCommand('cut') },
      { label: 'Copy',              shortcut: 'Ctrl+C', action: () => document.execCommand && document.execCommand('copy') },
      { label: 'Paste',             shortcut: 'Ctrl+V', action: () => document.execCommand && document.execCommand('paste') },
      { sep: true },
      { label: 'Select All',        shortcut: 'Ctrl+A', action: () => {
        const r = document.createRange();
        r.selectNodeContents($('#content'));
        const s = window.getSelection();
        s.removeAllRanges();
        s.addRange(r);
      } },
      { sep: true },
      { label: 'Find in This Page…', shortcut: 'Ctrl+F', action: () => openFind() },
      { label: 'Find Again',         shortcut: 'Ctrl+G', action: () => findNext() },
    ],
    view: () => [
      { label: 'Reload',                  shortcut: 'Ctrl+R', action: reload },
      { label: 'Reload Frame',            disabled: true },
      { sep: true },
      { label: 'Stop',                    shortcut: 'Esc',   action: stopLoading },
      { sep: true },
      { label: 'Page Source',             shortcut: 'Ctrl+U', action: () => {
        const url = state.history[state.currentIndex];
        const html = $('#content').innerHTML;
        const w = window.open('', '_blank', 'width=600,height=400');
        if (w) {
          w.document.write(`<title>Source of: ${escapeHtml(url)}</title><pre style="font-family:monospace;font-size:12px;">${escapeHtml(html)}</pre>`);
        }
      } },
      { sep: true },
      { label: 'Increase Font Size',      action: () => document.body.style.fontSize = 'larger' },
      { label: 'Decrease Font Size',      action: () => document.body.style.fontSize = 'smaller' },
      { sep: true },
      { label: 'Show / Hide Toolbars',    action: () => {
        const t = $('#toolbar');
        t.style.display = t.style.display === 'none' ? '' : 'none';
      } },
      { label: 'Show / Hide Bookmarks',   action: () => {
        const b = $('#bookmarks-bar');
        b.style.display = b.style.display === 'none' ? '' : 'none';
      } },
    ],
    go: () => [
      { label: 'Back',                 shortcut: 'Alt+Left',  action: back, disabled: state.currentIndex <= 0 },
      { label: 'Forward',              shortcut: 'Alt+Right', action: forward, disabled: state.currentIndex >= state.history.length - 1 },
      { sep: true },
      { label: 'Home',                 shortcut: 'Alt+Home',  action: home },
      { sep: true },
      { label: 'Stop',                 shortcut: 'Esc', action: stopLoading },
      { label: 'Reload',               shortcut: 'Ctrl+R', action: reload },
      { sep: true },
      ...state.history.slice(Math.max(0, state.currentIndex - 6), state.currentIndex + 1)
        .map(url => ({
          label: (PAGES[url]?.title || url).slice(0, 36),
          action: () => navigate(url),
          check: url === state.history[state.currentIndex],
        })),
    ],
    bookmarks: () => [
      { label: 'Add Bookmark…',         shortcut: 'Ctrl+D', action: () => {
        const url = state.history[state.currentIndex];
        addBookmark(url);
      } },
      { label: 'Manage Bookmarks…',     action: () => {
        renderBookmarksManager();
        showModal('dlg-bookmarks', { center: true });
      } },
      { sep: true },
      ...state.bookmarks.slice(0, 12).map(b => ({
        label: b.title.slice(0, 36),
        action: () => navigate(b.url),
      })),
    ],
    options: () => [
      { label: 'General Preferences…',   action: () => showAlert('Options', 'General Preferences — not implemented.') },
      { label: 'Mail & News Preferences…', action: () => showAlert('Options', 'No mail client configured.') },
      { label: 'Network Preferences…',   action: () => showAlert('Options', 'Network — proxy is auto-configured.') },
      { label: 'Security Preferences…',  action: () => showAlert('Options', 'Security — JS enabled by default.') },
      { label: 'Privacy Preferences…',   action: () => showAlert('Options', 'Privacy — cookies are off.') },
      { sep: true },
      {
        label: 'Automatically Load Images',
        check: state.showImages,
        action: () => {
          state.showImages = !state.showImages;
          saveShowImages();
          // Re-render current page so placeholders apply
          reload();
        },
      },
    ],
    directory: () => [
      { label: 'Netscape Search',       action: () => showAlert('Directory', 'Search the web via Netscape Search.') },
      { label: 'Internet Directory',     action: () => showAlert('Directory', 'Browse the directory.') },
      { label: 'People',                 action: () => showAlert('Directory', 'Find people.') },
      { label: 'Software',               action: () => showAlert('Directory', 'Browse software.') },
      { label: 'Yellow Pages',           action: () => showAlert('Directory', 'Yellow pages.') },
    ],
    window: () => [
      { label: 'Navigator',         check: true, action: () => {} },
      { sep: true },
      { label: 'Mail & Newsgroups', disabled: true },
      { label: 'Composer',          disabled: true },
    ],
    help: () => [
      { label: 'About Netscape…',     action: () => showModal('dlg-about', { center: true }) },
      { label: 'Release Notes',       action: () => showAlert('Help', 'Netscape Navigator 3.04 — Release Notes\n\n• Faster page rendering\n• New mail and news clients\n• JavaScript 1.1') },
      { label: 'Frequently Asked Questions', action: () => showAlert('Help', 'FAQ — this is a portfolio recreation, not the real Netscape.') },
      { sep: true },
      { label: 'How to Use the Web', action: () => showAlert('Help', 'How to Use the Web — see http://home.netscape.com/') },
      { label: 'How to Use This Browser', action: () => showAlert('Help', 'Toolbar buttons are at the top. URL bar is below. Bookmarks bar is below that. Status messages appear at the bottom.') },
      { label: 'About Plug-ins',       action: () => showAlert('Help', 'No plug-ins installed.') },
    ],
  };

  function openMenu(name, anchorEl) {
    closeMenu();
    const items = MENUS[name] ? MENUS[name]() : [];
    const popup = $('#menu-popup');
    popup.innerHTML = '';
    for (const item of items) {
      if (item.sep) {
        popup.appendChild(el('div', { class: 'sep' }));
        continue;
      }
      const mi = el('div', {
        class: 'mi' + (item.disabled ? ' disabled' : '') + (item.check ? ' check' : ''),
        role: 'menuitem',
        tabindex: '-1',
      }, item.label, item.shortcut ? el('span', { class: 'shortcut' }, item.shortcut) : null);
      if (!item.disabled) {
        mi.addEventListener('click', () => {
          closeMenu();
          try { item.action(); } catch (e) { console.error(e); }
        });
      }
      popup.appendChild(mi);
    }

    // Position the popup directly under the menu button
    const r = anchorEl.getBoundingClientRect();
    popup.style.left = `${r.left}px`;
    popup.style.top  = `${r.bottom}px`;
    popup.hidden = false;
    state.activeMenu = name;
    anchorEl.classList.add('active');
  }

  function closeMenu() {
    $('#menu-popup').hidden = true;
    state.activeMenu = null;
    $$('.menu').forEach(m => m.classList.remove('active'));
  }

  // ============================================================
  // DIALOG OPENERS
  // ============================================================
  function openOpenLocation() {
    $('#open-url').value = state.typedUrl || HOME_URL;
    showModal('dlg-open', { center: true });
    setTimeout(() => {
      $('#open-url').focus();
      $('#open-url').select();
    }, 20);
  }

  function openOpenFile() {
    $('#file-input').click();
  }

  function openAbout() {
    showModal('dlg-about', { center: true });
  }

  // ============================================================
  // IMAGES TOGGLE
  // ============================================================
  function toggleImages() {
    state.showImages = !state.showImages;
    saveShowImages();
    reload();
  }

  // ============================================================
  // NAV BUTTON STATE
  // ============================================================
  function refreshNavButtons() {
    $('#btn-back').disabled = state.currentIndex <= 0;
    $('#btn-forward').disabled = state.currentIndex >= state.history.length - 1;
    $('#btn-images').classList.toggle('pressed', !state.showImages);
  }

  // ============================================================
  // EVENT BINDINGS
  // ============================================================
  function bindEvents() {
    // Toolbar
    $('#toolbar').addEventListener('click', (e) => {
      const btn = e.target.closest('.tb');
      if (!btn || btn.disabled) return;
      const a = btn.dataset.action;
      if (a === 'back') back();
      else if (a === 'forward') forward();
      else if (a === 'reload') reload();
      else if (a === 'home') home();
      else if (a === 'toggle-images') toggleImages();
      else if (a === 'open') openOpenLocation();
      else if (a === 'print') openPrint();
      else if (a === 'find') openFind();
      else if (a === 'stop') stopLoading();
      else if (a === 'go') doGo();
    });

    // URL bar
    $('#url-bar').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') doGo();
      else if (e.key === 'Escape') $('#url-bar').blur();
    });

    // Title bar buttons
    $$('[data-title-action]').forEach(btn => {
      btn.addEventListener('click', () => {
        const a = btn.dataset.titleAction;
        if (a === 'close') {
          showAlert('Netscape', 'There is no place to go.');
        } else if (a === 'minimize') {
          $('#browser').classList.add('minimized');
        } else if (a === 'maximize') {
          showAlert('Netscape', 'Already maximized.');
        }
      });
    });

    // Menus
    $$('.menu').forEach(m => {
      m.addEventListener('click', (e) => {
        e.stopPropagation();
        if (state.activeMenu === m.dataset.menu) {
          closeMenu();
        } else {
          openMenu(m.dataset.menu, m);
        }
      });
    });

    // Bookmark add
    $('#bk-add').addEventListener('click', () => {
      addBookmark();
    });

    // Find bar
    $('#find-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') findNext();
      else if (e.key === 'Escape') closeFind();
    });
    $('#find-input').addEventListener('input', runFind);
    $('#find-prev').addEventListener('click', findPrev);
    $('#find-next').addEventListener('click', findNext);
    $('#find-highlight').addEventListener('click', highlightAll);
    $('#find-close').addEventListener('click', closeFind);

    // Modal close buttons
    $$('[data-modal-close]').forEach(b => {
      b.addEventListener('click', () => closeModal(b.dataset.modalClose));
    });
    $$('[data-modal-cancel]').forEach(b => {
      b.addEventListener('click', () => closeModal(b.dataset.modalCancel));
    });

    // Open Location OK
    $('#open-ok').addEventListener('click', () => {
      const url = $('#open-url').value.trim();
      if (!url) return;
      closeModal('dlg-open');
      navigate(url);
    });
    $('#open-url').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') $('#open-ok').click();
    });

    // Alert OK
    $('#alert-ok').addEventListener('click', () => closeModal('dlg-alert'));

    // Bookmarks manager remove
    $('#bk-remove-selected').addEventListener('click', () => {
      const sel = $('#bk-list .selected');
      if (!sel) {
        showAlert('Bookmarks', 'Select a bookmark to remove.');
        return;
      }
      removeBookmark(sel.dataset.url);
    });

    // File input (no-op for this recreation)
    $('#file-input').addEventListener('change', () => {
      showAlert('Open File', 'Local file support not implemented in this recreation.');
      $('#file-input').value = '';
    });

    // Modal shroud click closes all modals
    $('#modal-shroud').addEventListener('click', () => closeAllModals());

    // Click outside menu closes it
    document.addEventListener('click', (e) => {
      if (!state.activeMenu) return;
      if (e.target.closest('.menu-popup') || e.target.closest('.menu')) return;
      closeMenu();
    });

    // Global keyboard
    document.addEventListener('keydown', (e) => {
      // Skip if focused in an editable field
      const tag = (e.target.tagName || '').toUpperCase();
      const editable = tag === 'INPUT' || tag === 'TEXTAREA' || e.target.isContentEditable;

      // Always allow Esc to close find / menu / modal
      if (e.key === 'Escape') {
        if (!$('#find-bar').hidden) { closeFind(); return; }
        if (state.activeMenu) { closeMenu(); return; }
        if (!$('#modal-shroud').hidden) { closeAllModals(); return; }
        if (state.loading.active) { stopLoading(); return; }
      }

      if (editable) return;

      // Modifier shortcuts
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'l' || e.key === 'L') { e.preventDefault(); $('#url-bar').focus(); $('#url-bar').select(); return; }
        if (e.key === 'f' || e.key === 'F') { e.preventDefault(); openFind(); return; }
        if (e.key === 'd' || e.key === 'D') { e.preventDefault(); addBookmark(); return; }
        if (e.key === 'r' || e.key === 'R') { e.preventDefault(); reload(); return; }
        if (e.key === 'p' || e.key === 'P') { e.preventDefault(); openPrint(); return; }
        if (e.key === 'h' || e.key === 'H') { e.preventDefault(); home(); return; }
      }

      if (e.altKey && !e.ctrlKey && !e.metaKey) {
        // Alt+letter for menus
        const k = e.key.toLowerCase();
        const map = { f: 'file', e: 'edit', v: 'view', g: 'go',
                      b: 'bookmarks', o: 'options', d: 'directory',
                      w: 'window', h: 'help' };
        if (map[k]) {
          e.preventDefault();
          const m = $(`.menu[data-menu="${map[k]}"]`);
          if (m) openMenu(map[k], m);
        }
        return;
      }

      // Backspace = Back
      if (e.key === 'Backspace') { e.preventDefault(); back(); return; }

      // Alt+Left / Right arrow (browser-style back/forward)
      if (e.altKey && e.key === 'ArrowLeft')  { e.preventDefault(); back(); return; }
      if (e.altKey && e.key === 'ArrowRight') { e.preventDefault(); forward(); return; }
    });

    // Make title bars draggable (window + modals)
    $$('[data-drag]').forEach(t => {
      t.addEventListener('pointerdown', (e) => {
        if (e.target.closest('button,input,a,select,textarea')) return;
        const win = t.parentElement; // .window or .modal
        const rect = win.getBoundingClientRect();
        win.style.position = 'fixed';
        win.style.left = `${rect.left}px`;
        win.style.top  = `${rect.top}px`;
        win.style.right = 'auto';
        win.style.bottom = 'auto';
        win.style.width  = `${rect.width}px`;
        win.style.height = `${rect.height}px`;
        // Stretch the content area when dragged larger
        win.style.inset = 'auto';

        state.drag = {
          el: win,
          offsetX: e.clientX - rect.left,
          offsetY: e.clientY - rect.top,
        };
        try { t.setPointerCapture(e.pointerId); } catch (_) {}
      });
    });

    document.addEventListener('pointermove', (e) => {
      if (!state.drag) return;
      const { el, offsetX, offsetY } = state.drag;
      const maxX = window.innerWidth - 40;
      const maxY = window.innerHeight - 40;
      let nx = e.clientX - offsetX;
      let ny = e.clientY - offsetY;
      nx = Math.max(-40, Math.min(maxX, nx));
      ny = Math.max(0, Math.min(maxY, ny));
      el.style.left = `${nx}px`;
      el.style.top  = `${ny}px`;
    });

    document.addEventListener('pointerup', () => {
      state.drag = null;
    });
  }

  function doGo() {
    const url = $('#url-bar').value.trim();
    if (!url) return;
    navigate(url);
  }

  // ============================================================
  // UTIL
  // ============================================================
  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // ============================================================
  // INIT
  // ============================================================
  function init() {
    // Hydrate persistent state
    state.bookmarks  = loadBookmarks();
    state.showImages = loadShowImages();

    // Initial chrome
    refreshNavButtons();
    $('#btn-stop').disabled = true;
    $('#btn-images').classList.toggle('pressed', !state.showImages);

    // Bind
    bindEvents();

    // Initial bookmarks bar
    renderBookmarksBar();

    // Load the home page
    navigate(HOME_URL, { push: false });
    state.currentIndex = 0;

    // Refresh the JS demo "localStorage" panel if present
    if (state._refreshJs4) state._refreshJs4();

    // If we restored a minimized state, restore it
    // (none for now)
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();