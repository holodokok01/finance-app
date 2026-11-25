import React, { useEffect, useRef, useState } from 'react';
import { Squircle } from '../ui/Squircle';
import { CategoryTile } from '../ui/CategoryTile';
import { useAppStore } from '../../store/useAppStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { useHoldToDelete } from '../../hooks/useHoldToDelete';
import { haptic } from '../../services/telegram';
import { L } from '../../i18n';
import { CategoryType } from '../../types/fin';

/* Диалог удаления категории с операциями: перенести их в другую категорию или удалить вместе с ними (удержанием). */

interface Props {
  /** id категории или null, когда диалог закрыт */
  k: string | null;
  onCancel: () => void;
  /** to пустой: удалить вместе с операциями */
  onRun: (k: string, to?: string) => void;
}

export const CategoryDeleteDialog: React.FC<Props> = ({ k, onCancel, onRun }) => {
  const hapticOn = useSettingsStore(s => s.haptic);
  const categories = useAppStore(s => s.categories);
  const order = useAppStore(s => s.categoryOrder);
  const [rendered, setRendered] = useState(!!k);
  const [show, setShow] = useState(false);
  const [view, setView] = useState<'main' | 'pick'>('main');
  const snap = useRef<{ k: string; name: string; type: CategoryType } | null>(null);
  const kRef = useRef(k);
  kRef.current = k;

  if (k && categories[k]) snap.current = { k, name: categories[k].name, type: categories[k].type };

  useEffect(() => {
    if (k) {
      setView('main');
      setRendered(true);
      haptic('warning', hapticOn);
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
      if (!kRef.current) setRendered(false);
    }, 260);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [k]);

  const hold = useHoldToDelete({
    onDelete: () => {
      if (snap.current) onRun(snap.current.k);
    },
  });

  const s = snap.current;
  if (!rendered || !s) return null;
  const hp = (kind: Parameters<typeof haptic>[0]) => haptic(kind, hapticOn);
  const others = (order[s.type] || []).filter(x => x !== s.k && categories[x]);

  return (
    <div className={'dlg' + (show ? ' show' : '')} id="cdel" role="dialog" aria-modal="true">
      <div className="dlg-dim" onClick={onCancel} />
      <Squircle r={28} className="dlg-box cdel-box" id="cdel-box">
        {view === 'main' ? (
          <>
            <div className="dlg-t">{L('Удалить категорию «{c}»?', { c: s.name })}</div>
            <div className="dlg-x">{L('Зажми «Удалить», чтобы удалить с операциями, или перенеси их.')}</div>
            <div className="cdel-btns">
              <button
                className="pbtn"
                type="button"
                onClick={() => {
                  hp('light');
                  setView('pick');
                }}
              >
                {L('Перенести')}
              </button>
              <button className="pbtn danger" type="button" {...hold}>
                <span>{L('Удалить')}</span>
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="dlg-t">{L('Куда перенести операции?')}</div>
            <div className="dlg-x">{L('«{c}» удалится, операции перейдут в выбранную.', { c: s.name })}</div>
            <div className="cdel-list">
              {others.map(x => (
                <button key={x} type="button" className="cdel-row" data-to={x} onClick={() => onRun(s.k, x)}>
                  <CategoryTile cat={categories[x]} radius={16} as="span" />
                  <span>{categories[x].name}</span>
                </button>
              ))}
            </div>
            <button
              type="button"
              className="pbtn cdel-back"
              onClick={() => {
                hp('light');
                setView('main');
              }}
            >
              {L('Назад')}
            </button>
          </>
        )}
      </Squircle>
    </div>
  );
};
