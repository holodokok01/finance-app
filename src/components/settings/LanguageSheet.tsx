import React, { useCallback } from 'react';
import { Squircle } from '../ui/Squircle';
import { usePullToClose } from '../../hooks/usePullToClose';
import { useSheetPresence } from '../../hooks/useSheetPresence';
import { useSettingsStore } from '../../store/useSettingsStore';
import { haptic } from '../../services/telegram';
import { CHECK } from '../../assets/icons';
import { L, LANGS, LANG_CODE } from '../../i18n';
import { LangCode } from '../../types/settings';

/* Шит выбора языка: три строки с галочкой, выбор сразу применяется и шит закрывается. */

const CLOSE_PATH = 'M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z';

interface Props {
  open: boolean;
  onClose: () => void;
}

export const LanguageSheet: React.FC<Props> = ({ open, onClose }) => {
  const hapticOn = useSettingsStore(s => s.haptic);
  const lang = (useSettingsStore(s => s.lang) || 'ru') as LangCode;
  const setLang = useSettingsStore(s => s.setLang);
  const hp = useCallback((k: Parameters<typeof haptic>[0]) => haptic(k, hapticOn), [hapticOn]);
  const { rendered, show, height, kb, oy } = useSheetPresence(open, () => hp('light'));
  const { panelRef } = usePullToClose({ onClose, enabled: open });

  if (!rendered) return null;

  return (
    <div
      className={'detail cs' + (show ? ' show' : '')}
      id="lng"
      aria-hidden={!show}
      style={{ height: height ? height + 'px' : undefined, ['--kb' as string]: kb + 'px', transform: oy ? 'translateY(' + oy + 'px)' : undefined }}
    >
      <div className="detail-dim" id="lng-dim" onClick={onClose} />
      <Squircle r="32 32 0 0" className="detail-panel lng-panel" id="lng-panel" ref={panelRef as any}>
        <div className="d-grab" />
        <div className="d-top">
          <span className="d-spacer" />
          <div className="d-top-title">{L('Язык')}</div>
          <button
            className="rb"
            type="button"
            id="lng-close"
            aria-label={L('Закрыть')}
            onClick={() => {
              hp('light');
              onClose();
            }}
          >
            <svg viewBox="0 0 24 24">
              <path d={CLOSE_PATH} />
            </svg>
          </button>
        </div>
        <div className="lng-list" id="lng-list">
          {LANGS.map(k => (
            <button
              key={k}
              type="button"
              className="fp-row lng-row"
              data-l={k}
              aria-pressed={k === lang}
              onClick={() => {
                hp('select');
                if (k !== lang) setLang(k);
                setTimeout(onClose, 220);
              }}
            >
              <span className="row-title">{LANG_CODE[k]}</span>
              <svg className="fp-check" viewBox="0 0 24 24" dangerouslySetInnerHTML={{ __html: CHECK }} />
            </button>
          ))}
        </div>
      </Squircle>
    </div>
  );
};
