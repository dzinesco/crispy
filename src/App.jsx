import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import AdminGate from './components/AdminGate.jsx';
import Home from './pages/Home.jsx';
import About from './pages/About.jsx';
import Portfolio from './pages/Portfolio.jsx';
import Blog from './pages/Blog.jsx';
import BlogPost from './pages/BlogPost.jsx';
import DemoDetail from './pages/DemoDetail.jsx';
import Contact from './pages/Contact.jsx';
import Login from './pages/Login.jsx';
import Admin from './pages/Admin.jsx';
import NotFound from './pages/NotFound.jsx';
import Guestbook from './pages/Guestbook.jsx';
import Tyler from './pages/Tyler.jsx';
import { Privacy, Terms } from './pages/Legal.jsx';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/about" element={<About />} />
        <Route path="/packages" element={<Navigate to="/portfolio" replace />} />
        <Route path="/portfolio" element={<Portfolio />} />
        <Route path="/tyler" element={<Tyler />} />
        <Route path="/guestbook" element={<Guestbook />} />
        <Route path="/blog" element={<Blog />} />
        <Route path="/blog/:slug" element={<BlogPost />} />
        <Route path="/kits" element={<Navigate to="/portfolio" replace />} />
        <Route path="/kits/*" element={<Navigate to="/portfolio" replace />} />
        <Route path="/demos/:slug" element={<DemoDetail />} />
        <Route path="/apply" element={<Navigate to="/portfolio" replace />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/admin/login" element={<Login />} />
        <Route
          path="/admin"
          element={
            <AdminGate>
              <Admin />
            </AdminGate>
          }
        />
        <Route path="/404" element={<NotFound />} />
        <Route path="*" element={<Navigate to="/404" replace />} />
      </Route>
    </Routes>
  );
}
