export default function Mark({ className = 'h-7 w-7' }) {
  return (
    <svg className={className} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" fill="#171412" />
      <path d="M8 24 L16 6 L24 24" fill="none" stroke="#A67C1A" strokeWidth="2.4" />
      <path d="M11 24h10" stroke="#E7E1D4" strokeWidth="2" />
    </svg>
  );
}
