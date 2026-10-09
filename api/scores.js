import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN,
});

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    if (req.method === 'POST') {
      const { name, branch, score } = req.body || {};
      const s = Math.round(Number(score));
      const n = String(name || '').replace(/\|/g, '').trim().slice(0, 20);
      const b = String(branch || '').replace(/\|/g, '').slice(0, 20);
      if (!n || !b || !(s >= 0 && s <= 300)) {
        return res.status(400).json({ error: 'bad input' });
      }
      // gt: true -> only updates if the new score is higher (keeps best only)
      await redis.zadd('lb', { gt: true }, { score: s, member: `${n}|${b}` });
      return res.status(200).json({ ok: true });
    }
    const r = await redis.zrange('lb', 0, 9, { rev: true, withScores: true });
    const out = [];
    for (let i = 0; i < r.length; i += 2) {
      const [name, branch] = String(r[i]).split('|');
      out.push({ name, branch, best: Number(r[i + 1]) });
    }
    return res.status(200).json(out);
  } catch (e) {
    return res.status(500).json({ error: 'server error' });
  }
}
