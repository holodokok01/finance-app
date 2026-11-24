import React from 'react';
import { Squircle } from '../ui/Squircle';
import { CategoryTile } from '../ui/CategoryTile';
import { CHECK, ICON_IN, ICON_OUT } from '../../assets/icons';
import { L } from '../../i18n';
import { Category, CategoryOrder } from '../../types/fin';
import { ListFilter } from '../../lib/filters';

interface Props {
  f: ListFilter;
  categories: Record<string, Category>;
  order: CategoryOrder;
  onType: (t: 'income' | 'expense') => void;
  onCat: (id: string) => void;
}

const Check: React.FC = () => <svg className="fp-check" viewBox="0 0 24 24" dangerouslySetInnerHTML={{ __html: CHECK }} />;

/** Панель «Фильтр»: тип операции и категория. */
export const ListFilterPanel: React.FC<Props> = ({ f, categories, order, onType, onCat }) => {
  const types: Array<['income' | 'expense', string, string]> = [
    ['income', L('Доходы'), ICON_IN],
    ['expense', L('Расходы'), ICON_OUT],
  ];
  const ids = order.expense.concat(order.income);
  return (
    <div id="panel-filter">
      <div className="fp-title">{L('Фильтр')}</div>
      {types.map(([k, label, icon]) => (
        <button key={k} className="fp-row" type="button" aria-pressed={f.type === k} onClick={() => onType(k)}>
          <Squircle as="span" r={16} className="tile">
            <svg viewBox="0 0 24 24" dangerouslySetInnerHTML={{ __html: icon }} />
          </Squircle>
          <span className="row-title">{label}</span>
          <Check />
        </button>
      ))}
      <div className="fp-sep" />
      {ids.map(k => {
        const c = categories[k];
        if (!c) return null;
        return (
          <button key={k} className="fp-row" type="button" aria-pressed={f.cat === k} onClick={() => onCat(k)}>
            <CategoryTile cat={c} radius={16} as="span" />
            <span className="row-title">{c.name}</span>
            <Check />
          </button>
        );
      })}
    </div>
  );
};
