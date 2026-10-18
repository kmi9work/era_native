# Плагин two_teams (era_native)

Игра «Две команды»: клиент мастеров экономики.

Включение: `ACTIVE_GAME = 'two_teams'` (src/config.ts генерируется скриптами
era_scripts либо значение приходит из нативного модуля `GameConfigModule`).

## Что делает

- **Надпись для мастеров** (п. 8): «Обработка добычи и переработки предприятий
  ТОЛЬКО в программе» — оранжевая плашка над экранами цеха.
- **Отметка «добыча запрещена»** (п. 6): красная плашка со списком предприятий,
  добыча на которых запрещена в государстве их расположения. Работает в обычном
  режиме (`EnterpriseListScreen`) и в пакетном (`MultiEnterprisesScreen`).
  Данные — только с бэкенда: `GET /many_teams/guilds/:id/workshop`
  (`forbidden_plant_ids`), клиент ничего не вычисляет.

## Устройство

```
two_teams/
├── index.ts                       # регистрация экранов в componentRegistry
├── services/guildWorkshop.ts      # GET /many_teams/guilds/:id/workshop
├── hooks/useGuildWorkshop.ts      # ключ слоя данных + TTL/опрос
├── components/
│   ├── MastersNotice.tsx          # надпись для мастеров
│   ├── ExtractionForbiddenBanner.tsx
│   └── TwoTeamsOverlay.tsx        # накладка над экраном
└── screens/
    ├── EnterpriseListScreenWithTwoTeams.tsx
    └── MultiEnterprisesScreenWithTwoTeams.tsx
```

Плагин ничего не меняет внутри экранов ядра: он их оборачивает и регистрирует
обёртки в `componentRegistry` под именами `two_teams.EnterpriseListScreen` и
`two_teams.MultiEnterprisesScreen`. Ядро берёт экран из registry, если плагин
активен, иначе использует свой (`PlantWorkshopScreen.tsx`).
