import { Router } from 'express';
import db from '../db.js';
import { requestDay, visitorHash } from '../visitor.js';

const router = Router();

function currentCount() {
  return db.prepare('SELECT count FROM hits WHERE id = 1').get().count;
}

router.get('/hits', (_req, res) => {
  res.json({ count: currentCount() });
});

// One increment per hashed visitor per UTC day. The hash is IP + user agent.
router.post('/hits', (req, res) => {
  const day = requestDay(req);
  const hash = visitorHash(req);
  const count = db.transaction(() => {
    const info = db
      .prepare('INSERT OR IGNORE INTO hit_visitors (visitor_hash, day) VALUES (?, ?)')
      .run(hash, day);
    if (info.changes === 1) {
      db.prepare('UPDATE hits SET count = count + 1 WHERE id = 1').run();
    }
    return currentCount();
  })();
  res.json({ count });
});

export default router;
