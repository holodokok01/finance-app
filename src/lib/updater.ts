/**
 * GitHub Pages и webview Telegram кэшируют index.html на минуты, поэтому после выкладки
 * можно сидеть на старой сборке. Тут приложение само сверяет свой номер сборки с version.json
 * (всегда с сервера) и при новой версии открывает себя заново с другим адресом (?v=...),
 * для которого кэша нет.
 */
export function startUpdateCheck(): void {
  if (typeof __BUILD_ID__ === 'undefined' || typeof fetch === 'undefined') return;

  const check = () => {
    fetch('./version.json?t=' + Date.now(), { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null))
      .then(j => {
        if (!j || !j.id || j.id === __BUILD_ID__) return;
        // не перезагружаем, пока открыт шит: там может быть незаконченный ввод
        if (document.querySelector('.detail.show, .sheet.show')) return;
        const u = new URL(window.location.href);
        if (u.searchParams.get('v') === j.id) return; // уже на этом адресе, защита от цикла
        u.searchParams.set('v', j.id);
        window.location.replace(u.toString());
      })
      .catch(() => {});
  };

  check();
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) check();
  });
}
