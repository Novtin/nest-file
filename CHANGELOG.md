# Steroids Nest File

## Unreleased

### Fixes

[Migration guide](docs/MigrationGuide.md#unreleased)

- `IFileStorage.write` больше не принимает в качестве аргумента `fileStorageParams`, вместо этого хранилища сами берут эти настройки
из `IGetFileStorageParamsUseCase`
- Конфигурация `storages` теперь описывает `driver` и `options` для каждого имени хранилища; модуль создаёт экземпляры автоматически
- Хранилища имеют injection scope `TRANSIENT`, что позволяет создать несколько экземпляров одного хранилища с разным конфигом
- Использование `FileStorageEnum` в качестве типа обновлено на `string`

## [0.9.0](https://github.com/steroids/nest-file/compare/0.8.0...0.9.0) (2026-08-14)

[Migration guide](docs/MigrationGuide.md#090-2026-08-14)

### Breaking Changes

- `FileUploadInterceptor` переименован в `TemporaryFileUploadInterceptor`. Новый интерцептор удаляет созданный Multer временный файл после завершения обработки запроса, если `saveTemporaryFileAfterUpload` выключен. При программной загрузке через `FileService` локальный исходный файл больше не удаляется автоматически. ([#30](https://github.com/steroids/nest-file/pull/30))
- Удалён отдельный интерфейс `IFileLocalStorage`: методы `getFilesPaths()` и `getFileCreateTimeMs()` перенесены в общий `IFileStorage`, а `getFilesPaths()` теперь асинхронный. Кастомные хранилища должны реализовать обновлённый контракт. ([#33](https://github.com/steroids/nest-file/pull/33))
- В `peerDependencies` добавлен `@sentry/nestjs` версии `^10`, используемый для логирования ошибок при удалении временных файлов. ([#30](https://github.com/steroids/nest-file/pull/30))

### Features

- В `FileUploadOptions` добавлена карта `previews`, позволяющая задавать параметры превью для конкретной загрузки или возвращать их из `FileTypeService` для конкретного `fileType`. ([#32](https://github.com/steroids/nest-file/pull/32))
- Создание превью вынесено в `ICreateImagePreviewUseCase`; добавлены резолвер генераторов и отдельные генераторы для SVG и остальных поддерживаемых Sharp изображений. ([#32](https://github.com/steroids/nest-file/pull/32))
- Очистка lost/temporary файлов теперь поддерживает Minio S3: хранилище умеет получать список объектов и время их создания. ([#33](https://github.com/steroids/nest-file/pull/33))

### Fixes

- Пути файлов из БД, локального хранилища и S3 приведены к единому относительному формату: разделитель `/`, без ведущего слеша и без пустого сегмента папки. Это исправляет сопоставление файлов при очистке, в том числе для файлов в корне хранилища и при запуске на разных ОС. ([#33](https://github.com/steroids/nest-file/pull/33))
- В инструкции по подключению модуля использование удалённого `ModuleHelper.importDir` заменено явным списком таблиц. ([#36](https://github.com/steroids/nest-file/pull/36))

### Tests

- Добавлена Jest-конфигурация и тесты очистки lost/temporary файлов, нормализации локальных путей и получения путей из Minio S3. ([#33](https://github.com/steroids/nest-file/pull/33))

## [0.8.0](https://github.com/steroids/nest-file/compare/0.7.0...0.8.0) (2026-08-11)

[Migration guide](docs/MigrationGuide.md#080-2026-08-11)

### Changes

- Добавлена одновременная поддержка NestJS 10 и NestJS 11 в `peerDependencies` для `@nestjs/common`, `@nestjs/core` и `@nestjs/platform-express`. ([#148](https://gitlab.kozhindev.com/steroids/steroids-nest/-/issues/148))
- Диапазон поддерживаемых версий `@nestjs/schedule` расширен до major-версий 4–6, а `@nestjs/swagger` — до согласованных с NestJS 10 и NestJS 11 версий 8 и 11. ([#148](https://gitlab.kozhindev.com/steroids/steroids-nest/-/issues/148))
- Среда разработки обновлена до NestJS 11, Schedule 6, типов Express 5 и типов Multer 2. ([#148](https://gitlab.kozhindev.com/steroids/steroids-nest/-/issues/148))
- Multer обновлён до версии 2, Cron — до версии 4. ([#148](https://gitlab.kozhindev.com/steroids/steroids-nest/-/issues/148))
- Импорты `Request` и `OnApplicationBootstrap`, используемые только как типы, переведены на type-only imports. ([#148](https://gitlab.kozhindev.com/steroids/steroids-nest/-/issues/148))

### Fixes

- Исправлен двойной вызов callback в `FileUploadInterceptor` при загрузке файла с недопустимым MIME-типом.

### Removed

- Удалена прямая зависимость от Express 4. Версия Express теперь определяется установленным `@nestjs/platform-express`: Express 4 для NestJS 10 и Express 5 для NestJS 11. ([#148](https://gitlab.kozhindev.com/steroids/steroids-nest/-/issues/148))

## [0.7.0](https://github.com/steroids/nest-file/compare/0.6.0...0.7.0) (2026-07-23)

[Migration guide](docs/MigrationGuide.md#070-2026-07-23)

### Breaking Changes

- Форки `@steroidsjs/typeorm` и `@steroidsjs/nest-typeorm` заменены на оригинальные пакеты `typeorm` и `@nestjs/typeorm`
- Зависимости NestJS и Steroids обновлены до версий, совместимых с `@steroidsjs/nest@5.0.0-beta.1`
- Минимальная поддерживаемая версия Node.js повышена до 22, `@types/node` обновлен до `^22.13.17`

## [0.6.0](https://github.com/steroids/nest-file/compare/0.5.0...0.6.0) (2026-05-04)

[Migration guide](docs/MigrationGuide.md#060-2026-05-04)

### Features

- Добавлен lifetime для только что загруженных файлов: очистка lost/temporary файлов не удаляет свежие файлы сразу, а команда `unused-files` учитывает минимальный возраст файла перед удалением ([#118](https://gitlab.kozhindev.com/steroids/steroids-nest/-/issues/118))
- Добавлены параметры конфигурации `justUploadedTempFileLifetimeMs` и `justUploadedUnusedFileLifetimeMs`, а также env-переменные `JUST_UPLOADED_TEMP_FILE_LIFETIME_S` и `JUST_UPLOADED_UNUSED_FILE_LIFETIME_S`

### Fixes

- Исправлена DI-конфигурация сервисов после удаления deprecated `ModuleHelper.provide`; валидаторы файлов теперь регистрируются через `FILE_VALIDATORS_TOKEN` ([#159](https://gitlab.kozhindev.com/steroids/steroids-nest/-/issues/159))
- Исправлена ошибка в запросе `unused-files` для таблиц, которым требуется quoted identifier
- Сообщение об ошибке отсутствующего локального файла переведено на английский язык ([#209](https://gitlab.kozhindev.com/steroids/steroids-nest/-/issues/209))

### Build

- Публикация npm-пакета переведена на Trusted Publisher

## [0.5.0](https://github.com/steroids/nest-file/compare/0.4.1...0.5.0) (2026-03-25)

[Migration guide](docs/MigrationGuide.md#050-2026-03-25)

### Features

- В FileModel добавлено поле userId. Поле также включено в FileUploadOptions

## [0.4.1](https://github.com/steroids/nest-file/compare/0.4.0...0.4.1) (2025-12-18)

### Fixes

- Исправлено сохранение FileModel (поле fileType включено в состав save dto)

## [0.4.0](https://github.com/steroids/nest-file/compare/0.3.3...0.4.0) (2025-12-18)

### Features

[Migration guide](docs/MigrationGuide.md#040-2025-12-18)

- удален FileController ([#127](https://gitlab.kozhindev.com/steroids/steroids-nest/-/issues/127))
- Добавлены параметры загрузки файлов в хранилища по fileType ([#169](https://gitlab.kozhindev.com/steroids/steroids-nest/-/issues/169))
- Steroids зависимости вынесены в peerDependencies ([#190](https://gitlab.kozhindev.com/steroids/steroids-nest/-/issues/190))

## [0.3.3](https://github.com/steroids/nest-file/compare/0.3.2...0.3.3) (2025-07-03)

### Features

[Migration guide](docs/MigrationGuide.md#033-2025-07-03)

- На замену декоратору FileUpload добавлен FileUploadInterceptor, у которого есть доступ к DI.
  Он обращается в FileTypeService, получает конфиг для загружаемого типа файла и валидирует его по этому конфигу ([#128](https://gitlab.kozhindev.com/steroids/steroids-nest/-/issues/128))

## [0.3.2](https://github.com/steroids/nest-file/compare/0.3.1...0.3.2) (2025-06-26)

### Fixes

- Фикс ClearUnusedFilesCommand

## [0.3.1](https://github.com/steroids/nest-file/compare/0.3.0...0.3.1) (2025-06-24)

### Features

- Добавлена CLI команда для удаления файлов из хранилища, для которых нет записи в БД. ([#17](https://gitlab.kozhindev.com/steroids/steroids-nest/-/issues/17))
- Добавлена CLI команда для удаления неиспользуемых загруженных файлов ([#95](https://gitlab.kozhindev.com/steroids/steroids-nest/-/issues/95))
- Обновлены интерфейсы методов в IFileStorage ([#114](https://gitlab.kozhindev.com/steroids/steroids-nest/-/issues/114))
- Добавлен тип загружаемых файлов в конфиг для @FileUpload ([#120](https://gitlab.kozhindev.com/steroids/steroids-nest/-/issues/120))

## [0.3.0](https://github.com/steroids/nest-file/compare/0.2.6...0.3.0) (2025-05-12)

### Features

- Обновление Steroids до версии 3.2.0
- В качестве превью для svg файлов сохраняется ссылка на оригинальный файл ([#54](https://gitlab.kozhindev.com/steroids/steroids-nest/-/issues/54))
- Превью файла не растягивается, если оригинал имеет разрешение меньше заданного размера превью ([#111](https://gitlab.kozhindev.com/steroids/steroids-nest/-/issues/111))
- Инициализация сервиса CronJobsRegister перенесена с OnModuleInit на OnApplicationBootstrap ([#115](https://gitlab.kozhindev.com/steroids/steroids-nest/-/issues/115))
