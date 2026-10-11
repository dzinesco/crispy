// Tyler's MySpace-style profile. Edit copy and links here.
// Fields marked placeholder are stand-ins, not finished biography.

export const tyler = {
  name: 'Tyler',
  network: 'Tyler is in your extended network',
  // placeholder
  headline: 'The homepage is a place, not a funnel.',
  headlinePlaceholder: true,
  // placeholder
  mood: 'building',
  moodPlaceholder: true,
  location: 'Western Slope, Colorado',
  url: 'https://crispygoat.com',
  email: 'tm@crispygoat.com',
  about:
    'I build retro web apps and a team of AI bots. I run Crispygoat and Black Canyon Tickets, and I work in home care.',
  // placeholder
  meet: 'People who still view source, and anyone who will argue about a Winamp skin.',
  meetPlaceholder: true,
  // placeholder
  interests: 'Browser toys, hit counters, quiet software, and goats.',
  interestsPlaceholder: true,
  // placeholder
  music: 'Chiptune, square waves, and the playlist I never exported from Winamp.',
  musicPlaceholder: true,
  // placeholder
  movies: 'The ones where somebody boots an old computer and it still works.',
  moviesPlaceholder: true,
  // placeholder
  tv: 'Slow documentaries. No recap episodes.',
  tvPlaceholder: true,
  // placeholder
  heroes: 'Whoever kept a guestbook online, and the person who drew the goat.',
  heroesPlaceholder: true,
  // placeholder title for the original profile loop
  song: 'Square & Goat',
  songPlaceholder: true,
};

// Top 8. Four bots, four apps. App hrefs are the demo or the flagship slot.
// Napster has no demo in this repo yet — change href when it does.
export const top8 = [
  {
    kind: 'bot',
    id: 'elon',
    name: 'Elon',
    variant: 'spark',
    blurb: 'Bot. Builds in public.',
  },
  {
    kind: 'app',
    id: 'goatshop',
    name: 'Goatshop',
    href: '/#goatshop',
    blurb: 'Flagship slot on the homepage.',
  },
  {
    kind: 'bot',
    id: 'creative-director',
    name: 'Creative Director',
    variant: 'beret',
    blurb: 'Bot. Holds the taste.',
  },
  {
    kind: 'app',
    id: 'napster',
    name: 'Napster',
    href: '/portfolio',
    placeholder: true,
    blurb: 'Placeholder link. Point href at the Napster demo.',
  },
  {
    kind: 'bot',
    id: 'ledger',
    name: 'Ledger',
    variant: 'glasses',
    blurb: 'Bot. Counts the hits.',
  },
  {
    kind: 'app',
    id: 'windows98',
    name: 'Windows 98 Setup Challenge',
    href: '/demo/windows98/',
    blurb: 'Time to beat: 00:52.',
  },
  {
    kind: 'bot',
    id: 'canyon',
    name: 'Canyon',
    variant: 'mountain',
    blurb: 'Bot. Knows the slope.',
  },
  {
    kind: 'app',
    id: 'winamp',
    name: 'Winamp',
    href: '/demo/winamp/',
    blurb: 'It really whips.',
  },
];
