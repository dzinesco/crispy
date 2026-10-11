function Badge({ href, lines, tone }) {
  const face = (
    <span className={`b88-face is-${tone}`}>
      {lines.map((line) => <span key={line}>{line}</span>)}
    </span>
  );
  if (!href) return <span className="b88">{face}</span>;
  return <a className="b88" href={href}>{face}</a>;
}

const buttons = [
  { href: '/demo/netscape/', tone: 'dark', lines: ['BEST VIEWED IN', 'NETSCAPE 3'] },
  { tone: 'light', lines: ['EST.', '2024'] },
  { href: '/', tone: 'light', lines: ['CRISPY', 'GOAT'] },
  { href: '/guestbook', tone: 'rose', lines: ['SIGN THE', 'GUESTBOOK'] },
  { href: '/portfolio', tone: 'paper', lines: ['APPS', 'IN BROWSER'] },
  { href: '/tyler', tone: 'magenta', lines: ["TYLER'S", 'PAGE'] },
];

export default function ButtonWall() {
  return (
    <ul className="b88-wall">
      {buttons.map((button) => (
        <li key={button.lines.join('-')}>
          <Badge href={button.href} tone={button.tone} lines={button.lines} />
        </li>
      ))}
    </ul>
  );
}
