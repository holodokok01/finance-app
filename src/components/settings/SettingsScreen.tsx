import React, { useCallback, useRef, useState } from 'react';
import { Squircle } from '../ui/Squircle';
import { SegmentedControl } from '../ui/SegmentedControl';
import { ConfirmDialog, ConfirmSpec } from '../ui/ConfirmDialog';
import { AddCurrencySheet } from '../converter/AddCurrencySheet';
import { LanguageSheet } from './LanguageSheet';
import { useAppStore } from '../../store/useAppStore';
import { useRatesStore } from '../../store/useRatesStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { toast } from '../../store/useToastStore';
import { haptic } from '../../services/telegram';
import { symOf } from '../../lib/balance';
import { buildCsv, importCsv, ymdOf } from '../../lib/csv';
import { cvFmt } from '../../lib/converter';
import { refreshTopColor } from '../../lib/topColor';
import { I18N, L, LANG_CODE, MONTHS_SHORT_L, plural } from '../../i18n';
import { LangCode, ThemeSetting } from '../../types/settings';
import * as IC from './settingsIcons';

/* Экран «Настройки»: учёт, данные, приложение. Логика как в legacy. */

const r2 = (v: number) => Math.round(v * 100) / 100;

const Chev: React.FC = () => <svg className="set-chev" viewBox="0 0 24 24" dangerouslySetInnerHTML={{ __html: IC.SET_CHEV }} />;

const Ic: React.FC<{ color: string; svg: string }> = ({ color, svg }) => (
  <Squircle as="span" r={10} className="set-ic" style={{ ['--fill' as string]: color }}>
    <svg viewBox="0 0 24 24" dangerouslySetInnerHTML={{ __html: svg }} />
  </Squircle>
);

const Svg: React.FC<{ svg: string }> = ({ svg }) => <svg viewBox="0 0 24 24" dangerouslySetInnerHTML={{ __html: svg }} />;

interface Props {
  onOpenPayments: () => void;
  onOpenCategories: () => void;
}

export const SettingsScreen: React.FC<Props> = ({ onOpenPayments, onOpenCategories }) => {
  const base = useSettingsStore(s => s.base);
  const lang = (useSettingsStore(s => s.lang) || 'ru') as LangCode;
  const theme = (useSettingsStore(s => s.theme) || 'system') as ThemeSetting;
  const hapticOn = useSettingsStore(s => s.haptic);
  const rates = useRatesStore(s => s.r);
  const live = useRatesStore(s => s.live);
  const ratesDate = useRatesStore(s => s.date);
  const demoCount = useAppStore(s => s.transactions.filter(t => t.demo).length);
  const payCount = useAppStore(s => s.payments.length);

  const [baseOpen, setBaseOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [dlg, setDlg] = useState<ConfirmSpec | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const hp = useCallback((k: Parameters<typeof haptic>[0]) => haptic(k, useSettingsStore.getState().haptic), []);

  const rxDate = () => {
    if (!ratesDate) return '';
    const p = ratesDate.split('-');
    return +p[2] + ' ' + MONTHS_SHORT_L[lang][+p[1] - 1];
  };
  const rateSrc = live ? L('курс на {d}', { d: rxDate() }) : L('примерный курс');

  const sym = symOf(base);

  /* смена основной валюты: все суммы и стартовый баланс пересчитываются по текущему курсу */
  const changeBase = (c: string) => {
    const st = useSettingsStore.getState();
    const rx = useRatesStore.getState().r;
    const k = (rx[c] || 1) / (rx[st.base] || 1);
    const app = useAppStore.getState();
    const opening = r2(app.opening * k);
    useAppStore.setState({
      transactions: app.transactions.map(t => ({ ...t, sum: r2(t.sum * k) })),
      payments: app.payments.map(p => ({ ...p, sum: r2(p.sum * k) })),
      opening,
      base: c,
    });
    st.setOpening(opening);
    st.setBase(c);
    useAppStore.getState().saveNow();
    toast(L('Учёт теперь в {c}', { c }));
  };

  const pickBase = (c: string) => {
    if (c === base) {
      setBaseOpen(false);
      return;
    }
    hp('select');
    const k = (rates[c] || 1) / (rates[base] || 1);
    setDlg({
      title: L('Вести учёт в {c}?', { c }),
      text: L('Все суммы, включая прошлые операции и баланс, пересчитаются по {r}: 1 {a} = {b} {z}.', {
        r: live ? L('курсу на {d}', { d: rxDate() }) : L('примерному курсу'),
        a: sym,
        b: cvFmt(k),
        z: symOf(c),
      }),
      ok: 'Пересчитать',
      onOk: () => {
        changeBase(c);
        setBaseOpen(false);
      },
    });
  };

  const onTheme = (v: ThemeSetting) => {
    useSettingsStore.getState().setTheme(v);
    requestAnimationFrame(refreshTopColor);
  };

  const onHaptic = () => {
    const next = !hapticOn;
    useSettingsStore.getState().setHaptic(next);
    haptic('light', next);
  };

  const onDemo = () => {
    const n = demoCount;
    setDlg({
      title: 'Убрать демо-историю?',
      text: L('Удалятся {n} {w} за прошлые месяцы. Твои операции останутся.', {
        n,
        w: plural(n, 'сгенерированная операция', 'сгенерированные операции', 'сгенерированных операций'),
      }),
      ok: 'Убрать',
      danger: true,
      onOk: () => {
        useAppStore.getState().removeDemoHistory();
        useSettingsStore.getState().setDemoOff(true);
        useAppStore.getState().saveNow();
        toast('Демо-история убрана');
      },
    });
  };

  const onClear = () => {
    setDlg({
      title: 'Очистить все данные?',
      text: L('Удалятся все операции на этом устройстве и в облаке Telegram, баланс станет 0. Отменить это нельзя.'),
      ok: 'Очистить',
      danger: true,
      onOk: () =>
        setDlg({
          title: 'Точно очистить?',
          text: L('Последнее подтверждение. Если нужна копия, сначала сделай экспорт в CSV.'),
          ok: 'Да, очистить',
          danger: true,
          onOk: () => {
            useAppStore.getState().clearAllData();
            const st = useSettingsStore.getState();
            st.setOpening(0);
            st.setDemoOff(true);
            useAppStore.getState().saveNow();
            toast('Все данные удалены');
          },
        }),
    });
  };

  const copyText = (text: string, n: number) => {
    const fail = () => toast('Не получилось сохранить файл здесь');
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(
          () => toast(L('CSV скопирован: {n} {w}', { n, w: plural(n, 'операция', 'операции', 'операций') })),
          fail
        );
        return;
      }
    } catch (e) {}
    fail();
  };

  /* экспорт: файл через «Поделиться», если устройство умеет, иначе текст в буфер */
  const onExport = () => {
    const app = useAppStore.getState();
    const c = buildCsv(app.transactions, app.categories, base, lang);
    if (!c.n) {
      toast('Пока нет операций для экспорта');
      hp('error');
      return;
    }
    const name = 'finance-' + ymdOf(app.todayMidnight) + '.csv';
    let file: File | null = null;
    try {
      file = new File([c.text], name, { type: 'text/csv' });
    } catch (e) {}
    if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
      navigator.share({ files: [file], title: name }).then(
        () => hp('success'),
        err => {
          if (!err || err.name !== 'AbortError') copyText(c.text, c.n);
        }
      );
      return;
    }
    copyText(c.text, c.n);
  };

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const rd = new FileReader();
    rd.onload = () => {
      const app = useAppStore.getState();
      const { added, skipped } = importCsv(String(rd.result || ''), {
        transactions: app.transactions,
        categories: app.categories,
        base,
        rates: useRatesStore.getState().r,
        today: app.todayMidnight,
        i18nUk: I18N.uk,
        i18nEn: I18N.en,
      });
      const n = added.length;
      if (n) {
        const list = [...app.transactions, ...added];
        list.sort((a, b) => a.d - b.d || (a.t < b.t ? 1 : a.t > b.t ? -1 : b.id - a.id));
        useAppStore.setState({ transactions: list });
        useAppStore.getState().saveNow();
        hp('success');
        toast(
          L('Добавлено {n} {w}', { n, w: plural(n, 'операция', 'операции', 'операций') }) +
            (skipped ? L(', пропущено {n}', { n: skipped }) : '')
        );
      } else {
        hp('error');
        toast(skipped ? L('Новых операций нет, пропущено {n}', { n: skipped }) : 'В файле не нашлось операций');
      }
    };
    rd.readAsText(f);
  };

  return (
    <div className="set-screen">
      <div className="scr-head">
        <h1 className="scr-title">{L('Настройки')}</h1>
      </div>

      <div className="set-sec">{L('Учёт')}</div>
      <Squircle r={28} className="ops-card set-card">
        <button type="button" className="set-row" id="set-base" onClick={() => { hp('light'); setBaseOpen(true); }}>
          <Ic color="#0a84ff" svg={IC.SET_IC_BASE} />
          <span className="set-k">{L('Основная валюта')}</span>
          <span className="set-v">{base + (sym !== base ? ' ' + sym : '')}</span>
          <Chev />
        </button>
        <button type="button" className="set-row" id="set-cats" onClick={() => { hp('light'); onOpenCategories(); }}>
          <Ic color="#ff375f" svg={IC.SET_IC_CATS} />
          <span className="set-k">{L('Категории')}</span>
          <Chev />
        </button>
        <button type="button" className="set-row" id="set-pay" onClick={() => { hp('light'); onOpenPayments(); }}>
          <Ic color="#40c8e0" svg={IC.SET_IC_PAY} />
          <span className="set-k">{L('Обязательные платежи')}</span>
          <span className="set-v">{payCount ? String(payCount) : ''}</span>
          <Chev />
        </button>
      </Squircle>

      <div className="set-sec">{L('Данные')}</div>
      <Squircle r={28} className="ops-card set-card">
        <button type="button" className="set-row" id="set-export" onClick={() => { hp('light'); onExport(); }}>
          <Ic color="#30d158" svg={IC.SET_IC_EXPORT} />
          <span className="set-k">{L('Экспорт в CSV')}</span>
          <Chev />
        </button>
        <button
          type="button"
          className="set-row"
          id="set-import"
          onClick={() => {
            hp('light');
            const f = fileRef.current;
            if (f) {
              f.value = '';
              f.click();
            }
          }}
        >
          <Ic color="#5e5ce6" svg={IC.SET_IC_IMPORT} />
          <span className="set-k">{L('Импорт из CSV')}</span>
          <Chev />
        </button>
        <button type="button" className="set-row" id="set-demo" hidden={!demoCount} onClick={() => { hp('light'); onDemo(); }}>
          <Ic color="#ff9f0a" svg={IC.SET_IC_DEMO} />
          <span className="set-k">{L('Демо-история')}</span>
          <span className="set-v">{demoCount ? String(demoCount) : ''}</span>
          <Chev />
        </button>
        <button type="button" className="set-row danger" id="set-clear" onClick={onClear}>
          <Ic color="#ff453a" svg={IC.SET_IC_CLEAR} />
          <span className="set-k">{L('Очистить все данные')}</span>
        </button>
      </Squircle>

      <div className="set-sec">{L('Приложение')}</div>
      <Squircle r={28} className="ops-card set-card">
        <div className="set-row set-row-seg" id="set-theme">
          <Ic color="#ff375f" svg={IC.SET_IC_THEME} />
          <span className="set-k">{L('Тема')}</span>
          <SegmentedControl<ThemeSetting>
            id="set-theme-seg"
            value={theme}
            onChange={onTheme}
            options={[
              { value: 'system', ariaLabel: L('Системная'), icon: <Svg svg={IC.SET_TH_SYSTEM} /> },
              { value: 'dark', ariaLabel: L('Тёмная'), icon: <Svg svg={IC.SET_TH_DARK} /> },
              { value: 'light', ariaLabel: L('Светлая'), icon: <Svg svg={IC.SET_TH_LIGHT} /> },
            ]}
          />
        </div>
        <button type="button" className="set-row" id="set-lang" onClick={() => { hp('light'); setLangOpen(true); }}>
          <Ic color="#32ade6" svg={IC.SET_IC_LANG} />
          <span className="set-k">{L('Язык')}</span>
          <span className="set-v">{LANG_CODE[lang]}</span>
          <Chev />
        </button>
        <button type="button" className="set-row" id="set-haptic" onClick={onHaptic}>
          <Ic color="#bf5af2" svg={IC.SET_IC_HAPTIC} />
          <span className="set-k">{L('Вибрация')}</span>
          <span className="tsw" role="switch" aria-checked={hapticOn}>
            <i />
          </span>
        </button>
      </Squircle>

      <div className="set-foot">{L('Финансы 1.0 · {r}', { r: rateSrc })}</div>
      <input ref={fileRef} type="file" accept=".csv,text/csv,text/plain" hidden onChange={onFile} />

      <AddCurrencySheet
        open={baseOpen}
        onClose={() => setBaseOpen(false)}
        codes={Object.keys(rates)}
        selected={[base]}
        onToggle={pickBase}
        title="Основная валюта"
      />
      <LanguageSheet open={langOpen} onClose={() => setLangOpen(false)} />
      <ConfirmDialog spec={dlg} onClose={() => setDlg(null)} />
    </div>
  );
};
