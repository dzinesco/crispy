import { Helmet } from 'react-helmet-async';

export default function Seo({ title, description, path = '/' }) {
  const site = import.meta.env.VITE_SITE_URL || 'https://crispygoat.com';
  const url = `${site.replace(/\/$/, '')}${path}`;
  const fullTitle = title ? `${title} — Crispy Goat` : 'Crispy Goat';
  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description || 'Productized site kits and selective custom builds.'} />
      <link rel="canonical" href={url} />
      <meta property="og:type" content="website" />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:site_name" content="Crispy Goat" />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
    </Helmet>
  );
}
