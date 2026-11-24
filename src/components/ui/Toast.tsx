import React from 'react';
import { useToastStore, toast, showUndo } from '../../store/useToastStore';
import { useAppStore } from '../../store/useAppStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { haptic } from '../../services/telegram';
import { Squircle } from './Squircle';
import { L } from '../../i18n';

export { toast, showUndo };
export const showToast = toast;

export const Toast: React.FC = () => {
  const toastText = useToastStore(s => s.toastText);
  const toastVisible = useToastStore(s => s.toastVisible);
  const undoItem = useToastStore(s => s.undoItem);
  const undoVisible = useToastStore(s => s.undoVisible);
  const undoAt = useToastStore(s => s.undoAt);
  const hideUndo = useToastStore(s => s.hideUndo);

  const restoreTransaction = useAppStore(s => s.restoreTransaction);
  const hapticEnabled = useSettingsStore(s => s.haptic);

  const handleUndo = () => {
    if (!undoItem || performance.now() - undoAt < 600) return;
    restoreTransaction(undoItem.index, undoItem.tx);
    haptic('select', hapticEnabled);
    hideUndo();
  };

  return (
    <>
      {undoItem && (
        <Squircle
          r={24}
          className={`undo ${undoVisible ? 'show' : ''}`}
          id="undo"
          role="status"
        >
          <span className="undo-text">{L('Операция удалена')}</span>
          <button type="button" className="undo-btn" id="undo-btn" onClick={handleUndo}>
            {L('Отменить')}
          </button>
        </Squircle>
      )}
      <div className={`toast ${toastVisible ? 'show' : ''}`} id="toast" role="status">
        {toastText}
      </div>
    </>
  );
};
