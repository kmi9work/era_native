# Плагин many_teams (era_native)

Игра «Две команды»: клиент мастеров экономики.

Включение: `ACTIVE_GAME = 'many-teams'` (написание `many_teams` тоже
принимается; src/config.ts генерируется скриптами
era_scripts либо значение приходит из нативного модуля `GameConfigModule`).

## Что делает

- **Надпись для мастеров** (п. 8): «Обработка добычи и переработки предприятий
  ТОЛЬКО в программе» — оранжевая плашка над экранами цеха.
- **Отметка «строительство и работа запрещены»** (п. 0-6): красная плашка со
  списком предприятий, для которых в государстве расположения запрещены
  строительство и работа (это один запрет). Работает в обычном режиме
  (`EnterpriseListScreen`) и в пакетном (`MultiEnterprisesScreen`). Данные —
  только с бэкенда: `GET /many_teams/guilds/:id/workshop`
  (`forbidden_plant_ids`, `plants[].work_forbidden`), клиент ничего не вычисляет.
- **Где гильдии разрешено строить** (п. 0-4): строка под надписью для мастеров
  на экране «Предприятия гильдии» — «Строительство и работа разрешены в землях:
  …» по полю `countries[].allowed` того же цеха. В пакетном режиме её нет: там
  гильдий несколько.
- **Плашка на «Улучшении предприятия»** (п. 5): компонент `PlantWorkNotice`
  регистрируется как `many_teams.PlantWorkNotice`; ядро рисует его на экране
  улучшения, если он зарегистрирован (в базовой игре — не рисует).

## Устройство

```
many_teams/
├── index.ts                       # регистрация экранов в componentRegistry
├── services/guildWorkshop.ts      # GET /many_teams/guilds/:id/workshop
├── hooks/useGuildWorkshop.ts      # ключ слоя данных + TTL/опрос
├── components/
│   ├── BuildCountriesNotice.tsx   # где гильдии разрешено строить и работать
│   ├── WorkForbiddenBanner.tsx    # отметка на списках предприятий
│   ├── PlantWorkNotice.tsx        # плашка на «Улучшении предприятия»
│   └── ManyTeamsOverlay.tsx       # накладка над экраном
└── screens/
    ├── EnterpriseListScreenWithManyTeams.tsx
    └── MultiEnterprisesScreenWithManyTeams.tsx
```

Плагин ничего не меняет внутри экранов ядра: он их оборачивает и регистрирует
обёртки в `componentRegistry` под именами `many_teams.EnterpriseListScreen` и
`many_teams.MultiEnterprisesScreen`. Ядро берёт экран из registry, если плагин
активен, иначе использует свой (`PlantWorkshopScreen.tsx`). Плашка запрета на
экране улучшения — тоже точка расширения: ядро (`UpgradeConfirmScreen.tsx`)
рисует `many_teams.PlantWorkNotice`, если плагин его зарегистрировал.
