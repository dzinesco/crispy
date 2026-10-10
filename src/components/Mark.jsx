const paths = [
  'M40 34C30 18 12 8 4 18C14 14 26 22 34 34Z',
  'M46 30C42 14 26 2 16 4C26 8 38 16 44 30Z',
  'M32 38L6 34L28 48Z',
  'M28 34C26 24 38 18 50 24C62 30 66 42 60 50C54 58 40 58 32 52C24 48 22 40 28 34Z',
  'M52 36C64 36 72 44 68 52C64 58 54 56 48 50Z',
  'M50 52L60 72L42 72Z',
];

export default function Mark({ className = 'h-7 w-7' }) {
  return (
    <svg className={className} viewBox="0 0 74 74" fill="currentColor" aria-hidden="true">
      {paths.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
