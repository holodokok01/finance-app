/**
 * Временная отладка клавиатуры iOS: маленькая плашка сверху с размерами экрана и последними событиями.
 * Видна только пока открыт шит или модал. Убрать после фикса.
 */
export function startDebugHud(): void {
  const el = document.createElement('div');
  el.style.cssText =
    'position:fixed;left:4px;top:4px;z-index:9999;pointer-events:none;font:10px/12px ui-monospace,Menlo,monospace;' +
    'color:#0f0;background:rgba(0,0,0,.75);padding:4px 6px;border-radius:6px;white-space:pre;max-width:96vw;display:none';
  document.body.appendChild(el);
  const log: string[] = [];
  const t0 = performance.now();
  const snap = () => {
    const vv = window.visualViewport;
    const d = document.querySelector('.detail.show, .sheet.show') as HTMLElement | null;
    const p = d ? (d.querySelector('.detail-panel, .sheet-body') as HTMLElement | null) : null;
    const pr = p ? p.getBoundingClientRect() : null;
    return (
      'iH' + window.innerHeight +
      ' cH' + document.documentElement.clientHeight +
      ' vvH' + (vv ? Math.round(vv.height) : '-') +
      ' vvY' + (vv ? Math.round(vv.offsetTop) : '-') +
      ' sY' + Math.round(window.scrollY) +
      ' dH' + (d ? d.style.height || '-' : '-') +
      ' kb' + (d ? d.style.getPropertyValue('--kb') || '-' : '-') +
      ' tf' + (d ? (d.style.transform || '-').replace('translateY', 'Y') : '-') +
      ' pT' + (pr ? Math.round(pr.top) : '-') +
      ' pB' + (pr ? Math.round(pr.bottom) : '-')
    );
  };
  const draw = () => {
    const open = !!document.querySelector('.detail.show, .sheet.show');
    el.style.display = open ? 'block' : 'none';
    if (!open) return;
    el.textContent =
      'build ' + (typeof __BUILD_ID__ !== 'undefined' ? __BUILD_ID__ : 'dev') + '\n' + snap() + '\n' + log.join('\n');
  };
  const ev = (name: string) => () => {
    log.unshift(((performance.now() - t0) / 1000).toFixed(1) + ' ' + name + ' ' + snap());
    if (log.length > 8) log.pop();
    requestAnimationFrame(draw);
  };
  window.addEventListener('resize', ev('win'));
  window.visualViewport?.addEventListener('resize', ev('vvR'));
  window.visualViewport?.addEventListener('scroll', ev('vvS'));
  document.addEventListener('focusin', ev('fIn'));
  document.addEventListener('focusout', ev('fOut'));
  window.addEventListener('scroll', ev('scr'), { passive: true });
  setInterval(draw, 250);
}
