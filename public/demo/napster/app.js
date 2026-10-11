/* =============================================================
   Napster 2 — Web Edition
   Vanilla JS, no build. Login → windows → search/transfer.
   ============================================================= */

(() => {
  'use strict';
  window.__SCRIPT_RAN__ = true;

  // ============================================================
  // MOCK CATALOG (artists × tracks)
  // ============================================================
  const ARTISTS = {
    grunge: {
      'Nirvana': ['Smells Like Teen Spirit','Come As You Are','Lithium','Heart-Shaped Box','In Bloom','All Apologies','Polly','Drain You','About a Girl','Something in the Way'],
      'Pearl Jam': ['Alive','Black','Jeremy','Even Flow','Better Man','Corduroy','Daughter','Rearviewmirror','Do the Evolution','Given to Fly'],
      'Soundgarden': ['Black Hole Sun','Fell on Black Days','Spoonman','Rusty Cage','Superunknown','The Day I Tried to Live','Outshined','Burden in My Hand','Blow Up the Outside World','Pretty Noose'],
      'Alice in Chains': ['Man in the Box','Rooster','Would?','Down in a Hole','No Excuses','Heaven Beside You','Angry Chair','Grind','Them Bones','I Stay Away'],
      'Stone Temple Pilots': ['Plush','Creep','Interstate Love Song','Vasoline','Big Bang Baby','Sour Girl','Dead & Bloated','Wicked Garden','Trippin\' on a Hole','All in the Suit That You Wear'],
    },
    metal: {
      'Metallica': ['Enter Sandman','Master of Puppets','One','Nothing Else Matters','The Unforgiven','Fade to Black','Whiplash','Battery','Sad but True','For Whom the Bell Tolls'],
      'Megadeth': ['Symphony of Destruction','Hangar 18','Peace Sells','Sweating Bullets','Tornado of Souls','In My Darkest Hour','A Tout le Monde','Trust','Holy Wars','Rust in Peace'],
      'Slayer': ['Raining Blood','Angel of Death','South of Heaven','Seasons in the Abyss','War Ensemble','Dead Skin Mask','Mandatory Suicide','Chemical Warfare','Postmortem','Altar of Sacrifice'],
      'Anthrax': ['Bring the Noise','Caught in a Mosh','Madhouse','Got the Time','Among the Living','I\'m the Man','Indians','Antisocial','Only','Inside Out'],
      'Pantera': ['Cowboys from Hell','Walk','Cemetery Gates','Mouth for War','This Love','5 Minutes Alone','Domination','Hollow','Becoming','I\'m Broken'],
    },
    hiphop: {
      'Beastie Boys': ['Sabotage','Fight for Your Right','Sure Shot','Brass Monkey','Intergalactic','So What\'cha Want','Body Movin','Flute Loop','Hey Ladies','Shake Your Rump'],
      'Dr. Dre': ['Nuthin\' But a G Thang','Let Me Ride','Still D.R.E.','Forgot About Dre','California Love','Gin and Juice','The Next Episode','Keep Their Heads Ringin','Xxplosive','Bitches Ain\'t Shit'],
      'Outkast': ['B.O.B','Ms. Jackson','Hey Ya!','Roses','So Fresh, So Clean','ATLiens','Aquemini','SpottieOttieDopaliscious','Player\'s Ball','Liberation'],
      'Jay-Z': ['Hard Knock Life','Can\'t Knock the Hustle','Empire State of Mind','99 Problems','Big Pimpin','Izzo','Renegade','Dirt Off Your Shoulder','Encore','Crazy in Love'],
      'Eminem': ['Lose Yourself','The Real Slim Shady','Stan','Without Me','The Way I Am','My Name Is','Sing for the Moment','Mockingbird','Not Afraid','Cleaning Out My Closet'],
      'Nas': ['N.Y. State of Mind','The World Is Yours','If I Ruled the World','One Mic','Got Ur Self a...','Street Dreams','Made You Look','Ether','Hate Me Now','Thief\'s Theme'],
    },
    alt: {
      'Radiohead': ['Creep','Karma Police','Paranoid Android','No Surprises','Fake Plastic Trees','Street Spirit','Lucky','Just','Everything in Its Right Place','Idioteque'],
      'Smashing Pumpkins': ['Bullet with Butterfly Wings','1979','Tonight, Tonight','Today','Disarm','Zero','Cherub Rock','Thirty-Three','Landslide','Ava Adore'],
      'Weezer': ['Buddy Holly','Say It Ain\'t So','Undone – The Sweater Song','My Name Is Jonas','In the Garage','Hash Pipe','Island in the Sun','Beverly Hills','Pork and Beans','Africa'],
      'Green Day': ['Basket Case','When I Come Around','Longview','Brain Stew','Minority','American Idiot','Boulevard of Broken Dreams','Holiday','Wake Me Up When September Ends','Good Riddance'],
      'Blink-182': ['All the Small Things','What\'s My Age Again?','Dammit','I Miss You','Feeling This','The Rock Show','First Date','Stay Together for the Kids','Man Overboard','Not Now'],
      'The Offspring': ['Self Esteem','Come Out and Play','The Kids Aren\'t Alright','Pretty Fly (for a White Guy)','Why Don\'t You Get a Job?','Original Prankster','You\'re Gonna Go Far, Kid','Hit That','Keep \'Em Separated','Gone Away'],
    },
    rock: {
      'Red Hot Chili Peppers': ['Under the Bridge','Scar Tissue','Californication','Give It Away','Suck My Kiss','Higher Ground','By the Way','Dani California','Snow ((Hey Oh))','Soul to Squeeze'],
      'Foo Fighters': ['Everlong','Learn to Fly','The Pretender','Best of You','My Hero','Times Like These','Rope','Walk','All My Life','Monkey Wrench'],
      'Tool': ['Schism','Lateralus','Ænema','Sober','Stinkfist','Forty Six & 2','H.","Pushit","Pneuma","Fear Inoculum","Reflection'],
      'System of a Down': ['Chop Suey','Toxicity','B.Y.O.B.','Aerials','Hypnotize','Lonely Day','Question!','Sugar','Army of Me','Prison Song'],
      'Rage Against the Machine': ['Killing in the Name','Bulls on Parade','Guerrilla Radio','Know Your Enemy','Bombtrack','Wake Up','Testify','People of the Sun','Fistful of Steel','Calm Like a Bomb'],
      'Led Zeppelin': ['Stairway to Heaven','Black Dog','Kashmir','Whole Lotta Love','Immigrant Song','Rock and Roll','Dazed and Confused','Heartbreaker','Ramble On','Going to California'],
      'Pink Floyd': ['Comfortably Numb','Another Brick in the Wall','Wish You Were Here','Time','Money','Us and Them','Brain Damage','Eclipse','Hey You','Shine On You Crazy Diamond'],
    },
    punk: {
      'Bad Religion': ['21st Century (Digital Boy)','Infected','Sorrow','Los Angeles','Against the Grain','Suffer','Recipe for Hate','No Control','Generator','American Jesus'],
      'Pennywise': ['Bro Hymn','F*** Authority','Alien','My Own Country','Same Old Story','Everyday','Resist','Stand By Me','Homesick','Devotion'],
      'NOFX': ['Linoleum','The Decline','Don\'t Call Me White','Bob','Seeing Double at the Triple Rock','Kill All the White Man','Radio','Stickin\' in My Eye','Dinosaurs Will Die','Murder the Government'],
      'The Clash': ['London Calling','Should I Stay or Should I Go','Rock the Casbah','Train in Vain','Clampdown','Guns of Brixton','I Fought the Law','White Riot','Complete Control','Lost in the Supermarket'],
    },
    electronic: {
      'Daft Punk': ['Around the World','One More Time','Get Lucky','Harder Better Faster Stronger','Da Funk','Digital Love','Aerodynamic','Something About Us','Voyager','Veridis Quo'],
      'The Prodigy': ['Firestarter','Breathe','Smack My Bitch Up','Omen','Voodoo People','Out of Space','Invaders Must Die','Spitfire','Breathe with Me','Mindfields'],
      'The Chemical Brothers': ['Block Rockin\' Beats','Galvanize','Hey Boy Hey Girl','Go','Setting Sun','Saturate','Out of Control','The Sunshine Underground','Do It Again','Escape Velocity'],
      'Fatboy Slim': ['Praise You','Weapon of Choice','Rockafeller Skank','Right Here, Right Now','Gangster Tripping','Going Out of My Head','The Rockafeller Skank','Santa Cruz','Everybody Needs a 303','Sunset (Bird of Prey)'],
    },
    pop: {
      'Britney Spears': ['...Baby One More Time','Toxic','Oops!... I Did It Again','Gimme More','Circus','Womanizer','Piece of Me','Stronger','I\'m a Slave 4 U','Lucky'],
      '*NSYNC': ['Bye Bye Bye','It\'s Gonna Be Me','Tearin\' Up My Heart','This I Promise You','Pop','I Want You Back','Music of My Heart','Girlfriend','Celebrity','No Strings Attached'],
      'Backstreet Boys': ['I Want It That Way','Everybody (Backstreet\'s Back)','As Long As You Love Me','Quit Playing Games','Larger Than Life','The One','Show Me the Meaning','Drowning','Incomplete','Shape of My Heart'],
      'Madonna': ['Like a Virgin','Vogue','Material Girl','Hung Up','Music','Express Yourself','Papa Don\'t Preach','La Isla Bonita','Ray of Light','Frozen'],
    },
    rnb: {
      'Aaliyah': ['Are You That Somebody?','Try Again','One in a Million','Rock the Boat','Are You Ready','More Than a Woman','Back & Forth','At Your Best (You Are Love)','We Need a Resolution','I Don\'t Wanna'],
      'Destiny\'s Child': ['Say My Name','Bills Bills Bills','Jumpin\' Jumpin\'','Bootylicious','Independent Women','Survivor','Soldier','Lose My Breath','Cater 2 U','Girl'],
      'R. Kelly': ['I Believe I Can Fly','Bump N\' Grind','Ignition (Remix)','Step in the Name of Love','Same Girl','When a Woman\'s Fed Up','A Woman\'s Threat','Happy People','Fiesta','Slow Wind'],
    },
  };

  const EXTENSIONS = ['mp3', 'wma'];
  const BITRATES   = [96, 128, 128, 128, 160, 192, 192, 256, 320, 320];
  const STATUSES   = ['Available', 'Available', 'Available', 'Downloading', 'Firewalled', 'Queued'];

  // ============================================================
  // PSEUDO-RANDOM (seeded, so the catalog is stable per page load)
  // ============================================================
  let _seed = 0x9e3779b9;
  function rand() {
    _seed = (_seed * 1664525 + 1013904223) >>> 0;
    return _seed / 0x100000000;
  }
  function pick(arr) { return arr[Math.floor(rand() * arr.length)]; }
  function between(a, b) { return a + Math.floor(rand() * (b - a + 1)); }

  // ============================================================
  // CATALOG GENERATION
  // ============================================================
  function buildCatalog() {
    const tracks = [];
    const allArtists = [];
    for (const genre of Object.keys(ARTISTS)) {
      for (const artist of Object.keys(ARTISTS[genre])) {
        for (const track of ARTISTS[genre][artist]) {
          allArtists.push({ artist, track, genre });
        }
      }
    }
    // Generate ~200 unique file records
    const users = buildUsers();
    const seen = new Set();
    while (tracks.length < 220) {
      const a = pick(allArtists);
      const ext = pick(EXTENSIONS);
      const bitrate = pick(BITRATES);
      // Avoid duplicates of the same file
      const key = `${a.artist}|${a.track}.${ext}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const length = formatLength(between(140, 320));
      // Cap size for demo realism: ~3MB average MP3. Math.random in CATALOG sizeKB proportional to byte rate. Math.random in CATALOG sizeKB proportional to byte rate.
      const rawKB = Math.round((bitrate * 1000 / 8) * (parseLengthSeconds(length)) / 1024);
      const sizeKB = Math.min(8000, Math.max(800, rawKB));
      const owner = pick(users);
      tracks.push({
        filename: `${a.artist} - ${a.track}.${ext}`,
        artist: a.artist,
        track: a.track,
        genre: a.genre,
        user: owner.name,
        bitrate,
        length,
        sizeKB,
        status: pick(STATUSES),
      });
    }
    return { tracks, users };
  }

  function formatLength(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${String(s).padStart(2,'0')}`;
  }
  function parseLengthSeconds(str) {
    const [m, s] = str.split(':').map(Number);
    return m * 60 + s;
  }
  function formatSize(kb) {
    if (kb < 1024) return `${kb} KB`;
    return `${(kb/1024).toFixed(1)} MB`;
  }

  // ============================================================
  // USERS (50 fake users)
  // ============================================================
  const USER_NAMES = [
    'filez_r_us','DarkStar99','metallerX','MP3z4ever','sharebear','ByteMe','GigaByte2000',
    'NapsterKing','free_music_99','codec_zero','kewl_dood','mp3man','audiowhore','Beavis99',
    'buttHedz','maxreal3k','cl0wn_boy','pirate_jen','tr0ub4dor','met4lhed','grrl_geek',
    'slippytoad','Foxhound','SolidSnake','Raiden','liquid_snake','shadowmoses','outerheaven',
    'Tetsuo','Akira','kaneda','neo_1117','morpheus_zion','trinity99','cypher_punk','r00tbeer',
    'phisher_kid','m00n_dial','deadHead','PhishHe4d','r4v3n_h4ck','darkAngel','byteNinja',
    'subZero','iceman_zero','Maverick99','Goose99','JesterXL','Vortex99','RogueAgent','GhostFox',
    'SkyW4lker','Solo_1977','Skywalker99','red5_leader','wampa_hunt','tauntaun99',
  ];
  const SPEEDS = ['Cable Modem (700kbps+)','DSL (256kbps+)','DSL (256kbps+)','T1 (1.5Mbps+)','56K Modem','ISDN'];
  const USER_STATUS = ['Online','Online','Online','Online','Online','Online','Online','Online','Online','Away','Busy'];

  function buildUsers() {
    return USER_NAMES.map((name, i) => ({
      id: i + 1,
      name,
      speed: pick(SPEEDS),
      filesShared: between(20, 800),
      filesDownloaded: between(5, 4000),
      status: pick(USER_STATUS),
      joined: `${between(1999, 2000)}-${String(between(1,12)).padStart(2,'0')}-${String(between(1,28)).padStart(2,'0')}`,
      uploadSpeedKBps: between(5, 80),
    }));
  }

  // ============================================================
  // STATE
  // ============================================================
  const STORAGE_KEY = 'napster2.state.v1';
  const DEFAULT_POSITIONS = {
    search:    { x: 24,   y: 70 },
    library:   { x: 700,  y: 70 },
    transfers: { x: 24,   y: 450 },
    hotlist:   { x: 700,  y: 450 },
    users:     { x: 1180, y: 70 },
    chat:      { x: 320,  y: 250 },
  };

  const state = {
    catalog: null,    // { tracks, users }
    user: null,       // { name, connection, sharing }
    onlineCount: 50,
    visible: {
      search: true, library: false, transfers: true,
      hotlist: false, users: false, chat: false,
    },
    minimized: {},
    library: [],      // user's shared files (subset of catalog)
    transfers: [],    // active downloads
    hotlist: [],      // user names
    chatLog: [],      // [{channel, who, text, t}]
    selectedUser: null,
    ctxUser: null,    // user for context menu
  };

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (saved.library)     state.library = saved.library;
      if (saved.hotlist)     state.hotlist = saved.hotlist;
      if (saved.minimized)   state.minimized = saved.minimized;
      if (saved.user)        state.user = saved.user;
      if (saved.chatLog)     state.chatLog = saved.chatLog;
    } catch (e) { /* ignore */ }
  }
  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        library: state.library.slice(0, 200),
        hotlist: state.hotlist,
        minimized: state.minimized,
        user: state.user,
        chatLog: state.chatLog.slice(-200),
      }));
    } catch (e) { /* ignore */ }
  }

  // ============================================================
  // DOM HELPERS
  // ============================================================
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  function el(tag, attrs = {}, ...children) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') e.className = v;
      else if (k === 'dataset') Object.assign(e.dataset, v);
      else if (k.startsWith('on')) e.addEventListener(k.slice(2).toLowerCase(), v);
      else e.setAttribute(k, v);
    }
    for (const c of children) {
      if (c == null) continue;
      e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    }
    return e;
  }
  function escHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  // ============================================================
  // AUDIO ENGINE
  // Synthesizes a procedural chiptune-style riff per filename via the
  // Web Audio API. No external audio assets, no copyright concerns.
  // ============================================================
  const audio = {
    ctx: null,
    master: null,
    current: null,        // { filename, from, duration, scheduled, gain, startedAt, pausedAt, status, scheduledEnd, stopAt }
    queue: [],            // [{filename, from, duration}, ...]
    history: [],          // recently played filenames for prev/next
    historyIdx: -1,
    volume: 0.6,
    waveform: 'sawtooth',
    posTimer: null,
    onTick: null,         // callback for UI updates
    onEnd: null,

    ensureCtx() {
      if (!this.ctx) {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        this.ctx = new Ctx();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.volume;
        this.master.connect(this.ctx.destination);
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return this.ctx;
    },

    hash(s) {
      let h = 0;
      for (let i = 0; i < s.length; i++) h = ((h * 31) + s.charCodeAt(i)) | 0;
      return Math.abs(h);
    },

    // Pick a deterministic root note and scale for a given filename.
    pickKey(filename) {
      const roots = [196.00, 220.00, 246.94, 261.63, 293.66, 329.63, 392.00, 440.00];
      const scales = [
        { name: 'major',         degrees: [0, 2, 4, 5, 7, 9, 11] },
        { name: 'natural-minor', degrees: [0, 2, 3, 5, 7, 8, 10] },
        { name: 'pentatonic-maj',degrees: [0, 2, 4, 7, 9] },
        { name: 'pentatonic-min',degrees: [0, 3, 5, 7, 10] },
        { name: 'phrygian',      degrees: [0, 1, 3, 5, 7, 8, 10] },
        { name: 'dorian',        degrees: [0, 2, 3, 5, 7, 9, 10] },
      ];
      const h = this.hash(filename);
      return { root: roots[h % roots.length], scale: scales[(h >> 3) % scales.length] };
    },

    // Build a procedural melody of length ~durationSec, plus a bassline and a kick on the beat.
    buildSequence(filename, durationSec) {
      const { root, scale } = this.pickKey(filename);
      const h = this.hash(filename);
      const melody = [];
      const bass   = [];
      // Pick a tempo from the bitrate-ish range
      const bpm = 90 + (h % 70); // 90..160
      const beat = 60 / bpm;
      const stepsPerBeat = 2;
      const stepDur = beat / stepsPerBeat;
      const totalSteps = Math.floor(durationSec / stepDur);
      // Walk a scale, occasionally jumping
      let stepIdx = 0;
      let prevDeg = 0;
      for (let i = 0; i < totalSteps; i++) {
        const t = i * stepDur;
        // Choose a scale degree (weighted toward recent)
        let deg;
        if (Math.random() < 0.7) {
          // Adjacent step
          deg = prevDeg + (Math.random() < 0.5 ? -1 : 1) * (Math.random() < 0.4 ? 2 : 1);
        } else {
          // Random jump
          deg = scale.degrees[Math.floor(Math.random() * scale.degrees.length)] + ((Math.random() < 0.3) ? 12 : 0);
        }
        deg = Math.max(-2, Math.min(14, deg));
        const oct = (deg > 6) ? 1 : 0;
        const noteIdx = ((deg % scale.degrees.length) + scale.degrees.length) % scale.degrees.length;
        const semis = scale.degrees[noteIdx] + oct * 12 + (deg - noteIdx) * 12;
        const freq = root * Math.pow(2, semis / 12);
        const dur = stepDur * (0.8 + Math.random() * 0.6);
        melody.push({ t, freq, dur });
        prevDeg = deg;
        stepIdx++;
        // Bass note on every beat
        if (i % stepsPerBeat === 0) {
          const bassDeg = scale.degrees[(i / stepsPerBeat) % scale.degrees.length];
          const bfreq = root * Math.pow(2, (bassDeg - 12) / 12);
          bass.push({ t, freq: bfreq, dur: beat * 0.9 });
        }
      }
      return { melody, bass, bpm };
    },

    scheduleTrack(filename, from, duration = 8) {
      const ctx = this.ensureCtx();
      // Stop any currently playing track
      if (this.current) this.stopImmediate();
      const { melody, bass } = this.buildSequence(filename, duration);
      const startedAt = ctx.currentTime + 0.05;
      const gain = ctx.createGain();
      gain.gain.value = 1.0;
      gain.connect(this.master);

      const scheduled = [];
      const scheduledEnd = startedAt + duration + 0.1;
      // Master envelope for the track
      const env = ctx.createGain();
      env.gain.setValueAtTime(0, startedAt);
      env.gain.linearRampToValueAtTime(1.0, startedAt + 0.05);
      env.gain.setValueAtTime(1.0, scheduledEnd - 0.2);
      env.gain.linearRampToValueAtTime(0, scheduledEnd);
      env.connect(gain);

      for (const n of melody) {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = this.waveform;
        osc.frequency.value = n.freq;
        g.gain.setValueAtTime(0, startedAt + n.t);
        g.gain.linearRampToValueAtTime(0.12, startedAt + n.t + 0.01);
        g.gain.exponentialRampToValueAtTime(0.001, startedAt + n.t + n.dur);
        osc.connect(g).connect(env);
        osc.start(startedAt + n.t);
        osc.stop(startedAt + n.t + n.dur + 0.05);
        scheduled.push(osc);
      }
      for (const n of bass) {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = n.freq;
        g.gain.setValueAtTime(0, startedAt + n.t);
        g.gain.linearRampToValueAtTime(0.18, startedAt + n.t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.001, startedAt + n.t + n.dur);
        osc.connect(g).connect(env);
        osc.start(startedAt + n.t);
        osc.stop(startedAt + n.t + n.dur + 0.05);
        scheduled.push(osc);
      }
      // Add a soft "kick" on each beat for some tracks
      const h = this.hash(filename);
      if (h % 3 === 0) {
        for (let t = 0; t < duration; t += 60 / 90) {
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(110, startedAt + t);
          osc.frequency.exponentialRampToValueAtTime(40, startedAt + t + 0.12);
          g.gain.setValueAtTime(0.25, startedAt + t);
          g.gain.exponentialRampToValueAtTime(0.001, startedAt + t + 0.12);
          osc.connect(g).connect(env);
          osc.start(startedAt + t);
          osc.stop(startedAt + t + 0.13);
          scheduled.push(osc);
        }
      }

      this.current = {
        filename, from, duration,
        scheduled, gain, env,
        startedAt, scheduledEnd,
        status: 'playing',
      };

      // Auto-end
      const elapsed = (scheduledEnd - startedAt) * 1000;
      this._endTimer = setTimeout(() => this.advance('next'), elapsed + 50);

      this.history.push({ filename, from, duration });
      this.historyIdx = this.history.length - 1;
      this.startPosTimer();
      if (this.onTick) this.onTick();
    },

    pause() {
      if (!this.current || this.current.status !== 'playing') return;
      const ctx = this.ensureCtx();
      this.current.status = 'paused';
      this.current.pausedAt = ctx.currentTime;
      ctx.suspend();
      if (this.onTick) this.onTick();
    },

    resume() {
      if (!this.current || this.current.status !== 'paused') return;
      const ctx = this.ensureCtx();
      // Shift scheduled times forward by the pause duration
      const pauseDur = ctx.currentTime - this.current.pausedAt;
      for (const osc of this.current.scheduled) {
        // Oscillators are already past or finished; we just resume ctx time and let audio continue.
        // Since the timeline is absolute (startedAt), and we suspended, resuming effectively continues
        // playback at the same logical position. We don't need to shift oscillators here.
      }
      ctx.resume();
      this.current.status = 'playing';
      this.current.pausedAt = 0;
      if (this.onTick) this.onTick();
    },

    stopImmediate() {
      if (this._endTimer) { clearTimeout(this._endTimer); this._endTimer = null; }
      if (!this.current) return;
      try {
        for (const osc of this.current.scheduled) {
          try { osc.stop(); } catch (e) { /* already stopped */ }
        }
        if (this.current.env) this.current.env.disconnect();
        if (this.current.gain) this.current.gain.disconnect();
      } catch (e) { /* ignore */ }
    },

    stop() {
      this.stopImmediate();
      if (this.current) this.current.status = 'stopped';
      this.stopPosTimer();
      if (this.onTick) this.onTick();
    },

    advance(direction) {
      // direction: 'next' or 'prev'
      if (!this.queue.length) return;
      let nextIdx;
      if (direction === 'next') {
        nextIdx = (this._audioIdx == null ? -1 : this._audioIdx) + 1;
        if (nextIdx >= this.queue.length) nextIdx = 0;
      } else {
        nextIdx = (this._audioIdx == null ? 0 : this._audioIdx) - 1;
        if (nextIdx < 0) nextIdx = this.queue.length - 1;
      }
      this._audioIdx = nextIdx;
      const t = this.queue[nextIdx];
      this.scheduleTrack(t.filename, t.from, t.duration || 8);
    },

    play(filename, from, duration) {
      // Add to queue (replacing any previous queue of one) and play now
      this.queue = [{ filename, from, duration: duration || 8 }];
      this._audioIdx = 0;
      this.scheduleTrack(filename, from, duration || 8);
    },

    enqueue(filename, from, duration) {
      this.queue.push({ filename, from, duration: duration || 8 });
    },

    setVolume(v) {
      this.volume = Math.max(0, Math.min(1, v));
      if (this.master) this.master.gain.value = this.volume;
    },

    setWaveform(w) {
      this.waveform = w;
      // If a track is playing, restart with new waveform
      if (this.current && this.current.status === 'playing') {
        const { filename, from, duration } = this.current;
        // Re-queue current track to play again
        const remainingFromStart = Math.max(0, this.current.duration - this.getPosition());
        this.scheduleTrack(filename, from, Math.max(2, remainingFromStart + 2));
      }
    },

    getPosition() {
      if (!this.current) return 0;
      const ctx = this.ensureCtx();
      if (this.current.status === 'paused') {
        return Math.max(0, this.current.pausedAt - this.current.startedAt);
      }
      return Math.max(0, Math.min(this.current.duration, ctx.currentTime - this.current.startedAt));
    },

    startPosTimer() {
      this.stopPosTimer();
      this.posTimer = setInterval(() => {
        if (this.onTick) this.onTick();
      }, 200);
    },
    stopPosTimer() {
      if (this.posTimer) { clearInterval(this.posTimer); this.posTimer = null; }
    },
  };

  // ============================================================
  // LOGIN FLOW
  // ============================================================
  const login = {
    overlay: null,
    username: null,
    password: null,
    connection: null,
    share: null,
    status: null,
    init() {
      this.overlay    = $('#login-overlay');
      this.username   = $('#login-username');
      this.password   = $('#login-password');
      this.connection = $('#login-connection');
      this.share      = $('#login-share');
      this.status     = $('#login-status');

      // Restore last username
      const last = (state.user && state.user.name) || '';
      this.username.value = last || 'filez_r_us';

      $('#login-connect').addEventListener('click', () => this.go());
      $('#login-cancel').addEventListener('click', () => this.cancel());
      $('#login-new-account').addEventListener('click', () => this.newAccount());
      $('#login-close').addEventListener('click', () => this.cancel());
      [this.username, this.password].forEach((i) =>
        i.addEventListener('keydown', (e) => { if (e.key === 'Enter') this.go(); })
      );

      // If we already have a session, skip login
      if (state.user && state.user.name) this.skip();
    },
    setStatus(text, cls = '') {
      this.status.textContent = text;
      this.status.className = 'login-status' + (cls ? ' ' + cls : '');
    },
    cancel() {
      // Real Napster would quit; for the demo we proceed with a guest session
      this.username.value = this.username.value || 'guest';
      this.go();
    },
    newAccount() {
      const u = `user${between(1000, 9999)}`;
      this.username.value = u;
      this.password.focus();
    },
    go() {
      const name = this.username.value.trim();
      if (!name) { this.setStatus('Username is required.', 'error'); this.username.focus(); return; }
      if (name.length < 3) { this.setStatus('Username must be at least 3 characters.', 'error'); return; }
      if (!/^[a-zA-Z0-9_-]+$/.test(name)) { this.setStatus('Use letters, numbers, _ or - only.', 'error'); return; }

      this.setStatus('Connecting to napster.com…', 'connecting');
      $('#login-connect').disabled = true;
      $('#login-cancel').disabled = true;
      $('#login-new-account').disabled = true;

      // Simulated connection sequence
      const steps = [
        ['Looking up napster.com…', 350],
        ['Resolving servers…', 400],
        ['Logging in…', 500],
        ['Downloading user list…', 450],
        ['Indexing shared files…', 350],
      ];
      let i = 0;
      const runStep = () => {
        if (i >= steps.length) return this.finish(name);
        const [msg, ms] = steps[i++];
        this.setStatus(msg, 'connecting');
        setTimeout(runStep, ms);
      };
      runStep();
    },
    finish(name) {
      state.user = {
        name,
        connection: this.connection.value,
        sharing: this.share.checked,
      };
      this.setStatus(`Connected as ${name}. Welcome to Napster.`, 'connected');
      saveState();
      setTimeout(() => {
        this.overlay.classList.add('hidden');
        app.afterLogin();
      }, 400);
    },
    skip() {
      this.overlay.classList.add('hidden');
      app.afterLogin();
    },
  };

  // ============================================================
  // WINDOWS: drag, focus, close, minimize
  // ============================================================
  const winMgr = {
    init() {
      // Apply default positions
      for (const [key, pos] of Object.entries(DEFAULT_POSITIONS)) {
        const win = document.querySelector(`.win[data-window="${key}"]`);
        if (!win) continue;
        if (state.minimized[key]) win.classList.add('minimized');
        // Keep default positions on-screen (Users defaulted to x=1180, off a 1280 desktop).
        const desk = document.getElementById('desktop');
        const maxX = desk ? desk.clientWidth - win.offsetWidth - 8 : pos.x;
        win.style.left = Math.max(0, Math.min(pos.x, maxX)) + 'px';
        win.style.top  = pos.y + 'px';
      }

      // Toolbar buttons toggle windows
      $$('.tool').forEach((btn) => {
        const key = btn.dataset.window;
        btn.addEventListener('click', () => this.toggle(key));
      });

      // Title bar buttons
      $$('.btn-title').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const win = btn.closest('.win');
          if (!win) return;
          const key = win.dataset.window;
          if (btn.dataset.action === 'close') this.hide(key);
          else if (btn.dataset.action === 'minimize') this.minimize(key);
        });
      });

      // Dragging
      $$('.titlebar[data-drag]').forEach((bar) => this.makeDraggable(bar));

      // Focus
      $$('.win').forEach((w) => w.addEventListener('mousedown', () => this.focus(w)));
    },
    focus(win) {
      $$('.win').forEach((w) => w.classList.remove('active'));
      win.classList.add('active');
    },
    show(key) {
      const win = document.querySelector(`.win[data-window="${key}"]`);
      if (!win) return;
      win.classList.remove('minimized');
      state.visible[key] = true;
      state.minimized[key] = false;
      saveState();
      this.focus(win);
      $$('.tool').forEach((b) => b.classList.toggle('active', b.dataset.window === key));
    },
    hide(key) {
      const win = document.querySelector(`.win[data-window="${key}"]`);
      if (!win) return;
      win.classList.add('minimized');
      state.visible[key] = false;
      $$('.tool').forEach((b) => b.classList.remove('active'));
    },
    minimize(key) {
      const win = document.querySelector(`.win[data-window="${key}"]`);
      if (!win) return;
      win.classList.toggle('minimized');
      state.minimized[key] = win.classList.contains('minimized');
      saveState();
    },
    toggle(key) {
      const win = document.querySelector(`.win[data-window="${key}"]`);
      if (!win) return;
      if (win.classList.contains('minimized')) {
        this.show(key);
      } else if (state.visible[key] && $$('.win.active').includes(win)) {
        this.minimize(key);
      } else {
        this.show(key);
      }
    },
    makeDraggable(bar) {
      const win = bar.closest('.win');
      let ox = 0, oy = 0, dragging = false;
      const down = (e) => {
        dragging = true;
        const r = win.getBoundingClientRect();
        ox = e.clientX - r.left;
        oy = e.clientY - r.top;
        document.body.style.cursor = 'move';
        winMgr.focus(win);
      };
      const move = (e) => {
        if (!dragging) return;
        let nx = e.clientX - ox;
        let ny = e.clientY - oy;
        // keep titlebar on screen
        nx = Math.max(-win.offsetWidth + 60, Math.min(window.innerWidth - 60, nx));
        ny = Math.max(28, Math.min(window.innerHeight - 30, ny));
        win.style.left = nx + 'px';
        win.style.top  = ny + 'px';
      };
      const up = () => {
        if (!dragging) return;
        dragging = false;
        document.body.style.cursor = '';
      };
      bar.addEventListener('mousedown', down);
      window.addEventListener('mousemove', move);
      window.addEventListener('mouseup', up);
    },
  };

  // ============================================================
  // SEARCH
  // ============================================================
  const search = {
    init() {
      $('#search-go').addEventListener('click', () => this.run());
      $('#search-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') this.run(); });
      $('#search-input').addEventListener('input', () => this.run(true));
    },
    run(debounced = false) {
      const q = $('#search-input').value.trim().toLowerCase();
      const filt = $('#search-filter').value;
      const minBr = parseInt($('#search-bitrate').value, 10);
      const max = Math.max(10, Math.min(500, parseInt($('#search-max').value, 10) || 100));

      let results = state.catalog.tracks;
      if (q) {
        results = results.filter((t) =>
          t.filename.toLowerCase().includes(q) ||
          t.artist.toLowerCase().includes(q) ||
          t.track.toLowerCase().includes(q)
        );
      }
      if (filt !== 'any') results = results.filter((t) => t.filename.endsWith('.' + filt));
      results = results.filter((t) => t.bitrate >= minBr);
      results = results.slice(0, max);

      renderResults(results, q);
    },
  };

  function renderResults(results, q) {
    const body = $('#results-body');
    body.innerHTML = '';
    if (!results.length) {
      body.innerHTML = '<tr class="empty"><td colspan="6">No matches found.</td></tr>';
    } else {
      for (const r of results) {
        const tr = el('tr', { dataset: { file: r.filename, user: r.user, size: r.sizeKB, bitrate: r.bitrate } });
        tr.innerHTML = `
          <td class="col-filename"><a class="filelink" data-action="download" data-file="${escHtml(r.filename)}">${escHtml(r.filename)}</a></td>
          <td class="col-user"><a class="userlink" data-action="user" data-user="${escHtml(r.user)}">${escHtml(r.user)}</a></td>
          <td class="col-bitrate">${r.bitrate}</td>
          <td class="col-length">${escHtml(r.length)}</td>
          <td class="col-size">${formatSize(r.sizeKB)}</td>
          <td class="col-status">${escHtml(r.status)}</td>
        `;
        tr.querySelector('.filelink').addEventListener('click', (e) => {
          e.preventDefault();
          transfers.start(r);
        });
        tr.querySelector('.userlink').addEventListener('click', (e) => {
          e.preventDefault();
          users.browseUser(r.user);
        });
        tr.addEventListener('dblclick', () => transfers.start(r));
        body.appendChild(tr);
      }
    }
    $('#results-status').textContent = `${results.length} result${results.length === 1 ? '' : 's'}${q ? ` for "${q}"` : ''}`;
  }

  // ============================================================
  // LIBRARY (the user's shared files)
  // ============================================================
  const library = {
    init() {
      $('#lib-add').addEventListener('click', () => this.add());
      $('#lib-remove').addEventListener('click', () => this.remove());
      $('#lib-rescan').addEventListener('click', () => this.rescan());
      this.render();
    },
    seed() {
      // Seed user's library with a small subset of catalog
      const tracks = state.catalog.tracks;
      const own = state.user.name;
      // Use tracks owned by the user from catalog + a few random ones
      const ownTracks = tracks.filter((t) => t.user === own).slice(0, 25);
      const extras = tracks.slice(0, 35).map((t) => ({ ...t, user: own }));
      const seen = new Set();
      state.library = [...ownTracks, ...extras].filter((t) => {
        if (seen.has(t.filename)) return false;
        seen.add(t.filename);
        return true;
      });
      saveState();
    },
    add() {
      // Pick a few random tracks not already in library
      const pool = state.catalog.tracks.filter(
        (t) => !state.library.some((x) => x.filename === t.filename)
      );
      const count = between(3, 8);
      for (let i = 0; i < count && pool.length; i++) {
        const idx = between(0, pool.length - 1);
        state.library.push({ ...pool.splice(idx, 1)[0], user: state.user.name });
      }
      saveState();
      this.render();
      toast(`Added ${count} files to library.`);
    },
    addOne(file) {
      // Add a single file (used when a download completes)
      if (state.library.some((x) => x.filename === file.filename)) return;
      state.library.push({ ...file });
      saveState();
      this.render();
    },
    remove() {
      const before = state.library.length;
      state.library = [];
      saveState();
      this.render();
      toast(`Removed ${before} files.`);
    },
    rescan() {
      this.seed();
      this.render();
      toast(`Rescanned. Library: ${state.library.length} files.`);
    },
    play(filename) {
      const track = state.library.find((t) => t.filename === filename);
      if (!track) return;
      const dur = Math.max(4, Math.min(10, parseLengthSeconds(track.length) || 6));
      audio.play(track.filename, state.user.name, dur);
      winMgr.show('player');
    },
    render() {
      const body = $('#library-body');
      body.innerHTML = '';
      if (!state.library.length) {
        body.innerHTML = '<tr class="empty"><td colspan="5">Your shared library is empty. Add files to share.</td></tr>';
      } else {
        for (const r of state.library) {
          const tr = el('tr');
          tr.dataset.file = r.filename;
          tr.innerHTML = `
            <td class="col-play"><a class="play-link" data-action="play" title="Play">▶</a></td>
            <td class="col-filename">${escHtml(r.filename)}</td>
            <td class="col-bitrate">${r.bitrate}</td>
            <td class="col-length">${escHtml(r.length)}</td>
            <td class="col-size">${formatSize(r.sizeKB)}</td>
          `;
          const playBtn = tr.querySelector('.play-link');
          playBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.play(r.filename);
          });
          tr.addEventListener('dblclick', () => this.play(r.filename));
          body.appendChild(tr);
        }
      }
      const totalKB = state.library.reduce((s, t) => s + t.sizeKB, 0);
      $('#library-count').textContent = state.library.length;
      $('#library-size').textContent = formatSize(totalKB);
      $('#footer-libinfo').textContent = `${state.library.length} shared · ${state.user ? (state.user.downloaded || 0) : 0} downloaded`;
      this.highlightNowPlaying();
    },
    highlightNowPlaying() {
      const cur = audio.current && audio.current.filename;
      $$('#library-body tr').forEach((tr) => {
        const btn = tr.querySelector('.play-link');
        if (!btn) return;
        if (cur && tr.dataset.file === cur && audio.current.status === 'playing') {
          btn.classList.add('playing');
          btn.textContent = '❚❚';
        } else {
          btn.classList.remove('playing');
          btn.textContent = '▶';
        }
      });
    },
  };

  // ============================================================
  // TRANSFERS
  // ============================================================
  const transfers = {
    nextId: 1,
    init() {
      $('#xfer-clear').addEventListener('click', () => this.clearCompleted());
      $('#xfer-pause').addEventListener('click', () => this.togglePause());
      this.render();
      this.tickInterval = setInterval(() => this.tick(), 800);
    },
    start(file) {
      // Don't duplicate active downloads of the same file
      if (state.transfers.some((t) => t.filename === file.filename && t.status !== 'Complete')) {
        toast(`Already downloading ${file.filename}`);
        return;
      }
      const xfer = {
        id: this.nextId++,
        filename: file.filename,
        from: file.user,
        bitrate: file.bitrate,
        totalKB: file.sizeKB,
        doneKB: 0,
        rateKBps: 0,
        status: 'Connecting',
        paused: false,
        t: Date.now(),
      };
      state.transfers.push(xfer);
      // Switch to transfers window
      winMgr.show('transfers');
      setTimeout(() => this.tick(), 300);
      toast(`Downloading ${file.filename} from ${file.from}`);
    },
    tick() {
      const now = Date.now();
      let activeRate = 0;
      for (const x of state.transfers) {
        if (x.status === 'Complete') continue;
        if (x.paused) { x.rateKBps = 0; continue; }
        if (x.status === 'Connecting') {
          // Become Downloading after a short delay
          if (now - x.t > 600) x.status = 'Downloading';
          x.rateKBps = 0;
          continue;
        }
        // Simulate throughput. Demo: a typical 4MB track should finish in ~5-10 seconds.
        const kbps = between(150, Math.max(200, x.bitrate * 2.5));
        const incKB = Math.round(kbps * 0.8); // ~0.8s tick
        x.doneKB = Math.min(x.totalKB, x.doneKB + incKB);
        x.rateKBps = kbps;
        activeRate += x.rateKBps;
        if (x.doneKB >= x.totalKB) {
          x.status = 'Complete';
          x.doneKB = x.totalKB;
          x.rateKBps = 0;
          // Bump downloaded count for footer
          if (state.user) state.user.downloaded = (state.user.downloaded || 0) + 1;
          // Add to library so it can be played
          library.addOne({
            filename: x.filename,
            user: x.from,
            bitrate: x.bitrate,
            length: '0:00',
            sizeKB: x.totalKB,
            status: 'Available',
          });
          toast(`Download complete: ${x.filename}`);
        }
      }
      $('#xfer-count').textContent = state.transfers.length;
      $('#xfer-rate').textContent  = `${activeRate} KB/s`;
      this.render();
      $('#footer-libinfo').textContent = `${state.library.length} shared · ${state.user ? (state.user.downloaded || 0) : 0} downloaded`;
    },
    clearCompleted() {
      const before = state.transfers.length;
      state.transfers = state.transfers.filter((t) => t.status !== 'Complete');
      const removed = before - state.transfers.length;
      this.render();
      toast(`Cleared ${removed} completed transfers.`);
    },
    togglePause() {
      const btn = $('#xfer-pause');
      const anyActive = state.transfers.some((t) => t.status !== 'Complete' && !t.paused);
      for (const t of state.transfers) {
        if (t.status === 'Complete') continue;
        t.paused = anyActive;
      }
      btn.textContent = anyActive ? 'Resume All' : 'Pause All';
      toast(anyActive ? 'Paused all transfers.' : 'Resumed all transfers.');
    },
    render() {
      const body = $('#transfers-body');
      body.innerHTML = '';
      if (!state.transfers.length) {
        body.innerHTML = '<tr class="empty"><td colspan="6">No active downloads. Double-click a search result to download.</td></tr>';
        return;
      }
      for (const x of state.transfers) {
        const pct = x.totalKB > 0 ? Math.round((x.doneKB / x.totalKB) * 100) : 0;
        const tr = el('tr');
        tr.dataset.file = x.filename;
        const playCell = x.status === 'Complete'
          ? `<a class="play-link" data-action="play" title="Play">▶</a>`
          : '';
        tr.innerHTML = `
          <td class="col-play">${playCell}</td>
          <td class="col-filename">${escHtml(x.filename)}</td>
          <td class="col-user"><a class="userlink" data-user="${escHtml(x.from)}">${escHtml(x.from)}</a></td>
          <td class="col-size">${formatSize(x.totalKB)}</td>
          <td class="col-progress">
            <div class="progress"><div class="progress-bar" style="width:${pct}%"></div><div class="progress-text">${pct}% · ${x.rateKBps} KB/s</div></div>
          </td>
          <td class="col-status">${escHtml(x.status)}${x.paused ? ' (paused)' : ''}</td>
        `;
        const playBtn = tr.querySelector('.play-link');
        if (playBtn) {
          playBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            library.play(x.filename);
          });
          tr.addEventListener('dblclick', () => library.play(x.filename));
        }
        tr.querySelector('.userlink').addEventListener('click', (e) => {
          e.preventDefault();
          users.browseUser(x.from);
        });
        body.appendChild(tr);
      }
    },
  };

  // ============================================================
  // NOW PLAYING (window UI + controls)
  // ============================================================
  const player = {
    init() {
      $('#np-play').addEventListener('click', () => this.toggle());
      $('#np-stop').addEventListener('click', () => this.stop());
      $('#np-next').addEventListener('click', () => this.next());
      $('#np-prev').addEventListener('click', () => this.prev());
      $('#np-volume').addEventListener('input', (e) => audio.setVolume(e.target.value / 100));
      $('#np-wave').addEventListener('change', (e) => audio.setWaveform(e.target.value));
      // Click on progress bar to seek (best-effort: just restart at midpoint)
      $('#np-progress').addEventListener('click', (e) => {
        if (!audio.current) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const frac = (e.clientX - rect.left) / rect.width;
        audio.stop();
        audio.scheduleTrack(audio.current.filename, audio.current.from, audio.current.duration);
        // skip ahead by rescheduling at remaining duration
        const targetDur = Math.max(2, audio.current.duration * (1 - frac));
        audio.stop();
        audio.scheduleTrack(audio.current.filename, audio.current.from, targetDur);
      });
      // Spacebar toggles play/pause when player window is in focus
      document.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
        if (e.key === ' ') { e.preventDefault(); this.toggle(); }
      });
      // Hook into audio ticks to refresh UI
      audio.onTick = () => this.render();
      this.render();
    },
    toggle() {
      if (!audio.current) {
        // Nothing playing → start the first library track if any
        if (state.library.length) {
          library.play(state.library[0].filename);
          return;
        }
        toast('Nothing in library to play. Add some files first.');
        return;
      }
      if (audio.current.status === 'playing') audio.pause();
      else if (audio.current.status === 'paused') audio.resume();
      else if (audio.current.status === 'stopped') {
        audio.scheduleTrack(audio.current.filename, audio.current.from, audio.current.duration);
      }
    },
    stop() {
      audio.stop();
      this.render();
    },
    next() {
      if (!audio.queue.length && !audio.current) return;
      audio.advance('next');
    },
    prev() {
      if (!audio.queue.length && !audio.current) return;
      audio.advance('prev');
    },
    render() {
      const cur = audio.current;
      const trackEl  = $('#np-track');
      const fromEl   = $('#np-from');
      const timeEl   = $('#np-time');
      const fillEl   = $('#np-progress-fill');
      const playEl   = $('#np-play');
      const statEl   = $('#np-status');
      if (!cur) {
        trackEl.textContent = '— nothing playing —';
        fromEl.textContent  = '';
        timeEl.textContent  = '0:00 / 0:00';
        fillEl.style.width  = '0%';
        playEl.textContent  = '▶';
        statEl.textContent  = 'Ready. Synthesized audio preview — generated from the track\'s filename.';
        statEl.classList.remove('playing');
        library.highlightNowPlaying();
        return;
      }
      trackEl.textContent = cur.filename;
      fromEl.textContent  = cur.from ? `from ${cur.from}` : '';
      const pos = audio.getPosition();
      const total = cur.duration;
      timeEl.textContent  = `${formatLength(Math.floor(pos))} / ${formatLength(Math.floor(total))}`;
      fillEl.style.width  = `${Math.min(100, (pos / total) * 100)}%`;
      if (cur.status === 'playing') {
        playEl.textContent = '❚❚';
        statEl.textContent = '▶ Playing';
        statEl.classList.add('playing');
      } else if (cur.status === 'paused') {
        playEl.textContent = '▶';
        statEl.textContent = '❚❚ Paused';
        statEl.classList.remove('playing');
      } else {
        playEl.textContent = '▶';
        statEl.textContent = 'Stopped';
        statEl.classList.remove('playing');
      }
      library.highlightNowPlaying();
    },
  };

  // ============================================================
  // HOTLIST
  // ============================================================
  const hotlist = {
    init() { this.render(); },
    add(name) {
      if (state.hotlist.includes(name)) {
        toast(`${name} is already on your hotlist.`);
        return;
      }
      state.hotlist.push(name);
      saveState();
      this.render();
      toast(`Added ${name} to hotlist.`);
    },
    remove(name) {
      state.hotlist = state.hotlist.filter((n) => n !== name);
      saveState();
      this.render();
      toast(`Removed ${name} from hotlist.`);
    },
    toggle(name) {
      if (state.hotlist.includes(name)) this.remove(name);
      else this.add(name);
    },
    render() {
      const body = $('#hotlist-body');
      body.innerHTML = '';
      const users = state.catalog.users;
      const hotUsers = state.hotlist.map((n) => users.find((u) => u.name === n)).filter(Boolean);
      if (!hotUsers.length) {
        body.innerHTML = '<tr class="empty"><td colspan="4">Hotlist is empty. Right-click a user to add.</td></tr>';
      } else {
        for (const u of hotUsers) {
          const tr = el('tr');
          tr.innerHTML = `
            <td class="col-user"><a class="userlink" data-user="${escHtml(u.name)}">${escHtml(u.name)}</a></td>
            <td class="col-speed">${escHtml(u.speed)}</td>
            <td class="col-count">${u.filesShared}</td>
            <td class="col-status">${escHtml(u.status)}</td>
          `;
          tr.addEventListener('click', () => { state.selectedUser = u; });
          tr.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            ctxMenu.show(e.clientX, e.clientY, u);
          });
          tr.querySelector('.userlink').addEventListener('click', (e) => {
            e.preventDefault();
            users.browseUser(u.name);
          });
          body.appendChild(tr);
        }
      }
      $('#hotlist-count').textContent = hotUsers.length;
    },
  };

  // ============================================================
  // USERS (browse list)
  // ============================================================
  const users = {
    init() {
      $('#users-filter').addEventListener('input', () => this.render());
      this.render();
    },
    browseUser(name) {
      const u = state.catalog.users.find((x) => x.name === name);
      if (!u) return;
      const own = u.name;
      // Pretend to load their library: tracks owned by this user + a few from others
      const pool = state.catalog.tracks.filter((t) => t.user === own);
      const extras = state.catalog.tracks
        .filter((t) => t.user !== own)
        .sort(() => rand() - 0.5)
        .slice(0, Math.max(0, between(10, 30)));
      const list = [...pool, ...extras].slice(0, between(30, 80));
      $('#browse-username').textContent = own;
      const body = $('#browse-body');
      body.innerHTML = '';
      for (const r of list) {
        const tr = el('tr');
        tr.innerHTML = `
          <td class="col-filename">${escHtml(r.filename)}</td>
          <td class="col-bitrate">${r.bitrate}</td>
          <td class="col-length">${escHtml(r.length)}</td>
          <td class="col-size">${formatSize(r.sizeKB)}</td>
        `;
        body.appendChild(tr);
      }
      $('#browse-dialog').hidden = false;
    },
    getInfo(name) {
      const u = state.catalog.users.find((x) => x.name === name);
      if (!u) return;
      const body = $('#info-body');
      body.innerHTML = `
        <dl class="info-grid">
          <dt>Username</dt><dd>${escHtml(u.name)}</dd>
          <dt>Status</dt><dd>${escHtml(u.status)}</dd>
          <dt>Connection</dt><dd>${escHtml(u.speed)}</dd>
          <dt>Files Shared</dt><dd>${u.filesShared}</dd>
          <dt>Files Downloaded</dt><dd>${u.filesDownloaded}</dd>
          <dt>Upload Speed</dt><dd>${u.uploadSpeedKBps} KB/s</dd>
          <dt>Joined</dt><dd>${escHtml(u.joined)}</dd>
          <dt>User ID</dt><dd>${u.id}</dd>
          <dt>Client</dt><dd>Napster 2.0 Beta 7</dd>
        </dl>
      `;
      $('#info-dialog').hidden = false;
    },
    render() {
      const body = $('#users-body');
      body.innerHTML = '';
      const q = ($('#users-filter').value || '').toLowerCase();
      let list = state.catalog.users;
      if (q) list = list.filter((u) => u.name.toLowerCase().includes(q));
      for (const u of list) {
        const tr = el('tr');
        tr.innerHTML = `
          <td class="col-user"><a class="userlink" data-user="${escHtml(u.name)}">${escHtml(u.name)}</a></td>
          <td class="col-speed">${escHtml(u.speed)}</td>
          <td class="col-count">${u.filesShared}</td>
          <td class="col-status">${escHtml(u.status)}</td>
        `;
        tr.addEventListener('click', () => { state.selectedUser = u; });
        tr.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          ctxMenu.show(e.clientX, e.clientY, u);
        });
        tr.querySelector('.userlink').addEventListener('click', (e) => {
          e.preventDefault();
          users.browseUser(u.name);
        });
        body.appendChild(tr);
      }
      $('#users-count').textContent = list.length;
    },
  };

  // ============================================================
  // CONTEXT MENU
  // ============================================================
  const ctxMenu = {
    el: null,
    init() {
      this.el = $('#ctx-menu');
      this.el.addEventListener('click', (e) => {
        const li = e.target.closest('li');
        if (!li) return;
        const action = li.dataset.action;
        this.hide();
        this.handle(action);
      });
      document.addEventListener('click', () => this.hide());
      document.addEventListener('contextmenu', (e) => {
        if (!e.target.closest('tr')) this.hide();
      });
    },
    show(x, y) {
      const u = state.ctxUser;
      if (!u) return;
      const onHotlist = state.hotlist.includes(u.name);
      this.el.querySelector('[data-action="hotlist-add"]').style.display    = onHotlist ? 'none' : '';
      this.el.querySelector('[data-action="hotlist-remove"]').style.display = onHotlist ? '' : 'none';
      // Menu is absolute inside the desktop: convert viewport coords.
      const dr = (this.el.parentElement || document.body).getBoundingClientRect();
      this.el.style.left = (x - dr.left) + 'px';
      this.el.style.top  = (y - dr.top) + 'px';
      this.el.hidden = false;
    },
    hide() { this.el.hidden = true; },
    handle(action) {
      const u = state.ctxUser;
      if (!u) return;
      switch (action) {
        case 'browse':       users.browseUser(u.name); break;
        case 'download-all': users.downloadAll(u.name); break;
        case 'message':      chat.openPrivate(u.name); winMgr.show('chat'); break;
        case 'hotlist-add':    hotlist.add(u.name); break;
        case 'hotlist-remove': hotlist.remove(u.name); break;
        case 'get-info':     users.getInfo(u.name); break;
        case 'block':        toast(`Blocked ${u.name}.`); break;
      }
    },
  };

  // Patch users.render to record ctxUser on contextmenu and show the menu
  const _origRender = users.render;
  users.render = function() {
    _origRender.call(this);
    $$('#users-body tr, #hotlist-body tr').forEach((tr) => {
      tr.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        const link = tr.querySelector('.userlink');
        if (!link) return;
        const name = link.dataset.user;
        const u = state.catalog.users.find((x) => x.name === name);
        if (u) {
          state.ctxUser = u;
          ctxMenu.show(e.clientX, e.clientY);
        }
      });
    });
  };

  // Add downloadAll helper
  users.downloadAll = function(name) {
    const owned = state.catalog.tracks.filter((t) => t.user === name);
    const queue = owned.slice(0, 10);
    if (!queue.length) {
      // Browse anyway
      users.browseUser(name);
      return;
    }
    queue.forEach((t) => transfers.start(t));
    winMgr.show('transfers');
    toast(`Queued ${queue.length} files from ${name}.`);
  };

  // ============================================================
  // CHAT
  // ============================================================
  const chat = {
    init() {
      $('#chat-send').addEventListener('click', () => this.send());
      $('#chat-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') this.send(); });
      $('#chat-channel').addEventListener('change', () => { this.render(); this.renderRoster(); });
      // Periodic ambient messages so the chat feels alive
      this.ambient = setInterval(() => this.ambientMessage(), 7000);
      this.render();
      this.renderRoster();
    },
    send() {
      const input = $('#chat-input');
      const text = input.value.trim();
      if (!text) return;
      const ch = $('#chat-channel').value;
      const who = state.user ? state.user.name : 'guest';
      this.add({ channel: ch, who, text, self: true, t: Date.now() });
      input.value = '';
      // Auto-reply from a fake user after a moment
      setTimeout(() => {
        const users = state.catalog.users.filter((u) => u.status === 'Online');
        const u = pick(users);
        const reply = pick([
          'lol', 'yeah dude', '+1', 'right on', 'agreed', 'no way',
          'check out my library', 'who is online?', 'anyone got that new track?',
          'firewalled :(', 't1 baby!', 'thanks!', 'np', 'brb',
          'this song slaps', 'classic', '🔥', 'haha', 'same',
          'transferring now', 'hold on, low upstream',
        ]);
        this.add({ channel: ch, who: u.name, text: reply, t: Date.now() });
      }, between(800, 2500));
    },
    add(msg) {
      state.chatLog.push(msg);
      if (state.chatLog.length > 200) state.chatLog = state.chatLog.slice(-200);
      saveState();
      this.render();
    },
    ambientMessage() {
      // Drop a message into the lobby every so often
      if (!$('#chat-channel') || $('#chat-channel').value !== '#lobby') return;
      const u = pick(state.catalog.users.filter((u) => u.status === 'Online'));
      const lines = [
        'hey anyone got that new deftones track?',
        'is the server laggy for anyone else?',
        'just uploaded 30 tracks, enjoy',
        'firewalled can still dl?',
        't1 gang rise up',
        'finally a stable connection',
        'who is using winmx lol',
        'mp3 forever',
        'gief me metallica',
      ];
      this.add({ channel: '#lobby', who: u.name, text: pick(lines), t: Date.now() });
    },
    openPrivate(name) {
      // Switch chat to a pseudo-private room for the user
      const sel = $('#chat-channel');
      const optVal = `@${name}`;
      if (!Array.from(sel.options).some((o) => o.value === optVal)) {
        const opt = el('option', { value: optVal }, `Private: ${name}`);
        sel.appendChild(opt);
      }
      sel.value = optVal;
      this.render();
      this.renderRoster();
    },
    renderRoster() {
      // Show approximate "n users" in current channel
      const ch = $('#chat-channel').value;
      const n = between(8, 80);
      $('#chat-roster').textContent = `${n} user${n === 1 ? '' : 's'} in ${ch}`;
    },
    render() {
      const log = $('#chat-log');
      const ch = $('#chat-channel').value;
      log.innerHTML = '';
      const msgs = state.chatLog.filter((m) => m.channel === ch);
      if (!msgs.length) {
        const sys = el('div', { class: 'chat-msg system' }, `* You have entered ${ch}`);
        log.appendChild(sys);
      }
      for (const m of msgs) {
        const cls = m.self ? 'chat-msg self' : 'chat-msg';
        const line = el('div', { class: cls });
        const t = new Date(m.t);
        const hh = String(t.getHours()).padStart(2, '0');
        const mm = String(t.getMinutes()).padStart(2, '0');
        line.innerHTML = `<span class="chat-time">[${hh}:${mm}]</span> <span class="chat-who">&lt;${escHtml(m.who)}&gt;</span> <span class="chat-text">${escHtml(m.text)}</span>`;
        log.appendChild(line);
      }
      log.scrollTop = log.scrollHeight;
    },
  };

  // ============================================================
  // DIALOGS
  // ============================================================
  const dialogs = {
    init() {
      $('#info-close').addEventListener('click', () => $('#info-dialog').hidden = true);
      $('#info-ok').addEventListener('click', () => $('#info-dialog').hidden = true);
      $('#browse-close').addEventListener('click', () => $('#browse-dialog').hidden = true);
      $('#browse-ok').addEventListener('click', () => $('#browse-dialog').hidden = true);
      // Draggable too
      $$('#info-dialog .titlebar, #browse-dialog .titlebar').forEach((bar) => {
        const win = bar.closest('.dialog-window');
        let ox = 0, oy = 0, dragging = false;
        const down = (e) => {
          dragging = true;
          const r = win.getBoundingClientRect();
          ox = e.clientX - r.left;
          oy = e.clientY - r.top;
          document.body.style.cursor = 'move';
        };
        const move = (e) => {
          if (!dragging) return;
          win.style.left = (e.clientX - ox) + 'px';
          win.style.top  = (e.clientY - oy) + 'px';
          win.style.position = 'absolute';
          win.style.margin = '0';
        };
        const up = () => { if (dragging) { dragging = false; document.body.style.cursor = ''; } };
        bar.addEventListener('mousedown', down);
        window.addEventListener('mousemove', move);
        window.addEventListener('mouseup', up);
      });
    },
  };

  // ============================================================
  // TOAST (lightweight status messages)
  // ============================================================
  let toastEl = null;
  function toast(msg) {
    if (!toastEl) {
      toastEl = el('div', { class: 'toast' });
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => toastEl.classList.remove('show'), 2200);
  }

  // ============================================================
  // ONLINE COUNT (fluctuate slightly for realism)
  // ============================================================
  function startOnlineTicker() {
    setInterval(() => {
      const delta = between(-2, 3);
      state.onlineCount = Math.max(40, Math.min(120, state.onlineCount + delta));
      $('#online-count').textContent = state.onlineCount.toLocaleString();
      $('#menubar-status').textContent =
        `Logged in as ${state.user.name} · ${state.onlineCount} users online`;
      $('#footer-server').textContent =
        `napster.com — connected · ${state.onlineCount.toLocaleString()} users online`;
      $('#online-dot').classList.toggle('online', true);
    }, 3500);
  }

  // ============================================================
  // MENUBAR
  // ============================================================
  const menubar = {
    init() {
      $$('.menubar-item').forEach((btn) => {
        btn.addEventListener('click', () => {
          const menu = btn.dataset.menu;
          this.handle(menu);
        });
      });
    },
    handle(menu) {
      switch (menu) {
        case 'file':    toast('File menu: no actions wired in this demo.'); break;
        case 'edit':    toast('Edit menu: no actions wired in this demo.'); break;
        case 'view':    toast('View menu: use the toolbar buttons.'); break;
        case 'search':  winMgr.show('search'); $('#search-input').focus(); break;
        case 'actions': toast('Right-click a user for actions.'); break;
        case 'help':    this.help(); break;
      }
    },
    help() {
      $('#info-dialog').hidden = false;
      $('#info-body').innerHTML = `
        <h3 style="margin:0 0 8px;color:var(--teal-deep);">Napster 2 — Web Edition</h3>
        <p>A faithful recreation of the late-1999 Napster 2.x client for demo purposes.</p>
        <ul style="padding-left:18px;line-height:1.6;">
          <li><b>Search</b> — enter an artist or song; results update live.</li>
          <li><b>Double-click a result</b> to start a download.</li>
          <li><b>Right-click a user</b> in Browse for hotlist, browse, chat, get info.</li>
          <li><b>Drag window titlebars</b> to rearrange your desktop.</li>
          <li><b>Library → Add File</b> seeds your shared folder.</li>
          <li><b>Chat</b> — type in any of the channels. Bots reply occasionally.</li>
        </ul>
        <p style="margin-top:10px;color:#666;font-size:10px;">
          No real peer-to-peer here. Everything is mocked locally in <code>app.js</code>.
        </p>
      `;
    },
  };

  // ============================================================
  // APP BOOTSTRAP
  // ============================================================
  const app = {
    init() {
      loadState();
      state.catalog = buildCatalog();
      login.init();
      winMgr.init();
      ctxMenu.init();
      menubar.init();
      search.init();
      library.init();
      transfers.init();
      hotlist.init();
      users.init();
      chat.init();
      player.init();
      dialogs.init();
    },
    afterLogin() {
      // Seed library with the user's existing tracks (first login)
      if (!state.library.length) {
        library.seed();
        library.render();
      } else {
        library.render();
      }
      // Mark connected
      $('#footer-server').textContent =
        `napster.com — connected · ${state.onlineCount.toLocaleString()} users online`;
      $('#menubar-status').textContent =
        `Logged in as ${state.user.name} · ${state.onlineCount} users online`;
      $('#online-dot').classList.add('online');
      startOnlineTicker();
    },
  };

  // Inject toast CSS once
  const toastCss = document.createElement('style');
  toastCss.textContent = `
    .toast {
      position: fixed;
      bottom: 36px;
      left: 50%;
      transform: translateX(-50%) translateY(10px);
      background: var(--teal-deep);
      color: #fff;
      padding: 6px 14px;
      border: 1px solid #003f3f;
      box-shadow: 2px 2px 0 var(--chrome-dark);
      font-size: 11px;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.18s ease, transform 0.18s ease;
      z-index: 3000;
    }
    .toast.show {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
    }
    .chat-time { color: #888; margin-right: 4px; }
  `;
  document.head.appendChild(toastCss);

  // Run init after the DOM is parsed. With `defer` this is already true,
  // but fall back to DOMContentLoaded for any environment where it isn't.
  const _boot = () => {
    window.__BOOT_CALLED__ = true;
    try {
      app.init();
      window.__BOOT_RESULT__ = 'ok';
    } catch (e) {
      window.__BOOT_RESULT__ = String(e) + ' @ ' + (e.stack || '');
      console.error('[napster] init failed:', e);
    }
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _boot);
    window.__BOOT_MODE__ = 'domcontentloaded';
  } else {
    _boot();
    window.__BOOT_MODE__ = 'immediate';
  }
})();