# ТЗ. Единый слой загрузки данных клиента (`era_native`, средний вариант)

Паспорт документа

| Поле | Значение |
|---|---|
| Версия | 1.0 (на согласование) |
| Дата | 2026-10-16 |
| Репозиторий / ветка | `era_native`, база — `master` (7dcc442); работа — ветка `data-layer` |
| Область | только клиент `era_native`: `src/data/**` (новый), `src/services/api.ts`, хуки экранов `src/screens/hooks/**`, точечные правки экранов `src/screens/**` |
| Не входит | бэкенд `eraofchange`, веб-фронт `era_front`, `era_players` |
| Предусловие | серверный контракт API не меняется; тесты `npm run test`, линт `npm run lint` проходят до начала работ |
| Источник требований | вопрос заказчика от 2026-10-16: «как организовано обновление данных с сервера; интересует случай, если данные изменились — как они подгружаются», выбранный из трёх вариантов средний |
| Критерий готовности | (1) Любой экран при возврате на него показывает данные не старше своего TTL, без ручных действий мастера. (2) Справочники (`plant_levels`, `resources`) и цены обновляются сами, пока экран открыт. (3) Ручное обновление доступно всегда. (4) При недоступном сервере мастер видит старые данные и явный признак «нет связи», а не пустой экран. (5) Существующее поведение при игре «Артель» и `vassals-and-robbers` не меняется |

---

## 1. Контекст: что есть сейчас (проверено по коду)

Точка входа одна — singleton axios: `src/services/api.ts:48`, `baseURL` из `src/config.ts`, `timeout: 30000`, Basic Auth на каждый запрос (`src/services/api.ts:67-78`).

Особенность, влияющая на всю работу с данными: response-интерцептор `src/services/api.ts:80-85` на ошибку возвращает `error.response`, то есть промис **резолвится** при HTTP-ошибке. `catch` внутри методов срабатывает только на сетевые сбои (там `error.response === undefined`, и тогда `response.data` кидает `TypeError`). Ответы 500/422/404 уезжают в `setState` как «успех».

Текущие триггеры перезагрузки данных (всего пять):

| № | Триггер | Где | Что перезагружает |
|---|---|---|---|
| 1 | Монтирование экрана | `useMarketScreenLogic.ts:203-302`; `useProcessingScreenLogic.ts:679-688`; `GuildSelectionScreen.tsx:40`; `EnterpriseListScreen.tsx:47`; `NewPlantTypeScreen.tsx:47`; `UpgradeConfirmScreen.tsx:41`; `multiEnterpriseContext.ts:156`; `usePlantProcessingLogic.ts:313-316` | рынок, справочники, списки |
| 2 | Возврат на экран | хуков фокуса нет вообще (поиск `useFocusEffect` и `useIsFocused` по `src` → 0 совпадений) | ничего: нижний экран в stack остаётся смонтированным |
| 3 | Pull-to-refresh | `useProcessingScreenLogic.ts:116-126`, `ProcessingContent.tsx:66` | **только** список гильдий |
| 4 | Кнопка «Обновить цены» | `MarketScreen.tsx:337-345` → `handleRefreshPrices` (`:83-95`) → `handleLoadMarketData` (`useMarketScreenLogic.ts:135-200`) | рынок целиком; кнопка заблокирована, пока `newRelations === false` (`MarketScreen.tsx:340`) |
| 5 | После своей мутации | удаление предприятия `EnterpriseListScreen.tsx:61-70`; upgrade/downgrade `useUpgradeConfirmation.ts:33,48,76,106,110`; регистрация каравана `useMarketScreenLogic.ts:468` | список предприятий, предприятие, вероятности ограбления |

Что происходит, если данные изменились на сервере, сейчас:

- Опрос есть **только на рынке** и только по странам: `setInterval` 30 с (`useMarketScreenLogic.ts:271-279` при монтировании и `:183-192` при перезагрузке) дёргает `/countries/foreign_countries.json`; diff по `prevCountriesRef` (`:314-351`) сравнивает `relations` и `params.embargo` и показывает `Alert`; `newRelations` разблокирует кнопку «Обновить цены». Это паритет с вебом: `era_front/src/views/pages/economics/Exchange.vue:331` (`setInterval(fetchCountries, 30000)`) и ручная кнопка `Exchange.vue:838`.
- Цены, гильдии, предприятия, уровни предприятий, формулы, доступные места — **не опрашиваются вообще**: обновляются только при монтировании экрана или явным действием.
- Смена игрового года/цикла не отслеживается: если уровни и формулы поменялись, открытый экран этого не заметит.
- Кэша данных нет: `AsyncStorage` используется только для IP принтера (`PrinterSettings.ts:8,17`); `CaravanService` — второй in-memory дубль стран и цен (`CaravanService.ts:19-30`), обновляется параллельно со state.
- Режим игры определяется по данным: `isGameArtel = gameConfig.isActive('artel') || countries.length === 0` (`useMarketScreenLogic.ts:104`) — пустой или неудачный ответ по странам переключает рынок в режим «без страны».

Дублирование, которое надо устранить по ходу: логика загрузки рынка написана дважды (`useMarketScreenLogic.ts:135-200` и `:203-302`), причём `handleLoadMarketData` зависит от `pollInterval` (`:200`) и пересоздаётся при каждом перезапуске опроса.

Мёртвый код (фиксируется, но в объём не входит): `ProcessingScreen.tsx` не подключён ни к одному навигатору (`App.tsx:36-53` — только `Settings`, `PlantWorkshop`, `Market`; переход на `Processing` закомментирован в `SettingsScreen.tsx:143-156`), поэтому живой pull-to-refresh из `useProcessingScreenLogic.ts:116` недостижим. Реальная переработка живёт в цехе: `MultiEnterprisesScreen` + `usePlantProcessingLogic`.

---

## 2. Границы этапа

Входит:

- новый модуль слоя данных `src/data/**` (кэш в памяти, TTL, дедупликация запросов, отмена, подписки, глобальный менеджер опроса);
- нормализация ошибок API и правка response-интерцептора (`src/services/api.ts`);
- перевод на слой всех хуков, которые сейчас грузят данные (`useMarketScreenLogic`, `useProcessingScreenLogic`, `usePlantProcessingLogic`, `useGuildManagement`, `useEnterpriseManagement`, `usePlantBuilding`, `useUpgradeConfirmation`, `multiEnterpriseContext`);
- refetch при получении фокуса экраном (`useFocusEffect`) — цех и рынок целиком;
- периодический опрос справочников и цен, пока соответствующий экран в фокусе;
- индикаторы свежести и связи, pull-to-refresh на живых списках, снятие блокировки с кнопки «Обновить цены»;
- проверка и предупреждение, если цены/отношения изменились в момент расчёта каравана;
- определение режима игры по `CONFIG.ACTIVE_GAME` вместо длины списка стран;
- тесты слоя (jest) и ручной чеклист приёмки.

Не входит (согласуется отдельно):

- любые изменения бэкенда: новых эндпоинтов, полей, версий данных, `updated_at` — нет;
- WebSocket/SSE/long-polling;
- офлайн-режим и персистентный кэш (AsyncStorage/MMKV) — данные живого действия, устаревший кэш опаснее его отсутствия;
- автообновление открытой формы расчёта каравана и открытой формы переработки (только предупреждение, решение мастера);
- удаление или подключение `ProcessingScreen` и `useProcessingScreenLogic` (мёртвый код, отдельная задача);
- перенос `era_players` на тот же слой.

---

## 3. Термины

| Термин | Значение в этом документе |
|---|---|
| Ключ (query key) | Идентификатор набора данных, например `['guild', 12, 'plants']`. Строковый вид для логов: `guild:12:plants` |
| Запись кэша | `{ key, data, updatedAt, status, error, fetching, subscribers }` |
| TTL | Время, после которого данные считаются устаревшими и подлежат фоновому обновлению |
| SWR (stale-while-revalidate) | Схема показа: сначала отдаём данные из кэша (даже устаревшие), параллельно обновляем в фоне |
| Refetch-on-focus | Принудительное обновление ключей экрана при получении фокуса (переход вперёд/назад, возврат из штрихкод-флоу) |
| Опрос (polling) | Таймер по ключу, активный только пока хотя бы один подписчик в фокусе |
| Инвалидация | Пометка ключа устаревшим после своей мутации (`invalidate(['guild', 12, 'plants'])`) |
| Свежесть | `isStale = now - updatedAt > TTL`; отображается мастеру как «обновлено N назад» |

---

## 4. Ключевые решения

Каждое решение приведено с отклонёнными альтернативами и причиной отказа.

### Д1. Собственный минимальный слой вместо react-query / SWR

Пишем `src/data` сами: ~250-300 строк ядра. API хука проектируем совместимым с `react-query` (`useQuery(key, fetcher, options)` → `{ data, error, isLoading, isFetching, isStale, updatedAt, refetch }`), чтобы миграция на библиотеку позже была механической.

Отклонённые альтернативы:

- `@tanstack/react-query` — новая зависимость (~15 КБ) и её машинерия (QueryClient, контекст, devtools) на 48 файлов и один экран; ключевое отличие нужно нам ровно одно — TTL + опрос в фокусе. Отказ откладываем, не запрещаем.
- Возврат к `useEffect` + `setInterval` в каждом хуке — это текущее состояние, оно и порождает дублирование (`useMarketScreenLogic.ts:135-200` против `:203-302`) и рассинхрон `CaravanService`.

### Д2. Кэш только в памяти, без персиста

Отклонено: `AsyncStorage`-кэш с TTL. Причина: приложение живого действия, данные меняются мастерами в течение минуты; устаревший кэш после перезапуска приложения опаснее его отсутствия. Исключение сохраняется — `PrinterSettings` (IP принтера) остаётся в `AsyncStorage`, это конфиг, а не данные игры.

### Д3. Показ по схеме stale-while-revalidate

Экран получает кэшированные данные сразу (второй и последующие заходы — без спиннера), обновление идёт в фоне.

Отклонённые альтернативы:

- «Ждать свежих данных, показывать спиннер» (текущее поведение) — теряется скорость на медленной сети игрового полигона, при этом ничего не выигрывается: расчёт всё равно выполняется по данным на момент запроса.
- «Показывать только кэш, обновлять кнопкой» — не решает задачу мастера, который не знает, что данные устарели.

### Д4. Опрос только пока экран в фокусе

Один глобальный менеджер опроса в `queryClient` поднимает таймер на ключ при появлении первого подписчика в фокусе и снимает при уходе последнего. Таймер один на ключ, при ошибках — экспоненциальный backoff до 5 минут, jitter 10 % (несколько планшетов не бьют в сервер одновременно).

Отклонено: фоновый опрос независимо от фокуса. Причина: расход батареи и трафика на планшетах, лишняя нагрузка на бэкенд (тяжёлые `plant_levels.json`/`resources/show_all_resources`), риск гонок при обновлении того же экрана из двух источников.

### Д5. Refetch-on-focus через `useFocusEffect`, обёрнутый в свой хук

Используем `useFocusEffect` из `@react-navigation/native` (уже в зависимостях, v7) внутри нашего хука `useRefetchOnFocus(keys)`. Так делается один слушатель на экран в одном месте.

Отклонено: `navigation.addListener('focus', …)` руками в каждом из семи экранов (дублирование и утечки подписок, как сейчас в байндингах сканера).

### Д6. Режим игры определяется по `CONFIG.ACTIVE_GAME`, а не по данным

Правим `useMarketScreenLogic.ts:104`: `const isGameArtel = gameConfig.isActive('artel')`. Отклонено текущее `|| countries.length === 0`: при сетевом сбое, таймауте или пустом ответе рынок переключается в режим «без страны» и караван регистрируется с `country_id: null` (`MarketScreen.tsx`/`useMarketScreenLogic.ts:546,591`) — то есть неверный режим работы из-за ошибки транспорта. Пустой список стран — это отсутствие данных, а не смена игры; при пустом ответе показываем пустое состояние с признаком «нет связи».

### Д7. Изменения данных на сервере: детектор + предупреждение, а не молчаливое обновление

Сохраняем существующий UX рынка (diff отношений и эмбарго → `Alert`, `useMarketScreenLogic.ts:314-351`) и распространяем тот же приём на цены: если цены изменились, пока форма открыта, показываем предупреждение; перед регистрацией каравана выполняем принудительный refetch цен и, если итоговые цифры разошлись с уже посчитанными, показываем расхождение и требуем повторного расчёта.

Отклонено: молча подменять цены в открытой форме. Причина: мастер уже посчитал караван и показывает игроку цифры; тихая подмена приведёт к расхождению между тем, что показали, и тем, что записалось на сервере.

### Д8. Ошибки: интерцептор отклоняет, опрос не спамит

`src/services/api.ts:80-85` переписывается на отклонение промиса с нормализованной ошибкой `ApiError { kind: 'network'|'timeout'|'http', status?, message, keyPayload? }`. Опрос и refetch-on-focus ошибки не показывают алертом: ставится признак «нет связи» и сохраняются последние успешные данные; `Alert` остаётся только на явные действия мастера (кнопки, создание, улучшение, регистрация каравана).

Отклонено: оставить как есть. Причина: сейчас HTTP-ошибка выглядит как успешный ответ, и часть хуков кладёт `undefined` в state (например `loadGuilds` → `data.sort` падает с `TypeError`).

### Д9. Отмена запросов и защита от гонок

Каждый запрос уходит с `AbortController` (`signal` в axios); при уходе подписчика, смене параметров ключа или новом запросе по тому же ключу предыдущий отменяется. Запись в кэш применяется по принципу «последний стартовавший побеждает» (монотонный счётчик на ключ), а не «последний пришедший».

Отклонено: флаг `cancelled` в замыкании (есть сейчас в `useMarketScreenLogic.ts:204,223,266`) — он не отменяет сеть и не защищает от переупорядочивания ответов при двух параллельных загрузках.

### Д10. Мёртвый экран переработки не трогаем

`ProcessingScreen` + `useProcessingScreenLogic` не подключаются и не удаляются (вне объёма), но pull-to-refresh, который там написан, воспроизводим на живых списках — цех и рынок. Чтобы слой не завязался на мёртвый код, при переводе `useProcessingScreenLogic` на слой он переводится «как есть» (типы и возврат сохраняются), поведение не проверяется вручную.

Разделы, которые в этом ТЗ **не применимы** и почему (чтобы не искать их зря): миграции схемы БД, изменения JSON-параметров `GameParameter`, seeds, модели Rails, rake-задачи, контракт API «какие поля добавить» — потому что серверный контракт этим этапом не меняется ни в одном месте. Единственное ограничение: клиент обязан продолжать работать со старыми ответами без новых полей (например `updated_at`), то есть никакие решения не должны на них опираться.

---

## 5. Архитектура слоя

Новые файлы (все — в `era_native/src/data/`):

| Файл | Ответственность |
|---|---|
| `queryClient.ts` | Хранилище: `Map<key, Entry>`, `get/set/invalidate/remove`, счётчик версий запроса, менеджер опроса (таймеры, backoff, jitter), подписки для `useSyncExternalStore` |
| `useQuery.ts` | Хук: подписка на ключ, запуск fetcher с учётом TTL, SWR-показ, возврат состояния и `refetch` |
| `useRefetchOnFocus.ts` | Обёртка `useFocusEffect` → `queryClient.refetch(keys, { force: true })`, только для переданных ключей |
| `useMutation.ts` | Обёртка над мутацией: вызов API, затем `invalidate(keys)` и/или `set(key, data)` из ответа; единый обработчик ошибок |
| `keys.ts` | Фабрика ключей и их строковых представлений (для логов) |
| `apiErrors.ts` | `ApiError`, `normalizeError`, `isOffline(error)`, хранение времени последней успешной связи |
| `hooks/useGuilds.ts`, `useGuildPlants.ts`, `usePlant.ts`, `usePlantLevels.ts`, `useResources.ts`, `useAvailablePlaces.ts`, `useCountries.ts`, `usePrices.ts`, `useRobberyProbabilities.ts` | Прикладные хуки с зашитыми TTL и интервалами опроса; единственное место, где эти числа заданы |

Правила слоя:

1. Хук не знает про axios: только `key` + `fetcher` из `services/api`.
2. Один ключ — один набор данных. Параметризованные данные включаются в ключ, а не фильтруются из общего списка на клиенте (`['plantLevels', plantTypeId]` вместо фильтра по `response.data.filter(...)` как в `api.ts:122`).
3. TTL и интервал опроса задаются только в прикладных хуках (`hooks/*`), не в экранах.
4. Мутация не перезагружает всё: `invalidate` ровно тех ключей, которые затронуты (после `createPlant` — `guild:<id>:plants` и `availablePlaces`; после `upgradePlant`/`downgradePlant` — `plant:<id>`, `guild:*:plants`, `plantLevels`; после `registerCaravan` — `prices`, `robbery:*`, `countries`).
5. Экран остаётся «глупым»: те же имена полей и функций, что сейчас в возврате хуков, чтобы правки в `src/screens/**` были минимальными.

Предлагаемые параметры (числа — предмет утверждения, см. § 10, вопрос 1):

| Данные | Ключ | TTL | Опрос (только в фокусе) | Refetch-on-focus | Разблокирует кнопку/предупреждение |
|---|---|---|---|---|---|
| Гильдии | `['guilds']` | 60 с | — | да | — |
| Предприятия гильдии | `['guild', id, 'plants']` | 15 с | 30 с на экране списка | да | — |
| Предприятие по id | `['plant', id]` | 0 (всегда свежее) | — | да | — |
| Уровни предприятий (все) | `['plantLevels']` | 300 с | 60 с (цех, переработка) | да | предупреждение при смене формул года |
| Уровни по типу | `['plantLevels', typeId]` | 300 с | — | да | — |
| Ресурсы (номенклатура) | `['resources']` | 300 с | 60 с (цех, переработка) | да | — |
| Доступные места | `['availablePlaces']` | 60 с | — | да | — |
| Страны (отношения, эмбарго) | `['countries']` | 10 с | 30 с (как сейчас) | да | `newRelations` → Alert |
| Цены `show_prices` | `['prices']` | 10 с | 60 с (рынок) | да | Alert «цены изменились» + пересчёт |
| Вероятности ограбления | `['robbery', guildId]` | 30 с | — | да | — |

Индикация мастеру:

- бейдж в хедере: «обновлено 12 с назад» / «нет связи» (данные из `queryClient`), рядом со `ScannerStatusBadge`;
- pull-to-refresh на списках гильдий, предприятий и в цехе переработки;
- кнопка «Обновить цены» активна всегда (снятие гейта `MarketScreen.tsx:340`), по нажатию — `refetch(['prices','countries'], { force: true })`;
- существующие `Alert` об изменении отношений/эмбарго/цен сохраняются.

---

## 6. Изменения по файлам

| Файл | Что делаем |
|---|---|
| `src/data/*` (9 файлов + ядро) | создать |
| `src/services/api.ts` | интерцептор отклоняет (`:80-85`); методы принимают `signal`; `getPlantLevels` не фильтрует весь список на клиенте — либо остаётся как есть (совместимость), либо берёт параметр типа; ошибки — `ApiError` |
| `src/services/CaravanService.ts` | остаётся как есть по API, но становится единственным потребителем `['prices']`/`['countries']` через параметр хука; синхронизация «вручную после setState» (`useMarketScreenLogic.ts:146,150`) уходит |
| `src/screens/hooks/useMarketScreenLogic.ts` | переписать на слой: убрать дубль `:135-200` / `:203-302`, опрос из `:271-279` и `:183-192`, diff из `:314-351` — вынести в отдельный `useMarketWatch.ts`; `isGameArtel` по конфигу (`:104`); кнопка обновления без гейта; проверка цен перед `handleRegisterCaravan` (`:545`) |
| `src/screens/hooks/useMarketWatch.ts` | новый: diff предыдущих/новых стран и цен, формирование `Alert` и флага `newRelations` |
| `src/screens/hooks/usePlantProcessingLogic.ts` | справочники через `usePlantLevels()`/`useResources()`/`useGuilds()`; `loadPlant` — с `['plant', id]` при TTL 0 и отменой предыдущего запроса; `initializedRef`/`guildsRef`-костыли (`:120-135`, `:319-323`) убираются |
| `src/screens/hooks/useGuildManagement.ts`, `useEnterpriseManagement.ts`, `usePlantBuilding.ts`, `useUpgradeConfirmation.ts` | внутри — слой, наружу те же поля и функции; `loadGuilds`/`loadGuildPlants`/`loadAvailablePlaces` теперь `refetch` соответствующих ключей |
| `src/screens/hooks/useProcessingScreenLogic.ts` | перевести на слой без изменения поведения (мёртвый код, но не должен расходиться с архитектурой); pull-to-refresh оставить |
| `src/screens/PlantWorkshopScreens/multiEnterpriseContext.ts` | `useEffect` `:156-166` → `useResources()` |
| `src/screens/PlantWorkshopScreen.tsx` | `handleBarcodeScanned` (`:185-241`): запрос предприятия через слой с `force: true`; после добавления в мультисписок — `invalidate` ключей предприятия |
| `src/screens/PlantWorkshopScreens/GuildSelectionScreen.tsx`, `EnterpriseListScreen.tsx`, `UpgradeConfirmScreen.tsx`, `NewPlantTypeScreen.tsx` | `useEffect`-загрузки (`:40`, `:47`, `:41`, `:47`) заменяются на `useRefetchOnFocus` + подписку хука; добавляется pull-to-refresh на списках |
| `src/screens/PlantWorkshopScreens/MultiEnterprisesScreen.tsx` | подписка на слой для ресурсов; индикатор свежести |
| `src/screens/MarketScreen.tsx` | кнопка «Обновить цены» без гейта (`:340`), индикатор свежести, сообщение о расхождении цен при регистрации каравана |
| `src/screens/components/ProcessingContent.tsx`, `processing/ProcessingMultiContent.tsx` | не меняются по контракту пропсов (кроме `refreshing/onRefresh`, которые уже есть) |
| `src/components/DataFreshnessBadge.tsx` | новый: индикатор «обновлено N назад / нет связи» |
| `__tests__/data/queryClient.test.ts`, `__tests__/data/useQuery.test.tsx` | новые тесты слоя |

Оценка объёма: ядро ~300 строк, прикладные хуки ~250, правки существующих хуков ~450 (сокращение кода из-за удаления дублей), правки экранов ~120, тесты ~200.

---

## 7. Порядок работ (внутренние подэтапы)

Каждый шаг заканчивается зелёными `npm run test` и `npm run lint` и запуском приложения на реальном бэкенде.

1. **Слой без потребителей.** `src/data` (ядро + тесты). Приложение работает как раньше, ничего не подключено.
2. **Ошибки.** Правка интерцептора и `ApiError` (Д8) — отдельным коммитом: это единственное изменение, которое может поймать существующие скрытые ошибки, поэтому проверяем каждый экран вручную.
3. **Справочники.** Перевод `usePlantProcessingLogic`, `multiEnterpriseContext`, `usePlantBuilding` и TTL/опрос `plantLevels`/`resources`/`availablePlaces`. Здесь закрываются пункты 1-2 критерия готовности.
4. **Списки и фокус.** `useGuildManagement`, `useEnterpriseManagement`, `useUpgradeConfirmation`, рефетч при фокусе, pull-to-refresh, бейдж свежести.
5. **Рынок.** `useMarketScreenLogic` на слой, `useMarketWatch`, снятие гейта, проверка цен перед караваном, `isGameArtel` по конфигу (Д6).
6. **Мёртвый код и уборка.** Перевод `useProcessingScreenLogic`, удаление дублей и костылей, актуализация `README.md` (при необходимости — короткий раздел про слой данных).

---

## 8. Контракт API (клиентский, сервер не меняется)

| Метод `ApiService` | Эндпоинт | Ключ кэша | Вызовов сейчас | Станет |
|---|---|---|---|---|
| `getGuilds` | `GET /guilds.json` | `guilds` | при входе в цех/переработку | refetch-on-focus + TTL 60 с, дедупликация |
| `getGuildPlants` | `GET /guilds/:id.json` | `guild:id:plants` | при выборе гильдии | refetch-on-focus, опрос 30 с в фокусе списка |
| `getPlant` | `GET /plants/:id.json` | `plant:id` | при скане штрихкода | всегда `force`, отмена предыдущего |
| `getPlantLevels` / `getAllPlantLevels` | `GET /plant_levels.json` | `plantLevels` | 2 разных вызова одного эндпоинта | один ключ, фильтрация по типу — из кэша |
| `getAllResources` | `GET /resources/show_all_resources` | `resources` | 3 экрана | один ключ + опрос 60 с |
| `getAvailablePlaces` | `GET /plant_places/available_places` | `availablePlaces` | при заходе в «новое предприятие» | TTL 60 с, refetch-on-focus |
| `getGuildsList` | `GET /guilds/list.json` | `guilds` (общий) | рынок | тот же ключ, что `getGuilds` (после проверки совпадения формы ответа) |
| `getForeignCountries` | `GET /countries/foreign_countries.json` | `countries` | опрос 30 с | как сейчас |
| `getResourcesWithPrices` | `GET /resources/show_prices.json` | `prices` | вручную | опрос 60 с + проверка перед караваном |
| `checkRobbery` | `GET /caravans/check_robbery.json` | `robbery:id` | N запросов на N гильдий в цикле (`useMarketScreenLogic.ts:117-132`) | параллельно через слой, TTL 30 с, `Promise.allSettled` |
| `createPlant` / `upgradePlant` / `downgradePlant` / `deletePlant` / `registerCaravan` | POST/PATCH/DELETE | — | — | мутации с инвалидацией перечисленных ключей |

Отдельно проверить перед реализацией: `getGuildsList` (`/guilds/list.json`) и `getGuilds` (`/guilds.json`) отдают похожие, но не идентичные структуры (`useMarketScreenLogic.ts:139` против `useGuildManagement.ts:26`). Объединение в один ключ допустимо только при совпадении формы; иначе — два ключа `guilds` и `marketGuilds`.

---

## 9. Тест-план и критерии приёмки

Автотесты (jest, `npm run test`; есть только `__tests__/App.test.tsx`, инфраструктура уже настроена):

- `queryClient.test.ts`: TTL и `isStale`; дедупликация двух одновременных `fetch` одного ключа; отмена при уходе последнего подписчика; «последний стартовавший побеждает» при переупорядочивании ответов; `invalidate` помечает и запускает ровно нужные ключи; backoff при ошибке и сброс при успехе; снятие таймеров при потере фокуса.
- `useQuery.test.tsx`: SWR-показ (данные видны при `fetching`); ошибка не стирает предыдущие данные и выставляет `isOffline`; `force` игнорирует TTL.
- `useRefetchOnFocus.test.tsx`: фокус → refetch только переданных ключей; размонтирование снимает слушатель.
- `apiErrors.test.ts`: HTTP 500/422 → `ApiError{kind:'http'}`; таймаут и обрыв → `kind:'network'|'timeout'` (проверяет, что правка интерцептора не сломала существующие вызовы).

Ручной чеклист приёмки (на реальном бэкенде и планшете мастера):

1. Открыть цех → «Предприятия гильдии»; со второго устройства (или через `era_front`) создать предприятие; вернуться на список — новое предприятие видно без ручных действий.
2. Оставить экран списка предприятий открытым; изменить уровень предприятия на бэкенде; в течение 30 с список обновляется, показан бейдж свежести.
3. Открыть цех переработки, оставить открытым; изменить `plant_levels` (формулы) на бэкенде; в течение 60 с появляется предупреждение о смене формул, введённые значения не теряются.
4. Рынок: изменить отношения стран на бэкенде → `Alert` «Изменение отношений!», кнопка обновления цен активна (гейта нет).
5. Рынок: изменить цену ресурса на бэкенде, пока форма расчёта открыта → предупреждение; при попытке зарегистрировать караван с прежними цифрами — сообщение о расхождении и требование пересчёта.
6. Отключить Wi-Fi: экраны показывают последние данные + «нет связи», без `Alert`-спама на каждый опрос; после включения сети данные обновляются сами.
7. Режим `artel` (`ACTIVE_GAME: 'artel'` в `src/config.ts`) и `vassals-and-robbers`: рынок, цех, улучшение, переработка работают как раньше; страна в караване не появляется, пока режим artel.
8. Скан штрихкода при вводе предприятия на любом экране цеха: данные предприятия всегда свежие, экран не перерисовывается из-за фонового обновления.
9. Быстрая навигация вперёд-назад 10 раз: нет «мигания» данных, нет дублирующихся запросов в логе, лишних таймеров нет.
10. Улучшение предприятия (кнопка на той же строке, что «Уменьшить уровень») — регрессия: список и карточка обновляются сразу после ответа сервера.

Определение готовности (DoD):

- [ ] `src/data` покрыт тестами, `npm run test` и `npm run lint` зелёные;
- [ ] ни один хук не содержит `setInterval` и загрузки «на монтирование» напрямую;
- [ ] дубль загрузки рынка удалён, `CaravanService` синхронизируется без ручных `setCountries/setResources` в экранах;
- [ ] в коде нет `countries.length === 0` как признака режима игры;
- [ ] интерцептор отклоняет ошибки, все существующие `catch`-ветки проверены на новом поведении;
- [ ] чеклист 1-10 пройден на планшете мастера, в логах нет необработанных отклонений промисов;
- [ ] расход запросов на один открытый экран цеха за 5 минут измерен и записан в документ.

---

## 10. Риски

| Риск | Оценка | Влияние | Митигация |
|---|---|---|---|
| Рост трафика и нагрузки на бэкенд от опроса (особенно `plant_levels.json`, отдающий всё) | средняя | среднее | дедупликация, один таймер на ключ, интервалы 60 с только в фокусе, backoff при ошибках, jitter; измерение по чеклисту 10 |
| Расход батареи на планшетах | средняя | низкое | опрос только в фокусе, отсутствие таймеров в фоне, отмена запросов при уходе |
| Правка интерцептора вскроет скрытые ошибки, которые сейчас глотались | высокая | среднее | отдельный шаг 2, ручная проверка каждого экрана до перехода к остальным шагам |
| Лишние перерисовки экранов от подписок слоя | средняя | низкое | подписка на ключ, а не на весь кэш; `useSyncExternalStore` с селектором; мемоизация возврата хуков |
| Гонки при обновлении того же ключа из фокуса и опроса | средняя | среднее | единый менеджер опроса + отмена предыдущего запроса + правило «последний стартовавший» |
| Расхождение с вебом (`era_front`) в поведении рынка | средняя | среднее | UX рынка (Alert по отношениям/эмбарго, ручная кнопка) сохранён как в `Exchange.vue`; новое — только автоматический опрос цен, согласовать с мастером-экономистом |
| Режим artel/`vassals-and-robbers` ломается из-за смены определения режима (Д6) | низкая | высокое | проверка обоих режимов в чеклисте 7; `CONFIG.ACTIVE_GAME` — текущий генератор `config.ts` от `era_scripts` |
| Точки входа `ProcessingScreen` остаются мёртвыми и расходятся с архитектурой | низкая | низкое | перевод «как есть» (Д10), задача на удаление вынесена в «вне объёма» |

---

## 11. Открытые вопросы (нужны решения заказчика)

1. Утвердить таблицу TTL/интервалов из § 5. Рекомендация: оставить предложенные значения; интервал опроса цен 60 с — компромисс между свежестью и трафиком (быстрее — 30 с, как страны).
2. Опрос цен на рынке: включать автоматически (рекомендуется) или оставить только ручную кнопку с индикатором свежести? SECURITY/UX-аспект: автоматический опрос ловит изменение цен без участия мастера.
3. Гейт «Обновить цены» (`MarketScreen.tsx:340`): снимаем полностью (рекомендуется) или оставляем только подсветку «есть изменения»?
4. Предупреждение о смене формул года во время открытой формы переработки: показывать `Alert` (может прервать ввод) или держать в бейдже свежести до нажатия «Обновить»? Рекомендация: бейдж + подсветка, `Alert` только если изменились формулы предприятия, которое сейчас открыто.
5. `ProcessingScreen`/`useProcessingScreenLogic`: удалять в рамках этого этапа или оставить как есть (рекомендуется оставить, отдельная задача)?
6. Допустимо ли объединить `getGuilds` (`/guilds.json`) и `getGuildsList` (`/guilds/list.json`) в один ключ? Нужно решение после сверки форм ответа (см. § 8); рекомендация: сначала сверить ответы двух эндпоинтов, затем объединять.

---

## Приложение А. Инвентарь мест к правке (файл:строка → как должно быть)

| Место сейчас | Что там | Как должно быть |
|---|---|---|
| `src/services/api.ts:80-85` | интерцептор возвращает `error.response` | отклонять промис с `ApiError` (Д8) |
| `src/services/api.ts:49-57` | `axios.create` без поддержки отмены | пробрасывать `signal` из хука |
| `src/services/api.ts:119-127` | `getPlantLevels` фильтрует весь список | фильтрация по ключу `['plantLevels', typeId]` из кэша |
| `src/screens/hooks/useMarketScreenLogic.ts:96,180-192,271-285,305-311` | `pollInterval` в state + два `setInterval` | убрать, опрос в `queryClient` |
| `src/screens/hooks/useMarketScreenLogic.ts:135-200` и `:203-302` | дубль загрузки рынка | один путь через слой |
| `src/screens/hooks/useMarketScreenLogic.ts:104` | `isGameArtel` по длине списка стран | `gameConfig.isActive('artel')` (Д6) |
| `src/screens/hooks/useMarketScreenLogic.ts:314-351` | diff стран + Alert | вынести в `useMarketWatch.ts`, добавить diff цен |
| `src/screens/hooks/useMarketScreenLogic.ts:545-621` | регистрация каравана без проверки свежести цен | refetch `prices` перед регистрацией + проверка расхождения (Д7) |
| `src/screens/hooks/useMarketScreenLogic.ts:117-132` | последовательные `checkRobbery` в цикле | `Promise.allSettled` через слой, ключ `robbery:id` |
| `src/screens/hooks/usePlantProcessingLogic.ts:120-135,313-323` | `initializedRef`, `guildsRef`, `setTimeout(100)` | убрать, справочники из слоя |
| `src/screens/hooks/useProcessingScreenLogic.ts:116-126` | pull-to-refresh только гильдий | сохранить, добавить сюда же свежесть |
| `src/screens/hooks/useGuildManagement.ts:23-33` | `loadGuilds` → `data.sort` (падает на `undefined`) | `refetch(['guilds'])`, ошибка через слой |
| `src/screens/hooks/useEnterpriseManagement.ts:43-53,63-75` | загрузка списка, удаление | `refetch(['guild', id, 'plants'])`, `invalidate` после удаления |
| `src/screens/hooks/usePlantBuilding.ts:42-51,65-84` | места, уровни по типу | ключи `availablePlaces`, `plantLevels:typeId` |
| `src/screens/hooks/useUpgradeConfirmation.ts:30-67,110` | `getPlant` + `getPlantLevels` | `['plant', id]` при TTL 0, `['plantLevels']` из кэша, `invalidate` после upgrade/downgrade |
| `src/screens/PlantWorkshopScreen.tsx:185-241` | `getPlant` при скане штрихкода | `force: true` через слой, отмена предыдущего |
| `src/screens/PlantWorkshopScreens/GuildSelectionScreen.tsx:40` | `useEffect` → `loadGuilds` | `useRefetchOnFocus(['guilds'])` + pull-to-refresh |
| `src/screens/PlantWorkshopScreens/EnterpriseListScreen.tsx:47,61-70` | `useEffect` + ручная перезагрузка после удаления | `useRefetchOnFocus(['guild', id, 'plants'])`, `invalidate` в мутации |
| `src/screens/PlantWorkshopScreens/UpgradeConfirmScreen.tsx:41-46` | загрузка по `plantId` | refetch-on-focus для `['plant', id]` |
| `src/screens/PlantWorkshopScreens/NewPlantTypeScreen.tsx:47` | `loadAvailablePlaces` | `useRefetchOnFocus(['availablePlaces'])` |
| `src/screens/PlantWorkshopScreens/multiEnterpriseContext.ts:156-166` | `getAllResources` на монтировании | `useResources()` |
| `src/screens/MarketScreen.tsx:83-95,337-345` | кнопка с гейтом `newRelations` | кнопка всегда активна, `force`-refetch, бейдж свежести |
| `src/screens/components/ProcessingContent.tsx:66` | `RefreshControl` есть | оставить, передавать `refreshing` из слоя |
| `src/screens/ProcessingScreen.tsx`, `useProcessingScreenLogic.ts` | мёртвый экран | перевести на слой без изменения поведения (Д10) |

## Приложение Б. Интерфейсы слоя (эскиз, без реализации)

```ts
// src/data/keys.ts
export type QueryKey = readonly (string | number)[];

// src/data/queryClient.ts
export interface QueryOptions<T> {
  ttl: number;                 // мс, после которого данные считаются устаревшими
  pollInterval?: number;       // мс, только пока есть подписчик в фокусе
  refetchOnFocus?: boolean;    // по умолчанию true
  refetchOnMount?: 'if-stale' | 'always' | 'never';
  enabled?: boolean;
}

export interface QueryState<T> {
  data: T | undefined;
  error: unknown | undefined;
  isLoading: boolean;          // нет данных и идёт первая загрузка
  isFetching: boolean;         // идёт любая загрузка (в т.ч. фоновая)
  isStale: boolean;
  updatedAt: number | undefined;
  isOffline: boolean;
  refetch: (opts?: { force?: boolean }) => Promise<void>;
}

export declare function invalidate(keys: QueryKey[]): void;
export declare function setQueryData<T>(key: QueryKey, data: T): void;
export declare function getQueryData<T>(key: QueryKey): T | undefined;
```

```ts
// src/data/useQuery.ts
export declare function useQuery<T>(
  key: QueryKey,
  fetcher: (signal: AbortSignal) => Promise<T>,
  options: QueryOptions<T>,
): QueryState<T>;

// src/data/useRefetchOnFocus.ts
export declare function useRefetchOnFocus(keys: QueryKey[]): void;

// src/data/hooks/usePrices.ts (пример прикладного хука)
export declare function usePrices(): QueryState<{ off_market: Resource[]; to_market: Resource[] }>;
```

```ts
// src/data/apiErrors.ts
export interface ApiError {
  kind: 'network' | 'timeout' | 'http';
  status?: number;
  message: string;
  payload?: unknown;
}
export declare function isOffline(error: unknown): boolean;
```

## Приложение В. Что остаётся как есть

- Серверный контракт: ни один эндпоинт, параметр или поле ответа не меняется.
- UX рынка: `Alert` при изменении отношений и эмбарго, обязательное подтверждение контрабанды, блокировка каравана при недостатке золота (`useMarketScreenLogic.ts:492-517,526-543`).
- Печать штрихкодов (`BrotherPrinterService`) и работа сканера (`BarcodeScannerContext`) — вне объёма.
- Определение режима игры и его источник (`src/config.ts` генерируется `era_scripts`); этап только меняет способ чтения этого признака.
