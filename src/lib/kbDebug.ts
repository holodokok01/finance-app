/**
 * Скрытая запись клавиатуры для отладки на iPhone.
 * Включается 7 быстрыми тапами по «Общий баланс». После тапа по полю в модале
 * 1,6 с пишет каждый кадр (высоты окна, прокрутка, слой и панель) и показывает
 * текст с кнопкой «Копировать». Обычным пользователям не видна.
 */
const KEY = 'kb_dbg';
const on = () => {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch (e) {
    return false;
  }
};

let rec: string[] = [];
let ev: string[] = [];
let t0 = 0;
let busy = false;

const note = (s: string) => {
  if (busy) ev.push(s);
};

const desc = (el: Element | null) => {
  if (!el) return '-';
  const h = el as HTMLElement;
  return h.id || h.tagName.toLowerCase();
};

const sample = () => {
  const t = Math.round(performance.now() - t0);
  const vv = window.visualViewport;
  const layer = document.querySelector('.detail.show') as HTMLElement | null;
  const panel = layer ? (layer.querySelector('.detail-panel') as HTMLElement | null) : null;
  const lr = layer ? layer.getBoundingClientRect() : null;
  const pr = panel ? panel.getBoundingClientRect() : null;
  const app = document.getElementById('app');
  rec.push(
    [
      t,
      window.innerHeight,
      vv ? Math.round(vv.height) : '-',
      vv ? Math.round(vv.offsetTop) : '-',
      Math.round(window.scrollY),
      app ? app.scrollTop : '-',
      lr ? Math.round(lr.top) + '/' + Math.round(lr.height) : '-',
      pr ? Math.round(pr.top) + '/' + Math.round(pr.bottom) : '-',
      desc(document.activeElement),
      ev.join(','),
    ].join(' ')
  );
  ev = [];
  if (t < 1600) requestAnimationFrame(sample);
  else {
    busy = false;
    show();
  }
};

const begin = (why: string) => {
  if (busy || !on()) return;
  busy = true;
  rec = [];
  ev = [why];
  t0 = performance.now();
  requestAnimationFrame(sample);
};

const show = () => {
  const old = document.getElementById('kbdbg');
  if (old) old.remove();
  const ua = navigator.userAgent.replace(/\s+/g, ' ').slice(0, 120);
  const text = 'ua ' + ua + '\nt ih vvh vvtop sy appTop layer(top/h) panel(top/bottom) active events\n' + rec.join('\n');
  const box = document.createElement('div');
  box.id = 'kbdbg';
  box.style.cssText =
    'position:fixed;left:8px;right:8px;top:8px;z-index:99999;background:#000;color:#0f0;border:1px solid #0f0;border-radius:12px;padding:8px;font:11px/14px monospace;display:flex;flex-direction:column;gap:8px';
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.readOnly = true;
  ta.style.cssText = 'height:200px;background:#000;color:#0f0;border:0;font:11px/14px monospace;user-select:text;-webkit-user-select:text';
  const row = document.createElement('div');
  row.style.cssText = 'display:flex;gap:8px';
  const btn = (label: string, fn: () => void) => {
    const b = document.createElement('button');
    b.textContent = label;
    b.style.cssText = 'flex:1;height:36px;border-radius:8px;border:1px solid #0f0;background:#111;color:#0f0;font:14px monospace';
    b.onclick = fn;
    row.appendChild(b);
  };
  btn('Копировать', () => {
    const done = () => {
      const c = row.firstChild as HTMLElement;
      c.textContent = 'Скопировано';
    };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, () => ta.select());
    else {
      ta.select();
      document.execCommand('copy');
      done();
    }
  });
  btn('Закрыть', () => box.remove());
  box.appendChild(ta);
  box.appendChild(row);
  document.body.appendChild(box);
};

export function installKbDebug() {
  let taps: number[] = [];
  document.addEventListener('click', e => {
    const t = e.target as HTMLElement | null;
    if (!t || !t.closest || !t.closest('.balance-label')) return;
    const now = Date.now();
    taps = taps.filter(x => now - x < 3000);
    taps.push(now);
    if (taps.length < 7) return;
    taps = [];
    const next = !on();
    try {
      localStorage.setItem(KEY, next ? '1' : '0');
    } catch (err) {
      /* ignore */
    }
    alert(next ? 'Запись клавиатуры включена' : 'Запись клавиатуры выключена');
  });
  const inSheet = (t: EventTarget | null) => !!(t as HTMLElement | null)?.closest?.('.detail');
  document.addEventListener(
    'touchend',
    e => {
      const t = e.target as HTMLElement | null;
      if (inSheet(t) && t && t.closest && t.closest('input, textarea, label, [data-kb-box]')) begin('touchend:' + desc(t));
      else note('touchend');
    },
    { capture: true, passive: true }
  );
  document.addEventListener('focusin', e => note('focusin:' + desc(e.target as Element)), true);
  document.addEventListener('focusout', e => note('focusout:' + desc(e.target as Element)), true);
  window.addEventListener('resize', () => note('resize'));
  window.addEventListener('scroll', () => note('scroll'), { passive: true });
  window.visualViewport?.addEventListener('resize', () => note('vvresize'));
  window.visualViewport?.addEventListener('scroll', () => note('vvscroll'));
}
