import { Transaction, Category } from '../types/fin';
import { L } from '../i18n';
import { LangCode } from '../types/settings';

export function csvCell(v: unknown): string {
  const str = String(v == null ? '' : v);
  return /[";\n\r]/.test(str) ? '"' + str.replace(/"/g, '""') + '"' : str;
}

export function ymdOf(ts: number): string {
  const d = new Date(ts);
  return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
}

export function buildCsv(
  txList: Transaction[],
  cats: Record<string, Category>,
  baseCurrency: string,
  lang: LangCode = 'ru'
): { text: string; n: number } {
  const rows = txList
    .filter(t => !t.demo)
    .slice()
    .sort((a, b) => b.ts - a.ts || (a.t < b.t ? 1 : -1));

  const header = ['Дата', 'Время', 'Тип', 'Категория', 'Комментарий', 'Сумма', 'Валюта']
    .map(x => L(x, undefined, lang))
    .join(';');

  const out = [header];
  for (let i = 0; i < rows.length; i++) {
    const t = rows[i];
    const catName = cats[t.cat] ? cats[t.cat].name : t.cat;
    const typeLabel = t.sum > 0 ? L('Доход', undefined, lang) : L('Расход', undefined, lang);
    const sumStr = String(Math.abs(t.sum)).replace('.', ',');
    const line = [ymdOf(t.ts), t.t, typeLabel, catName, t.note || '', sumStr, baseCurrency].map(csvCell).join(';');
    out.push(line);
  }

  // BOM prefix \uFEFF for Excel UTF-8 compatibility
  return {
    text: '\uFEFF' + out.join('\r\n'),
    n: rows.length,
  };
}

export function parseCsv(text: string): string[][] {
  text = text.replace(/^\uFEFF/, '');
  const first = text.split(/\r?\n/)[0] || '';
  const sep = (first.match(/;/g) || []).length >= (first.match(/,/g) || []).length ? ';' : ',';
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let q = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          q = false;
        }
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      q = true;
    } else if (ch === sep) {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += ch;
    }
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter(r => r.some(x => x.trim()));
}

export function dateTs(v: unknown): number | null {
  const str = String(v || '').trim();
  let m = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  let y: number;
  let mo: number;
  let d: number;
  if (m) {
    y = +m[1];
    mo = +m[2];
    d = +m[3];
  } else {
    m = str.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
    if (!m) return null;
    d = +m[1];
    mo = +m[2];
    y = +m[3];
  }
  const t = new Date(y, mo - 1, d);
  t.setHours(0, 0, 0, 0);
  return isNaN(t.getTime()) ? null : t.getTime();
}

export function catByName(
  name: string,
  cats: Record<string, Category>,
  i18nUk: Record<string, string>,
  i18nEn: Record<string, string>
): string | null {
  const n = String(name || '').trim().toLowerCase();
  for (const k in cats) {
    if (k.toLowerCase() === n || cats[k].name.toLowerCase() === n) return k;
    const ru = cats[k].ru;
    if (ru) {
      const candidates = [ru, i18nUk[ru] || ru, i18nEn[ru] || ru];
      if (candidates.some(x => x.toLowerCase() === n)) return k;
    }
  }
  return null;
}
