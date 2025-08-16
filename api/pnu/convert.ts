// Vercel Serverless Function: POST /api/pnu/convert
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { textToPnuWithCandidates } from '../../utils/addr.js';

export default function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-API-Key');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const text = body?.text ?? (req.query?.text ?? '');
    const { result, candidates } = textToPnuWithCandidates(String(text));
    if (!result) {
      const message = candidates.length === 0
        ? "해당 명칭으로 매칭된 법정동이 없습니다. 시·군·구를 포함해 다시 입력해주세요."
        : "여러 지역에서 같은 동명이 발견되었습니다. 시·군·구를 지정해주세요.";
      return res.status(200).json({ ok: false, message, candidates });
    }
    return res.status(200).json({
      ok: true,
      input: result.input,
      normalized: result.token,
      full: result.name,
      admCd10: result.admCd10,
      mtYn: result.mtYn,
      bun: result.bun !== null ? String(result.bun).padStart(4, '0') : null,
      ji: result.ji !== null ? String(result.ji).padStart(4, '0') : null,
      pnu: result.pnu,
      length: result.pnu ? String(result.pnu).length : null,
      candidates
    });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || 'internal error' });
  }
}
