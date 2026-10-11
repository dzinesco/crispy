import { useGuestbook } from '../lib/api.js';

function when(value) {
  if (!value) return '';
  const date = new Date(value.includes('T') ? value : `${value.replace(' ', 'T')}Z`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function GuestbookList({ page = 'guestbook', limit = 20, empty = 'No notes yet.' }) {
  const { data, isLoading, error } = useGuestbook(page, limit);
  const entries = data?.entries || [];

  if (isLoading) return <p className="gb-empty">Loading notes…</p>;
  if (error) return <p className="gb-empty">The guestbook isn’t loading.</p>;
  if (entries.length === 0) return <p className="gb-empty">{empty}</p>;

  return (
    <ol className="gb-list">
      {entries.map((entry) => (
        <li key={entry.id}>
          <p className="gb-who">
            <span>{entry.first_name}</span>
            {entry.city ? <span className="gb-city">{entry.city}</span> : null}
            <time className="pixel" dateTime={entry.created_at}>{when(entry.created_at)}</time>
          </p>
          <p className="gb-message">{entry.message}</p>
        </li>
      ))}
    </ol>
  );
}
