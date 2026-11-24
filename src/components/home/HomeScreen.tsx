import React from 'react';
import { useAppStore } from '../../store/useAppStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { useRatesStore } from '../../store/useRatesStore';
import { toast } from '../../store/useToastStore';
import { haptic } from '../../services/telegram';
import { Squircle } from '../ui/Squircle';
import { Flag } from '../ui/Flag';
import { TransactionRow } from './TransactionRow';
import { PaymentRow } from './PaymentRow';
import { formatBalanceParts, calcTotals30Days, groupThousands, symOf, formatCurrency } from '../../lib/balance';
import { calcFreeBalance } from '../../lib/payments';
import { L, MONTHS_SHORT_L } from '../../i18n';
import { Transaction, RecurringPayment } from '../../types/fin';

const FX_NAMES: Record<string, string> = {
  USD: 'Доллары',
  EUR: 'Евро',
  UAH: 'Гривны',
};

interface HomeScreenProps {
  onSelectTransaction?: (tx: Transaction) => void;
  onOpenOperations?: () => void;
  onSelectPayment?: (p: RecurringPayment) => void;
  onOpenPayments?: () => void;
  onAddClick?: (type: 'expense' | 'income') => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  onSelectTransaction,
  onOpenOperations,
  onSelectPayment,
  onOpenPayments,
  onAddClick,
}) => {
  const transactions = useAppStore(s => s.transactions);
  const payments = useAppStore(s => s.payments);
  const todayMidnight = useAppStore(s => s.todayMidnight);
  const balanceVal = useAppStore(s => s.balance());

  const base = useSettingsStore(s => s.base);
  const lang = useSettingsStore(s => s.lang) || 'ru';
  const hapticEnabled = useSettingsStore(s => s.haptic);

  const ratesLive = useRatesStore(s => s.live);
  const ratesDate = useRatesStore(s => s.date);
  const ratesR = useRatesStore(s => s.r);

  const sym = symOf(base);
  const balParts = formatBalanceParts(balanceVal, base);
  const totals30 = calcTotals30Days(transactions, todayMidnight);
  const hasPayments = payments.length > 0;
  const freeBal = hasPayments ? calcFreeBalance(balanceVal, payments, todayMidnight) : 0;

  const topTransactions = transactions.slice(0, 3);
  const topPayments = payments.slice(0, 3);

  // Currency rates section
  const pair = ['USD', 'EUR', 'UAH'].filter(c => c !== base).slice(0, 2);
  const fromRate = ratesR[base] || 1;

  const rxDate = () => {
    if (!ratesDate) return '';
    const p = ratesDate.split('-');
    const mIdx = +p[1] - 1;
    const mStr = (MONTHS_SHORT_L[lang] || MONTHS_SHORT_L['ru'])[mIdx] || '';
    return +p[2] + ' ' + mStr;
  };

  const ratesSrcText = ratesLive
    ? L('курс на {d}', { d: rxDate() })
    : L('пример курса');

  const handleAction = (act: 'expense' | 'income' | 'scan') => {
    haptic('light', hapticEnabled);
    if (act === 'scan') {
      toast(L('Скан чеков добавим позже'));
      return;
    }
    if (onAddClick) {
      onAddClick(act);
    }
  };

  return (
    <>
      <Squircle as="section" r={32} className="panel" aria-label={L('Баланс')}>
        <div className="balance">
          <div className="balance-label">{L('Общий баланс')}</div>
          <h1 className="balance-amount" id="balance">
            {balParts.sign}
            {balParts.pre}
            {balParts.whole}
            <span className="cents">
              {balParts.cents}
              {balParts.post}
            </span>
          </h1>
          <div className="bal-free" id="bal-free" hidden={!hasPayments}>
            {hasPayments &&
              L('Свободно {v}', {
                v: (freeBal < 0 ? '−' : '') + formatCurrency(Math.abs(freeBal), sym),
              })}
          </div>
        </div>

        <div className="actions">
          <button
            className="action"
            type="button"
            data-act="expense"
            onClick={() => handleAction('expense')}
          >
            <Squircle as="span" r={99} className="action-pill">
              <svg viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  fillRule="evenodd"
                  d="M18.47 13.47a.75.75 0 0 1 1.06 0l2 2a.75.75 0 1 1-1.06 1.06l-.72-.72V20a.75.75 0 0 1-1.5 0v-4.19l-.72.72a.75.75 0 1 1-1.06-1.06z"
                  clipRule="evenodd"
                />
                <path
                  fill="currentColor"
                  d="M10 4h4c3.771 0 5.657 0 6.828 1.172c.844.843 1.08 2.057 1.146 4.078H2.026c.066-2.021.302-3.235 1.146-4.078C4.343 4 6.229 4 10 4"
                />
                <path
                  fill="currentColor"
                  fillRule="evenodd"
                  d="M10 20h4c1.056 0 1.964 0 2.75-.026v-1.738a2.25 2.25 0 0 1-1.341-3.827l2-2a2.25 2.25 0 0 1 3.182 0l1.403 1.403Q22 12.988 22 12q0-.662-.002-1.25H2.002Q1.999 11.338 2 12c0 3.771 0 5.657 1.172 6.828S6.229 20 10 20m-4.75-4a.75.75 0 0 1 .75-.75h4a.75.75 0 0 1 0 1.5H6a.75.75 0 0 1-.75-.75m7.25-.75a.75.75 0 0 0 0 1.5H14a.75.75 0 0 0 0-1.5z"
                  clipRule="evenodd"
                />
              </svg>
            </Squircle>
            <span className="action-label">{L('Расход')}</span>
          </button>

          <button
            className="action"
            type="button"
            data-act="income"
            onClick={() => handleAction('income')}
          >
            <Squircle as="span" r={99} className="action-pill">
              <svg viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  fillRule="evenodd"
                  d="M18.47 20.53a.75.75 0 0 0 1.06 0l2-2a.75.75 0 1 0-1.06-1.06l-.72.72V14a.75.75 0 0 0-1.5 0v4.19l-.72-.72a.75.75 0 1 0-1.06 1.06z"
                  clipRule="evenodd"
                />
                <path
                  fill="currentColor"
                  d="M10 4h4c3.771 0 5.657 0 6.828 1.172c.844.843 1.08 2.057 1.146 4.078H2.026c.066-2.021.302-3.235 1.146-4.078C4.343 4 6.229 4 10 4"
                />
                <path
                  fill="currentColor"
                  fillRule="evenodd"
                  d="M10 20h4c.66 0 1.261 0 1.812-.006l-.403-.403a2.25 2.25 0 0 1 1.341-3.827V14a2.25 2.25 0 0 1 4.5 0v1.764c.224.025.445.083.654.175C22 14.917 22 13.636 22 12q0-.662-.002-1.25H2.002Q1.999 11.338 2 12c0 3.771 0 5.657 1.172 6.828S6.229 20 10 20m-4-4.75a.75.75 0 0 0 0 1.5h4a.75.75 0 0 0 0-1.5zm6.5 0a.75.75 0 0 0 0 1.5H14a.75.75 0 0 0 0-1.5z"
                  clipRule="evenodd"
                />
              </svg>
            </Squircle>
            <span className="action-label">{L('Доход')}</span>
          </button>

          <button
            className="action disabled"
            type="button"
            data-act="scan"
            aria-disabled="true"
            tabIndex={-1}
            onClick={() => handleAction('scan')}
          >
            <Squircle as="span" r={99} className="action-pill">
              <svg viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  fillRule="evenodd"
                  d="M2 12c0-4.714 0-7.071 1.464-8.536C4.93 2 7.286 2 12 2s7.071 0 8.535 1.464C22 4.93 22 7.286 22 12s0 7.071-1.465 8.535C19.072 22 16.714 22 12 22s-7.071 0-8.536-1.465C2 19.072 2 16.714 2 12m8.004-6.248a.75.75 0 1 0-.008-1.5c-1.082.005-1.98.03-2.713.158c-.752.132-1.395.382-1.922.884c-.455.433-.76.872-.925 1.503c-.15.571-.177 1.275-.184 2.197a.75.75 0 1 0 1.5.012c.008-.949.04-1.466.135-1.828c.08-.303.206-.51.509-.798c.242-.23.572-.392 1.145-.492c.592-.104 1.37-.13 2.463-.136m4-1.5a.75.75 0 0 0-.008 1.5c1.093.006 1.871.032 2.463.136c.573.1.903.262 1.145.492c.303.288.43.495.509.798c.095.362.128.879.135 1.828a.75.75 0 0 0 1.5-.012c-.007-.922-.034-1.626-.184-2.197c-.166-.63-.47-1.07-.925-1.503c-.527-.502-1.17-.752-1.922-.884c-.733-.128-1.631-.153-2.713-.158M5 11.25a.75.75 0 1 0 0 1.5h14a.75.75 0 0 0 0-1.5zm.752 3.744a.75.75 0 0 0-1.5.012c.007.923.034 1.626.184 2.197c.166.63.47 1.07.925 1.503c.527.502 1.17.752 1.922.884c.733.128 1.631.153 2.713.158a.75.75 0 0 0 .008-1.5c-1.093-.005-1.871-.032-2.463-.136c-.573-.1-.903-.261-1.145-.492c-.303-.288-.43-.495-.509-.798c-.095-.361-.127-.879-.135-1.828m13.996.012a.75.75 0 1 0-1.5-.012c-.008.95-.04 1.467-.135 1.828c-.08.303-.206.51-.509.798c-.242.23-.572.392-1.145.492c-.592.104-1.37.13-2.463.136a.75.75 0 0 0 .008 1.5c1.082-.005 1.98-.03 2.713-.158c.752-.132 1.395-.382 1.922-.884c.455-.433.76-.872.925-1.503c.15-.571.177-1.274.184-2.197"
                  clipRule="evenodd"
                />
              </svg>
            </Squircle>
            <span className="action-label">{L('Скан')}</span>
          </button>
        </div>

        <div className="stats">
          <Squircle r={28} className="stat">
            <span className="stat-label">{L('Доходы · 30 дн.')}</span>
            <span className="stat-value plus" id="income">
              +{formatCurrency(totals30.income, sym)}
            </span>
          </Squircle>
          <Squircle r={28} className="stat">
            <span className="stat-label">{L('Расходы · 30 дн.')}</span>
            <span className="stat-value" id="expense">
              −{formatCurrency(totals30.expense, sym)}
            </span>
          </Squircle>
        </div>
      </Squircle>

      <section className="ops" aria-label={L('Операции')}>
        <Squircle r={32} className="ops-card" id="ops-card">
          <div className="card-head">
            <h2 className="card-title">{L('Операции')}</h2>
            <Squircle
              as="button"
              r={99}
              type="button"
              className="mini"
              id="open-all"
              onClick={onOpenOperations}
            >
              <span>{L('Все')}</span>
              <svg viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M15.835 11.63L9.205 5.2C8.79 4.799 8 5.042 8 5.57v12.86c0 .528.79.771 1.205.37l6.63-6.43a.5.5 0 0 0 0-.74"
                />
              </svg>
            </Squircle>
          </div>
          <div className="list" id="list">
            <div className="day">
              {topTransactions.map(tx => (
                <TransactionRow
                  key={tx.id}
                  tx={tx}
                  onClick={onSelectTransaction}
                />
              ))}
            </div>
          </div>
        </Squircle>
      </section>

      <section
        className="ops pay-sec"
        id="pay-sec"
        aria-label={L('Платежи')}
        hidden={!hasPayments}
      >
        <Squircle r={32} className="ops-card">
          <div className="card-head">
            <h2 className="card-title">{L('Платежи')}</h2>
            <Squircle
              as="button"
              r={99}
              type="button"
              className="mini"
              id="pay-all"
              onClick={onOpenPayments}
            >
              <span>{L('Все')}</span>
              <svg viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M15.835 11.63L9.205 5.2C8.79 4.799 8 5.042 8 5.57v12.86c0 .528.79.771 1.205.37l6.63-6.43a.5.5 0 0 0 0-.74"
                />
              </svg>
            </Squircle>
          </div>
          <div className="list" id="pay-list">
            {topPayments.map(p => (
              <PaymentRow
                key={p.id}
                payment={p}
                onClick={onSelectPayment}
              />
            ))}
          </div>
        </Squircle>
      </section>

      <section className="ops rates-sec" aria-label={L('Курс')}>
        <Squircle r={32} className="ops-card rates-card">
          <div className="card-head rates-head">
            <h2 className="card-title">{L('Баланс в валютах')}</h2>
            <span className="rates-src" id="rates-src">
              {ratesSrcText}
            </span>
          </div>
          <div className="rates-grid">
            {pair.map((c, i) => {
              const cVal = Math.round((balanceVal / fromRate) * (ratesR[c] || 1));
              const cSym = symOf(c);
              const formatted =
                (cVal < 0 ? '−' : '') + groupThousands(Math.abs(cVal)) + '\u00a0' + cSym;

              return (
                <Squircle key={c} r={24} className="rate">
                  <span className="rate-top">
                    <Flag code={c} className="sm" />
                    <span className="rate-label" id={`fx${i + 1}-name`}>
                      {L(FX_NAMES[c] || c)}
                    </span>
                  </span>
                  <span className="rate-value" id={i === 0 ? 'bal-usd' : 'bal-uah'}>
                    {formatted}
                  </span>
                </Squircle>
              );
            })}
          </div>
        </Squircle>
      </section>
    </>
  );
};
