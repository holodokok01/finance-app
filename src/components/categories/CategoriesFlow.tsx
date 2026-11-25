import React, { useRef, useState } from 'react';
import { CategoriesHandle, CategoriesSheet } from './CategoriesSheet';
import { CategoryEditorSheet, EditTarget } from './CategoryEditorSheet';
import { CategoryDeleteDialog } from './CategoryDeleteDialog';
import { ConfirmDialog, ConfirmSpec } from '../ui/ConfirmDialog';
import { useAppStore } from '../../store/useAppStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { toast } from '../../store/useToastStore';
import { haptic } from '../../services/telegram';
import { catCount, removeCategory } from '../../lib/categories';
import { L } from '../../i18n';

/* Менеджер категорий целиком: список, редактор, выбор иконки и удаление с переносом операций. */

interface Props {
  open: boolean;
  onClose: () => void;
}

export const CategoriesFlow: React.FC<Props> = ({ open, onClose }) => {
  const mgr = useRef<CategoriesHandle>(null);
  const [edit, setEdit] = useState<EditTarget | null>(null);
  const [delK, setDelK] = useState<string | null>(null);
  const [ask, setAsk] = useState<ConfirmSpec | null>(null);
  const editRef = useRef(edit);
  editRef.current = edit;

  const hp = (k: Parameters<typeof haptic>[0]) => haptic(k, useSettingsStore.getState().haptic);

  /* категория уходит: из списка строкой, из редактора сразу; редактор при этом закрывается */
  const run = (k: string, to?: string) => {
    const s = useAppStore.getState();
    const dest = to ? s.categories[to] : null;
    const doIt = () => {
      removeCategory(k, to);
      if (editRef.current && editRef.current.k === k) setEdit(null);
      if (dest) {
        hp('success');
        toast(L('Перенесено в «{c}»', { c: dest.name }));
      } else toast('Категория удалена');
    };
    setDelK(null);
    if (!editRef.current && mgr.current) mgr.current.fly(k, doIt);
    else doIt();
  };

  /* удаление из редактора */
  const deleteFromEditor = (k: string) => {
    const s = useAppStore.getState();
    const c = s.categories[k];
    if (!c) return;
    if ((s.categoryOrder[c.type] || []).length <= 1) {
      hp('error');
      toast('Нужна хотя бы одна категория');
      return;
    }
    if (!catCount(k)) {
      setAsk({
        title: L('Удалить «{c}»?', { c: c.name }),
        text: L('Операций в ней нет.'),
        ok: 'Удалить',
        danger: true,
        onOk: () => run(k),
      });
      return;
    }
    setDelK(k);
  };

  return (
    <>
      <CategoriesSheet
        ref={mgr}
        open={open}
        onClose={onClose}
        onEdit={(k, type) => setEdit({ k, type })}
        onRequestDelete={k => setDelK(k)}
        onDeleteEmpty={k => run(k)}
      />
      <CategoryEditorSheet target={edit} onClose={() => setEdit(null)} onDelete={deleteFromEditor} />
      <CategoryDeleteDialog
        k={delK}
        onCancel={() => {
          setDelK(null);
          mgr.current?.closeRow();
        }}
        onRun={run}
      />
      <ConfirmDialog spec={ask} onClose={() => setAsk(null)} />
    </>
  );
};
