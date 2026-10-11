// Original goat drawings for the profile and the bot row.
// Palette: ink, white, paper, rose, magenta. No likeness of a real person.

const VARIANTS = {
  plain: null,
  spark: 'spark',
  beret: 'beret',
  glasses: 'glasses',
  mountain: 'mountain',
};

export default function GoatArt({ label, variant = 'plain', className = '', decorative = false }) {
  const extra = VARIANTS[variant] || null;
  return (
    <svg
      className={className}
      viewBox="0 0 80 80"
      role={decorative ? 'presentation' : 'img'}
      aria-hidden={decorative ? 'true' : undefined}
      aria-label={decorative ? undefined : label}
    >
      <rect width="80" height="80" fill="#f4f4f5" />
      <path d="M26 36 C24 20 18 14 14 12" fill="none" stroke="#101014" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M54 36 C56 20 62 14 66 12" fill="none" stroke="#101014" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M24 46 L12 40 L24 34 Z" fill="#ffffff" stroke="#101014" strokeWidth="2" />
      <path d="M56 46 L68 40 L56 34 Z" fill="#ffffff" stroke="#101014" strokeWidth="2" />
      <ellipse cx="40" cy="48" rx="18" ry="16" fill="#ffffff" stroke="#101014" strokeWidth="2" />
      <circle cx="33" cy="48" r="2.1" fill="#101014" />
      <circle cx="47" cy="48" r="2.1" fill="#101014" />
      <ellipse cx="40" cy="56" rx="4.5" ry="3" fill="#9f1239" />
      <path d="M36 56 H44" stroke="#101014" strokeWidth="1" />
      {extra === 'beret' && (
        <path d="M22 36 Q40 18 60 34 Q44 28 22 36 Z" fill="#9f1239" stroke="#101014" strokeWidth="1.5" />
      )}
      {extra === 'glasses' && (
        <g fill="none" stroke="#101014" strokeWidth="1.6">
          <circle cx="33" cy="48" r="5" />
          <circle cx="47" cy="48" r="5" />
          <path d="M38 48 H42" />
        </g>
      )}
      {extra === 'mountain' && (
        <path d="M6 72 L22 52 L34 64 L50 44 L74 72" fill="none" stroke="#3f3f46" strokeWidth="2" />
      )}
      {extra === 'spark' && (
        <path d="M64 14 L66 20 L72 22 L66 24 L64 30 L62 24 L56 22 L62 20 Z" fill="#86104e" />
      )}
    </svg>
  );
}
