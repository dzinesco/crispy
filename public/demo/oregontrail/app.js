/* =====================================================================
 * THE OREGON TRAIL — browser recreation
 *
 * Phases:
 *   1. Shell          ✓ (CRT frame, title, phosphor/cols toggles, accents)
 *   2. State + setup  ✓ (occupation / names / month, save/load)
 *   3. Main store
 *   4. Trail travel
 *   5. Landmarks + rivers
 *   6. Random events
 *   7. Hunting mini-game
 *   8. Fort stores + end-of-trail
 *   9. Polish
 *
 * Sections:
 *   Constants · State · RNG · Audio · DOM · Rendering ·
 *   Persistence · Setup flow · Input · Boot
 * ===================================================================== */

(() => {
  "use strict";

  // =====================================================================
  // CONSTANTS
  // =====================================================================

  const SCHEMA_VERSION = 1;
  const SAVE_KEY = "oregontrail.save.v1";

  // Addictive fixes — meta persistence (history, unlocks, stats, achievements).
  // All keys share the oregontrail.* namespace.
  const HISTORY_KEY = "oregontrail.history.v1";
  const UNLOCKS_KEY = "oregontrail.unlocks.v1";
  const STATS_KEY = "oregontrail.stats.v1";
  const ACHIEVEMENTS_KEY = "oregontrail.achievements.v1";

  const PHOSPHORS = ["green", "amber"];

  // 40-column ASCII title banner.
  const TITLE_ART = String.raw`
+--------------------------------------+
|                                      |
|                                      |
|      THE  OREGON  TRAIL              |
|                                      |
|                                      |
|   You may have many disasters,      |
|   but you only need to be lucky      |
|   once.                              |
|                                      |
|                                      |
|   PRESS  ENTER  TO  CONTINUE         |
|                                      |
|                                      |
+--------------------------------------+
`.trimEnd();

  // -------------------------------------------------------------
  // Game-data tables
  // -------------------------------------------------------------

  const OCCUPATIONS = {
    BANKER:    { key: "1", label: "Banker",    cash: 1600, rank: 1, blurb: "You are a banker from Boston." },
    CARPENTER: { key: "2", label: "Carpenter", cash:  800, rank: 2, blurb: "You are a carpenter from Ohio." },
    FARMER:    { key: "3", label: "Farmer",    cash:  400, rank: 3, blurb: "You are a farmer from Illinois." },
  };

  // Unlockable classes — gained by reaching Oregon. Each has a gameplay
  // modifier expressed in OCC_EFFECTS so the core systems stay simple.
  OCCUPATIONS.DOCTOR  = { key: "4", label: "Doctor",  cash: 1200, rank: 4, unlock: true, blurb: "You are a doctor from Philadelphia." };
  OCCUPATIONS.TEACHER = { key: "5", label: "Teacher", cash:  600, rank: 5, unlock: true, blurb: "You are a schoolteacher from Maine." };
  OCCUPATIONS.SOLDIER = { key: "6", label: "Soldier", cash:  900, rank: 6, unlock: true, blurb: "You are a soldier from Virginia." };

  const OCC_EFFECTS = {
    BANKER:    { illnessMod: 1.00, foodMod: 1.00, banditMod: 1.00 },
    CARPENTER: { illnessMod: 1.00, foodMod: 1.00, banditMod: 1.00 },
    FARMER:    { illnessMod: 1.00, foodMod: 1.00, banditMod: 1.00 },
    DOCTOR:    { illnessMod: 0.75, foodMod: 1.00, banditMod: 1.00 },
    TEACHER:   { illnessMod: 1.00, foodMod: 0.85, banditMod: 1.00 },
    SOLDIER:   { illnessMod: 1.00, foodMod: 1.00, banditMod: 0.50 },
  };

  const MONTHS = {
    MARCH: { key: "1", label: "March", n: 3, blurb: "The rivers will be high but the grass will be good." },
    APRIL: { key: "2", label: "April", n: 4, blurb: "The weather is warming and the trail is open." },
    MAY:   { key: "3", label: "May",   n: 5, blurb: "The grass is getting thin, but the rivers are low." },
    JUNE:  { key: "4", label: "June",  n: 6, blurb: "The grass is poor, but you can still get through." },
  };

  // Multipliers used at random-roll call sites (§6.6 of the plan).
  const DIFFICULTY = {
    EASY:     { key: "1", label: "Easy",     desc: "A gentle trail. Illness and disaster rates are halved.",
                 illnessFatality: 0.50, disasterRate: 0.60, foodPerRation: 0.85, oxenWear: 0.70, riverLoss: 0.50 },
    NORMAL:   { key: "2", label: "Normal",   desc: "A balanced trail. Illness and disaster rates are slightly reduced.",
                 illnessFatality: 0.85, disasterRate: 0.85, foodPerRation: 0.95, oxenWear: 0.85, riverLoss: 0.80 },
    FAITHFUL: { key: "3", label: "Faithful", desc: "The original 1985 numbers. Brutal and unforgiving.",
                 illnessFatality: 1.00, disasterRate: 1.00, foodPerRation: 1.00, oxenWear: 1.00, riverLoss: 1.00 },
    HARD:     { key: "4", label: "Hard",     desc: "Stacked penalties for veteran pioneers.",
                 illnessFatality: 1.20, disasterRate: 1.20, foodPerRation: 1.15, oxenWear: 1.20, riverLoss: 1.25 },
  };

  // Classic roster. The setup flow rotates through this list to suggest
  // defaults that the player can accept by pressing Enter alone.
  const NAME_POOL = ["Mary", "Greg", "Jane", "John", "Anna", "Peter", "Liz", "Tom", "Sarah", "Mark", "Kate", "Sam"];
  const DEFAULT_LEADER = "John";

  // Help / instructions text shown if the player asks for it.
  const HELP_TEXT = String.raw`
TRY THE OREGON TRAIL

The object of the game is to travel from
Independence, Missouri to Oregon City,
Oregon in 1848. The trail is about 2,000
miles long. You will travel by covered
wagon pulled by oxen.

Before you leave Independence you should
buy supplies from the general store:
  - OXEN to pull your wagon
  - FOOD for your party of five
  - AMMUNITION for hunting
  - CLOTHING for cold weather
  - SPARE PARTS to fix your wagon

Along the trail you will:
  - CROSS rivers (ford, ferry, wait, caulk)
  - HUNT for food to add to your supplies
  - VISIT forts to resupply
  - ENCOUNTER weather, illness, strangers
  - CHOOSE your pace and ration carefully

Choose a STRENUOUS pace and you will reach
Oregon faster, but you risk illness and
losing oxen. Choose a GRUELING pace and
your oxen will die.

Many have died of dysentery along this trail.

              PRESS  SPACE  TO  CONTINUE
`.trimEnd();

  // Sample-game preset (used when the player picks option 1 on the menu).
  const SAMPLE_TRAIL = {
    occupation: "FARMER",
    leaderName: "Sam",
    partyNames: ["Mary", "Greg", "Jane", "Liz"],
    month: "APRIL",
    difficulty: "NORMAL",
    cash: OCCUPATIONS.FARMER.cash,
  };

  // -------------------------------------------------------------
  // Store catalog (main store at Independence + fort stores).
  // Prices match the original 1985 game.
  // -------------------------------------------------------------

  const STORE_CATALOG = [
    { key: "OXEN",     num: "1", label: "Oxen",        unit: "yoke",  unitCost: 20,   color: "wagon",  blurb: "Strong animals pull your wagon." },
    { key: "FOOD",     num: "2", label: "Food",        unit: "lb",    unitCost: 0.20, color: "fruit",  blurb: "Each person eats a few pounds a day." },
    { key: "CLOTHING", num: "3", label: "Clothing",    unit: "set",   unitCost: 10,   color: "cold",   blurb: "Warm clothes for cold months." },
    { key: "AMMO",     num: "4", label: "Ammunition",  unit: "box",   unitCost: 2,    color: "danger", blurb: "Each box holds 20 bullets." },
    { key: "PARTS",    num: "5", label: "Spare parts", unit: "part",  unitCost: 10,   color: "wagon",  blurb: "Wheels, axles, tongues." },
  ];
  // Map by key for fast lookup
  const STORE_BY_KEY = Object.fromEntries(STORE_CATALOG.map(p => [p.key, p]));

  const RATIONS = {
    FILLING:     { key: "1", label: "Filling",     perDay: 3, blurb: "Three pounds of food per person per day." },
    MEAGER:      { key: "2", label: "Meager",      perDay: 2, blurb: "Two pounds of food per person per day." },
    BARE_BONES:  { key: "3", label: "Bare bones",  perDay: 1, blurb: "One pound of food per person per day. Risky." },
  };

  const PACE = {
    STEADY:    { key: "1", label: "Steady",     milesPerDay: 15, oxenWear: 0.6, healthRisk: 0 },
    STRENUOUS: { key: "2", label: "Strenuous",  milesPerDay: 22, oxenWear: 1.0, healthRisk: 1 },
    GRUELING:  { key: "3", label: "Grueling",   milesPerDay: 30, oxenWear: 2.0, healthRisk: 5 },
  };

  // -------------------------------------------------------------
  // Calendar / date math (Phase 4+)
  // -------------------------------------------------------------
  const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const MONTH_NAMES = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  const MONTH_INDEX = {
    JANUARY: 0, FEBRUARY: 1, MARCH: 2, APRIL: 3, MAY: 4, JUNE: 5,
    JULY: 6, AUGUST: 7, SEPTEMBER: 8, OCTOBER: 9, NOVEMBER: 10, DECEMBER: 11,
  };

  /** Convert game.day (1-based) + start month to {month, day, year}. */
  function currentDate() {
    const startIdx = MONTH_INDEX[game.monthKey] ?? 2;
    let m = startIdx;
    let d = game.day;
    while (d > DAYS_IN_MONTH[m]) {
      d -= DAYS_IN_MONTH[m];
      m = (m + 1) % 12;
    }
    const yearsElapsed = Math.floor((game.day - 1) / 365);
    return { month: MONTH_NAMES[m], day: d, year: 1848 + yearsElapsed };
  }

  function seasonOf(dateMonth) {
    const m = MONTH_INDEX[MONTH_NAMES.indexOf ? MONTH_NAMES.indexOf(dateMonth) : Object.keys(MONTH_INDEX).find((k) => MONTH_NAMES[MONTH_INDEX[k]] === dateMonth)];
    // Fallback: derive from string match
    if (dateMonth === "December" || dateMonth === "January" || dateMonth === "February") return "Winter";
    if (dateMonth === "March" || dateMonth === "April" || dateMonth === "May") return "Spring";
    if (dateMonth === "June" || dateMonth === "July" || dateMonth === "August") return "Summer";
    return "Fall";
  }

  function isCold(dateMonth) {
    return ["November", "December", "January", "February", "March"].includes(dateMonth);
  }

  // -------------------------------------------------------------
  // Landmark schedule (Phase 5+)
  // -------------------------------------------------------------
  const LANDMARKS = [
    { miles:  100, key: "KANSAS_RIVER",     type: "river",    name: "Kansas River Crossing",   region: "prairie",   blurb: "A muddy river blocks the trail." },
    { miles:  160, key: "BIG_BLUE",         type: "river",    name: "Big Blue River Crossing", region: "prairie",   blurb: "The Big Blue runs fast and cold." },
    { miles:  300, key: "FORT_KEARNEY",     type: "fort",     name: "Fort Kearney",            region: "plains",    blurb: "A small outpost on the prairie." },
    { miles:  550, key: "CHIMNEY_ROCK",     type: "landmark", name: "Chimney Rock",            region: "plains",    blurb: "A tall spire rises from the plains." },
    { miles:  720, key: "FORT_LARAMIE",     type: "fort",     name: "Fort Laramie",            region: "plains",    blurb: "A large American fort on the North Platte." },
    { miles:  830, key: "INDEPENDENCE_ROCK", type: "landmark", name: "Independence Rock",      region: "plains",    blurb: "A massive granite dome in the desert." },
    { miles:  950, key: "SOUTH_PASS",       type: "landmark", name: "South Pass",              region: "mountains", blurb: "The gentle crossing through the Rockies." },
    { miles: 1080, key: "FORT_BRIDGER",     type: "fort",     name: "Fort Bridger",            region: "mountains", blurb: "Jim Bridger's trading post." },
    { miles: 1150, key: "GREEN_RIVER",      type: "river",    name: "Green River Crossing",    region: "mountains", blurb: "A swift river with steep banks." },
    { miles: 1320, key: "SODA_SPRINGS",     type: "landmark", name: "Soda Springs",            region: "mountains", blurb: "Natural springs of carbonated water." },
    { miles: 1390, key: "FORT_HALL",        type: "fort",     name: "Fort Hall",               region: "mountains", blurb: "A British-built fort in Idaho." },
    { miles: 1500, key: "SNAKE_RIVER",      type: "river",    name: "Snake River Crossing",    region: "mountains", blurb: "A wide, deep river through basalt canyons." },
    { miles: 1620, key: "FORT_BOISE",       type: "fort",     name: "Fort Boise",              region: "mountains", blurb: "A Hudson's Bay Company post." },
    { miles: 1750, key: "FORT_WALLA_WALLA", type: "fort",     name: "Fort Walla Walla",        region: "plains",    blurb: "A fortified mission on the Columbia plain." },
    { miles: 1820, key: "THE_DALLES",       type: "dalles",   name: "The Dalles",              region: "forest",    blurb: "Rapids end the overland route." },
    { miles: 2000, key: "OREGON_CITY",      type: "end",      name: "Oregon City",             region: "valley",    blurb: "The end of the trail." },
  ];

  // -------------------------------------------------------------
  // Illness catalog (Phase 6)
  //
  // `fatality` is the daily chance a sick party member dies (modified by
  // difficulty.illnessFatality). `minDays`/`maxDays` define recovery range.
  // If daysSick exceeds `maxDays` without recovery, fatality also rises.
  // -------------------------------------------------------------
  const ILLNESSES = {
    Exhaustion: { fatality: 0.02, minDays: 2, maxDays: 6, color: "warm",  blurb: "worn down by the trail" },
    Snakebite:  { fatality: 0.04, minDays: 3, maxDays: 8, color: "danger", blurb: "bitten by a snake" },
    Dysentery:  { fatality: 0.05, minDays: 4, maxDays: 10, color: "danger", blurb: "ailing with dysentery" },
    Typhoid:    { fatality: 0.07, minDays: 5, maxDays: 12, color: "danger", blurb: "ill with typhoid" },
    Cholera:    { fatality: 0.10, minDays: 3, maxDays: 8,  color: "danger", blurb: "sick with cholera" },
    Measles:    { fatality: 0.03, minDays: 4, maxDays: 9,  color: "warm",   blurb: "covered in measles" },
    Fever:      { fatality: 0.04, minDays: 3, maxDays: 7,  color: "warm",   blurb: "burning with fever" },
  };

  // -------------------------------------------------------------
  // Daily-event catalog (Phase 6)
  //
  // `rollDailyEvent` picks one weighted entry per advance-day based on
  // difficulty.disasterRate. Each entry's `apply` mutates game state and
  // returns an array of message lines shown on the event screen.
  // -------------------------------------------------------------
  const EVENTS = [
    // ----- DISASTERS (lose resources) -----
    {
      key: "BLIZZARD", type: "disaster", weight: 4,
      msg: "A blizzard sweeps across the plains.",
      apply() {
        const lostFood = Math.min(game.food, rint(20, 80));
        game.food -= lostFood;
        const sick = applyIllnessToRandomMember("Exhaustion");
        return [
          colorize.danger(`  A blizzard sweeps across the plains.`),
          colorize.danger(`  You lose ${Math.floor(lostFood)} lb of food.`),
          sick ? colorize.warm(`  ${sick.name} is ${sick.illnessLine}.`) : "",
        ].filter(Boolean);
      },
    },
    {
      key: "HAIL", type: "disaster", weight: 3,
      msg: "Hailstorms damage the wagon.",
      apply() {
        const lostParts = Math.min(game.parts, rint(1, 2));
        game.parts -= lostParts;
        return [
          colorize.danger(`  A hailstorm pummels the wagon.`),
          colorize.danger(`  You lose ${lostParts} spare part${lostParts === 1 ? "" : "s"}.`),
        ];
      },
    },
    {
      key: "HEAVY_RAIN", type: "disaster", weight: 5,
      msg: "Heavy rains soak your supplies.",
      apply() {
        const lostFood = Math.min(game.food, rint(10, 40));
        game.food -= lostFood;
        return [
          colorize.water(`  Heavy rains soak your supplies.`),
          colorize.danger(`  You lose ${Math.floor(lostFood)} lb of food.`),
        ];
      },
    },
    {
      key: "LIGHTNING", type: "disaster", weight: 1,
      msg: "Lightning strikes a nearby tree.",
      apply() {
        const lost = Math.min(game.oxen, rint(1, 2));
        game.oxen -= lost;
        return [
          colorize.danger(`  Lightning strikes a tree near the wagon.`),
          colorize.danger(`  ${lost} oxen ${lost === 1 ? "is" : "are"} killed.`),
        ];
      },
    },
    {
      key: "BANDITS", type: "disaster", weight: 2,
      msg: "Bandits attack the wagon.",
      apply() {
        const occFx = OCC_EFFECTS[game.occupationKey] || OCC_EFFECTS.FARMER;
        const banditMod = occFx.banditMod;
        const lostCash = Math.min(game.cash, Math.floor(rint(20, 80) * banditMod));
        const lostAmmo = Math.min(game.ammo, Math.floor(rint(5, 25) * banditMod));
        game.cash -= lostCash;
        game.ammo -= lostAmmo;
        return [
          colorize.danger(`  Bandits ambush the wagon!`),
          colorize.danger(`  You lose $${lostCash} and ${lostAmmo} bullet${lostAmmo === 1 ? "" : "s"}.`),
        ];
      },
    },
    {
      key: "SNAKEBITE", type: "disaster", weight: 2,
      msg: "A snake strikes.",
      apply() {
        const who = applyIllnessToRandomMember("Snakebite");
        return [
          colorize.danger(`  A snake strikes from the tall grass!`),
          who ? colorize.warm(`  ${who.name} is ${who.illnessLine}.`) : colorize.meta(`  Luckily, no one was bitten.`),
        ].filter(Boolean);
      },
    },
    {
      key: "BROKEN_WHEEL", type: "disaster", weight: 4,
      msg: "A wagon wheel breaks.",
      apply() {
        if (game.parts > 0) {
          game.parts -= 1;
          return [
            colorize.wagon(`  A wagon wheel breaks on rough ground.`),
            colorize.meta(`  You spend 1 spare part to fix it.`),
          ];
        }
        // Lose time/miles
        return [
          colorize.danger(`  A wagon wheel breaks on rough ground.`),
          colorize.danger(`  You have no spare parts. You will lose a day.`),
        ];
      },
    },
    {
      key: "OXEN_INJURY", type: "disaster", weight: 4,
      msg: "An ox is injured.",
      apply() {
        const lost = Math.min(game.oxen, 1);
        game.oxen -= lost;
        return [
          colorize.danger(`  An ox is injured by a thorn or rock.`),
          lost
            ? colorize.danger(`  The animal cannot continue and is left behind.`)
            : colorize.meta(`  The ox recovers on its own.`),
        ].filter(Boolean);
      },
    },

    // ----- ILLNESSES (no resource loss, but risk of death) -----
    {
      key: "DYSENTERY", type: "illness", weight: 3,
      apply() {
        const who = applyIllnessToRandomMember("Dysentery");
        return who ? [
          colorize.warm(`  ${who.name} is ${who.illnessLine}.`),
        ] : [];
      },
    },
    {
      key: "TYPHOID", type: "illness", weight: 2,
      apply() {
        const who = applyIllnessToRandomMember("Typhoid");
        return who ? [
          colorize.warm(`  ${who.name} is ${who.illnessLine}.`),
        ] : [];
      },
    },
    {
      key: "CHOLERA", type: "illness", weight: 1,
      apply() {
        const who = applyIllnessToRandomMember("Cholera");
        return who ? [
          colorize.warm(`  ${who.name} is ${who.illnessLine}.`),
        ] : [];
      },
    },
    {
      key: "MEASLES", type: "illness", weight: 3,
      apply() {
        const who = applyIllnessToRandomMember("Measles");
        return who ? [
          colorize.warm(`  ${who.name} is ${who.illnessLine}.`),
        ] : [];
      },
    },
    {
      key: "FEVER", type: "illness", weight: 3,
      apply() {
        const who = applyIllnessToRandomMember("Fever");
        return who ? [
          colorize.warm(`  ${who.name} is ${who.illnessLine}.`),
        ] : [];
      },
    },

    // ----- POSITIVE EVENTS (rare but useful) -----
    {
      key: "WILD_FRUIT", type: "good", weight: 2,
      apply() {
        const gained = rint(20, 60);
        game.food += gained;
        return [
          colorize.fruit(`  The party finds wild berries and edible roots.`),
          colorize.fruit(`  You gather ${gained} lb of food.`),
        ];
      },
    },
    {
      key: "HERBS", type: "good", weight: 1,
      apply() {
        const recovered = cureRandomSick();
        return [
          colorize.fruit(`  The party finds herbs along the trail.`),
          recovered
            ? colorize.fruit(`  ${recovered.name} feels better.`)
            : colorize.meta(`  No one was sick, so you save them for later.`),
        ];
      },
    },
    {
      key: "STRANGER", type: "good", weight: 1,
      apply() {
        const gained = rint(10, 30);
        game.ammo += gained;
        return [
          colorize.fruit(`  A kind stranger shares ammunition.`),
          colorize.fruit(`  You gain ${gained} bullet${gained === 1 ? "" : "s"}.`),
        ];
      },
    },
    {
      key: "ABANDONED_WAGON", type: "good", weight: 1,
      apply() {
        const gainedFood = rint(50, 150);
        const gainedParts = rint(0, 1);
        game.food += gainedFood;
        game.parts += gainedParts;
        return [
          colorize.fruit(`  You find an abandoned wagon by the trail.`),
          colorize.fruit(`  You salvage ${gainedFood} lb of food${gainedParts ? ` and ${gainedParts} spare part${gainedParts === 1 ? "" : "s"}` : ""}.`),
        ];
      },
    },
  ];

  /** Build the weighted pool (depth == total weight) used by rollDailyEvent. */
  function weightedEvents() {
    const total = EVENTS.reduce((s, e) => s + e.weight, 0);
    const cum = [];
    let running = 0;
    for (const e of EVENTS) {
      running += e.weight;
      cum.push({ event: e, threshold: running });
    }
    return { total, cum };
  }
  const EVENT_POOL = weightedEvents();

  /** Pick a sick-less random alive party member and apply the given illness. */
  function applyIllnessToRandomMember(illnessKey) {
    if (!game.party || !game.party.length) return null;
    const candidates = game.party.filter((p) => p.alive && !p.sick);
    if (!candidates.length) return null;
    const who = candidates[Math.floor(roll() * candidates.length)];
    who.sick = true;
    who.illness = illnessKey;
    who.daysSick = 0;
    const illness = ILLNESSES[illnessKey];
    return {
      name: who.name,
      illnessLine: `${illness ? illness.blurb : "ill"} (${illnessKey.toLowerCase()})`,
    };
  }

  /** Cure a random sick party member (used by herbs event). */
  function cureRandomSick() {
    if (!game.party || !game.party.length) return null;
    const sick = game.party.filter((p) => p.alive && p.sick);
    if (!sick.length) return null;
    const who = sick[Math.floor(roll() * sick.length)];
    who.sick = false;
    who.illness = null;
    who.daysSick = 0;
    return who;
  }

  /** Pick a single random event from the weighted catalog. */
  function rollDailyEvent() {
    const diff = DIFFICULTY[game.difficultyKey] || DIFFICULTY.FAITHFUL;
    if (roll() > diff.disasterRate) return null;
    const r = roll() * EVENT_POOL.total;
    for (const slot of EVENT_POOL.cum) {
      if (r < slot.threshold) return slot.event;
    }
    return EVENT_POOL.cum[EVENT_POOL.cum.length - 1].event;
  }

  /** Apply daily illness progression: sickness counters tick up, recovery or
   *  death happens, and the call returns an array of message lines. */
  function dailyIllnessCheck() {
    const lines = [];
    if (!game.party || !game.party.length) return lines;
    const diff = DIFFICULTY[game.difficultyKey] || DIFFICULTY.FAITHFUL;
    const occFx = OCC_EFFECTS[game.occupationKey] || OCC_EFFECTS.FARMER;
    for (const p of game.party) {
      if (!p.alive) continue;
      if (!p.sick) continue;
      p.daysSick += 1;
      const illness = ILLNESSES[p.illness] || ILLNESSES.Exhaustion;
      const fatalChance = illness.fatality * diff.illnessFatality * occFx.illnessMod;
      if (roll() < fatalChance && p.daysSick >= 2) {
        p.alive = false;
        p.sick = false;
        // Track cause of death + dysentery specifically for trail-log + achievements.
        game.causeOfDeath = p.illness || "illness";
        if ((p.illness || "").toLowerCase() === "dysentery") game._hadDysenteryDeath = true;
        lines.push(colorize.danger(`  ${p.name} has died of ${(p.illness || "illness").toLowerCase()}.`));
        continue;
      }
      // Recovery
      if (p.daysSick >= illness.minDays && roll() < 0.30) {
        p.sick = false;
        p.illness = null;
        p.daysSick = 0;
        lines.push(colorize.fruit(`  ${p.name} has recovered from ${illness ? (p.illness || "illness").toLowerCase() : "illness"}.`));
      }
    }
    return lines;
  }

  // -------------------------------------------------------------
  // Keyboard legends per phase/sub-phase
  // -------------------------------------------------------------
  const LEGENDS = {
    TITLE: [
      ["ENTER", "CONTINUE"],
      ["G", "GREEN"],
      ["A", "AMBER"],
      ["4", "40-COL"],
      ["8", "80-COL"],
      ["H", "HI-CONTRAST"],
      ["M", "MUTE"],
      ["R", "RESET SAVE"],
    ],
    SAMPLE_OR_MAIN: [
      ["1", "SAMPLE TRAIL"],
      ["2", "NEW GAME"],
      ["ESC", "TITLE"],
    ],
    CONTINUE_PROMPT: [
      ["Y", "CONTINUE"],
      ["N", "NEW GAME"],
    ],
    INSTRUCTIONS: [
      ["SPACE", "CONTINUE"],
      ["N", "SKIP"],
    ],
    DIFFICULTY: [
      ["1", "EASY"],
      ["2", "NORMAL"],
      ["3", "FAITHFUL"],
      ["4", "HARD"],
      ["ESC", "BACK"],
    ],
    OCCUPATION: [
      ["1", "BANKER"],
      ["2", "CARPENTER"],
      ["3", "FARMER"],
      ["4", "DOCTOR"],
      ["5", "TEACHER"],
      ["6", "SOLDIER"],
      ["ESC", "BACK"],
    ],
    MONTH: [
      ["1", "MARCH"],
      ["2", "APRIL"],
      ["3", "MAY"],
      ["4", "JUNE"],
      ["ESC", "BACK"],
    ],
    NAME_INPUT: [
      ["ENTER", "CONFIRM"],
      ["BKSP", "EDIT"],
      ["ESC", "BACK"],
    ],
    STORE_INTRO: [
      ["ENTER", "OPEN STORE"],
    ],
    STORE_MAIN: [
      ["1", "OXEN"],
      ["2", "FOOD"],
      ["3", "CLOTHING"],
      ["4", "AMMO"],
      ["5", "PARTS"],
      ["6", "LEAVE"],
      ["ESC", "BACK"],
    ],
    STORE_QUANTITY: [
      ["ENTER", "CONFIRM"],
      ["BKSP", "EDIT"],
      ["ESC", "CANCEL"],
    ],
    STORE_CONFIRM: [
      ["ENTER", "CONTINUE"],
      ["ESC", "BACK"],
    ],
    RATION: [
      ["1", "FILLING"],
      ["2", "MEAGER"],
      ["3", "BARE BONES"],
      ["ESC", "BACK"],
    ],
    PACE: [
      ["1", "STEADY"],
      ["2", "STRENUOUS"],
      ["3", "GRUELING"],
      ["ESC", "BACK"],
    ],
    TRAVEL_INTRO: [
      ["ENTER", "BEGIN TRAIL"],
    ],
    TRAVEL_MENU: [
      ["1", "CONTINUE"],
      ["2", "SUPPLIES"],
      ["3", "PACE"],
      ["4", "RATION"],
      ["5", "HUNT"],
      ["6", "REST"],
    ],
    TRAVEL_DAY: [
      ["ENTER", "CONTINUE"],
      ["ESC", "MENU"],
    ],
    CHECK_SUPPLIES: [
      ["ENTER", "BACK"],
    ],
    TRAVEL_PACE: [
      ["1", "STEADY"],
      ["2", "STRENUOUS"],
      ["3", "GRUELING"],
      ["ESC", "BACK"],
    ],
    TRAVEL_RATION: [
      ["1", "FILLING"],
      ["2", "MEAGER"],
      ["3", "BARE BONES"],
      ["ESC", "BACK"],
    ],
    HUNT_PROMPT: [
      ["ENTER", "GO HUNTING"],
      ["ESC", "BACK"],
    ],
    EVENT: [
      ["ENTER", "CONTINUE"],
    ],
    EVENT_RESULT: [
      ["ENTER", "CONTINUE"],
    ],
    FORT_STORE: [
      ["1", "OXEN"],
      ["2", "FOOD"],
      ["3", "CLOTHING"],
      ["4", "AMMO"],
      ["5", "PARTS"],
      ["6", "LEAVE"],
      ["ESC", "BACK"],
    ],
    FORT_STORE_QUANTITY: [
      ["ENTER", "CONFIRM"],
      ["BKSP", "EDIT"],
      ["ESC", "CANCEL"],
    ],
    FORT_STORE_CONFIRM: [
      ["ENTER", "CONTINUE"],
      ["ESC", "BACK"],
    ],
  };

  // =====================================================================
  // STATE
  // =====================================================================

  // UI / runtime state.
  const ui = {
    phase: "BOOT", // BOOT, TITLE, SAMPLE_OR_MAIN, CONTINUE_PROMPT, INSTRUCTIONS,
                   // DIFFICULTY, OCCUPATION, MONTH, NAME_INPUT, STORE_INTRO, ...
    subPhase: null,
    phosphor: "green",
    cols: 40,
    muted: false,
    highContrast: false,
  };

  // Game-state (the player). Persisted to localStorage on each milestone.
  const game = {
    occupation: null,
    leaderName: null,
    partyNames: [], // 4 entries
    month: null,
    difficulty: "FAITHFUL",
    cash: 0,
    // Supplies (Phase 3+)
    oxen: 0,      // yokes
    food: 0,      // pounds
    ammo: 0,      // bullets (not boxes)
    clothing: 0,  // sets
    parts: 0,     // count
    rations: "FILLING",
    pace: "STEADY",
    // Trail (Phase 4+)
    day: 1,
    milesTraveled: 0,
    nextLandmarkIndex: 0,
    history: [],  // log of events
    // Health (Phase 6+)
    party: [],    // detailed party records with {alive, sick, illness, daysSick}
  };

  // Transient input state for text-entry screens.
  const input = {
    active: false,
    prompt: "",
    default: "",
    current: "",
    maxLen: 12,
    onConfirm: null, // fn(name) called on Enter
    onBack: null,    // fn() called on Escape
    nameIndex: 0,    // which of the 5 names we're on (0=leader, 1..4=party)
  };

  // Transient input state for the store quantity-entry screens.
  const storeInput = {
    active: false,
    product: null,
    current: "",
    max: 9999,
  };

  // Track which step of the setup flow we're on, for save/load versioning.
  const setupStep = {
    name: "TITLE", // TITLE → SAMPLE_OR_MAIN → DIFFICULTY → OCCUPATION → LEADER_NAME → PARTY_NAME_0..3 → MONTH → STORE
    index: 0,
  };

  let rngSeed = Date.now();
  let rng = mulberry32(rngSeed);

  /** True until enterTitle() runs. Suppresses saveGame() calls from
   *  setPhosphor/setCols so they don't overwrite a pre-existing save. */
  let booting = true;

  // =====================================================================
  // RNG (mulberry32) — seeded so replays are reproducible
  // =====================================================================

  function mulberry32(seed) {
    let t = seed >>> 0;
    return function rand() {
      t |= 0;
      t = (t + 0x6d2b79f5) | 0;
      let r = Math.imul(t ^ (t >>> 15), 1 | t);
      r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }
  function reseed(seed) {
    rngSeed = seed >>> 0;
    rng = mulberry32(rngSeed);
  }
  function roll() { return rng(); }
  function rint(lo, hi) { return lo + Math.floor(roll() * (hi - lo + 1)); }
  function pick(arr) { return arr[Math.floor(roll() * arr.length)]; }

  // =====================================================================
  // AUDIO
  // =====================================================================

  const audio = {
    ctx: null,
    muted: false,
    bootDone: false,

    ensure() {
      if (this.muted) return null;
      if (this.ctx) return this.ctx;
      try {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return null;
        this.ctx = new Ctx();
        return this.ctx;
      } catch { return null; }
    },

    bootChime() {
      if (this.muted || this.bootDone) return;
      const ctx = this.ensure();
      if (!ctx) return;
      this.bootDone = true;
      const t0 = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "square";
      osc.frequency.setValueAtTime(1000, t0);
      osc.frequency.exponentialRampToValueAtTime(220, t0 + 0.9);
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(0.18, t0 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.0);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + 1.05);
    },

    keyClick() {
      if (this.muted) return;
      const ctx = this.ensure();
      if (!ctx) return;
      const t0 = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "square";
      osc.frequency.setValueAtTime(880, t0);
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(0.06, t0 + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.04);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + 0.05);
    },

    toggleMute() { this.muted = !this.muted; return this.muted; },
  };

  // =====================================================================
  // DOM
  // =====================================================================

  const $ = (id) => document.getElementById(id);
  const dom = {
    body: document.body,
    screen: $("screen"),
    text: $("screen-text"),
    caret: $("caret"),
    hud: $("hud"),
    hiresCanvas: $("hires-canvas"),
    legendKeys: $("legend-keys"),
    softkeys: $("softkeys"),
    muteBtn: $("mute-toggle"),
  };

  // =====================================================================
  // RENDERING
  // =====================================================================

  function renderScreen(text) {
    if (/<[a-z][^>]*>/i.test(text)) {
      dom.text.innerHTML = text;
    } else {
      dom.text.textContent = text;
    }
    dom.text.style.display = "block";
    dom.screen.classList.remove("hires-active");
  }

  function c(text, cls) { return `<span class="${cls}">${escapeHtml(text)}</span>`; }
  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  const colorize = {
    danger: (t) => c(t, "danger"),
    water:  (t) => c(t, "water"),
    money:  (t) => c(t, "money"),
    warm:   (t) => c(t, "warm"),
    cold:   (t) => c(t, "cold"),
    wagon:  (t) => c(t, "wagon"),
    fruit:  (t) => c(t, "fruit"),
    meta:   (t) => c(t, "meta"),
    bright: (t) => c(t, "bright"),
    dim:    (t) => c(t, "dim"),
  };

  function renderHiRes(draw) {
    dom.screen.classList.add("hires-active");
    const ctx = dom.hiresCanvas.getContext("2d");
    draw(ctx, dom.hiresCanvas.width, dom.hiresCanvas.height);
  }

  function renderHud(text) {
    if (!text) { dom.hud.classList.add("hidden"); return; }
    dom.hud.classList.remove("hidden");
    dom.hud.textContent = text;
  }

  function renderLegend(phaseOrKey) {
    const keys = LEGENDS[phaseOrKey] || [];
    dom.legendKeys.innerHTML = "";
    for (const [key, label] of keys) {
      const span = document.createElement("span");
      span.className = "key-group";
      const k = document.createElement("kbd");
      k.textContent = key;
      const l = document.createElement("span");
      l.textContent = label;
      span.appendChild(k);
      span.appendChild(l);
      dom.legendKeys.appendChild(span);
    }
    // Mirror the legend into the mobile soft-keys row as tappable buttons.
    if (dom.softkeys) {
      dom.softkeys.innerHTML = "";
      for (const [key, label] of keys) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.textContent = `${key} ${label}`;
        btn.addEventListener("click", () => {
          // Translate "SPACE"/"ENTER" to KeyboardEvent.key and dispatch.
          const k = key === "SPACE" ? " " : (key === "BKSP" ? "Backspace" : (key === "ESC" ? "Escape" : key));
          window.dispatchEvent(new KeyboardEvent("keydown", { key: k }));
        });
        dom.softkeys.appendChild(btn);
      }
    }
  }

  function jitter() {
    dom.screen.classList.add("jitter");
    setTimeout(() => dom.screen.classList.remove("jitter"), 200);
  }

  function loadingFlicker(ms) {
    return new Promise((resolve) => {
      dom.screen.classList.add("loading-flicker");
      setTimeout(() => {
        dom.screen.classList.remove("loading-flicker");
        resolve();
      }, ms);
    });
  }

  // =====================================================================
  // PERSISTENCE — single auto-save to localStorage
  // =====================================================================

  function saveSnapshot() {
    return {
      schema: SCHEMA_VERSION,
      ui: { phosphor: ui.phosphor, cols: ui.cols, muted: ui.muted, highContrast: ui.highContrast },
      game: { ...game, partyNames: [...game.partyNames] },
      setupStep: { ...setupStep },
      rngSeed,
    };
  }

  function saveGame() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(saveSnapshot()));
    } catch (e) {
      // localStorage may be unavailable (privacy mode, quota, etc.) — non-fatal.
      console.warn("save failed", e);
    }
  }

  function hasSave() {
    try { return !!localStorage.getItem(SAVE_KEY); } catch { return false; }
  }

  function loadGame() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      const snap = JSON.parse(raw);
      if (typeof snap !== "object" || !snap) return null;
      // Schema migration: any older snapshot with version < SCHEMA_VERSION
      // is migrated forward. Snapshots without a schema are treated as v0
      // and upgraded best-effort.
      if (snap.schema !== SCHEMA_VERSION) {
        if (typeof snap.schema !== "number") snap.schema = SCHEMA_VERSION;
        if (snap.schema < SCHEMA_VERSION) {
          snap.schema = SCHEMA_VERSION;
          if (!snap.ui) snap.ui = {};
          if (snap.ui.highContrast === undefined) snap.ui.highContrast = false;
          if (!Array.isArray(snap.game?.partyNames)) snap.game.partyNames = [];
          if (!snap.setupStep) snap.setupStep = { name: "STORE_INTRO", index: 0 };
          if (typeof snap.rngSeed !== "number") snap.rngSeed = Date.now();
        }
        try { localStorage.setItem(SAVE_KEY, JSON.stringify(snap)); } catch {}
      }
      return snap;
    } catch { return null; }
  }

  function clearSave() {
    try { localStorage.removeItem(SAVE_KEY); } catch {}
  }

  // =====================================================================
  // ADDICTIVE FIXES — meta persistence, classes, achievements, journal
  // =====================================================================

  // Every fort landmark key. Used by the "All Forts" achievement.
  const ALL_FORTS = ["FORT_KEARNEY", "FORT_LARAMIE", "FORT_BRIDGER", "FORT_HALL", "FORT_BOISE", "FORT_WALLA_WALLA"];

  // Pre-authored trail journal. Each entry has a min-miles gate so the
  // appropriate entry fires as the wagon reaches that region of the trail.
  // {day} is filled in with the current game day at fetch time.
  const JOURNAL_ENTRIES = [
    { minMiles:   0, text: "Day {day} — the wagon rolls out of Independence under a wide prairie sky." },
    { minMiles:  40, text: "Day {day} — the trail is muddy and the oxen pull hard against the ruts." },
    { minMiles: 100, text: "Day {day} — forded the Kansas River. The water is brown and the banks are steep." },
    { minMiles: 200, text: "Day {day} — prairie stretches flat to every horizon. We saw a herd of antelope at dawn." },
    { minMiles: 300, text: "Day {day} — reached Fort Kearney. The sod walls are a welcome sight." },
    { minMiles: 420, text: "Day {day} — buffalo herds darken the plains like a slow-moving storm." },
    { minMiles: 550, text: "Day {day} — passed Chimney Rock. Mary swears it looks like a giant's hand." },
    { minMiles: 650, text: "Day {day} — the Platte River runs wide and shallow beside us, mile after mile." },
    { minMiles: 720, text: "Day {day} — Fort Laramie at last. We traded stories and bought hardtack." },
    { minMiles: 830, text: "Day {day} — Independence Rock. Travellers before us carved their names into the granite." },
    { minMiles: 950, text: "Day {day} — South Pass. The wagons climb gently through the Rockies." },
    { minMiles:1080, text: "Day {day} — Fort Bridger. Jim Bridger's place smells of pine smoke and pemmican." },
    { minMiles:1150, text: "Day {day} — floated the Green River. The raft leaks badly but we made the far bank." },
    { minMiles:1280, text: "Day {day} — entered the lava beds. The trail is sharp under the wheels." },
    { minMiles:1390, text: "Day {day} — Fort Hall. The British flag still flies over the gate." },
    { minMiles:1500, text: "Day {day} — Snake River crossing. Two oxen lost in the current. We mourned them." },
    { minMiles:1620, text: "Day {day} — Fort Boise. The missionaries offered prayers and a loaf of bread." },
    { minMiles:1720, text: "Day {day} — crossed onto the Columbia plateau. The grass is poor and the wind is sharp." },
    { minMiles:1820, text: "Day {day} — The Dalles. The Columbia roars through basalt canyons." },
    { minMiles:1900, text: "Day {day} — Barlow Toll Road. The toll is steep but the way is safe." },
    { minMiles:1970, text: "Day {day} — Mt. Hood rises white against the western sky. Almost there." },
    { minMiles:2000, text: "Day {day} — Oregon City at last. The Willamette Valley is greener than we dared hope." },
  ];

  const ACHIEVEMENTS = [
    { key: "FRONTIER",      label: "Frontier"      },
    { key: "ALL_FORTS",     label: "All Forts"     },
    { key: "HUNT_PRO",      label: "Hunt Pro"      },
    { key: "HEALTHY_WAGON", label: "Healthy Wagon" },
    { key: "BIG_SPENDER",   label: "Big Spender"   },
    { key: "VETERAN",       label: "Veteran"       },
  ];

  // ----- LocalStorage helpers -----
  function loadJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      const v = JSON.parse(raw);
      return v == null ? fallback : v;
    } catch { return fallback; }
  }
  function saveJSON(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); }
    catch (e) { console.warn("save failed", key, e); }
  }

  function loadHistory()      { return loadJSON(HISTORY_KEY, []); }
  function saveHistory(h)     { saveJSON(HISTORY_KEY, h); }
  function loadUnlocks()      { return loadJSON(UNLOCKS_KEY, {}); }
  function saveUnlocks(u)     { saveJSON(UNLOCKS_KEY, u); }
  function loadStats() {
    return loadJSON(STATS_KEY, { trailsCompleted: 0, totalHuntedLb: 0, dysenteryDeaths: 0 });
  }
  function saveStats(s)       { saveJSON(STATS_KEY, s); }
  function loadAchievements() { return loadJSON(ACHIEVEMENTS_KEY, {}); }
  function saveAchievements(a){ saveJSON(ACHIEVEMENTS_KEY, a); }

  function isOccupationUnlocked(occKey) {
    const occ = OCCUPATIONS[occKey];
    if (!occ || !occ.unlock) return true;
    return !!loadUnlocks()[occKey];
  }

  // ----- Number formatting -----
  function formatNumber(n) {
    return Math.round(Number(n) || 0).toLocaleString("en-US");
  }
  function formatShareDate(d) {
    return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  }

  // ----- Trail journal -----
  // Pick the next journal entry to fetch. Walks the table forward past the
  // last-fetched index and returns the first entry whose minMiles gate has
  // been reached. If none qualify (we're still before the first gate) we
  // return null — advanceOneDay then leaves the screen alone this tick.
  let _lastJournalIdx = -1;
  function pickJournalEntry() {
    for (let i = 0; i < JOURNAL_ENTRIES.length; i++) {
      if (i <= _lastJournalIdx) continue;
      if (JOURNAL_ENTRIES[i].minMiles <= game.milesTraveled) {
        _lastJournalIdx = i;
        return JOURNAL_ENTRIES[i];
      }
    }
    // Past the end of the list — wrap and pick the deepest gate we already
    // crossed so the journal keeps producing lines on long runs.
    for (let i = JOURNAL_ENTRIES.length - 1; i >= 0; i--) {
      if (JOURNAL_ENTRIES[i].minMiles <= game.milesTraveled) {
        return JOURNAL_ENTRIES[i];
      }
    }
    return null;
  }
  function resetJournalIndex() { _lastJournalIdx = -1; }

  // ----- Achievements -----
  function checkAndAwardAchievements(entry) {
    const ach = loadAchievements();
    const stats = loadStats();
    const newlyAwarded = {};
    const award = (k) => { if (!ach[k]) newlyAwarded[k] = true; };

    if (entry.outcome === "REACHED OREGON") {
      if (entry.alive === 5) award("FRONTIER");
      if (entry.dollars >= 1000) award("BIG_SPENDER");
      if (!entry.hadDysenteryDeath) award("HEALTHY_WAGON");
      const forts = (entry.fortsVisited || []).length;
      if (forts >= ALL_FORTS.length) award("ALL_FORTS");
    }
    if (stats.trailsCompleted >= 5) award("VETERAN");
    if (stats.totalHuntedLb >= 500) award("HUNT_PRO");

    if (Object.keys(newlyAwarded).length) {
      saveAchievements({ ...ach, ...newlyAwarded });
    }
    return newlyAwarded;
  }

  // ----- History -----
  // Append a finished-trail record and roll older entries off the end so
  // the trail log shows the most recent 5 runs.
  function addHistoryEntry(entry) {
    const h = loadHistory();
    h.push(entry);
    while (h.length > 5) h.shift();
    saveHistory(h);
  }

  function updateStatsOnTrailEnd(entry) {
    const s = loadStats();
    if (entry.outcome === "REACHED OREGON") s.trailsCompleted = (s.trailsCompleted || 0) + 1;
    s.totalHuntedLb = (s.totalHuntedLb || 0) + (entry.huntedLb || 0);
    if (entry.hadDysenteryDeath) s.dysenteryDeaths = (s.dysenteryDeaths || 0) + 1;
    saveStats(s);
  }

  function unlockAllClasses() {
    const u = loadUnlocks();
    let changed = false;
    for (const k of Object.keys(OCCUPATIONS)) {
      if (OCCUPATIONS[k].unlock && !u[k]) { u[k] = true; changed = true; }
    }
    if (changed) saveUnlocks(u);
  }

  // Build and persist a history entry for a finished run (win or death).
  function recordTrailEnd(outcome, causeOfDeath) {
    const s = computeScore();
    const entry = {
      date: new Date().toISOString().slice(0, 10),
      name: game.leaderName || "Unknown",
      occupation: game.occupation || "Pioneer",
      year: currentDate().year,
      days: s.days,
      alive: s.alive,
      causeOfDeath: causeOfDeath || (outcome === "REACHED OREGON" ? "REACHED OREGON" : "the trail"),
      dollars: s.cash,
      score: s.score,
      outcome,
      hadDysenteryDeath: !!game._hadDysenteryDeath,
      fortsVisited: Array.from(game._fortsVisited || []),
      huntedLb: game._huntedLb || 0,
    };
    addHistoryEntry(entry);
    updateStatsOnTrailEnd(entry);
    if (outcome === "REACHED OREGON") unlockAllClasses();
    const newlyAwarded = checkAndAwardAchievements(entry);
    // Stash the list so a reload of the end-trail screen can re-show the
    // exact same banner instead of every achievement the player has ever
    // earned.
    if (newlyAwarded && Object.keys(newlyAwarded).length) {
      game._lastNewlyAwarded = newlyAwarded;
    } else if (!game._lastNewlyAwarded) {
      game._lastNewlyAwarded = {};
    }
    return newlyAwarded;
  }

  // ----- Tombstone rendering -----
  function formatTombstone(entry, cols) {
    const name = (entry.name || "Unknown").toUpperCase().padEnd(12);
    const occ = (entry.occupation || "Pioneer").toUpperCase();
    const year = entry.year || 1848;
    if (entry.outcome === "REACHED OREGON") {
      return [
        `  ${colorize.bright(name)} ${colorize.meta("•")} ${colorize.meta(occ)} ${colorize.meta("•")} ${colorize.meta(year)}`,
        `    ${colorize.meta("reached Oregon in " + entry.days + " days")} ${colorize.meta("•")} ${colorize.bright("score " + formatNumber(entry.score))}`,
      ];
    }
    return [
      `  ${colorize.bright(name)} ${colorize.meta("•")} ${colorize.meta(occ)} ${colorize.meta("•")} ${colorize.meta(year)}`,
      `    ${colorize.danger("died of " + entry.causeOfDeath + " on day " + entry.days)}`,
    ];
  }

  // ----- Title panels -----
  function buildTrailLogPanel(maxTombstones) {
    const history = loadHistory();
    const lines = [colorize.bright("  TRAIL  LOG")];
    if (!history.length) {
      lines.push(colorize.meta("    (no trails recorded yet)"));
      return lines;
    }
    // Most-recent first, up to maxTombstones entries.
    const recent = history.slice(-maxTombstones).reverse();
    for (const entry of recent) {
      for (const l of formatTombstone(entry, ui.cols)) lines.push(l);
    }
    return lines;
  }

  function buildAchievementsPanel() {
    const ach = loadAchievements();
    const lines = [colorize.bright("  ACHIEVEMENTS")];
    if (ui.cols === 80) {
      // Lay 6 achievements in two rows of 3
      const row1 = ACHIEVEMENTS.slice(0, 3).map(a => {
        const earned = !!ach[a.key];
        const mark = earned ? "✓" : "·";
        return (earned ? colorize.bright : colorize.dim)(`${mark} ${a.label}`);
      });
      const row2 = ACHIEVEMENTS.slice(3).map(a => {
        const earned = !!ach[a.key];
        const mark = earned ? "✓" : "·";
        return (earned ? colorize.bright : colorize.dim)(`${mark} ${a.label}`);
      });
      lines.push("    " + row1.join("     "));
      lines.push("    " + row2.join("     "));
    } else {
      // 40-col: two columns of three
      const fmt = (a) => {
        const earned = !!ach[a.key];
        const mark = earned ? "✓" : "·";
        return (earned ? colorize.bright : colorize.dim)(`${mark} ${a.label.toUpperCase()}`);
      };
      lines.push("    " + fmt(ACHIEVEMENTS[0]).padEnd(0) + "   " + fmt(ACHIEVEMENTS[1]));
      lines.push("    " + fmt(ACHIEVEMENTS[2]) + "   " + fmt(ACHIEVEMENTS[3]));
      lines.push("    " + fmt(ACHIEVEMENTS[4]) + "   " + fmt(ACHIEVEMENTS[5]));
    }
    return lines;
  }

  function buildTitlePanels() {
    const maxTombstones = ui.cols === 80 ? 4 : 3;
    const log = buildTrailLogPanel(maxTombstones);
    const ach = buildAchievementsPanel();
    return [...log, "", ...ach].join("\n");
  }

  // ----- Share / clipboard -----
  function buildShareString(s) {
    const dateStr = formatShareDate(new Date());
    return `I reached Oregon in ${s.days} days with ${s.alive} alive — score ${formatNumber(s.score)}. Tyler, ${dateStr}, #OregonTrail`;
  }

  function copyToClipboard(text) {
    // Prefer the async Clipboard API; fall back to a hidden <textarea> +
    // execCommand for older browsers or insecure contexts.
    if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
      return navigator.clipboard.writeText(text).then(() => true, () => fallbackCopy(text));
    }
    return Promise.resolve(fallbackCopy(text));
  }
  function fallbackCopy(text) {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "absolute";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch { return false; }
  }

  // =====================================================================
  // SETUP FLOW
  // =====================================================================

  /** Decide which screen to show based on `setupStep.name`. Covers both the
   *  setup flow and the trail/store phases so the continue-prompt "Y" path
   *  can land directly on the trail without falling back to the title. */
  function runSetup() {
    switch (setupStep.name) {
      // setup
      case "SAMPLE_OR_MAIN": return renderSampleOrMain();
      case "DIFFICULTY":     return renderDifficulty();
      case "OCCUPATION":     return renderOccupation();
      case "LEADER_NAME":    return promptName({ index: 0 });
      case "PARTY_NAME_0":   return promptName({ index: 1 });
      case "PARTY_NAME_1":   return promptName({ index: 2 });
      case "PARTY_NAME_2":   return promptName({ index: 3 });
      case "PARTY_NAME_3":   return promptName({ index: 4 });
      case "MONTH":          return renderMonth();
      // store
      case "STORE_INTRO":    return renderStoreIntro();
      case "STORE_MAIN":     return renderStoreMain();
      case "RATION":         return renderRation();
      case "PACE":           return renderPace();
      // trail
      case "TRAVEL_INTRO":   return renderTravelIntro();
      case "TRAVEL_MENU":    return renderTravelMenu();
      case "TRAVEL_DAY":     return renderTravelDay();
      case "TRAVEL_PACE":    return renderTravelPace();
      case "TRAVEL_RATION":  return renderTravelRation();
      case "CHECK_SUPPLIES": return renderCheckSupplies();
      case "HUNT_PROMPT":    return renderHuntPrompt();
      case "HUNT":           return renderTravelMenu();
      case "HUNT_RESULT":    return renderTravelMenu();
      case "EVENT":          return renderTravelMenu();
      case "END_TRAIL":      return renderEndTrail();
      // landmark/fort/river rerender — these need the active entity, which
      // the caller should already have set in game._currentRiver etc. If not,
      // fall back to the travel menu so we never end up at a stale screen.
      case "RIVER": {
        if (game._currentRiver) return renderRiverChoice(game._currentRiver);
        return renderTravelMenu();
      }
      case "DALLES":         return renderTheDalles(LANDMARKS[14]);
      case "LANDMARK":       return renderTravelMenu();
      case "FORT":           return renderTravelMenu();
      case "FORT_STORE":     return openFortStore();
      case "FORT_STORE_QUANTITY": return renderFortStoreMain();
      case "FORT_STORE_CONFIRM":  return openFortStore();
      case "RIVER_RESULT":   return renderTravelMenu();
      case "GAME_OVER":      return renderTravelMenu();
      default:               return enterTitle();
    }
  }

  /** Pick a default name from NAME_POOL, rotating deterministically. */
  function suggestPartyDefault(index) {
    return NAME_POOL[(index + Math.floor(rng() * NAME_POOL.length)) % NAME_POOL.length];
  }

  // -------- SAMPLE_OR_MAIN --------
  function renderSampleOrMain() {
    ui.phase = "SAMPLE_OR_MAIN";
    setupStep.name = "SAMPLE_OR_MAIN";
    renderLegend("SAMPLE_OR_MAIN");
    renderHud(null);

    const lines = [
      "",
      "  THE  OREGON  TRAIL",
      "",
      "  1.  Try the Sample Game",
      "  2.  Main Menu (start a new game)",
      "",
      colorize.meta("  Which would you like?  "),
      colorize.bright("1"),
      " or ",
      colorize.bright("2"),
      " _",
    ].join("\n");

    renderScreen(lines);
    saveGame();
  }

  function handleSampleOrMain(key) {
    if (key === "1") {
      // Sample trail — prefill everything
      game.occupation = SAMPLE_TRAIL.occupation;
      game.occupationKey = "FARMER";
      game.leaderName = SAMPLE_TRAIL.leaderName;
      game.partyNames = [...SAMPLE_TRAIL.partyNames];
      game.month = SAMPLE_TRAIL.month;
      game.monthKey = "APRIL";
      game.difficulty = SAMPLE_TRAIL.difficulty;
      game.difficultyKey = "NORMAL";
      game.cash = SAMPLE_TRAIL.cash;
      // Reset per-trail tracking state so re-runs don't bleed over.
      game._hadDysenteryDeath = false;
      game._fortsVisited = [];
      game._huntedLb = 0;
      game.causeOfDeath = null;
      game.nextJournalDay = null;
      game._recordedTrailEnd = false;
      game._lastNewlyAwarded = null;
      resetJournalIndex();
      reseed(Date.now());
      setupStep.name = "STORE_INTRO";
      saveGame();
      return runSetup();
    }
    if (key === "2") {
      setupStep.name = "DIFFICULTY";
      return runSetup();
    }
    if (key === "Escape") return enterTitle();
  }

  // -------- CONTINUE_PROMPT --------
  function renderContinuePrompt() {
    ui.phase = "CONTINUE_PROMPT";
    renderLegend("CONTINUE_PROMPT");
    renderHud(null);
    const snap = loadGame();
    const date = snap?.game?.month || "an earlier month";
    const who = snap?.game?.leaderName || "your earlier self";
    renderScreen(
      [
        "",
        "  A SAVED GAME WAS FOUND.",
        "",
        `  Leader: ${colorize.bright(who)}`,
        `  Departure: ${date}`,
        "",
        "  Continue the saved game?",
        "",
        colorize.bright("Y") + " (continue)   " + colorize.bright("N") + " (start over)",
      ].join("\n") + "\n"
    );
  }

  function handleContinuePrompt(key) {
    const k = key.toLowerCase();
    if (k === "y") {
      const snap = loadGame();
      if (!snap) {
        // Save vanished; fall back to setup
        resetGame();
        setupStep.name = "SAMPLE_OR_MAIN";
        return runSetup();
      }
      Object.assign(ui, snap.ui || {});
      setPhosphor(ui.phosphor);
      setCols(ui.cols);
      Object.assign(game, snap.game);
      game.partyNames = [...(snap.game.partyNames || [])];
      reseed(snap.rngSeed || Date.now());
      setupStep.name = snap.setupStep?.name || "STORE_INTRO";
      saveGame();
      return runSetup();
    }
    if (k === "n") {
      resetGame();
      setupStep.name = "SAMPLE_OR_MAIN";
      return runSetup();
    }
  }

  /** Wipe game state and persisted save. Used by "start over". */
  function resetGame() {
    clearSave();
    game.occupation = null;
    game.occupationKey = null;
    game.leaderName = null;
    game.partyNames = [];
    game.month = null;
    game.monthKey = null;
    game.difficulty = "FAITHFUL";
    game.difficultyKey = "FAITHFUL";
    game.cash = 0;
    // Phase 3+
    game.oxen = 0;
    game.food = 0;
    game.ammo = 0;
    game.clothing = 0;
    game.parts = 0;
    game.rations = "FILLING";
    game.pace = "STEADY";
    game.day = 1;
    game.milesTraveled = 0;
    game.history = [];
    game.party = [];
    // Addictive-fixes per-trail tracking state.
    game._hadDysenteryDeath = false;
    game._fortsVisited = [];
    game._huntedLb = 0;
    game.causeOfDeath = null;
    game.nextJournalDay = null;
    game._recordedTrailEnd = false;
    game._lastNewlyAwarded = null;
    resetJournalIndex();
    setupStep.name = "SAMPLE_OR_MAIN";
    setupStep.index = 0;
  }

  // -------- INSTRUCTIONS --------
  function renderInstructions() {
    ui.phase = "INSTRUCTIONS";
    renderLegend("INSTRUCTIONS");
    renderHud(null);
    renderScreen(HELP_TEXT + "\n");
  }
  function handleInstructions(key) {
    if (key === " " || key === "Enter" || key.toLowerCase() === "n") {
      setupStep.name = "OCCUPATION";
      return runSetup();
    }
  }

  // -------- DIFFICULTY --------
  function renderDifficulty() {
    ui.phase = "DIFFICULTY";
    setupStep.name = "DIFFICULTY";
    renderLegend("DIFFICULTY");
    renderHud(null);
    const rows = Object.values(DIFFICULTY).map(
      (d) => `  ${colorize.bright(d.key)}  ${d.label.padEnd(10)}  ${colorize.meta(d.desc)}`
    );
    renderScreen(
      [
        "",
        colorize.bright("  CHOOSE  YOUR  DIFFICULTY"),
        "",
        ...rows,
        "",
        colorize.meta("  Difficulty applies throughout the trail and cannot be"),
        colorize.meta("  changed once the wagon rolls."),
        "",
        colorize.bright("1-4"),
        " to choose _",
      ].join("\n")
    );
    saveGame();
  }
  function handleDifficulty(key) {
    const k = key.toLowerCase();
    for (const d of Object.values(DIFFICULTY)) {
      if (d.key === k) {
        game.difficulty = d.label.toUpperCase();
        // Map back to the constant name (UPPER) for the multipliers
        for (const key2 of Object.keys(DIFFICULTY)) {
          if (DIFFICULTY[key2] === d) { game.difficultyKey = key2; break; }
        }
        setupStep.name = "OCCUPATION";
        saveGame();
        return runSetup();
      }
    }
    if (key === "Escape") {
      setupStep.name = "SAMPLE_OR_MAIN";
      return runSetup();
    }
  }

  // -------- OCCUPATION --------
  function renderOccupation() {
    ui.phase = "OCCUPATION";
    setupStep.name = "OCCUPATION";
    renderLegend("OCCUPATION");
    renderHud(null);
    const rows = [];
    rows.push("  Many kinds of people made the trip to Oregon.");
    rows.push("");
    rows.push("  You may be:");
    rows.push("");
    for (const o of Object.values(OCCUPATIONS)) {
      const unlocked = isOccupationUnlocked(Object.keys(OCCUPATIONS).find((k) => OCCUPATIONS[k] === o));
      if (unlocked) {
        const from = occupationHometown(o);
        rows.push(`  ${colorize.bright(o.key)}  A ${o.label} from ${from}`);
      } else {
        rows.push(`  ${colorize.dim(o.key)}  ${colorize.dim("[LOCK]")}  ${colorize.dim("UNLOCK BY REACHING OREGON")}`);
      }
    }
    rows.push("");
    rows.push("  What is your occupation?  " + colorize.bright("1-6") + " _");
    renderScreen(rows.join("\n"));
    saveGame();
  }
  // Display city for each occupation (used on the occupation screen).
  function occupationHometown(o) {
    if (o === OCCUPATIONS.BANKER) return "Boston";
    if (o === OCCUPATIONS.CARPENTER) return "Ohio";
    if (o === OCCUPATIONS.FARMER) return "Illinois";
    if (o === OCCUPATIONS.DOCTOR) return "Philadelphia";
    if (o === OCCUPATIONS.TEACHER) return "Maine";
    if (o === OCCUPATIONS.SOLDIER) return "Virginia";
    return "the East";
  }
  function handleOccupation(key) {
    const k = key.toLowerCase();
    for (const o of Object.values(OCCUPATIONS)) {
      if (o.key === k) {
        const occKey = Object.keys(OCCUPATIONS).find((kk) => OCCUPATIONS[kk] === o);
        if (!isOccupationUnlocked(occKey)) {
          // Locked — render a brief "still locked" screen and stay put.
          ui.phase = "OCCUPATION";
          setupStep.name = "OCCUPATION";
          renderLegend("OCCUPATION");
          renderHud(null);
          renderScreen(
            [
              "",
              colorize.bright("  CLASS  LOCKED"),
              "",
              `  ${colorize.meta("The " + o.label + " class is not yet unlocked.")}`,
              "",
              `  ${colorize.meta("Complete a trail to Oregon to unlock it.")}`,
              "",
              colorize.meta("  Press ENTER to go back."),
            ].join("\n")
          );
          return;
        }
        game.occupation = o.label.toUpperCase();
        game.occupationKey = occKey;
        game.cash = o.cash;
        setupStep.name = "LEADER_NAME";
        saveGame();
        return runSetup();
      }
    }
    if (key === "Escape") {
      setupStep.name = "DIFFICULTY";
      return runSetup();
    }
  }

  // -------- NAME INPUT --------
  function promptName({ index }) {
    ui.phase = "NAME_INPUT";
    setupStep.name = index === 0 ? "LEADER_NAME" : `PARTY_NAME_${index - 1}`;
    renderLegend("NAME_INPUT");
    renderHud(null);

    input.active = true;
    input.nameIndex = index;
    if (index === 0) {
      input.prompt = "What is the first name of the wagon leader?";
      input.default = game.leaderName || DEFAULT_LEADER;
    } else {
      const slot = index;
      input.prompt = `What is the first name of party member #${slot}?`;
      input.default = game.partyNames[index - 1] || suggestPartyDefault(index);
    }
    input.current = "";
    input.maxLen = 12;
    input.onConfirm = (name) => {
      input.active = false;
      if (index === 0) {
        game.leaderName = name;
        setupStep.name = "PARTY_NAME_0";
      } else {
        game.partyNames[index - 1] = name;
        const next = index + 1;
        setupStep.name = next <= 4 ? `PARTY_NAME_${next - 1}` : "MONTH";
      }
      saveGame();
      runSetup();
    };
    input.onBack = () => {
      input.active = false;
      if (index === 0) {
        setupStep.name = "OCCUPATION";
      } else {
        const prev = index - 1;
        setupStep.name = prev === 0 ? "LEADER_NAME" : `PARTY_NAME_${prev - 1}`;
      }
      runSetup();
    };

    renderNameInputScreen();
    saveGame();
  }

  function renderNameInputScreen() {
    const value = input.current || "";
    const shown = value + colorize.bright("_");
    const acceptDefault = value.length === 0
      ? colorize.meta(`  (press ENTER for default: ${input.default})`)
      : "";
    const preview = value.length > 0 ? value : input.default;

    const partyLine =
      input.nameIndex === 0
        ? colorize.meta(`  Party so far: ${colorize.bright("you")} + 4 to name`)
        : colorize.meta(`  Party so far: ${colorize.bright(game.leaderName)} + ${game.partyNames.slice(0, input.nameIndex - 1).map((n) => colorize.bright(n)).join(", ") || colorize.meta("(none)")}`);

    renderScreen(
      [
        "",
        `  ${input.prompt}`,
        "",
        `  > ${shown}`,
        "",
        acceptDefault,
        "",
        partyLine,
        "",
        colorize.meta(`  Name shown: ${colorize.bright(preview)}`),
        "",
        colorize.meta("  Letters only, 1-12 characters. ENTER to confirm."),
      ].join("\n")
    );
  }

  function handleNameInput(key) {
    if (key === "Enter") {
      const name = (input.current || input.default).trim();
      if (!isValidName(name)) {
        // Re-prompt with same screen and a brief flash
        renderScreen(
          renderScreen.toString() // no-op; just keep current screen
            ? ""
            : ""
        );
        renderNameInputScreen();
        return;
      }
      input.onConfirm(name);
      return;
    }
    if (key === "Escape") {
      input.onBack();
      return;
    }
    if (key === "Backspace") {
      input.current = input.current.slice(0, -1);
      renderNameInputScreen();
      return;
    }
    // Single character of input
    if (key.length === 1) {
      if (input.current.length >= input.maxLen) return;
      if (!isValidNameChar(key)) return;
      input.current += key;
      renderNameInputScreen();
      return;
    }
  }

  function isValidNameChar(ch) {
    // Letters only, per the original
    return /^[A-Za-z]$/.test(ch);
  }
  function isValidName(name) {
    if (!name) return false;
    if (name.length > 12) return false;
    if (!/^[A-Za-z]+$/.test(name)) return false;
    return true;
  }

  // -------- MONTH --------
  function renderMonth() {
    ui.phase = "MONTH";
    setupStep.name = "MONTH";
    renderLegend("MONTH");
    renderHud(null);
    const partyFull = [
      game.leaderName,
      ...game.partyNames,
    ].filter(Boolean).map((n) => colorize.bright(n)).join(", ");

    const rows = Object.values(MONTHS).map(
      (m) => `  ${colorize.bright(m.key)}  ${m.label.padEnd(7)}  ${colorize.meta(m.blurb)}`
    );

    renderScreen(
      [
        "",
        colorize.bright("  IT  IS  1848."),
        "",
        colorize.meta("  The weather is warm. Your supplies are fresh."),
        "",
        "  Choose your departure month:",
        "",
        ...rows,
        "",
        colorize.meta(`  Party of 5: ${partyFull}`),
        colorize.meta(`  Occupation: ${colorize.wagon(game.occupation)}   Difficulty: ${colorize.money(game.difficulty)}`),
        "",
        colorize.bright("1-4"),
        " to choose the month of departure _",
      ].join("\n")
    );
    saveGame();
  }

  function handleMonth(key) {
    const k = key.toLowerCase();
    for (const m of Object.values(MONTHS)) {
      if (m.key === k) {
        game.month = m.label.toUpperCase();
        for (const key2 of Object.keys(MONTHS)) {
          if (MONTHS[key2] === m) { game.monthKey = key2; break; }
        }
        setupStep.name = "STORE_INTRO";
        saveGame();
        return runSetup();
      }
    }
    if (key === "Escape") {
      setupStep.name = "PARTY_NAME_3";
      return runSetup();
    }
  }

  // -------- STORE INTRO (transitions to Phase 3) --------
  function renderStoreIntro() {
    ui.phase = "STORE_INTRO";
    renderLegend("STORE_INTRO");
    renderHud(null);

    const cash = `${colorize.money("$" + game.cash)}`;
    const party = [
      game.leaderName,
      ...game.partyNames,
    ].filter(Boolean).map((n) => colorize.bright(n)).join(", ");

    // Hometown by occupation
    const HOMETOWN = {
      BANKER: "Boston",
      CARPENTER: "Ohio",
      FARMER: "Illinois",
    };
    const hometown = HOMETOWN[game.occupationKey] || "the East";
    const occLower = (game.occupation || "").toLowerCase();

    renderScreen(
      [
        "",
        colorize.bright("  INDEPENDENCE,  MISSOURI"),
        colorize.meta("  Spring 1848"),
        "",
        `  You are a ${colorize.wagon(occLower)} from ${colorize.meta(hometown)}`,
        colorize.meta("  with a wife and four children."),
        "",
        `  Your party: ${party}`,
        "",
        `  You have ${cash} in cash.`,
        "",
        colorize.meta("  Before you leave Independence, you will need to buy"),
        colorize.meta("  supplies from the GENERAL STORE: oxen, food, clothing,"),
        colorize.meta("  ammunition, and spare wagon parts."),
        "",
        colorize.meta("  Press ENTER to enter the store. _"),
      ].join("\n")
    );
    saveGame();
  }

  function handleStoreIntro(key) {
    if (key === "Enter") {
      setupStep.name = "STORE_MAIN";
      renderStoreMain();
      return;
    }
    if (key === "Escape") {
      enterTitle();
    }
  }

  // =====================================================================
  // STORE FLOW
  // =====================================================================

  function goodsLine() {
    return [
      `  You already have: ${colorize.wagon(game.oxen + " yoke" + (game.oxen === 1 ? "" : "s") + " of oxen")}, ` +
        `${colorize.fruit(game.food + " lb of food")}, ${colorize.danger(game.ammo + " bullet" + (game.ammo === 1 ? "" : "s"))}, ` +
        `${colorize.cold(game.clothing + " set" + (game.clothing === 1 ? "" : "s") + " of clothing")}, ` +
        `${colorize.wagon(game.parts + " spare part" + (game.parts === 1 ? "" : "s"))}.`,
    ].join("\n");
  }

  function formatMoney(n) {
    if (n === undefined || n === null || isNaN(n)) return "$?";
    return "$" + Math.round(n);
  }

  function storeHeading() {
    return colorize.bright("  INDEPENDENCE  GENERAL  STORE");
  }

  // -------- STORE_MAIN (catalog) --------
  function renderStoreMain() {
    ui.phase = "STORE_MAIN";
    setupStep.name = "STORE_MAIN";
    renderLegend("STORE_MAIN");
    renderHud(null);

    const rows = STORE_CATALOG.map((p) => {
      const cost = p.unitCost < 1 ? `$${p.unitCost.toFixed(2)}` : `$${p.unitCost}`;
      const y = p.key === "OXEN" || p.key === "CLOTHING" || p.key === "PARTS" ? Math.floor(p.unitCost) : p.unitCost;
      const display = p.unitCost < 1 ? p.unitCost.toFixed(2) : String(p.unitCost);
      return `  ${colorize.bright(p.num)}  ${p.label.padEnd(12)} ${colorize.money("$" + display)} / ${p.unit}`;
    });

    const cash = `${colorize.money(formatMoney(game.cash))}`;

    renderScreen(
      [
        "",
        storeHeading(),
        "",
        colorize.meta("  You may buy:"),
        "",
        ...rows,
        `  ${colorize.bright("6")}  Leave store`,
        "",
        `  You have ${cash} to spend.`,
        "",
        goodsLine(),
        "",
        colorize.meta("  What would you like to buy? _"),
      ].join("\n")
    );
    saveGame();
  }

  function handleStoreMain(key) {
    const num = key;
    if (num === "6") {
      setupStep.name = "RATION";
      renderRation();
      return;
    }
    if (num === "Escape") {
      setupStep.name = "MONTH";
      renderMonth();
      return;
    }
    // Find the product by num
    const product = STORE_CATALOG.find((p) => p.num === num);
    if (!product) return;
    setupStep.name = "STORE_QUANTITY";
    renderStoreQuantity(product);
  }

  // -------- STORE_QUANTITY (number input) --------
  function renderStoreQuantity(product) {
    ui.phase = "STORE_QUANTITY";
    renderLegend("STORE_QUANTITY");
    renderHud(null);

    // Determine max affordable
    const maxAffordable = Math.floor(game.cash / product.unitCost);
    const have = game[product.key.toLowerCase()] || 0;

    storeInput.active = true;
    storeInput.product = product;
    storeInput.current = "";
    storeInput.max = Math.min(9999, maxAffordable);

    const cost = product.unitCost < 1 ? `$${product.unitCost.toFixed(2)}` : `$${product.unitCost}`;
    const maxLine = product.unitCost > 0
      ? colorize.meta(`  Maximum you can afford: ${storeInput.max}`)
      : "";

    renderScreen(
      [
        "",
        `${colorize.bright("  " + product.label.toUpperCase())}`,
        "",
        `  You have ${colorize.money(formatMoney(game.cash))} in cash.`,
        `  ${product.label} cost ${colorize.money(cost)} per ${product.unit}.`,
        "",
        colorize.meta(`  You currently have ${have} ${product.unit}${have === 1 ? "" : "s"}.`),
        "",
        maxLine,
        "",
        colorize.meta("  How many do you want to buy?"),
        colorize.meta("  Enter a number (0 to skip). _"),
      ].join("\n")
    );
  }

  function handleStoreQuantity(key) {
    if (key === "Escape") {
      storeInput.active = false;
      setupStep.name = "STORE_MAIN";
      renderStoreMain();
      return;
    }
    if (key === "Enter") {
      const n = parseInt(storeInput.current || "0", 10);
      const product = storeInput.product;
      storeInput.active = false;

      if (n === 0) {
        setupStep.name = "STORE_MAIN";
        renderStoreMain();
        return;
      }

      const cost = n * product.unitCost;
      if (cost > game.cash) {
        // Can't afford — show confirmation and back
        setupStep.name = "STORE_CONFIRM";
        ui.phase = "STORE_CONFIRM";
        renderLegend("STORE_CONFIRM");
        renderScreen(
          [
            "",
            colorize.danger("  YOU  CANNOT  AFFORD  THAT."),
            "",
            `  ${n} ${product.unit}${n === 1 ? "" : "s"} would cost ${colorize.money("$" + cost.toFixed(2))},`,
            `  but you only have ${colorize.money(formatMoney(game.cash))}.`,
            "",
            colorize.meta("  Press ENTER to go back to the store."),
          ].join("\n")
        );
        return;
      }

      // Apply purchase
      game.cash -= cost;
      if (product.key === "AMMO") {
        game.ammo += n * 20; // each box = 20 bullets
      } else {
        const slot = product.key.toLowerCase();
        game[slot] = (game[slot] || 0) + n;
      }
      saveGame();
      setupStep.name = "STORE_CONFIRM";
      ui.phase = "STORE_CONFIRM";
      renderLegend("STORE_CONFIRM");

      const newCash = formatMoney(game.cash);
      const newHave = product.key === "AMMO" ? game.ammo : (game[product.key.toLowerCase()] || 0);
      const unitDisplay = product.key === "AMMO" ? "bullet" + (newHave === 1 ? "" : "s") : product.unit + (newHave === 1 ? "" : "s");

      renderScreen(
        [
          "",
          colorize.bright(`  PURCHASED  ${n}  ${product.unit.toUpperCase()}${n === 1 ? "" : "S"}  OF  ${product.label.toUpperCase()}.`),
          "",
          `  Spent:  ${colorize.money("$" + cost.toFixed(2))}`,
          `  Cash:   ${colorize.money(newCash)}`,
          `  You now have ${colorize.bright(newHave + " " + unitDisplay)} of ${product.label.toLowerCase()}.`,
          "",
          goodsLine(),
          "",
          colorize.meta("  Press ENTER to keep shopping."),
        ].join("\n")
      );
      return;
    }
    if (key === "Backspace") {
      storeInput.current = storeInput.current.slice(0, -1);
      // Re-render with new input
      const product = storeInput.product;
      renderScreen(
        [
          "",
          `${colorize.bright("  " + product.label.toUpperCase())}`,
          "",
          `  You have ${colorize.money(formatMoney(game.cash))} in cash.`,
          "",
          colorize.meta(`  How many do you want to buy? (0-${storeInput.max})`),
          `  > ${storeInput.current}${colorize.bright("_")}`,
        ].join("\n")
      );
      return;
    }
    if (key.length === 1 && /^[0-9]$/.test(key)) {
      if (storeInput.current.length >= 4) return;
      storeInput.current += key;
      // Re-render
      const product = storeInput.product;
      renderScreen(
        [
          "",
          `${colorize.bright("  " + product.label.toUpperCase())}`,
          "",
          `  You have ${colorize.money(formatMoney(game.cash))} in cash.`,
          "",
          colorize.meta(`  How many do you want to buy? (0-${storeInput.max})`),
          `  > ${storeInput.current}${colorize.bright("_")}`,
        ].join("\n")
      );
      return;
    }
  }

  function handleStoreConfirm(key) {
    if (key === "Enter" || key === "Escape") {
      setupStep.name = "STORE_MAIN";
      renderStoreMain();
    }
  }

  // -------- RATION --------
  function renderRation() {
    ui.phase = "RATION";
    setupStep.name = "RATION";
    renderLegend("RATION");
    renderHud(null);

    const rows = Object.values(RATIONS).map(
      (r) => `  ${colorize.bright(r.key)}  ${r.label.padEnd(11)} ${colorize.meta(r.blurb)}`
    );

    const partySize = 1 + game.partyNames.filter(Boolean).length;
    const examples = Object.values(RATIONS).map(
      (r) => `  ${colorize.meta(r.label + ":")} ${r.perDay * partySize} lb / day for the party`
    );

    renderScreen(
      [
        "",
        colorize.bright("  CHOOSE  YOUR  RATIONING"),
        "",
        colorize.meta("  Your party of " + partySize + " will eat:"),
        ...examples,
        "",
        colorize.meta("  How would you like to ration your food?"),
        "",
        ...rows,
        "",
        colorize.meta(`  Current ration: ${colorize.fruit(game.rations)}`),
        "",
        colorize.bright("1-3") + " to choose _",
      ].join("\n")
    );
    saveGame();
  }

  function handleRation(key) {
    const k = key;
    for (const r of Object.values(RATIONS)) {
      if (r.key === k) {
        game.rations = r.label.toUpperCase().replace(" ", "_");
        for (const key2 of Object.keys(RATIONS)) {
          if (RATIONS[key2] === r) { game.rationsKey = key2; break; }
        }
        saveGame();
        setupStep.name = "PACE";
        renderPace();
        return;
      }
    }
    if (key === "Escape") {
      setupStep.name = "STORE_MAIN";
      renderStoreMain();
    }
  }

  // -------- PACE --------
  function renderPace() {
    ui.phase = "PACE";
    setupStep.name = "PACE";
    renderLegend("PACE");
    renderHud(null);

    const rows = Object.values(PACE).map((p) => {
      const wear = p.oxenWear < 1 ? "low" : p.oxenWear < 2 ? "moderate" : "high";
      return `  ${colorize.bright(p.key)}  ${p.label.padEnd(10)} ${p.milesPerDay} mi/day  ·  oxen wear: ${colorize.meta(wear)}`;
    });

    renderScreen(
      [
        "",
        colorize.bright("  CHOOSE  YOUR  PACE"),
        "",
        colorize.meta("  How fast should the wagon travel each day?"),
        "",
        ...rows,
        "",
        colorize.meta("  A grueling pace will kill your oxen."),
        colorize.meta("  A strenuous pace risks illness."),
        "",
        colorize.meta(`  Current pace: ${colorize.wagon(game.pace)}`),
        "",
        colorize.bright("1-3") + " to choose _",
      ].join("\n")
    );
    saveGame();
  }

  function handlePace(key) {
    const k = key;
    for (const p of Object.values(PACE)) {
      if (p.key === k) {
        game.pace = p.label.toUpperCase();
        for (const key2 of Object.keys(PACE)) {
          if (PACE[key2] === p) { game.paceKey = key2; break; }
        }
        saveGame();
        setupStep.name = "TRAVEL_INTRO";
        renderTravelIntro();
        return;
      }
    }
    if (key === "Escape") {
      setupStep.name = "RATION";
      renderRation();
    }
  }

  // -------- TRAVEL INTRO (Phase 4 transition) --------
  function renderTravelIntro() {
    ui.phase = "TRAVEL_INTRO";
    setupStep.name = "TRAVEL_INTRO";
    renderLegend("TRAVEL_INTRO");
    renderHud(null);
    renderScreen(
      [
        "",
        colorize.bright("  THE  WAGON  ROLLS  OUT  OF  INDEPENDENCE"),
        "",
        colorize.meta("  Phase 4 will build the trail loop next."),
        "",
        `  Party: ${[game.leaderName, ...game.partyNames].filter(Boolean).map((n) => colorize.bright(n)).join(", ")}`,
        `  Cash:  ${colorize.money(formatMoney(game.cash))}`,
        `  Food:  ${colorize.fruit(game.food + " lb")}`,
        `  Oxen:  ${colorize.wagon(game.oxen + " yoke" + (game.oxen === 1 ? "" : "s"))}`,
        `  Ammo:  ${colorize.danger(game.ammo + " bullet" + (game.ammo === 1 ? "" : "s"))}`,
        `  Clothing: ${colorize.cold(game.clothing + " set" + (game.clothing === 1 ? "" : "s"))}`,
        `  Parts: ${colorize.wagon(game.parts + " spare")}`,
        `  Ration: ${colorize.fruit(game.rations.replace("_", " "))}`,
        `  Pace:   ${colorize.wagon(game.pace)}`,
        "",
        colorize.meta("  Press ENTER to start the trail. _"),
      ].join("\n")
    );
    saveGame();
  }

  function handleTravelIntro(key) {
    if (key === "Enter") {
      setupStep.name = "TRAVEL_MENU";
      initParty(); // Phase 6 builds party records; harmless to call here
      renderTravelMenu();
      return;
    }
    if (key === "Escape") {
      enterTitle();
    }
  }

  // =====================================================================
  // TRAIL TRAVEL — Phase 4
  // =====================================================================

  /** Initialize the party records array used by Phase 6 (illness tracking).
   *  Also resets per-trail tracking state so the new run starts clean even
   *  if a previous run left the underscore-prefixed fields populated. */
  function initParty() {
    if (game.party && game.party.length) {
      // Party already exists; only reset the per-trail flags.
      game._hadDysenteryDeath = false;
      game._fortsVisited = [];
      game._huntedLb = 0;
      game.causeOfDeath = null;
      game.nextJournalDay = null;
      game._recordedTrailEnd = false;
      game._lastNewlyAwarded = null;
      resetJournalIndex();
      return;
    }
    const names = [game.leaderName, ...game.partyNames].filter(Boolean);
    game.party = names.map((name) => ({
      name,
      alive: true,
      sick: false,
      illness: null,
      daysSick: 0,
    }));
    game._hadDysenteryDeath = false;
    game._fortsVisited = [];
    game._huntedLb = 0;
    game.causeOfDeath = null;
    game.nextJournalDay = null;
    game._recordedTrailEnd = false;
    game._lastNewlyAwarded = null;
    resetJournalIndex();
  }

  function partyAliveCount() {
    if (!game.party || !game.party.length) return 5;
    return game.party.filter((p) => p.alive).length;
  }

  const TOTAL_MILES = 2000;

  function updateHud() {
    const date = currentDate();
    const season = seasonOf(date.month);
    const alive = partyAliveCount();
    const ration = RATIONS[game.rationsKey];
    const diff = DIFFICULTY[game.difficultyKey];
    const rationDesc = ration ? ration.label : game.rations;
    const paceDesc = game.pace;

    const hud = [
      `${date.month.slice(0, 3).toUpperCase()} ${date.day}, ${date.year}`,
      `MI ${game.milesTraveled}/${TOTAL_MILES}`,
      `FOOD ${Math.floor(game.food)} lb`,
      `PACE ${paceDesc}`,
      `RATION ${rationDesc}`,
      season.toUpperCase(),
      `PARTY ${alive}/5`,
    ].join("  ·  ");

    renderHud(hud);
  }

  function renderTravelMenu() {
    ui.phase = "TRAVEL_MENU";
    setupStep.name = "TRAVEL_MENU";
    renderLegend("TRAVEL_MENU");
    updateHud();

    const date = currentDate();
    const alive = partyAliveCount();

    // Hint about next landmark (Phase 5 wires this in fully)
    const nextLandmark = (window.NEXT_LANDMARK ? window.NEXT_LANDMARK() : null);

    renderScreen(
      [
        "",
        colorize.bright("  YOU  ARE  ON  THE  TRAIL"),
        "",
        `  ${colorize.wagon(date.month)} ${date.day}, ${colorize.meta(date.year)}`,
        `  Miles traveled: ${colorize.bright(game.milesTraveled)} of ${TOTAL_MILES}`,
        `  Party alive: ${colorize.bright(alive)} of 5`,
        "",
        nextLandmark ? `  Next landmark: ${colorize.meta(nextLandmark)}` : "",
        "",
        `  ${colorize.bright("1")}  Continue on trail`,
        `  ${colorize.bright("2")}  Check supplies`,
        `  ${colorize.bright("3")}  Change pace (${colorize.wagon(game.pace)})`,
        `  ${colorize.bright("4")}  Change ration (${colorize.fruit(game.rations.replace("_", " ").toLowerCase())})`,
        `  ${colorize.bright("5")}  Hunt`,
        `  ${colorize.bright("6")}  Rest 1 day`,
        "",
        colorize.meta("  What would you like to do? _"),
      ].filter(Boolean).join("\n")
    );
    saveGame();
  }

  function handleTravelMenu(key) {
    switch (key) {
      case "1": return advanceOneDay();
      case "2": return renderCheckSupplies();
      case "3": return renderTravelPace();
      case "4": return renderTravelRation();
      case "5": return renderHuntPrompt();
      case "6": return restOneDay();
    }
  }

  // -------- Landmark + River crossing (Phase 5) --------

  /** Return the next landmark the player just reached, or null. Consumes
   *  all landmarks up to the current miles so debug jumps and long days
   *  don't miss earlier milestones. */
  function checkForLandmark() {
    const start = game.nextLandmarkIndex || 0;
    let idx = start;
    while (idx < LANDMARKS.length && LANDMARKS[idx].miles <= game.milesTraveled) {
      idx++;
    }
    game.nextLandmarkIndex = idx;
    if (idx === start) return null; // nothing new reached
    const justReached = LANDMARKS[idx - 1];
    return justReached;
  }

  /** Hint for the travel menu. */
  function nextLandmarkHint() {
    const idx = game.nextLandmarkIndex || 0;
    const lm = LANDMARKS[idx];
    if (!lm) return null;
    const milesAway = Math.max(0, lm.miles - game.milesTraveled);
    return `${lm.name} in ${milesAway} miles`;
  }
  // Expose for the travel-menu (declared as window.NEXT_LANDMARK in Phase 4)
  window.NEXT_LANDMARK = nextLandmarkHint;

  function renderLandmark(lm, opts = {}) {
    updateHud();
    if (lm.type === "river") return renderRiverIntro(lm);
    if (lm.type === "dalles") return renderTheDalles(lm);
    if (lm.type === "end") return renderEndTrail();
    if (lm.type === "fort") return renderFort(lm);
    // plain landmark
    ui.phase = "LANDMARK";
    setupStep.name = "LANDMARK";
    LEGENDS.LANDMARK = [["ENTER", "CONTINUE"]];
    renderLegend("LANDMARK");
    saveGame();
    const journalLine = opts.journalLine ? colorize.meta(`  ${opts.journalLine}`) : "";
    renderScreen(
      [
        "",
        colorize.bright(`  ${lm.name.toUpperCase()}`),
        "",
        colorize.meta(`  ${lm.blurb}`),
        "",
        journalLine,
        colorize.meta(`  Miles traveled so far: ${game.milesTraveled}`),
        "",
        colorize.meta("  Press ENTER to continue."),
      ].filter(Boolean).join("\n")
    );
  }

  function handleLandmark(key) {
    if (key === "Enter" || key === "Escape") {
      // After a landmark, return to the travel day summary
      renderTravelDay();
    }
  }

  // -------- Fort --------
  function renderFort(lm) {
    ui.phase = "FORT";
    setupStep.name = "FORT";
    // Track which forts the party actually visits (for the All Forts
    // achievement). Reaching the fort screen counts as a visit — entering
    // the store is optional.
    if (lm && lm.key) {
      if (!Array.isArray(game._fortsVisited)) game._fortsVisited = [];
      if (!game._fortsVisited.includes(lm.key)) game._fortsVisited.push(lm.key);
    }
    LEGENDS.FORT = [
      ["ENTER", "CONTINUE"],
      ["V", "VISIT STORE"],
      ["ESC", "SKIP"],
    ];
    renderLegend("FORT");
    updateHud();
    saveGame();
    renderScreen(
      [
        "",
        colorize.bright(`  ${lm.name.toUpperCase()}`),
        "",
        colorize.meta(`  ${lm.blurb}`),
        "",
        colorize.meta("  You may rest here, visit the fort store, or continue"),
        colorize.meta("  on the trail without stopping."),
        "",
        `  ${colorize.bright("ENTER")}  Continue on the trail`,
        `  ${colorize.bright("V")}  Visit the fort store  ${colorize.meta("(Phase 8)")}`,
        "",
        colorize.meta("  Current supplies:"),
        `    ${colorize.wagon(game.oxen + " yoke" + (game.oxen === 1 ? "" : "s") + " of oxen")}, ` +
          `${colorize.fruit(game.food + " lb of food")}, ${colorize.money(formatMoney(game.cash))} cash`,
        "",
        colorize.meta("  Press ENTER to continue, or V to visit the store."),
      ].join("\n")
    );
  }

  function handleFort(key) {
    if (key === "Enter" || key === "Escape") {
      renderTravelDay();
      return;
    }
    if (key.toLowerCase() === "v") {
      openFortStore();
    }
  }

  function openFortStore() {
    // Same catalog as the main store but slightly higher prices.
    if (!game._fortStoreCatalog) {
      game._fortStoreCatalog = STORE_CATALOG.map((p) => ({
        ...p,
        unitCost: Math.round((p.unitCost * 1.25) * 100) / 100,
      }));
      game._fortStoreByKey = Object.fromEntries(game._fortStoreCatalog.map((p) => [p.key, p]));
    }
    storeInput.active = false;
    setupStep.name = "FORT_STORE";
    ui.phase = "FORT_STORE";
    renderFortStoreMain();
  }

  function fortStoreHeading(fortName) {
    return colorize.bright(`  ${fortName.toUpperCase()}  TRADING  POST`);
  }

  function renderFortStoreMain() {
    renderLegend("FORT_STORE");
    renderHud(null);
    const rows = game._fortStoreCatalog.map((p) => {
      const display = p.unitCost < 1 ? p.unitCost.toFixed(2) : String(p.unitCost);
      return `  ${colorize.bright(p.num)}  ${p.label.padEnd(12)} ${colorize.money("$" + display)} / ${p.unit}`;
    });
    const cash = colorize.money(formatMoney(game.cash));
    renderScreen(
      [
        "",
        fortStoreHeading("FORT"),
        "",
        colorize.meta("  Fort prices are higher than Independence."),
        colorize.meta("  You may buy:"),
        "",
        ...rows,
        `  ${colorize.bright("6")}  Leave store`,
        "",
        `  You have ${cash} to spend.`,
        "",
        goodsLine(),
        "",
        colorize.meta("  What would you like to buy? _"),
      ].join("\n")
    );
  }

  function handleFortStore(key) {
    const num = key;
    if (num === "6" || num === "Escape") {
      // back to fort
      ui.phase = "FORT";
      setupStep.name = "FORT";
      const lm = LANDMARKS[game.nextLandmarkIndex - 1] || LANDMARKS[game.nextLandmarkIndex];
      renderFort(lm);
      return;
    }
    const product = game._fortStoreCatalog.find((p) => p.num === num);
    if (!product) return;
    setupStep.name = "FORT_STORE_QUANTITY";
    renderFortStoreQuantity(product);
  }

  function renderFortStoreQuantity(product) {
    ui.phase = "FORT_STORE_QUANTITY";
    renderLegend("STORE_QUANTITY");
    renderHud(null);
    const maxAffordable = Math.floor(game.cash / product.unitCost);
    const have = product.key === "AMMO" ? Math.floor(game.ammo / 20) : (game[product.key.toLowerCase()] || 0);

    storeInput.active = true;
    storeInput.product = product;
    storeInput.current = "";
    storeInput.max = Math.min(9999, maxAffordable);
    storeInput.isFort = true;

    const display = product.unitCost < 1 ? product.unitCost.toFixed(2) : String(product.unitCost);
    const maxLine = colorize.meta(`  Maximum you can afford: ${storeInput.max}`);

    renderScreen(
      [
        "",
        `${colorize.bright("  " + product.label.toUpperCase())}`,
        "",
        `  You have ${colorize.money(formatMoney(game.cash))} in cash.`,
        `  ${product.label} cost ${colorize.money("$" + display)} per ${product.unit}.`,
        "",
        colorize.meta(`  You currently have ${have} ${product.unit}${have === 1 ? "" : "s"}.`),
        "",
        maxLine,
        "",
        colorize.meta("  How many do you want to buy?"),
        colorize.meta("  Enter a number (0 to skip). _"),
      ].join("\n")
    );
  }

  function handleFortStoreQuantity(key) {
    if (key === "Escape") {
      storeInput.active = false;
      storeInput.isFort = false;
      openFortStore();
      return;
    }
    if (key === "Enter") {
      const n = parseInt(storeInput.current || "0", 10);
      const product = storeInput.product;
      storeInput.active = false;
      storeInput.isFort = false;

      if (n === 0) {
        openFortStore();
        return;
      }

      const cost = n * product.unitCost;
      if (cost > game.cash) {
        ui.phase = "FORT_STORE_CONFIRM";
        setupStep.name = "FORT_STORE_CONFIRM";
        renderLegend("STORE_CONFIRM");
        renderScreen(
          [
            "",
            colorize.danger("  YOU  CANNOT  AFFORD  THAT."),
            "",
            `  ${n} ${product.unit}${n === 1 ? "" : "s"} would cost ${colorize.money("$" + cost.toFixed(2))},`,
            `  but you only have ${colorize.money(formatMoney(game.cash))}.`,
            "",
            colorize.meta("  Press ENTER to go back to the store."),
          ].join("\n")
        );
        return;
      }
      game.cash -= cost;
      if (product.key === "AMMO") game.ammo += n * 20;
      else game[product.key.toLowerCase()] = (game[product.key.toLowerCase()] || 0) + n;
      saveGame();
      ui.phase = "FORT_STORE_CONFIRM";
      setupStep.name = "FORT_STORE_CONFIRM";
      renderLegend("STORE_CONFIRM");

      const newCash = formatMoney(game.cash);
      const newHave = product.key === "AMMO" ? game.ammo : (game[product.key.toLowerCase()] || 0);
      const unitDisplay = product.key === "AMMO" ? "bullet" + (newHave === 1 ? "" : "s") : product.unit + (newHave === 1 ? "" : "s");

      renderScreen(
        [
          "",
          colorize.bright(`  PURCHASED  ${n}  ${product.unit.toUpperCase()}${n === 1 ? "" : "S"}  OF  ${product.label.toUpperCase()}.`),
          "",
          `  Spent:  ${colorize.money("$" + cost.toFixed(2))}`,
          `  Cash:   ${colorize.money(newCash)}`,
          `  You now have ${colorize.bright(newHave + " " + unitDisplay)} of ${product.label.toLowerCase()}.`,
          "",
          goodsLine(),
          "",
          colorize.meta("  Press ENTER to keep shopping."),
        ].join("\n")
      );
      return;
    }
    if (key === "Backspace") {
      storeInput.current = storeInput.current.slice(0, -1);
      const product = storeInput.product;
      renderScreen(
        [
          "",
          `${colorize.bright("  " + product.label.toUpperCase())}`,
          "",
          `  You have ${colorize.money(formatMoney(game.cash))} in cash.`,
          "",
          colorize.meta(`  How many do you want to buy? (0-${storeInput.max})`),
          `  > ${storeInput.current}${colorize.bright("_")}`,
        ].join("\n")
      );
      return;
    }
    if (key.length === 1 && /^[0-9]$/.test(key)) {
      if (storeInput.current.length >= 4) return;
      storeInput.current += key;
      const product = storeInput.product;
      renderScreen(
        [
          "",
          `${colorize.bright("  " + product.label.toUpperCase())}`,
          "",
          `  You have ${colorize.money(formatMoney(game.cash))} in cash.`,
          "",
          colorize.meta(`  How many do you want to buy? (0-${storeInput.max})`),
          `  > ${storeInput.current}${colorize.bright("_")}`,
        ].join("\n")
      );
      return;
    }
  }

  function handleFortStoreConfirm(key) {
    if (key === "Enter" || key === "Escape") openFortStore();
  }

  // -------- River crossing --------
  function renderRiverIntro(lm, opts = {}) {
    // Generate the river once on arrival
    const river = {
      ...lm,
      depth: rint(1, 5),     // feet
      width: rint(20, 80),   // yards
      ferryCost: rint(3, 15),
    };
    game._currentRiver = river;
    game._pendingJournal = opts.journalLine || null;
    renderRiverChoice(river);
  }

  function renderRiverChoice(river) {
    ui.phase = "RIVER";
    setupStep.name = "RIVER";
    LEGENDS.RIVER = [
      ["1", "FORD"],
      ["2", "FERRY"],
      ["3", "WAIT"],
      ["4", "CAULK"],
    ];
    renderLegend("RIVER");
    updateHud();
    saveGame();

    const safe = river.depth < 2;
    const warn = river.depth >= 4;
    const journal = game._pendingJournal ? colorize.meta(`  ${game._pendingJournal}`) : "";
    if (journal) game._pendingJournal = null;

    renderScreen(
      [
        "",
        colorize.water(`  ${river.name.toUpperCase()}`),
        "",
        `  The river is ${colorize.water(river.depth + " feet deep")} and ${colorize.water(river.width + " yards wide")}.`,
        "",
        journal,
        safe ? colorize.meta("  The river is shallow. You can probably ford it safely.") : "",
        warn ? colorize.danger("  The river is dangerously high. A ferry is recommended.") : "",
        "",
        colorize.meta("  How will you cross?"),
        "",
        `  ${colorize.bright("1")}  Ford the river  ${colorize.meta("(free, risky at this depth)")}`,
        `  ${colorize.bright("2")}  Take the ferry  ${colorize.meta("($" + river.ferryCost + ", safe)")}`,
        `  ${colorize.bright("3")}  Wait to see if conditions improve`,
        `  ${colorize.bright("4")}  Caulk the wagon and float across  ${colorize.meta("(free, dangerous)")}`,
        "",
        colorize.meta("  _"),
      ].filter(Boolean).join("\n")
    );
  }

  function handleRiver(key) {
    const river = game._currentRiver;
    if (!river) return renderTravelMenu();
    const diff = DIFFICULTY[game.difficultyKey];

    if (key === "1") return resolveFord(river);
    if (key === "2") return resolveFerry(river);
    if (key === "3") return resolveWait(river);
    if (key === "4") return resolveCaulk(river);
  }

  function showRiverOutcome(lines) {
    ui.phase = "RIVER_RESULT";
    setupStep.name = "RIVER_RESULT";
    LEGENDS.RIVER_RESULT = [["ENTER", "CONTINUE"]];
    renderLegend("RIVER_RESULT");
    updateHud();
    renderScreen(
      [
        "",
        ...lines,
        "",
        colorize.meta("  Press ENTER to continue."),
      ].join("\n")
    );
    saveGame();
  }

  function handleRiverResult(key) {
    if (key === "Enter" || key === "Escape") {
      game._currentRiver = null;
      // After crossing, return to day summary
      renderTravelDay();
    }
  }

  function resolveFord(river) {
    const diff = DIFFICULTY[game.difficultyKey];
    const danger = river.depth * diff.riverLoss / 5; // 0..1
    const rollV = roll();
    if (rollV > danger) {
      return showRiverOutcome([
        colorize.fruit("  YOU  FORD  THE  RIVER  SAFELY."),
        "",
        colorize.meta("  Your wagon and oxen make it across without incident."),
      ]);
    }
    // Bad ford
    const losses = [];
    if (game.oxen > 0 && roll() < 0.5) {
      const lost = Math.min(game.oxen, rint(1, 2));
      game.oxen -= lost;
      losses.push(colorize.danger(`  You lose ${lost} oxen in the current.`));
    }
    if (game.parts > 0 && roll() < 0.3) {
      const lost = Math.min(game.parts, 1);
      game.parts -= lost;
      losses.push(colorize.danger(`  You lose ${lost} spare part${lost === 1 ? "" : "s"}.`));
    }
    if (game.food > 0 && roll() < 0.4) {
      const lost = Math.min(game.food, rint(20, 80));
      game.food -= lost;
      losses.push(colorize.danger(`  You lose ${Math.floor(lost)} lb of food.`));
    }
    if (game.clothing > 0 && roll() < 0.2) {
      const lost = Math.min(game.clothing, 1);
      game.clothing -= lost;
      losses.push(colorize.danger(`  You lose ${lost} set${lost === 1 ? "" : "s"} of clothing.`));
    }
    if (!losses.length) {
      losses.push(colorize.meta("  You get across with only a scare."));
    }
    return showRiverOutcome([
      colorize.danger("  YOU  HAVE  DIFFICULTY  FORDING  THE  RIVER."),
      "",
      ...losses,
    ]);
  }

  function resolveFerry(river) {
    if (game.cash < river.ferryCost) {
      return showRiverOutcome([
        colorize.danger("  YOU  CANNOT  AFFORD  THE  FERRY."),
        "",
        colorize.meta("  Try another option."),
      ]);
    }
    game.cash -= river.ferryCost;
    return showRiverOutcome([
      colorize.fruit("  THE  FERRY  TAKES  YOU  ACROSS  SAFELY."),
      "",
      `  You paid ${colorize.money("$" + river.ferryCost)} for the crossing.`,
    ]);
  }

  function resolveWait(river) {
    const days = rint(1, 3);
    game.day += days;
    const change = rint(-2, 1);
    river.depth = Math.max(1, Math.min(6, river.depth + change));
    const wentDown = change < 0;
    return showRiverOutcome([
      colorize.meta(`  YOU  WAIT  ${days}  ${days === 1 ? "DAY" : "DAYS"}.`),
      "",
      wentDown
        ? colorize.fruit(`  The river drops to ${river.depth} feet deep.`)
        : colorize.danger(`  The river rises to ${river.depth} feet deep.`),
      "",
      colorize.meta("  Press ENTER to choose a crossing method."),
    ]);
  }

  function resolveCaulk(river) {
    const diff = DIFFICULTY[game.difficultyKey];
    const danger = river.depth * diff.riverLoss / 4;
    if (roll() > danger) {
      return showRiverOutcome([
        colorize.fruit("  YOU  CAULK  THE  WAGON  AND  FLOAT  ACROSS  SAFELY."),
      ]);
    }
    const losses = [];
    if (game.oxen > 0) {
      const lost = Math.min(game.oxen, rint(1, 3));
      game.oxen -= lost;
      losses.push(colorize.danger(`  ${lost} oxen${lost === 1 ? "" : "s"} drown${lost === 1 ? "s" : ""}.`));
    }
    if (game.parts > 0 && roll() < 0.5) {
      const lost = Math.min(game.parts, rint(1, 2));
      game.parts -= lost;
      losses.push(colorize.danger(`  You lose ${lost} spare part${lost === 1 ? "" : "s"}.`));
    }
    if (game.food > 0) {
      const lost = Math.min(game.food, rint(50, 200));
      game.food -= lost;
      losses.push(colorize.danger(`  You lose ${Math.floor(lost)} lb of food.`));
    }
    if (game.clothing > 0 && roll() < 0.5) {
      const lost = Math.min(game.clothing, rint(1, 3));
      game.clothing -= lost;
      losses.push(colorize.danger(`  You lose ${lost} set${lost === 1 ? "" : "s"} of clothing.`));
    }
    if (!losses.length) {
      losses.push(colorize.meta("  You get across with only a scare."));
    }
    return showRiverOutcome([
      colorize.danger("  THE  WAGON  SINKS  IN  THE  CURRENT."),
      "",
      ...losses,
    ]);
  }

  // -------- The Dalles (Columbia River rapids, no ford) --------
  function renderTheDalles(lm) {
    ui.phase = "DALLES";
    setupStep.name = "DALLES";
    LEGENDS.DALLES = [
      ["1", "FLOAT DOWN"],
      ["2", "BARLOW TOLL ROAD"],
    ];
    renderLegend("DALLES");
    updateHud();
    saveGame();
    renderScreen(
      [
        "",
        colorize.water("  THE  DALLES  OF  THE  COLUMBIA"),
        "",
        colorize.meta("  The overland route ends at the great Columbia River."),
        colorize.meta("  The rapids are impassable by wagon. You must choose:"),
        "",
        `  ${colorize.bright("1")}  Float down the river to Oregon City`,
        colorize.meta("      Risk of drowning and losing supplies."),
        "",
        `  ${colorize.bright("2")}  Take the Barlow Toll Road around Mt. Hood`,
        colorize.meta("      Costs cash but is safer."),
        "",
        colorize.meta("  _"),
      ].join("\n")
    );
  }

  function handleTheDalles(key) {
    if (key === "1") {
      // Float — risky
      if (roll() < 0.25) {
        const lost = Math.min(game.food, rint(50, 200));
        game.food -= lost;
        game.parts = Math.max(0, game.parts - 1);
        showRiverOutcome([
          colorize.danger("  YOUR  WAGON  CAPSIZES  IN  THE  RAPIDS."),
          "",
          colorize.danger(`  You lose ${Math.floor(lost)} lb of food and 1 wagon part.`),
        ]);
      } else {
        showRiverOutcome([
          colorize.fruit("  You reach the lower Columbia safely."),
          "",
        ]);
      }
      return;
    }
    if (key === "2") {
      const toll = 5; // nominal toll
      if (game.cash < toll) {
        showRiverOutcome([
          colorize.danger("  You cannot afford the toll."),
          "",
          colorize.meta("  You will have to float down the river."),
        ]);
        return;
      }
      game.cash -= toll;
      showRiverOutcome([
        colorize.fruit(`  You pay $${toll} and take the Barlow Toll Road.`),
      ]);
      return;
    }
  }

  // -------- advanceOneDay --------
  function advanceOneDay() {
    game.day += 1;
    const pace = PACE[game.paceKey];
    const diff = DIFFICULTY[game.difficultyKey];
    const occFx = OCC_EFFECTS[game.occupationKey] || OCC_EFFECTS.FARMER;

    // Travel miles
    game.milesTraveled += pace.milesPerDay;

    // Consume food (Teachers trim the daily cost by 15%)
    const alive = partyAliveCount();
    const ration = RATIONS[game.rationsKey];
    const perDay = alive * ration.perDay * diff.foodPerRation * occFx.foodMod;
    game.food = Math.max(0, game.food - perDay);

    // Bare-bones ration stresses the body and may cause exhaustion.
    if (game.rationsKey === "BARE_BONES" && roll() < 0.05) {
      applyIllnessToRandomMember("Exhaustion");
    }

    // Tick illness progression for any sick party members.
    const illnessLines = dailyIllnessCheck();

    // Journal fetch — every 3-5 days, append a flavor line keyed by region.
    let journalLine = null;
    if (game.nextJournalDay == null) {
      game.nextJournalDay = game.day + rint(3, 5);
    }
    if (game.day >= game.nextJournalDay) {
      const entry = pickJournalEntry();
      if (entry) {
        journalLine = entry.text.replace(/\{day\}/g, String(game.day));
        game.nextJournalDay = game.day + rint(3, 5);
        audio.keyClick();
      } else {
        // No qualifying entry yet (very early trail); re-arm.
        game.nextJournalDay = game.day + rint(3, 5);
      }
    }

    // Landmark interception (Phase 5)
    const lm = checkForLandmark();
    if (lm) return renderLandmark(lm, { illnessLines, journalLine });

    // Random event (Phase 6)
    const evt = rollDailyEvent();
    if (evt) return renderEvent(evt, { illnessLines, journalLine });

    // Show day summary (with illness progression + journal entry)
    renderTravelDay({ illnessLines, journalLine });
  }

  function restOneDay() {
    game.day += 1;
    // Food still gets consumed at the ration rate during rest.
    const alive = partyAliveCount();
    const ration = RATIONS[game.rationsKey];
    const diff = DIFFICULTY[game.difficultyKey];
    const occFx = OCC_EFFECTS[game.occupationKey] || OCC_EFFECTS.FARMER;
    if (ration && diff) {
      const perDay = alive * ration.perDay * diff.foodPerRation * occFx.foodMod;
      game.food = Math.max(0, game.food - perDay);
    }
    // Tick illness progression so death can still happen on rest days.
    const illnessLines = dailyIllnessCheck();
    saveGame();
    renderTravelDay({ rested: true, illnessLines });
  }

  function renderTravelDay(opts = {}) {
    ui.phase = "TRAVEL_DAY";
    setupStep.name = "TRAVEL_DAY";
    renderLegend("TRAVEL_DAY");
    updateHud();

    const date = currentDate();
    const messages = [];

    if (opts.rested) {
      messages.push(colorize.meta(`  Your party rests for a day.`));
      messages.push(colorize.meta(`  Sick members feel a little better.`));
    } else {
      const pace = PACE[game.paceKey];
      messages.push(colorize.meta(`  You travel ${pace.milesPerDay} miles.`));
    }

    // Trail journal entry — pre-authored flavor keyed by region/mile marker.
    if (opts.journalLine) {
      messages.push(colorize.meta(`  ${opts.journalLine}`));
    }

    // Surface illness progression lines (deaths, recoveries) from the day.
    if (Array.isArray(opts.illnessLines)) {
      for (const line of opts.illnessLines) messages.push(line);
    }

    if (game.food <= 0) {
      messages.push(colorize.danger(`  Your food has run out!`));
    } else if (game.food < 50) {
      messages.push(colorize.danger(`  Food is running low (${Math.floor(game.food)} lb).`));
    }

    if (game.oxen <= 0) {
      messages.push(colorize.danger(`  You are out of oxen. The wagon cannot move.`));
    }

    if (game.party && game.party.length) {
      const sick = game.party.filter((p) => p.alive && p.sick);
      if (sick.length) {
        const names = sick.map((p) => colorize.warm(p.name)).join(", ");
        messages.push(colorize.meta(`  Sick: ${names}`));
      }
      const dead = game.party.filter((p) => !p.alive);
      if (dead.length) {
        const names = dead.map((p) => colorize.danger(p.name)).join(", ");
        messages.push(colorize.danger(`  Lost along the trail: ${names}`));
      }
    }

    renderScreen(
      [
        "",
        colorize.bright(`  ${date.month.toUpperCase()}  ${date.day},  ${date.year}`),
        "",
        ...messages,
        "",
        colorize.meta("  Press ENTER to continue."),
      ].join("\n")
    );
    saveGame();
  }

  function handleTravelDay(key) {
    if (key === "Enter" || key === "Escape") {
      // Check for game-over conditions before returning to menu
      if (game.food <= 0) {
        renderGameOver("You have run out of food.");
        return;
      }
      if (game.oxen <= 0) {
        renderGameOver("Your oxen have all died. The wagon cannot move.");
        return;
      }
      if (partyAliveCount() <= 0) {
        renderGameOver("Your entire party has perished.");
        return;
      }
      if (game.milesTraveled >= TOTAL_MILES) {
        // Phase 8 handles end-of-trail
        setupStep.name = "END_TRAIL";
        renderEndTrail();
        return;
      }
      renderTravelMenu();
    }
  }

  // -------- Check supplies --------
  function renderCheckSupplies() {
    ui.phase = "CHECK_SUPPLIES";
    setupStep.name = "CHECK_SUPPLIES";
    renderLegend("CHECK_SUPPLIES");
    updateHud();

    const date = currentDate();
    const ration = RATIONS[game.rationsKey];
    const alive = partyAliveCount();
    const daysOfFood = ration && alive ? Math.floor(game.food / (alive * ration.perDay)) : 0;

    renderScreen(
      [
        "",
        colorize.bright("  CHECK  SUPPLIES"),
        "",
        `  Date:        ${date.month} ${date.day}, ${date.year}`,
        `  Day number:  ${colorize.bright(game.day)}`,
        `  Miles:       ${colorize.bright(game.milesTraveled)} of ${TOTAL_MILES}`,
        "",
        `  Cash:        ${colorize.money(formatMoney(game.cash))}`,
        `  Food:        ${colorize.fruit(Math.floor(game.food) + " lb")}  (${colorize.meta(daysOfFood + " days remaining")})`,
        `  Oxen:        ${colorize.wagon(game.oxen + " yoke" + (game.oxen === 1 ? "" : "s"))}`,
        `  Ammunition:  ${colorize.danger(game.ammo + " bullet" + (game.ammo === 1 ? "" : "s"))}`,
        `  Clothing:    ${colorize.cold(game.clothing + " set" + (game.clothing === 1 ? "" : "s"))}`,
        `  Spare parts: ${colorize.wagon(game.parts + " part" + (game.parts === 1 ? "" : "s"))}`,
        "",
        `  Pace:   ${colorize.wagon(game.pace)}`,
        `  Ration: ${colorize.fruit(game.rations.replace("_", " ").toLowerCase())}`,
        "",
        colorize.meta("  Press ENTER to return to the trail."),
      ].join("\n")
    );
  }

  function handleCheckSupplies(key) {
    if (key === "Enter" || key === "Escape") {
      renderTravelMenu();
    }
  }

  // -------- Change pace / ration (during travel) --------
  function renderTravelPace() {
    ui.phase = "TRAVEL_PACE";
    setupStep.name = "TRAVEL_PACE";
    renderLegend("TRAVEL_PACE");
    updateHud();

    const rows = Object.values(PACE).map(
      (p) => `  ${colorize.bright(p.key)}  ${p.label.padEnd(10)} ${p.milesPerDay} mi/day`
    );

    renderScreen(
      [
        "",
        colorize.bright("  CHANGE  PACE"),
        "",
        ...rows,
        "",
        colorize.meta(`  Current: ${colorize.wagon(game.pace)}`),
        "",
        colorize.bright("1-3") + " to choose _",
      ].join("\n")
    );
  }

  function handleTravelPace(key) {
    for (const p of Object.values(PACE)) {
      if (p.key === key) {
        game.pace = p.label.toUpperCase();
        for (const key2 of Object.keys(PACE)) {
          if (PACE[key2] === p) { game.paceKey = key2; break; }
        }
        saveGame();
        renderTravelMenu();
        return;
      }
    }
    if (key === "Escape") renderTravelMenu();
  }

  function renderTravelRation() {
    ui.phase = "TRAVEL_RATION";
    setupStep.name = "TRAVEL_RATION";
    renderLegend("TRAVEL_RATION");
    updateHud();

    const rows = Object.values(RATIONS).map(
      (r) => `  ${colorize.bright(r.key)}  ${r.label.padEnd(11)} ${r.blurb}`
    );

    renderScreen(
      [
        "",
        colorize.bright("  CHANGE  RATION"),
        "",
        ...rows,
        "",
        colorize.meta(`  Current: ${colorize.fruit(game.rations.replace("_", " ").toLowerCase())}`),
        "",
        colorize.bright("1-3") + " to choose _",
      ].join("\n")
    );
  }

  function handleTravelRation(key) {
    for (const r of Object.values(RATIONS)) {
      if (r.key === key) {
        game.rations = r.label.toUpperCase().replace(" ", "_");
        for (const key2 of Object.keys(RATIONS)) {
          if (RATIONS[key2] === r) { game.rationsKey = key2; break; }
        }
        saveGame();
        renderTravelMenu();
        return;
      }
    }
    if (key === "Escape") renderTravelMenu();
  }

  // -------- Random event (Phase 6) --------
  function renderEvent(evt, opts = {}) {
    const illnessLines = Array.isArray(opts) ? opts : (opts.illnessLines || []);
    const journalLine = !Array.isArray(opts) ? opts.journalLine : null;
    ui.phase = "EVENT";
    setupStep.name = "EVENT";
    LEGENDS.EVENT = [["ENTER", "CONTINUE"]];
    renderLegend("EVENT");
    updateHud();
    saveGame();

    const eventLines = evt.apply ? evt.apply() : [colorize.meta(`  ${evt.msg || "Something happens."}`)];

    renderScreen(
      [
        "",
        colorize.bright(`  ${(evt.key || "EVENT").replace(/_/g, " ")}`),
        "",
        ...eventLines,
        ...illnessLines,
        journalLine ? colorize.meta(`  ${journalLine}`) : "",
        "",
        colorize.meta("  Press ENTER to continue."),
      ].filter(Boolean).join("\n")
    );
    saveGame();
  }

  function handleEvent(key) {
    if (key === "Enter" || key === "Escape") {
      renderTravelDay();
    }
  }

  // -------- Hunt prompt (Phase 7) --------
  // Hunting uses the hidden hires canvas (280x192) so we get full-pixel art
  // for animals, bullets, and the crosshair. The text stage is hidden while
  // the hunt runs. Press SPACE to fire; animals pass left-to-right and yield
  // food on a hit (chance based on ammo).
  function renderHuntPrompt() {
    ui.phase = "HUNT_PROMPT";
    setupStep.name = "HUNT_PROMPT";
    renderLegend("HUNT_PROMPT");
    updateHud();

    const maxAmmo = Math.min(50, Math.max(10, game.ammo));
    renderScreen(
      [
        "",
        colorize.bright("  HUNT  GAME"),
        "",
        colorize.meta(`  You have ${colorize.danger(game.ammo + " bullet" + (game.ammo === 1 ? "" : "s"))} of ammunition.`),
        "",
        colorize.meta("  You can hunt for up to 10 shots, or until you run out."),
        colorize.meta("  Larger animals give more food but are harder to hit."),
        "",
        colorize.bright("1") + "  Go hunting     " + colorize.meta("ESC") + "  Skip",
      ].join("\n")
    );
  }

  function handleHuntPrompt(key) {
    if (key === "1") return startHunt();
    if (key === "Enter") return startHunt();
    if (key === "Escape") return renderTravelMenu();
  }

  // Hunt state
  const hunt = window._hunt = {
    active: false,
    ticks: 0,
    bullets: 0,
    maxBullets: 10,
    hits: 0,
    fired: 0,
    animals: [],
    bulletsInFlight: [],
    crossX: 140,
    crossDir: 1,
    lastSpawn: 0,
  };

  // Animal types: name, char pattern, food yield, speed, hit chance, score weight
  const ANIMAL_TYPES = [
    { key: "RABBIT",  glyph: "rabbit",  food: rint => rint(5, 15),  speed: 1.4, hitChance: 0.55, w: 12, h: 6 },
    { key: "BIRD",    glyph: "bird",    food: rint => rint(2, 8),   speed: 2.0, hitChance: 0.45, w: 8,  h: 4 },
    { key: "DEER",    glyph: "deer",    food: rint => rint(40, 80), speed: 1.0, hitChance: 0.40, w: 18, h: 10 },
    { key: "BUFFALO", glyph: "buffalo", food: rint => rint(150, 300), speed: 0.6, hitChance: 0.25, w: 28, h: 14 },
  ];

  function startHunt() {
    if (game.ammo <= 0) {
      // No ammo — bail back with a message
      ui.phase = "EVENT";
      setupStep.name = "EVENT";
      LEGENDS.EVENT = [["ENTER", "CONTINUE"]];
      renderLegend("EVENT");
      updateHud();
      renderScreen(
        [
          "",
          colorize.danger("  NO  AMMUNITION"),
          "",
          colorize.meta("  You have no bullets left to hunt with."),
          "",
          colorize.meta("  Press ENTER to return."),
        ].join("\n")
      );
      return;
    }

    hunt.active = true;
    hunt.ticks = 0;
    hunt.bullets = 0;
    hunt.maxBullets = Math.min(10, game.ammo);
    hunt.hits = 0;
    hunt.fired = 0;
    hunt.animals = [];
    hunt.bulletsInFlight = [];
    hunt.crossX = 140;
    hunt.crossDir = 1;
    hunt.lastSpawn = -30; // first spawn happens almost immediately
    ui.phase = "HUNT";
    setupStep.name = "HUNT";
    LEGENDS.HUNT = [
      ["SPACE", "FIRE"],
      ["←", "AIM LEFT"],
      ["→", "AIM RIGHT"],
      ["ESC", "STOP"],
    ];
    renderLegend("HUNT");
    updateHud();
    dom.text.style.display = "none";
    dom.screen.classList.add("hires-active");
    if (huntLoopHandle) clearInterval(huntLoopHandle);
    // Use setInterval at ~30fps so the hunt loop runs even in background tabs
    // where requestAnimationFrame can be paused.
    huntLoopHandle = setInterval(huntLoop, 33);
  }

  function endHunt() {
    hunt.active = false;
    if (huntLoopHandle) clearInterval(huntLoopHandle);
    huntLoopHandle = null;
    // Each hit rolls a food amount; difficulty scales hit chances.
    const diff = DIFFICULTY[game.difficultyKey] || DIFFICULTY.FAITHFUL;
    let totalFood = 0;
    for (const a of hunt.animals) {
      if (a.dead) totalFood += a.food;
    }
    // Reduce ammo per shot fired
    game.ammo = Math.max(0, game.ammo - hunt.fired);
    game.food = Math.max(0, game.food + totalFood);
    // Track cumulative pounds hunted this run (for the Hunt Pro achievement).
    game._huntedLb = (game._huntedLb || 0) + totalFood;

    const accuracy = hunt.fired ? Math.round((hunt.hits / hunt.fired) * 100) : 0;
    dom.screen.classList.remove("hires-active");
    dom.text.style.display = "block";

    ui.phase = "HUNT_RESULT";
    setupStep.name = "HUNT_RESULT";
    LEGENDS.HUNT_RESULT = [["ENTER", "CONTINUE"]];
    renderLegend("HUNT_RESULT");
    updateHud();
    saveGame();

    renderScreen(
      [
        "",
        colorize.bright("  HUNTING  RESULTS"),
        "",
        `  Shots fired: ${colorize.danger(hunt.fired + " bullet" + (hunt.fired === 1 ? "" : "s"))}`,
        `  Hits:        ${colorize.fruit(hunt.hits + " animal" + (hunt.hits === 1 ? "" : "s"))}  (${accuracy}%)`,
        `  Food gained: ${colorize.fruit(Math.floor(totalFood) + " lb")}`,
        "",
        colorize.meta(`  You have ${game.ammo} bullet${game.ammo === 1 ? "" : "s"} and ${Math.floor(game.food)} lb of food.`),
        "",
        colorize.meta("  Press ENTER to return."),
      ].join("\n")
    );
  }

  let huntLoopHandle = null;

  function huntLoop() {
    if (!hunt.active) return;
    hunt.ticks += 1;
    const ctx = dom.hiresCanvas.getContext("2d");
    const W = dom.hiresCanvas.width;
    const H = dom.hiresCanvas.height;

    // Spawn new animals periodically (every ~30 frames)
    if (hunt.ticks - hunt.lastSpawn > rint(20, 40) && hunt.animals.length < 6) {
      const types = ["RABBIT", "RABBIT", "BIRD", "DEER", "BUFFALO"];
      const typeKey = types[Math.floor(roll() * types.length)];
      const type = ANIMAL_TYPES.find(t => t.key === typeKey);
      hunt.animals.push({
        ...type,
        x: -type.w,
        y: H - 24 - type.h,
        dead: false,
        fallY: 0,
        food: type.food(rint),
      });
      hunt.lastSpawn = hunt.ticks;
    }

    // Move crosshair back and forth
    hunt.crossX += hunt.crossDir * 2;
    if (hunt.crossX < 30) { hunt.crossX = 30; hunt.crossDir = 1; }
    if (hunt.crossX > W - 30) { hunt.crossX = W - 30; hunt.crossDir = -1; }

    // Move animals
    for (const a of hunt.animals) {
      if (a.dead) {
        a.fallY = Math.min(8, a.fallY + 0.6);
        continue;
      }
      a.x += a.speed;
    }
    // Remove off-screen animals (after fade out)
    hunt.animals = hunt.animals.filter(a => a.x < W + 40 && (!a.dead || a.fallY < 8));

    // Move bullets
    for (const b of hunt.bulletsInFlight) {
      b.x += b.vx;
      b.y += b.vy;
    }
    hunt.bulletsInFlight = hunt.bulletsInFlight.filter(b => b.x > 0 && b.x < W && b.y > 0);

    // Detect hits: bullet vs animal
    for (const b of hunt.bulletsInFlight) {
      let closest = null;
      let closestDx = Infinity;
      for (const a of hunt.animals) {
        if (a.dead) continue;
        // Generous hitbox so a shot near the crosshair lands a hit on any
        // animal whose body passes by. Slack on y so the bullet catches the
        // animal even if it crosses the body slightly above or below.
        const yHit = b.y >= a.y - 4 && b.y <= a.y + a.h + 4;
        const xHit = b.x >= a.x - 6 && b.x <= a.x + a.w + 6;
        if (yHit && xHit) {
          const dx = Math.abs((a.x + a.w / 2) - b.x);
          if (dx < closestDx) { closestDx = dx; closest = a; }
        }
      }
      if (closest) {
        const diff = DIFFICULTY[game.difficultyKey] || DIFFICULTY.FAITHFUL;
        const hitChance = closest.hitChance * (1 / diff.disasterRate);
        if (roll() < hitChance) {
          closest.dead = true;
          closest.fallY = 0;
          hunt.hits += 1;
        }
        b.dead = true;
      }
    }
    hunt.bulletsInFlight = hunt.bulletsInFlight.filter(b => !b.dead);

    // ---------- Render ----------
    // Sky
    ctx.fillStyle = "#0a1a0a";
    ctx.fillRect(0, 0, W, H);
    // Sun
    ctx.fillStyle = "#5fa05f";
    ctx.fillRect(W - 40, 8, 8, 4);
    ctx.fillRect(W - 38, 6, 4, 8);
    // Distant hills
    ctx.fillStyle = "#1a3a1a";
    for (let i = 0; i < 6; i++) {
      const x = i * 50;
      ctx.fillRect(x, H - 60, 50, 8);
      ctx.fillRect(x + 12, H - 70, 26, 8);
    }
    // Ground
    ctx.fillStyle = "#5a3a1a";
    ctx.fillRect(0, H - 24, W, 24);
    // Grass tufts
    ctx.fillStyle = "#3a5a1a";
    for (let i = 0; i < 30; i++) {
      const x = (i * 13 + (hunt.ticks % 3)) % W;
      const y = H - 24;
      ctx.fillRect(x, y, 1, 2);
    }
    // Wagons (party) at far right — bottom corner
    ctx.fillStyle = "#7a5a3a";
    ctx.fillRect(8, H - 36, 14, 10);
    ctx.fillRect(10, H - 40, 10, 4);
    ctx.fillStyle = "#5a3a1a";
    ctx.fillRect(8, H - 26, 14, 2);

    // Animals
    for (const a of hunt.animals) {
      const ay = a.y + a.fallY;
      drawAnimal(ctx, a.key, a.x, ay, a.dead);
    }

    // Bullets
    for (const b of hunt.bulletsInFlight) {
      ctx.fillStyle = "#ffd060";
      ctx.fillRect(b.x - 1, b.y - 1, 2, 2);
    }

    // Crosshair
    ctx.strokeStyle = "#ff5a5a";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(hunt.crossX - 6, H - 24);
    ctx.lineTo(hunt.crossX + 6, H - 24);
    ctx.moveTo(hunt.crossX, H - 30);
    ctx.lineTo(hunt.crossX, H - 18);
    ctx.stroke();

    // HUD overlay (top): shots remaining
    const rem = hunt.maxBullets - hunt.bullets;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, 14);
    ctx.fillStyle = "#ff6";
    ctx.font = "10px monospace";
    ctx.fillText(`SHOTS: ${rem}`, 4, 9);
    ctx.fillStyle = "#aaf";
    ctx.fillText(`HITS: ${hunt.hits}`, 80, 9);
    ctx.fillStyle = "#fff";
    ctx.fillText("SPACE FIRE  ARROWS AIM", 130, 9);

    // Time limit: stop after some time OR ammo
    if (hunt.bullets >= hunt.maxBullets || (hunt.ticks > 600 && hunt.animals.every(a => a.dead || a.x > W - 10))) {
      endHunt();
      return;
    }
  }

  // Render one animal as a tiny pixel sprite (8x6 to 28x14 pixels).
  function drawAnimal(ctx, key, x, y, dead) {
    ctx.fillStyle = dead ? "#3a2a1a" : "#d0a060";
    if (key === "RABBIT") {
      // body
      ctx.fillRect(x + 2, y + 3, 8, 3);
      // ear
      ctx.fillRect(x + 4, y + 1, 1, 2);
      ctx.fillRect(x + 7, y + 1, 1, 2);
      // eye
      if (!dead) { ctx.fillStyle = "#000"; ctx.fillRect(x + 4, y + 3, 1, 1); }
      // tail
      ctx.fillStyle = dead ? "#3a2a1a" : "#f0d090";
      ctx.fillRect(x + 10, y + 3, 2, 2);
    } else if (key === "BIRD") {
      ctx.fillRect(x + 1, y + 1, 4, 2);
      ctx.fillRect(x + 5, y + 2, 2, 1);
      ctx.fillRect(x + 2, y, 1, 1); // wing tip
      ctx.fillRect(x + 4, y, 1, 1);
      if (!dead) { ctx.fillStyle = "#000"; ctx.fillRect(x + 4, y + 2, 1, 1); }
    } else if (key === "DEER") {
      // body
      ctx.fillRect(x + 4, y + 5, 12, 4);
      // legs
      ctx.fillRect(x + 5, y + 9, 1, 4);
      ctx.fillRect(x + 9, y + 9, 1, 4);
      ctx.fillRect(x + 13, y + 9, 1, 4);
      // head
      ctx.fillRect(x + 14, y + 4, 3, 3);
      // antlers
      ctx.fillRect(x + 15, y + 2, 1, 2);
      ctx.fillRect(x + 17, y + 2, 1, 2);
    } else if (key === "BUFFALO") {
      // body
      ctx.fillRect(x + 6, y + 6, 18, 6);
      // hump
      ctx.fillRect(x + 9, y + 4, 6, 2);
      // head
      ctx.fillRect(x + 22, y + 7, 4, 4);
      // horns
      ctx.fillRect(x + 22, y + 6, 1, 1);
      ctx.fillRect(x + 25, y + 6, 1, 1);
      // legs
      ctx.fillRect(x + 8, y + 12, 2, 4);
      ctx.fillRect(x + 14, y + 12, 2, 4);
      ctx.fillRect(x + 20, y + 12, 2, 4);
    }
  }

  function handleHunt(key) {
    if (!hunt.active) return;
    if (key === "Escape") {
      endHunt();
      return;
    }
    if (key === "ArrowLeft") {
      hunt.crossDir = -1;
      hunt.crossX = Math.max(30, hunt.crossX - 14);
      return;
    }
    if (key === "ArrowRight") {
      hunt.crossDir = 1;
      hunt.crossX = Math.min(dom.hiresCanvas.width - 30, hunt.crossX + 14);
      return;
    }
    if (key === " " || key === "Spacebar" || key === "Space") {
      if (hunt.bullets >= hunt.maxBullets) return;
      hunt.bullets += 1;
      hunt.fired += 1;
      // Bullet flies straight up from the crosshair. The hit zone is wide
      // enough (24px slack) that any animal passing near the crosshair will
      // be checked on multiple frames as the bullet rises through its y row.
      hunt.bulletsInFlight.push({
        x: hunt.crossX,
        y: dom.hiresCanvas.height - 24,
        vx: 0,
        vy: -3,
      });
      // Reverse crosshair direction briefly after firing
      hunt.crossDir *= -1;
      return;
    }
  }

  function handleHuntResult(key) {
    if (key === "Enter" || key === "Escape") renderTravelMenu();
  }

  LEGENDS.HUNT = [
    ["SPACE", "FIRE"],
    ["←", "AIM L"],
    ["→", "AIM R"],
    ["ESC", "STOP"],
  ];
  LEGENDS.HUNT_RESULT = [["ENTER", "CONTINUE"]];

  // -------- Game over (Phase 8) --------
  function renderGameOver(reason) {
    ui.phase = "GAME_OVER";
    setupStep.name = "GAME_OVER";
    renderLegend("GAME_OVER");
    updateHud();

    // Cause of death — pick the most prominent reason the trail ended.
    let cause = reason;
    if (!cause) {
      if (game.food <= 0) cause = "You have run out of food.";
      else if (game.oxen <= 0) cause = "Your oxen have all died. The wagon cannot move.";
      else if (partyAliveCount() <= 0) cause = "Your entire party has perished.";
      else cause = "The trail has ended.";
    }

    // Record the run before rendering (first call only — guarded against
    // double-recording on reload). The tombstone uses a short cause
    // string ("starvation", "cholera", "dysentery", etc.) so we map the
    // long cause to a short label here.
    if (!game._recordedTrailEnd) {
      const shortCause = shortCauseOfDeath(cause, game.causeOfDeath);
      recordTrailEnd("DIED", shortCause);
      game._recordedTrailEnd = true;
    }

    const date = currentDate();
    renderScreen(
      [
        "",
        colorize.danger("  THE  END  OF  THE  TRAIL"),
        "",
        `  ${cause}`,
        "",
        `  You made it ${colorize.bright(game.milesTraveled)} of ${TOTAL_MILES} miles.`,
        `  Date: ${colorize.meta(date.month)} ${date.day}, ${date.year}`,
        `  Days on trail: ${colorize.bright(game.day)}`,
        `  Cash remaining: ${colorize.money(formatMoney(game.cash))}`,
        `  Party alive: ${colorize.bright(partyAliveCount())} of 5`,
        "",
        colorize.meta("  Many have died on the Oregon Trail."),
        "",
        colorize.meta("  Press ENTER to return to the title."),
      ].join("\n")
    );
    saveGame();
  }

  // Map a verbose game-over reason into a short tombstone cause.
  function shortCauseOfDeath(cause, lastIllness) {
    if (lastIllness) return String(lastIllness).toLowerCase();
    if (!cause) return "the trail";
    if (cause.includes("food")) return "starvation";
    if (cause.includes("oxen")) return "lost their oxen";
    if (cause.includes("perished")) return "exposure";
    return "the trail";
  }

  function handleGameOver(key) {
    if (key === "Enter" || key === "Escape") {
      clearSave();
      enterTitle();
    }
  }

  LEGENDS.GAME_OVER = [["ENTER", "TITLE"]];

  // -------- End of trail (Phase 8) --------
  /** Compute the final score for the trail run, plus a flavor rank/title.
   *  The score formula is the spec'd one:
   *    days_to_complete × party_alive × (dollars_remaining / 100, integer)
   *  The rank/title are decorative and use the same score for flavor. */
  function computeScore() {
    const alive = partyAliveCount();
    const days = game.day;
    const cash = Math.floor(game.cash);
    const totalFood = Math.floor(game.food);
    const ammo = game.ammo;
    const oxen = game.oxen;
    const parts = game.parts;

    // Spec formula — sensible rounding via Math.floor on the final product.
    const cashHundreds = Math.floor(cash / 100);
    const score = Math.max(0, Math.floor(days * alive * cashHundreds));

    let rank, title;
    if (score >= 5000) { rank = "TRAILBLAZER"; title = "Master of the Oregon Trail"; }
    else if (score >= 2500) { rank = "PIONEER"; title = "An excellent pioneer"; }
    else if (score >= 1000)  { rank = "SETTLER"; title = "A steady settler"; }
    else if (score >= 400)  { rank = "FARMER"; title = "A humble farmer"; }
    else if (score >= 100)  { rank = "GREENHORN"; title = "Just getting by"; }
    else                    { rank = "WAGONEER"; title = "Lucky to be alive"; }

    return { score, rank, title, alive, days, cash, totalFood, ammo, oxen, parts };
  }

  function renderEndTrail() {
    ui.phase = "END_TRAIL";
    setupStep.name = "END_TRAIL";
    // Record the finished run (history + stats + unlocks + achievements) the
    // first time the win screen renders. A guard prevents double-recording
    // when the player reloads while sitting on the end-trail screen.
    let newlyAwarded = null;
    if (!game._recordedTrailEnd) {
      newlyAwarded = recordTrailEnd("REACHED OREGON");
      game._recordedTrailEnd = true;
    } else {
      // Reuse the list captured during the original record call so the
      // banner doesn't grow on every reload.
      newlyAwarded = game._lastNewlyAwarded || {};
    }
    LEGENDS.END_TRAIL = [
      ["ENTER", "TITLE"],
      ["S", "SHARE"],
    ];
    renderLegend("END_TRAIL");
    const s = computeScore();
    const newAchList = newlyAwarded
      ? ACHIEVEMENTS.filter((a) => newlyAwarded[a.key]).map((a) => a.label)
      : [];
    const newAchLine = newAchList.length
      ? colorize.bright(`  NEW  ACHIEVEMENT${newAchList.length > 1 ? "S" : ""}:  ${newAchList.join(", ")}`)
      : "";
    renderScreen(
      [
        "",
        colorize.bright("  YOU  HAVE  REACHED  OREGON  CITY!"),
        "",
        colorize.meta("  After " + s.days + " days on the trail, your party arrives"),
        colorize.meta("  in the Willamette Valley."),
        "",
        `  Party survived:    ${colorize.fruit(s.alive + " of 5")}`,
        `  Days taken:        ${colorize.bright(s.days)}`,
        `  Cash remaining:    ${colorize.money("$" + s.cash)}`,
        `  Food on hand:      ${colorize.fruit(s.totalFood + " lb")}`,
        `  Ammunition:        ${colorize.danger(s.ammo + " bullet" + (s.ammo === 1 ? "" : "s"))}`,
        `  Oxen:              ${colorize.wagon(s.oxen + " yoke" + (s.oxen === 1 ? "" : "s"))}`,
        `  Spare parts:       ${colorize.wagon(s.parts + " part" + (s.parts === 1 ? "" : "s"))}`,
        "",
        `  FINAL  SCORE:  ${colorize.bright(formatNumber(s.score))}`,
        `  Rank:          ${colorize.bright(s.rank)}`,
        newAchLine,
        "",
        colorize.meta(`  ${s.title}.`),
        "",
        colorize.meta("  Press ENTER to return to the title."),
      ].filter(Boolean).join("\n")
    );
    saveGame();
  }

  function handleEndTrail(key) {
    if (key === "Enter" || key === "Escape") {
      clearSave();
      enterTitle();
      return;
    }
    if (key === "s" || key === "S") {
      const s = computeScore();
      const text = buildShareString(s);
      copyToClipboard(text).then((ok) => {
        // Race-guard: if the user has already moved off the END_TRAIL
        // screen (e.g. pressed Enter while the copy was in flight), don't
        // overwrite whatever is currently on screen.
        if (ui.phase !== "END_TRAIL") return;
        const lines = [
          "",
          ok ? colorize.bright("  COPIED  TO  CLIPBOARD") : colorize.danger("  COULD  NOT  COPY  TO  CLIPBOARD"),
          "",
          colorize.meta("  " + text),
          "",
          colorize.meta("  Press ENTER to return to the title."),
        ];
        renderScreen(lines.join("\n"));
      });
    }
  }

  // LEGENDS.END_TRAIL is now set inside renderEndTrail() so the SHARE key
  // can be added on the win screen without polluting the constant.

  // =====================================================================
  // PHASE: TITLE
  // =====================================================================

  async function enterTitle() {
    ui.phase = "TITLE";
    setupStep.name = "TITLE";
    renderLegend("TITLE");
    renderHud(null);
    await loadingFlicker(1500);
    const titleLines = [
      "",
      colorize.bright("       THE  OREGON  TRAIL"),
      "",
      colorize.meta('  "You may have many disasters,'),
      colorize.meta('   but you only need to be lucky once."'),
      "",
    ].join("\n");
    const panels = buildTitlePanels();
    const prompt = "\n  " + colorize.bright("PRESS  ENTER  TO  CONTINUE") + "  _";
    renderScreen(titleLines + "\n" + panels + prompt);
    jitter();
    audio.bootChime();
  }

  function handleTitle(key) {
    const k = key.toLowerCase();
    if (k === "enter") {
      if (hasSave()) {
        setupStep.name = "SAMPLE_OR_MAIN"; // fallback if user picks N
        renderContinuePrompt();
        return;
      }
      setupStep.name = "SAMPLE_OR_MAIN";
      runSetup();
      return;
    }
    if (k === "g") { setPhosphor("green"); return; }
    if (k === "a") { setPhosphor("amber"); return; }
    if (k === "4") { setCols(40); return; }
    if (k === "8") { setCols(80); return; }
    if (k === "h") { setHighContrast(!ui.highContrast); return; }
    if (k === "m") {
      audio.toggleMute();
      dom.muteBtn.textContent = audio.muted ? "SOUND: OFF" : "SOUND: ON";
      return;
    }
    if (k === "r") {
      // Reset confirmation: press R twice within 2s to wipe save
      if (resetArmed) {
        clearSave();
        resetArmed = false;
        jitter();
        renderScreen(
          [
            "",
            colorize.danger("  SAVE  CLEARED."),
            "",
            "  All progress has been forgotten.",
            "",
            "  Press ENTER to return to the title.",
          ].join("\n")
        );
        ui.phase = "TITLE_RESET";
        renderLegend("TITLE_RESET");
        return;
      }
      resetArmed = true;
      setTimeout(() => { resetArmed = false; }, 2000);
      renderScreen(
        [
          "",
          colorize.danger("  Press R once more within 2 seconds"),
          colorize.danger("  to erase your saved game."),
          "",
          "  Press ESC to cancel.",
        ].join("\n")
      );
      ui.phase = "TITLE_RESET";
      renderLegend("TITLE_RESET");
      return;
    }
  }
  let resetArmed = false;

  function handleTitleReset(key) {
    if (key === "Escape") {
      resetArmed = false;
      enterTitle();
    }
  }

  LEGENDS.TITLE_RESET = [["ESC", "CANCEL"]];

  // =====================================================================
  // INPUT ROUTING
  // =====================================================================

  function handleKeyDown(e) {
    audio.keyClick();
    const key = e.key;

    // Text-input screens own the keyboard while a name is being entered.
    if (input.active && ui.phase === "NAME_INPUT") {
      handleNameInput(key);
      e.preventDefault();
      return;
    }

    // Store quantity-entry screens own the keyboard while digits are typed.
    if (storeInput.active && (ui.phase === "STORE_QUANTITY" || ui.phase === "FORT_STORE_QUANTITY")) {
      if (ui.phase === "FORT_STORE_QUANTITY") handleFortStoreQuantity(key);
      else handleStoreQuantity(key);
      e.preventDefault();
      return;
    }

    const handler = uiHandlers[ui.phase];
    if (handler) handler(key);
  }

  const uiHandlers = {
    TITLE: handleTitle,
    TITLE_RESET: handleTitleReset,
    CONTINUE_PROMPT: handleContinuePrompt,
    SAMPLE_OR_MAIN: handleSampleOrMain,
    INSTRUCTIONS: handleInstructions,
    DIFFICULTY: handleDifficulty,
    OCCUPATION: handleOccupation,
    MONTH: handleMonth,
    NAME_INPUT: handleNameInput,
    STORE_INTRO: handleStoreIntro,
    STORE_MAIN: handleStoreMain,
    STORE_QUANTITY: handleStoreQuantity,
    STORE_CONFIRM: handleStoreConfirm,
    RATION: handleRation,
    PACE: handlePace,
    TRAVEL_INTRO: handleTravelIntro,
    TRAVEL_MENU: handleTravelMenu,
    TRAVEL_DAY: handleTravelDay,
    CHECK_SUPPLIES: handleCheckSupplies,
    TRAVEL_PACE: handleTravelPace,
    TRAVEL_RATION: handleTravelRation,
    HUNT_PROMPT: handleHuntPrompt,
    HUNT: handleHunt,
    HUNT_RESULT: handleHuntResult,
    EVENT: handleEvent,
    GAME_OVER: handleGameOver,
    END_TRAIL: handleEndTrail,
    LANDMARK: handleLandmark,
    FORT: handleFort,
    FORT_STORE: handleFortStore,
    FORT_STORE_QUANTITY: handleFortStoreQuantity,
    FORT_STORE_CONFIRM: handleFortStoreConfirm,
    RIVER: handleRiver,
    RIVER_RESULT: handleRiverResult,
    DALLES: handleTheDalles,
  };

  // =====================================================================
  // OPTIONS — phosphor / column mode / high-contrast
  // =====================================================================

  function setPhosphor(name) {
    if (!PHOSPHORS.includes(name)) return;
    ui.phosphor = name;
    dom.body.dataset.phosphor = name;
    if (!booting) saveGame();
  }
  function setCols(n) {
    ui.cols = n;
    dom.screen.dataset.cols = String(n);
    if (!booting) saveGame();
  }
  function setHighContrast(on) {
    ui.highContrast = !!on;
    dom.body.dataset.hc = ui.highContrast ? "1" : "0";
    if (!booting) saveGame();
  }

  // =====================================================================
  // BOOT
  // =====================================================================

  window.addEventListener("keydown", handleKeyDown);

  dom.muteBtn.addEventListener("click", () => {
    audio.toggleMute();
    dom.muteBtn.textContent = audio.muted ? "SOUND: OFF" : "SOUND: ON";
  });

  const unlockAudio = () => {
    audio.ensure();
    window.removeEventListener("keydown", unlockAudio);
    window.removeEventListener("click", unlockAudio);
  };
  window.addEventListener("keydown", unlockAudio);
  window.addEventListener("click", unlockAudio);

  // Apply persisted UI prefs (phosphor / cols / high-contrast) on boot, then start the title.
  try {
    const snap = loadGame();
    if (snap?.ui) {
      setPhosphor(snap.ui.phosphor || "green");
      setCols(snap.ui.cols || 40);
      setHighContrast(!!snap.ui.highContrast);
      ui.muted = !!snap.ui.muted;
      audio.muted = ui.muted;
      dom.muteBtn.textContent = audio.muted ? "SOUND: OFF" : "SOUND: ON";
    }
  } catch {}

  booting = false;
  enterTitle();
})();