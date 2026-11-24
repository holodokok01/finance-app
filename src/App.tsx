import React, { useEffect, useState } from 'react';
import { useSettingsStore } from './store/useSettingsStore';
import { useAppStore } from './store/useAppStore';
import { useRatesStore } from './store/useRatesStore';
import { initTelegramSdk } from './services/telegram';
import { AppLayout } from './components/layout/AppLayout';
import { HomeScreen } from './components/home/HomeScreen';
import { AddTransactionSheet } from './components/home/AddTransactionSheet';
import { Transaction } from './types/fin';

export const App: React.FC = () => {
  const themeApply = useSettingsStore(s => s.themeApply);
  const loadStorage = useAppStore(s => s.loadStorage);
  const cloudLoad = useAppStore(s => s.cloudLoad);
  const loadRates = useRatesStore(s => s.loadRates);

  const [addOpen, setAddOpen] = useState(false);
  const [addType, setAddType] = useState<'expense' | 'income'>('expense');
  const [editTx, setEditTx] = useState<Transaction | null>(null);

  useEffect(() => {
    themeApply();
    loadStorage();
    loadRates();

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
    // When transaction is clicked, we can open edit for now
    setAddType(tx.sum > 0 ? 'income' : 'expense');
    setEditTx(tx);
    setAddOpen(true);
  };

  return (
    <AppLayout>
      <HomeScreen
        onAddClick={handleOpenAdd}
        onSelectTransaction={handleSelectTransaction}
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
    </AppLayout>
  );
};
