import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Squircle } from '../ui/Squircle';
import { Flag } from '../ui/Flag';
import { usePullToClose } from '../../hooks/usePullToClose';
import { useSheetPresence } from '../../hooks/useSheetPresence';
import { useSettingsStore } from '../../store/useSettingsStore';
import { haptic } from '../../services/telegram';
import { CV_POP, cvName } from '../../lib/converter';
import { CHECK } from '../../assets/icons';
import { L } from '../../i18n';
import { LangCode } from '../../types/settings';

/* Шит «Добавить валюту»: поиск, популярные и все валюты; тап добавляет или убирает валюту из списка конвертера. */

const CLOSE_PATH = 'M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z';

interface Props {
  open: boolean;
  onClose: () => void;
  /** все коды валют с курсом */
  codes: string[];
  selected: string[];
  onToggle: (code: string) => void;
  /** заголовок шита; по умолчанию «Добавить валюту» */
  title?: string;
}

export const AddCurrencySheet: React.FC<Props> = ({ open, onClose, codes, selected, onToggle, title }) => {
  const hapticOn = useSettingsStore(s => s.haptic);
  const lang = (useSettingsStore(s => s.lang) || 'ru') as LangCode;
  const hp = useCallback((k: Parameters<typeof haptic>[0]) => haptic(k, hapticOn), [hapticOn]);
  const { rendered, show, height, kb, oy } = useSheetPresence(open, () => hp('light'));
  const [q, setQ] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const close = useCallback(() => {
    if (document.activeElement === inputRef.current) inputRef.current?.blur();
    onClose();
  }, [onClose]);
  const { panelRef } = usePullToClose({ onClose: close, enabled: open });

  useEffect(() => {
    if (open) setQ('');
  }, [open]);

  const all = useMemo(() => codes.filter(c => c.length === 3).sort(), [codes]);

  const row = (c: string) => (
    <button key={c} type="button" className="cva-row" data-c={c} aria-pressed={selected.indexOf(c) >= 0} onClick={() => onToggle(c)}>
      <Flag code={c} />
      <span className="cv-main">
        <span className="cv-code">{c}</span>
        <span className="cv-name">{cvName(c, lang)}</span>
      </span>
      <svg className="fp-check" viewBox="0 0 24 24" dangerouslySetInnerHTML={{ __html: CHECK }} />
    </button>
  );

  const body = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (t) {
      const hit = all.filter(c => (c + ' ' + cvName(c, lang)).toLowerCase().indexOf(t) >= 0);
      return hit.length ? hit.map(row) : <div className="cva-empty">{L('Ничего не найдено')}</div>;
    }
    const pop = CV_POP.filter(c => all.indexOf(c) >= 0);
    return (
      <>
        <div className="cva-sec">{L('Популярные')}</div>
        {pop.map(row)}
        <div className="cva-sec">{L('Все валюты')}</div>
        {all.filter(c => pop.indexOf(c) < 0).map(row)}
      </>
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, all, selected, lang]);

  if (!rendered) return null;

  return (
    <div
      className={`detail cs${show ? ' show' : ''}`}
      id="cva"
      aria-hidden={!show}
      style={{ height: height ? height + 'px' : undefined, ['--kb' as string]: kb + 'px', transform: oy ? 'translateY(' + oy + 'px)' : undefined }}
    >
      <div className="detail-dim" id="cva-dim" onClick={close} />
      <Squircle r="32 32 0 0" className="detail-panel cs-panel cva-panel" id="cva-panel" ref={panelRef as any}>
        <div className="cva-head">
          <div className="d-grab" />
          <div className="d-top">
            <span className="d-spacer" />
            <div className="d-top-title">{L(title || 'Добавить валюту')}</div>
            <button
              className="rb"
              type="button"
              id="cva-close"
              aria-label={L('Закрыть')}
              onClick={() => {
                hp('light');
                close();
              }}
            >
              <svg viewBox="0 0 24 24">
                <path d={CLOSE_PATH} />
              </svg>
            </button>
          </div>
          <Squircle as="label" r={99} className="field cva-field">
            <svg viewBox="0 0 24 24">
              <g fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11.5" cy="11.5" r="9.5" />
                <path strokeLinecap="round" d="M18.5 18.5L22 22" />
              </g>
            </svg>
            <input
              ref={inputRef}
              id="cva-q"
              type="search"
              placeholder={L('Поиск: код или название')}
              autoComplete="off"
              enterKeyHint="search"
              value={q}
              onChange={e => setQ(e.target.value)}
            />
          </Squircle>
        </div>
        <div id="cva-list">{body}</div>
      </Squircle>
    </div>
  );
};
