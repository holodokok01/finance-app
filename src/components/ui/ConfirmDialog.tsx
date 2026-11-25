import React, { useEffect, useRef, useState } from 'react';
import { Squircle } from './Squircle';
import { haptic } from '../../services/telegram';
import { useSettingsStore } from '../../store/useSettingsStore';
import { L } from '../../i18n';

/* Диалог подтверждения по центру: затемнение, заголовок, текст и две кнопки. */

export interface ConfirmSpec {
  title: string;
  text: string;
  ok: string;
  danger?: boolean;
  onOk: () => void;
}

interface Props {
  spec: ConfirmSpec | null;
  onClose: () => void;
}

export const ConfirmDialog: React.FC<Props> = ({ spec, onClose }) => {
  const hapticOn = useSettingsStore(s => s.haptic);
  const [last, setLast] = useState<ConfirmSpec | null>(spec);
  const [rendered, setRendered] = useState(!!spec);
  const [show, setShow] = useState(false);
  const specRef = useRef(spec);
  specRef.current = spec;

  useEffect(() => {
    if (spec) {
      setLast(spec);
      setRendered(true);
      haptic(spec.danger ? 'warning' : 'light', hapticOn);
      let r2 = 0;
      const r1 = requestAnimationFrame(() => {
        r2 = requestAnimationFrame(() => setShow(true));
      });
      return () => {
        cancelAnimationFrame(r1);
        cancelAnimationFrame(r2);
      };
    }
    setShow(false);
    const t = setTimeout(() => {
      if (!specRef.current) setRendered(false);
    }, 260);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spec]);

  if (!rendered || !last) return null;

  return (
    <div className={'dlg' + (show ? ' show' : '')} id="dlg" role="dialog" aria-modal="true">
      <div className="dlg-dim" onClick={onClose} />
      <Squircle r={28} className="dlg-box">
        <div className="dlg-t">{L(last.title)}</div>
        <div className="dlg-x">{last.text}</div>
        <div className="dlg-b">
          <button type="button" className="pbtn" onClick={onClose}>
            {L('Отмена')}
          </button>
          <button
            type="button"
            className={'pbtn ' + (last.danger ? 'red' : 'primary')}
            onClick={() => {
              const cb = last.onOk;
              onClose();
              cb();
            }}
          >
            {L(last.ok)}
          </button>
        </div>
      </Squircle>
    </div>
  );
};
