import React, { useMemo, useState } from 'react';
import { Squircle } from '../ui/Squircle';
import { Flag } from '../ui/Flag';
import { useRatesStore } from '../../store/useRatesStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { RX_FALLBACK } from '../../services/rates';
import { CV_DEFAULT, CvState, cvFmt, cvName, loadCv } from '../../lib/converter';
import { CV_TRASH } from '../../assets/icons';
import { L, LOC } from '../../i18n';
import { LangCode } from '../../types/settings';

/* Экран «Конвертер», блок 1: шапка и список валют с пересчётом по курсам.
   Ввод, добавление валюты, правка и перетаскивание подключаются следующими блоками. */

const PENCIL =
  'm11.4 18.161l7.396-7.396a10.3 10.3 0 0 1-3.326-2.234a10.3 10.3 0 0 1-2.235-3.327L5.839 12.6c-.577.577-.866.866-1.114 1.184a6.6 6.6 0 0 0-.749 1.211c-.173.364-.302.752-.56 1.526l-1.362 4.083a1.06 1.06 0 0 0 1.342 1.342l4.083-1.362c.775-.258 1.162-.387 1.526-.56q.647-.308 1.211-.749c.318-.248.607-.537 1.184-1.114m9.448-9.448a3.932 3.932 0 0 0-5.561-5.561l-.887.887l.038.111a8.75 8.75 0 0 0 2.092 3.32a8.75 8.75 0 0 0 3.431 2.13z';

const GRIP =
  'M4 8.25a.75.75 0 0 1 .75-.75h14.5a.75.75 0 0 1 0 1.5H4.75A.75.75 0 0 1 4 8.25m0 3.75a.75.75 0 0 1 .75-.75h14.5a.75.75 0 0 1 0 1.5H4.75A.75.75 0 0 1 4 12m.75 3a.75.75 0 0 0 0 1.5h14.5a.75.75 0 0 0 0-1.5z';

export const ConverterScreen: React.FC = () => {
  const rates = useRatesStore(s => s.r);
  const live = useRatesStore(s => s.live);
  const ratesDate = useRatesStore(s => s.date);
  const lang = (useSettingsStore(s => s.lang) || 'ru') as LangCode;

  const [cv] = useState<CvState>(loadCv);

  const rate = (c: string) => rates[c] || RX_FALLBACK[c] || 0;

  /* валюты без курса пропускаются, база остаётся в списке (как cvRender в legacy) */
  const view = useMemo(() => {
    let list = cv.list.filter(c => rate(c));
    if (!list.length) list = CV_DEFAULT.list.slice();
    const base = list.indexOf(cv.base) < 0 ? list[0] : cv.base;
    return { list, base };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cv, rates]);

  const value = (c: string) => {
    if (c === view.base) return cv.amount;
    const b = rate(view.base);
    const r = rate(c);
    return b && r ? (cv.amount / b) * r : 0;
  };

  const rxDate = () => {
    if (!ratesDate) return '';
    const p = ratesDate.split('-');
    const dt = new Date(+p[0], +p[1] - 1, +p[2]);
    return new Intl.DateTimeFormat(LOC[lang] || LOC['ru'], { day: 'numeric', month: 'long' }).format(dt);
  };

  return (
    <>
      <div className="scr-head cv-head">
        <div>
          <h1 className="scr-title">{L('Конвертер')}</h1>
          <div className="cv-src" id="cv-src">
            {live ? L('Курс на {d}', { d: rxDate() }) : L('Примерный курс')}
          </div>
        </div>
        <div className="cv-btns">
          <button className="rb" type="button" id="cv-add-btn" aria-label={L('Добавить валюту')}>
            <svg viewBox="0 0 24 24">
              <path fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" d="M12 5v14M5 12h14" />
            </svg>
          </button>
          <button className="rb" type="button" id="cv-edit" aria-label={L('Править')}>
            <svg viewBox="0 0 24 24">
              <path d={PENCIL} />
            </svg>
          </button>
        </div>
      </div>
      <Squircle r={32} className="ops-card cv-card">
        <div className="cv-list" id="cv-list">
          {view.list.map(c => (
            <div className="cv-row" data-c={c} key={c}>
              <button type="button" className="cv-trash" aria-label={L('Удалить')} dangerouslySetInnerHTML={{ __html: CV_TRASH }} />
              <Squircle r={20} className="cv-in">
                <button type="button" className="cv-minus" aria-label={L('Убрать')}>
                  <span />
                </button>
                <Flag code={c} />
                <span className="cv-main">
                  <span className="cv-code">{c}</span>
                  <span className="cv-name">{cvName(c, lang)}</span>
                </span>
                <span className="cv-val">{cvFmt(value(c))}</span>
                <span className="cv-grip" aria-label={L('Перетащить')}>
                  <svg viewBox="0 0 24 24">
                    <path d={GRIP} />
                  </svg>
                </span>
              </Squircle>
            </div>
          ))}
        </div>
      </Squircle>
    </>
  );
};
