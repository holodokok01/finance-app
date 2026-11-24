export const SWIPE_OPEN = 88;
export const SWIPE_SPRING = 'cubic-bezier(.25, 1.25, .4, 1)';

/**
 * Положение свайпа строки: тело едет влево, красная корзина растёт справа.
 * Всё через translate/width напрямую в DOM, без React-состояния (плавно на 120 Гц).
 * Возвращает true, когда строка потянута достаточно далеко для удаления отпусканием.
 */
export function setRowSwipe(row: HTMLElement, dx: number, anim: boolean, wide?: boolean): boolean {
  const inn = row.querySelector<HTMLElement>('.cv-in, .cm-body');
  const tr = row.querySelector<HTMLElement>('.cv-trash');
  if (!inn || !tr || !tr.firstElementChild) return false;
  const ic = tr.firstElementChild as unknown as HTMLElement;
  const W = row.offsetWidth;
  const armed = -dx > W * 0.75;
  const w = wide ? W - 8 : Math.max(0, -dx - 8);
  const x = Math.max(0, Math.round((w - 24) / 2));
  const ease = anim ? ' .34s ' + SWIPE_SPRING : '';
  inn.style.transition = anim ? 'translate' + ease + ', background .2s ease' : 'background .2s ease';
  inn.style.translate = Math.round(dx) + 'px 0';
  tr.style.transition = anim ? 'width' + ease + ', opacity .2s ease' : 'none';
  tr.style.width = Math.round(w) + 'px';
  tr.style.opacity = dx < -4 ? '1' : '0';
  ic.style.transition = anim
    ? 'translate' + ease + ', scale .22s cubic-bezier(.3, 1.6, .5, 1)'
    : 'scale .22s cubic-bezier(.3, 1.6, .5, 1)';
  ic.style.translate = x + 'px 0';
  ic.style.scale = armed ? '1.2' : '1';
  return armed;
}
