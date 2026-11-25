# Монетка

Личный трекер финансов, Telegram Mini App. Один пользователь, бэкенда нет: данные в localStorage и Telegram CloudStorage.

Сайт: https://holodokok01.github.io/finance-app/

## Стек

React 18, TypeScript, Vite, Zustand. Тесты: Vitest.

## Команды

- `npm install`: поставить зависимости
- `npm run dev`: локальный запуск
- `npm test`: тесты
- `npm run build`: проверка типов и сборка в `dist/`

## Деплой

Пуш в `main` запускает GitHub Actions (`.github/workflows/deploy.yml`): тесты, сборка и публикация на GitHub Pages.

## Структура

- `src/components/`: экраны и шиты (home, stats, converter, settings, categories, layout, ui)
- `src/store/`: Zustand-сторы (операции, настройки, курсы, тосты)
- `src/hooks/`: общие жесты и анимации (свайп строки, закрытие шита, удержание для удаления)
- `src/lib/`: чистая логика (баланс, статистика, CSV, платежи, хранение)
- `src/i18n/`: переводы (uk, ru, en)
- `src/services/`: курсы валют и Telegram
- `tests/unit/`: юнит-тесты

## Хранилище

Ключи localStorage: `set_v1` (настройки), `fin_v1` (операции, категории, платежи), `cv_v1` (конвертер), `rx_v1` (курсы).

## Старая версия

Исходное приложение в одном файле (`legacy/index.html`) удалено из дерева, но осталось в истории git: `git show beb081c:legacy/index.html`.

Контекст проекта и правила работы лежат в `PROJECT_CONTEXT.md`.
