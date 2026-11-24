import React from 'react';
import { RecurringPayment } from '../../types/fin';
import { useAppStore } from '../../store/useAppStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { payDays, payWhen, payAdvance, fmtMoney } from '../../lib/payments';
import { symOf } from '../../lib/balance';
import { CategoryTile } from '../ui/CategoryTile';
import { L } from '../../i18n';
import { haptic } from '../../services/telegram';
import { toast } from '../../store/useToastStore';

interface PaymentRowProps {
  payment: RecurringPayment;
  onClick?: (p: RecurringPayment) => void;
}

export const PaymentRow: React.FC<PaymentRowProps> = ({ payment, onClick }) => {
  const categories = useAppStore(s => s.categories);
  const addTransaction = useAppStore(s => s.addTransaction);
  const updatePayment = useAppStore(s => s.updatePayment);
  const todayMidnight = useAppStore(s => s.todayMidnight);
  const base = useSettingsStore(s => s.base);
  const hapticEnabled = useSettingsStore(s => s.haptic);

  const cat = categories[payment.cat];
  const sym = symOf(base);
  const days = payDays(payment, todayMidnight);
  const due = days <= 0;
  const name = payment.n || cat?.name || payment.cat;
  const sub = payWhen(payment, todayMidnight);

  const formattedSum = fmtMoney(payment.sum, sym);

  const handlePay = (e: React.MouseEvent) => {
    e.stopPropagation();
    const now = new Date();
    const hh = ('0' + now.getHours()).slice(-2) + ':' + ('0' + now.getMinutes()).slice(-2);
    // как в эталоне: операция записывается сегодняшним днём и текущим временем
    addTransaction({
      ts: todayMidnight,
      t: hh,
      cat: payment.cat,
      note: payment.n && payment.n !== (cat ? cat.name : '') ? payment.n : '',
      sum: -payment.sum,
    });
    const clone = { next: payment.next, per: payment.per, day: payment.day };
    payAdvance(clone);
    updatePayment(payment.id, { next: clone.next });
    haptic('success', hapticEnabled);
    toast(L('Записано {v}', { v: '−' + fmtMoney(payment.sum, sym) }));
  };

  return (
    <div
      className="row pay-row"
      data-p={payment.id}
      onClick={() => onClick?.(payment)}
    >
      <CategoryTile cat={cat} radius={16} as="div" />
      <div className="row-main">
        <span className="row-title">{name}</span>
        <span className={`row-sub ${due ? 'warn' : ''}`}>{sub}</span>
      </div>
      {due ? (
        <button type="button" className="pay-btn" onClick={handlePay}>
          {L('Оплатил')}
        </button>
      ) : (
        <span className="row-amount">{formattedSum}</span>
      )}
    </div>
  );
};
