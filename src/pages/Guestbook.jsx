import Seo from '../components/Seo.jsx';
import GuestbookForm from '../components/GuestbookForm.jsx';
import GuestbookList from '../components/GuestbookList.jsx';

export default function Guestbook() {
  return (
    <div className="pw">
      <Seo
        title="Guestbook"
        description="Sign the Crispy Goat guestbook. Notes stay pending until they’re approved."
        path="/guestbook"
      />
      <header className="pw-hero">
        <p className="pixel">Leave a note</p>
        <h1>Guestbook</h1>
        <p className="pw-lead">First name, a city if you want, and a short message. It shows up after it’s approved.</p>
      </header>
      <GuestbookList page="guestbook" limit={50} />
      <GuestbookForm page="guestbook" />
    </div>
  );
}
