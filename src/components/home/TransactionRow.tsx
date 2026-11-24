import React from 'react';
import { Transaction } from '../../types/fin';
import { useAppStore } from '../../store/useAppStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { symOf, groupThousands } from '../../lib/balance';
import { CategoryTile } from '../ui/CategoryTile';

interface TransactionRowProps {
  tx: Transaction;
  onClick?: (tx: Transaction) => void;
}

const TransactionRowBase: React.FC<TransactionRowProps> = ({ tx, onClick }) => {
  const categories = useAppStore(s => s.categories);
  const base = useSettingsStore(s => s.base);
  const sym = symOf(base);

  const cat = categories[tx.cat];
  const plus = tx.sum > 0;
  const abs = Math.abs(tx.sum);
  const a = Math.round(abs * 100);
  const c = a % 100;
  const formattedAmount =
    groupThousands(Math.floor(a / 100)) + (c ? ',' + ('0' + c).slice(-2) : '') + '\u00a0' + sym;

  return (
    <div
      className="row"
      data-id={tx.id}
      onClick={() => onClick?.(tx)}
    >
      <CategoryTile cat={cat} radius={16} as="div" />
      <div className="row-main">
        <div className="row-title">{cat?.name || tx.cat}</div>
        <div className="row-sub">{tx.t}</div>
      </div>
      <div className={`row-amount ${plus ? 'plus' : ''}`}>
        {plus ? '+' : '−'}
        {formattedAmount}
      </div>
    </div>
  );
};

// onClick is a thin setter in every caller, so re-render only when the transaction itself changes
export const TransactionRow = React.memo(TransactionRowBase, (a, b) => a.tx === b.tx);
