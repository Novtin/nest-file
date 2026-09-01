# Steroids Nest File

## Unreleased

### Fixes

[Migration guide](docs/MigrationGuide.md#unreleased)

- `IFileStorage.write` больше не принимает в качестве аргумента `fileStorageParams`, вместо этого хранилища сами берут эти настройки
из `IGetFileStorageParamsUseCase`
- Конфигурация `storages` теперь описывает `driver` и `options` для каждого имени хранилища; модуль создаёт экземпляры автоматически
- Хранилища имеют injection scope `TRANSIENT`, что позволяет создать несколько экземпляров одного хранилища с разным конфигом
- Использование `FileStorageEnum` в качестве типа обновлено на `string`

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
