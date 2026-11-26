import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Squircle, squirclePath } from '../ui/Squircle';
import { catTint } from '../ui/CategoryTile';
import { IconPickerSheet } from './IconPickerSheet';
import { usePullToClose } from '../../hooks/usePullToClose';
import { useSheetPresence } from '../../hooks/useSheetPresence';
import { useAppStore } from '../../store/useAppStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { toast } from '../../store/useToastStore';
import { haptic } from '../../services/telegram';
import { ICONS, ICONSET } from '../../assets/icons';
import { CAT_PAL } from '../../lib/catData';
import { catFreeColor, saveCategory } from '../../lib/categories';
import { cleanAmountInput, parseAmount } from '../../lib/payments';
import { symOf } from '../../lib/balance';
import { L } from '../../i18n';
import { CategoryType } from '../../types/fin';

/* Шит редактора категории: название, цвет, иконка или эмодзи. Удаление отдаёт наверх (там диалог переноса). */

const CLOSE_PATH = 'M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z';
const SHAKE = [{ translate: '0' }, { translate: '-8px' }, { translate: '8px' }, { translate: '-4px' }, { translate: '0' }];

export interface EditTarget {
  k: string | null;
  type: CategoryType;
}

interface Props {
  target: EditTarget | null;
  onClose: () => void;
  onDelete: (k: string) => void;
  onSaved?: (k: string) => void;
}

export const CategoryEditorSheet: React.FC<Props> = ({ target, onClose, onDelete, onSaved }) => {
  const open = !!target;
  const hapticOn = useSettingsStore(s => s.haptic);
  const theme = useSettingsStore(s => s.effectiveTheme);
  useSettingsStore(s => s.lang);
  const categories = useAppStore(s => s.categories);
  const hp = useCallback((k: Parameters<typeof haptic>[0]) => haptic(k, hapticOn), [hapticOn]);
  const { rendered, show, height, kb, oy } = useSheetPresence(open, () => hp('light'));

  const [name, setName] = useState('');
  const [color, setColor] = useState(CAT_PAL[0]);
  const [kind, setKind] = useState<'icon' | 'emoji'>('icon');
  const [icon, setIcon] = useState('');
  const [emoji, setEmoji] = useState('');
  const [limit, setLimit] = useState('');
  const [pickOpen, setPickOpen] = useState(false);
  const last = useRef<EditTarget | null>(target);
  if (target) last.current = target;
  const cur = last.current;

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLLabelElement>(null);
  const caretRef = useRef<HTMLElement>(null);
  const mirRef = useRef<HTMLSpanElement>(null);
  const pickRef = useRef<HTMLButtonElement>(null);
  const prevRef = useRef<HTMLElement | null>(null);
  const [focused, setFocused] = useState(false);

  const close = useCallback(() => {
    if (document.activeElement === inputRef.current) inputRef.current?.blur();
    setPickOpen(false);
    onClose();
  }, [onClose]);
  const { panelRef } = usePullToClose({ onClose: close, enabled: open && !pickOpen, scrollRef });

  /* при открытии заполняем черновик из категории (или новый со свободным цветом) */
  useEffect(() => {
    if (!target) return;
    const c = target.k ? useAppStore.getState().categories[target.k] : null;
    setName(c ? c.name : '');
    setColor(c ? c.color : catFreeColor());
    setIcon(c ? c.icon || '' : '');
    setEmoji(c ? c.emoji || '' : '');
    setKind(c && c.emoji ? 'emoji' : 'icon');
    const lv = target.k ? useAppStore.getState().budgets[target.k] : 0;
    setLimit(lv ? String(lv).replace('.', ',') : '');
    setPickOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target && target.k, !!target]);

  const hasGlyph = kind === 'emoji' ? !!emoji : !!icon;
  const base = useSettingsStore(s => s.base);
  const isExpense = (cur && cur.k && categories[cur.k] ? categories[cur.k].type : cur ? cur.type : 'expense') === 'expense';

  /* своя каретка: стартует слева от подсказки и мигает */
  const placeCaret = useCallback((restart?: boolean) => {
    const inp = inputRef.current;
    const car = caretRef.current;
    const mir = mirRef.current;
    if (!inp || !car || !mir) return;
    const W = inp.clientWidth;
    const t = inp.value;
    let x: number;
    if (!t) {
      mir.textContent = inp.placeholder;
      x = (W - mir.offsetWidth) / 2 - 4;
    } else {
      mir.textContent = t;
      const full = mir.offsetWidth;
      const pos = inp.selectionStart == null ? t.length : inp.selectionStart;
      mir.textContent = t.slice(0, pos);
      x = (W - full) / 2 + mir.offsetWidth;
    }
    car.style.left = Math.round(x) + 'px';
    if (restart) {
      car.style.animation = 'none';
      void car.offsetWidth;
      car.style.animation = '';
    }
  }, []);

  useLayoutEffect(() => {
    if (rendered) placeCaret(false);
  }, [name, rendered, placeCaret]);

  useEffect(() => {
    if (!focused) return;
    const f = () => placeCaret(true);
    document.addEventListener('selectionchange', f);
    return () => document.removeEventListener('selectionchange', f);
  }, [focused, placeCaret]);

  /* превью слегка подпрыгивает при смене цвета и иконки */
  const firstPrev = useRef(true);
  useEffect(() => {
    if (firstPrev.current) {
      firstPrev.current = false;
      return;
    }
    const p = prevRef.current;
    if (p && p.animate) p.animate([{ scale: '.86' }, { scale: '1' }], { duration: 320, easing: 'cubic-bezier(.3, 1.6, .5, 1)' });
  }, [color, icon, emoji, kind]);

  const used: Record<string, 1> = {};
  Object.keys(categories).forEach(k => {
    if (k !== (cur && cur.k)) used[categories[k].color] = 1;
  });

  const save = () => {
    const nm = name.replace(/[<>&"]/g, '').trim();
    if (!nm) {
      hp('error');
      toast('Введи название');
      boxRef.current?.animate && boxRef.current.animate(SHAKE, { duration: 300 });
      return;
    }
    if (!hasGlyph) {
      hp('error');
      toast('Выбери иконку');
      pickRef.current?.animate && pickRef.current.animate(SHAKE, { duration: 300 });
      return;
    }
    const isNew = !(cur && cur.k);
    const k = saveCategory({ k: cur ? cur.k : null, type: cur ? cur.type : 'expense', name: nm, color, kind, icon, emoji });
    if (isExpense) useAppStore.getState().setBudget(k, parseAmount(limit));
    hp('success');
    toast(isNew ? 'Категория создана' : 'Категория изменена');
    close();
    if (onSaved) onSaved(k);
  };

  if (!rendered || !cur) return null;

  const g = kind === 'emoji' ? <span className="emo">{emoji}</span> : <svg viewBox="0 0 24 24" dangerouslySetInnerHTML={{ __html: ICONS[icon] || ICONSET[icon] || ICONSET.star || '' }} />;

  return (
    <>
      <div
        className={'detail cs' + (show ? ' show' : '')}
        id="ce"
        aria-hidden={!show}
        style={{ height: height ? height + 'px' : undefined, ['--kb' as string]: kb + 'px', transform: oy ? 'translateY(' + oy + 'px)' : undefined }}
        onKeyDown={e => {
          if (e.key === 'Enter' && (e.target as HTMLElement).tagName === 'INPUT') (e.target as HTMLElement).blur();
        }}
      >
        <div className="detail-dim" id="ce-dim" onClick={close} />
        <Squircle r="32 32 0 0" className="detail-panel ce-panel" id="ce-panel" ref={panelRef as any}>
          <div className="ce-scroll" id="ce-scroll" ref={scrollRef}>
            <div className="d-grab" />
            <div className="d-top">
              <span className="d-spacer" />
              <div className="d-top-title">{L(cur.k ? 'Изменить категорию' : 'Новая категория')}</div>
              <button
                className="rb"
                type="button"
                id="ce-close"
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
            <div className="ce-hero">
              <button
                ref={pickRef}
                type="button"
                className="ce-pick"
                id="ce-pick"
                aria-label={L('Выбор иконки')}
                onClick={() => {
                  hp('light');
                  if (document.activeElement === inputRef.current) inputRef.current?.blur();
                  setPickOpen(true);
                }}
              >
                {hasGlyph ? (
                  <Squircle
                    ref={prevRef as any}
                    r={28}
                    className="tile cc big ce-prev"
                    id="ce-prev"
                    style={{ ['--fill' as string]: catTint(color, theme), color } as React.CSSProperties}
                  >
                    {g}
                  </Squircle>
                ) : (
                  <div className="ce-empty ce-prev" id="ce-prev" ref={prevRef as any}>
                    <svg className="dash" viewBox="0 0 96 96">
                      <path transform="translate(1 1)" d={squirclePath(94, 94, [28, 28, 28, 28])} />
                    </svg>
                    <svg className="plus" viewBox="0 0 24 24">
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                  </div>
                )}
              </button>
            </div>
            <label className={'ce-name' + (focused ? ' f' : '')} ref={boxRef}>
              <input
                ref={inputRef}
                id="ce-n"
                type="text"
                maxLength={24}
                autoComplete="off"
                enterKeyHint="done"
                placeholder={L('Название')}
                value={name}
                onChange={e => {
                  setName(e.target.value);
                  requestAnimationFrame(() => placeCaret(true));
                }}
                onFocus={() => {
                  setFocused(true);
                  placeCaret(true);
                }}
                onBlur={() => setFocused(false)}
              />
              <i className="ce-caret" ref={caretRef as any} />
              <span className="ce-mir" ref={mirRef} aria-hidden="true" />
            </label>
            <div className="ce-pal" id="ce-pal">
              {CAT_PAL.map(c => (
                <button
                  key={c}
                  type="button"
                  className={'ce-col' + (c === color ? ' on' : '') + (used[c] ? ' used' : '')}
                  data-col={c}
                  style={{ background: c }}
                  aria-label={c}
                  onClick={() => {
                    hp('select');
                    setColor(c);
                  }}
                />
              ))}
            </div>
            {isExpense && (
              <Squircle r={16} className="ce-lim">
                <span>{L('Лимит в месяц')}</span>
                <input
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  enterKeyHint="done"
                  maxLength={9}
                  placeholder={L('Без лимита')}
                  value={limit}
                  onChange={e => setLimit(cleanAmountInput(e.target.value))}
                />
                <em>{symOf(base)}</em>
              </Squircle>
            )}
          </div>
          <div className="ce-foot" id="ce-foot">
            {cur.k && (
              <button
                className="pbtn danger"
                type="button"
                id="ce-del"
                onClick={() => {
                  hp('light');
                  onDelete(cur.k as string);
                }}
              >
                <span>{L('Удалить')}</span>
              </button>
            )}
            <button className="pbtn primary" type="button" id="ce-save" onClick={save}>
              {L(cur.k ? 'Сохранить' : 'Создать')}
            </button>
          </div>
        </Squircle>
      </div>
      <IconPickerSheet
        open={pickOpen}
        onClose={() => setPickOpen(false)}
        kind={kind}
        icon={icon}
        emoji={emoji}
        color={color}
        onPick={(k, v) => {
          if (k === 'emoji') setEmoji(v);
          else setIcon(v);
          setKind(k);
        }}
      />
    </>
  );
};
