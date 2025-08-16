import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';

export type PnuResult = {
  input: string;
  token: string | null;
  admCd10: string | null; // 법정동코드 10자리
  name: string | null;    // 법정동명
  bun: number | null;     // 본번
  ji: number | null;      // 부번
  mtYn: 0 | 1;            // 산여부(0/1)
  pnu: string | null;     // 총 19자리 = 10+1+4+4
};

export type Candidate = { admCd10: string, name: string };
type Row = { 법정동코드: string; 법정동명: string };

function normalize(s: string): string {
  return s.replace(/\u3000/g, ' ').replace(/[\s\t\r\n]+/g, ' ').trim();
}

export function loadDongTable(): Row[] {
  const tsvPath = path.join(process.cwd(), 'data', 'pnu10.tsv');
  const buf = fs.readFileSync(tsvPath, 'utf-8');
  const recs: Row[] = parse(buf, {
    delimiter: '\t',
    columns: true,
    skip_empty_lines: true,
    bom: true,
    trim: true
  });
  return recs.map(r => ({
    법정동코드: String(r['법정동코드']).trim(),
    법정동명: normalize(String(r['법정동명'] || ''))
  }));
}

const tableCache: { rows: Row[] | null } = { rows: null };
function getTable(): Row[] {
  if (!tableCache.rows) tableCache.rows = loadDongTable();
  return tableCache.rows!;
}

function extractAreaToken(text: string): string | null {
  const only = text.replace(/[^가-힣\s]/g, ' ');
  const simplified = normalize(only);
  const m = Array.from(simplified.matchAll(/([가-힣\s]+?(동|리|가|읍|면))/g));
  if (m.length > 0) return normalize(m[m.length - 1][1]);
  return simplified.length ? simplified : null;
}

function findExact(token: string): Row | null {
  const t = normalize(token);
  const rows = getTable();
  const hit = rows.find(r => r.법정동명 === t);
  return hit ?? null;
}

function findByPriority(token: string): Row[] {
  const t = normalize(token);
  const rows = getTable();
  const exact = rows.filter(r => r.법정동명 === t);
  if (exact.length) return exact;
  const suffix = rows.filter(r => r.법정동명.endsWith(t));
  if (suffix.length) return suffix.sort((a,b) => b.법정동명.length - a.법정동명.length);
  const contains = rows.filter(r => r.법정동명.includes(t));
  if (contains.length) return contains.sort((a,b) => b.법정동명.length - a.법정동명.length);
  return [];
}

function findCandidates(token: string): Candidate[] {
  const rows = findByPriority(token);
  const out: Candidate[] = rows.map(r => ({ admCd10: r.법정동코드, name: r.법정동명 }));
  const seen = new Set<string>();
  const dedup: Candidate[] = [];
  for (const c of out) {
    if (!seen.has(c.admCd10)) { seen.add(c.admCd10); dedup.push(c); }
  }
  return dedup;
}

function parseBunJiPrecise(text: string): { mtYn: 0|1, bun: number|null, ji: number|null } {
  const hasMt = /산/.test(text) ? 1 : 0;
  const stripped = text.replace(/산/g, '');
  // 입력 내의 모든 숫자/숫자-숫자 중 '마지막' 것을 번지로 사용
  const all = Array.from(stripped.matchAll(/(\d+)(?:\s*-\s*(\d+))?/g));
  if (all.length === 0) return { mtYn: hasMt as 0|1, bun: null, ji: null };
  const m = all[all.length - 1];
  const bun = parseInt(m[1], 10);
  const ji  = m[2] ? parseInt(m[2], 10) : 0;
  return { mtYn: hasMt as 0|1, bun, ji };
}

function toPnu(admCd10: string | null, mtYn: 0|1, bun: number|null, ji: number|null): string | null {
  if (!admCd10) return null;
  const mt = String(mtYn);
  const bunS = String(bun ?? 0).padStart(4, '0'); // 본번 4자리
  const jiS  = String(ji ?? 0).padStart(4, '0');  // 부번 4자리
  // 총 19자리: 10 + 1 + 4 + 4
  return `${String(admCd10).padStart(10, '0')}${mt}${bunS}${jiS}`;
}

export function textToPnuWithCandidates(text: string): { result: PnuResult|null, candidates: Candidate[] } {
  const input = String(text || '');
  const token = extractAreaToken(input);
  let candidates: Candidate[] = [];
  if (token) {
    const exact = findExact(token);
    if (exact) {
      candidates = [{ admCd10: exact.법정동코드, name: exact.법정동명 }];
    } else {
      candidates = findCandidates(token);
    }
  }
  if (candidates.length === 0) {
    const exact = findExact(input);
    if (exact) candidates = [{ admCd10: exact.법정동코드, name: exact.법정동명 }];
    else candidates = findCandidates(input);
  }

  if (candidates.length === 1) {
    const chosen = candidates[0];
    const { mtYn, bun, ji } = parseBunJiPrecise(input);
    const pnu = toPnu(chosen.admCd10, mtYn, bun, ji);
    const result: PnuResult = {
      input,
      token: token ?? null,
      admCd10: chosen.admCd10,
      name: chosen.name,
      bun, ji, mtYn, pnu
    };
    return { result, candidates };
  }
  return { result: null, candidates };
}
