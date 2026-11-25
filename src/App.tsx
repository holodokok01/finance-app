import React, { useEffect, useState } from 'react';
import { useSettingsStore } from './store/useSettingsStore';
import { useAppStore } from './store/useAppStore';
import { useRatesStore } from './store/useRatesStore';
import { initTelegramSdk } from './services/telegram';
import { AppLayout } from './components/layout/AppLayout';
import { HomeScreen } from './components/home/HomeScreen';
import { AddTransactionSheet } from './components/home/AddTransactionSheet';
import { FullListSheet } from './components/home/FullListSheet';
import { TransactionDetailSheet } from './components/home/TransactionDetailSheet';
import { PaymentsSheet } from './components/home/PaymentsSheet';
import { PaymentEditorSheet } from './components/home/PaymentEditorSheet';
import { Transaction, RecurringPayment } from './types/fin';
import { SectionVariantSwitch } from './components/ui/SectionVariantSwitch';

export const App: React.FC = () => {
  const themeApply = useSettingsStore(s => s.themeApply);
  const loadStorage = useAppStore(s => s.loadStorage);
  const cloudLoad = useAppStore(s => s.cloudLoad);
  const loadRates = useRatesStore(s => s.loadRates);

  const [addOpen, setAddOpen] = useState(false);
  const [addType, setAddType] = useState<'expense' | 'income'>('expense');
  const [editTx, setEditTx] = useState<Transaction | null>(null);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [listOpen, setListOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [payEdit, setPayEdit] = useState<{ id: string | null } | null>(null);

  useEffect(() => {
    themeApply();
    loadStorage();
    loadRates();

    // Возврат в приложение из фона: курс обновится, если кэш старше 12 часов
    const onVisible = () => {
      if (document.visibilityState === 'visible') loadRates();
    };
    document.addEventListener('visibilitychange', onVisible);

    initTelegramSdk((tg) => {
      themeApply();
      cloudLoad();
      tg.onEvent('themeChanged', () => {
        themeApply();
      });
    });

    // Expose openAdd for external scripts / tests
    (window as any).openAdd = (type: 'expense' | 'income' = 'expense', tx?: Transaction) => {
      setAddType(type);
      setEditTx(tx || null);
      setAddOpen(true);
    };
  }, []);

  const handleOpenAdd = (type: 'expense' | 'income') => {
    setAddType(type);
    setEditTx(null);
    setAddOpen(true);
  };

  const handleSelectTransaction = (tx: Transaction) => {
    setDetailId(tx.id);
  };

  const handleEditFromDetail = (tx: Transaction) => {
    setAddType(tx.sum > 0 ? 'income' : 'expense');
    setEditTx(tx);
    setAddOpen(true);
  };

  return (
    <>
      <SectionVariantSwitch />
      <AppLayout>
        <HomeScreen
          onAddClick={handleOpenAdd}
          onSelectTransaction={handleSelectTransaction}
          onOpenOperations={() => setListOpen(true)}
          onOpenPayments={() => setPayOpen(true)}
          onSelectPayment={(p: RecurringPayment) => setPayEdit({ id: p.id })}
        />
      </AppLayout>
      <FullListSheet
        open={listOpen}
        onClose={() => setListOpen(false)}
        onSelectTransaction={handleSelectTransaction}
      />
      <PaymentsSheet open={payOpen} onClose={() => setPayOpen(false)} onEdit={id => setPayEdit({ id })} />
      <PaymentEditorSheet target={payEdit} onClose={() => setPayEdit(null)} />
      <TransactionDetailSheet
        txId={detailId}
        onClose={() => setDetailId(null)}
        onEdit={handleEditFromDetail}
      />
      <AddTransactionSheet
        isOpen={addOpen}
        onClose={() => {
          setAddOpen(false);
          setEditTx(null);
        }}
        initialType={addType}
        editTransaction={editTx}
      />
    </>
  );
};
