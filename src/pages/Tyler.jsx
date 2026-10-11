import { Link } from 'react-router-dom';
import Seo from '../components/Seo.jsx';
import GoatArt from '../components/GoatArt.jsx';
import ProfileSong from '../components/ProfileSong.jsx';
import GuestbookForm from '../components/GuestbookForm.jsx';
import GuestbookList from '../components/GuestbookList.jsx';
import { usePosts } from '../lib/api.js';
import { tyler, top8 } from '../data/tyler.js';

const BLURBS = [
  ['About me', tyler.about],
  ["Who I'd like to meet", tyler.meet],
  ['Interests', tyler.interests],
  ['Music', tyler.music],
  ['Movies', tyler.movies],
  ['Television', tyler.tv],
  ['Heroes', tyler.heroes],
];

export default function Tyler() {
  const { data } = usePosts();
  const posts = (data?.posts || []).slice(0, 5);

  return (
    <div className="ms">
      <Seo
        title="Tyler"
        description="Tyler is in your extended network. A 2005-style profile: about, top 8, a profile song, and comments."
        path="/tyler"
      />
      <p className="ms-banner">crispygoat.com</p>
      <div className="ms-page">
        <h1>{tyler.name}</h1>
        <p className="ms-quote">“{tyler.headline}”</p>

        <div className="ms-layout">
          <aside className="ms-side">
            <GoatArt className="ms-pic" label="Tyler, drawn as a goat" variant="plain" />
            <div className="ms-box">
              <h2>Contacting {tyler.name}</h2>
              <dl>
                <div>
                  <dt>Mood</dt>
                  <dd>{tyler.mood}</dd>
                </div>
                <div>
                  <dt>Location</dt>
                  <dd>{tyler.location}</dd>
                </div>
                <div>
                  <dt>URL</dt>
                  <dd><a href="/">crispygoat.com</a></dd>
                </div>
                <div>
                  <dt>Email</dt>
                  <dd><a href={`mailto:${tyler.email}`}>{tyler.email}</a></dd>
                </div>
              </dl>
            </div>
            <div className="ms-box">
              <h2>View my</h2>
              <ul>
                <li><Link to="/portfolio">Apps</Link></li>
                <li><Link to="/blog">Blog</Link></li>
                <li><Link to="/guestbook">Guestbook</Link></li>
              </ul>
            </div>
            <ProfileSong title={tyler.song} />
          </aside>

          <div className="ms-main">
            <p className="ms-network">{tyler.network}</p>
            {BLURBS.map(([title, body]) => (
              <section key={title} className="ms-box">
                <h2>{title}</h2>
                <p>{body}</p>
              </section>
            ))}

            <section className="ms-box" id="top8" aria-labelledby="top8-title">
              <h2 id="top8-title">{tyler.name}&apos;s Top 8</h2>
              <ul className="ms-top">
                {top8.map((item) => (
                  <li key={item.id}>
                    {item.kind === 'bot' ? (
                      <article>
                        <GoatArt label={`${item.name}, a goat-shaped bot`} variant={item.variant} />
                        <h3>{item.name}</h3>
                        <p>{item.blurb}</p>
                      </article>
                    ) : (
                      <a href={item.href}>
                        <GoatArt decorative variant="plain" />
                        <h3>{item.name}</h3>
                        <p>{item.blurb}</p>
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </section>

            <section className="ms-box" aria-labelledby="blog-title">
              <h2 id="blog-title">Blog</h2>
              {posts.length === 0 ? (
                <p>No posts yet.</p>
              ) : (
                <ul>
                  {posts.map((post) => (
                    <li key={post.slug}><Link to={`/blog/${post.slug}`}>{post.title}</Link></li>
                  ))}
                </ul>
              )}
            </section>

            <section className="ms-box" aria-labelledby="comments-title">
              <h2 id="comments-title">Comments</h2>
              <GuestbookList page="tyler" limit={20} empty="No comments yet." />
              <GuestbookForm page="tyler" />
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
