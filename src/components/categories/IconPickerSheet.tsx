import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Squircle } from '../ui/Squircle';
import { SegmentedControl } from '../ui/SegmentedControl';
import { catTint } from '../ui/CategoryTile';
import { usePullToClose } from '../../hooks/usePullToClose';
import { useSheetPresence } from '../../hooks/useSheetPresence';
import { useSettingsStore } from '../../store/useSettingsStore';
import { haptic } from '../../services/telegram';
import { ICONSET } from '../../assets/icons';
import { EMOJI_IDX, EMOJI_SECT, ICON_IDX, ICON_SECT, normQ } from '../../lib/catData';
import { L } from '../../i18n';

/* Шит «Выбор иконки»: иконки или эмодзи, поиск на трёх языках. Открывается поверх редактора. */

const CLOSE_PATH = 'M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z';

type Kind = 'icon' | 'emoji';

interface Props {
  open: boolean;
  onClose: () => void;
  kind: Kind;
  icon: string;
  emoji: string;
  color: string;
  onPick: (kind: Kind, value: string) => void;
}

export const IconPickerSheet: React.FC<Props> = ({ open, onClose, kind, icon, emoji, color, onPick }) => {
  const hapticOn = useSettingsStore(s => s.haptic);
  const theme = useSettingsStore(s => s.effectiveTheme);
  useSettingsStore(s => s.lang);
  const hp = useCallback((k: Parameters<typeof haptic>[0]) => haptic(k, hapticOn), [hapticOn]);
  const { rendered, show, height, kb, oy } = useSheetPresence(open);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<Kind>(kind);
  const [q, setQ] = useState('');

  const close = useCallback(() => {
    if (document.activeElement === inputRef.current) inputRef.current?.blur();
    onClose();
  }, [onClose]);
  const { panelRef } = usePullToClose({ onClose: close, enabled: open, scrollRef });

  useEffect(() => {
    if (open) {
      setTab(kind);
      setQ('');
      hp('light');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const emo = tab === 'emoji';
  const grid = useMemo(() => {
    const idx = emo ? EMOJI_IDX : ICON_IDX;
    const sect = emo ? EMOJI_SECT : ICON_SECT;
    const toks = normQ(q).trim().split(/\s+/).filter(Boolean);
    const hit = idx.filter(x => toks.every(t => x.k.indexOf(t) >= 0 || (emo && x.v === t)));
    const seen: Record<string, 1> = {};
    const groups: Array<{ s: number; items: string[] }> = [];
    hit.forEach(x => {
      if (seen[x.v]) return;
      seen[x.v] = 1;
      const g = groups[groups.length - 1];
      if (g && g.s === x.s) g.items.push(x.v);
      else groups.push({ s: x.s, items: [x.v] });
    });
    return { groups, sect };
  }, [emo, q, tab]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [tab]);

  if (!rendered) return null;

  const gridStyle = { ['--c' as string]: color, ['--t' as string]: catTint(color, theme) } as React.CSSProperties;

  return (
    <div
      className={'detail cs' + (show ? ' show' : '')}
      id="cp"
      aria-hidden={!show}
      style={{ height: height ? height + 'px' : undefined, ['--kb' as string]: kb + 'px', transform: oy ? 'translateY(' + oy + 'px)' : undefined, zIndex: 45 }}
    >
      <div className="detail-dim" id="cp-dim" onClick={close} />
      <Squircle r="32 32 0 0" className="detail-panel cp-panel" id="cp-panel" ref={panelRef as any}>
        <div className="d-grab" />
        <div className="d-top">
          <span className="d-spacer" />
          <div className="d-top-title">{L('Выбор иконки')}</div>
          <button
            className="rb"
            type="button"
            id="cp-close"
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
        <div className="cp-head" id="cp-head">
          <SegmentedControl<Kind>
            id="ce-kind"
            className="ce-kind"
            value={tab}
            onChange={setTab}
            options={[
              { value: 'icon', label: L('Иконки') },
              { value: 'emoji', label: L('Эмодзи') },
            ]}
          />
          <Squircle as="label" r={99} className="field ce-q">
            <svg viewBox="0 0 24 24">
              <g fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11.5" cy="11.5" r="9.5" />
                <path strokeLinecap="round" d="M18.5 18.5L22 22" />
              </g>
            </svg>
            <input
              ref={inputRef}
              id="ce-q"
              type="search"
              placeholder={L('Поиск')}
              autoComplete="off"
              enterKeyHint="search"
              value={q}
              onChange={e => setQ(e.target.value)}
            />
          </Squircle>
        </div>
        <div className="cp-scroll" id="cp-scroll" ref={scrollRef}>
          <div className="ce-grid" id="ce-grid" style={gridStyle}>
            {grid.groups.length ? (
              grid.groups.map((g, gi) => (
                <React.Fragment key={g.s + '-' + gi}>
                  <div className="ce-gsec">{L(grid.sect[g.s].ru)}</div>
                  <div className="ce-gr">
                    {g.items.map(v => {
                      const on = emo ? kind === 'emoji' && emoji === v : kind === 'icon' && icon === v;
                      return (
                        <button
                          key={v}
                          type="button"
                          className={'ce-it' + (on ? ' on' : '')}
                          data-v={v}
                          onClick={() => {
                            hp('select');
                            onPick(tab, v);
                            setTimeout(close, 180);
                          }}
                        >
                          {emo ? <span className="emo">{v}</span> : <svg viewBox="0 0 24 24" dangerouslySetInnerHTML={{ __html: ICONSET[v] || '' }} />}
                        </button>
                      );
                    })}
                  </div>
                </React.Fragment>
              ))
            ) : (
              <div className="cva-empty">{L('Ничего не найдено')}</div>
            )}
          </div>
        </div>
      </Squircle>
    </div>
  );
};
