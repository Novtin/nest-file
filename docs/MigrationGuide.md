# Steroids Nest File Migration Guide

## Unreleased

### Провайдинг хранилищ после обновления

`FileStorageFactory` теперь получает именованные экземпляры хранилищ из конфигурации модуля.
Каждое хранилище в `FileModule.config.storages` теперь описывается объектом с полями `driver` и `options`.

`driver` — это класс, реализующий `IFileStorage`: `FileLocalStorage`, `MinioS3Storage` или пользовательская реализация.
Ключ в `storages` становится `storageName`, а `options` передаются драйверу при инициализации. Один драйвер можно использовать под несколькими именами с разными настройками.

#### Обновление конфигурации стандартных хранилищ

Если проект использует только настройки из env и не задаёт `FileModule.config.storages`, изменять конфигурацию не требуется.
Если проект переопределяет настройки `local` или `minio_s3`, нужно перейти на новый формат.

До обновления:

```typescript
storages: {
    local: {
        rootPath: '/var/app/files',
        rootUrl: '/files',
    },
}
```

После обновления:

```typescript
import {FileLocalStorage} from '@steroidsjs/nest-file/domain/storages/FileLocalStorage';

storages: {
    local: {
        driver: FileLocalStorage,
        options: {
            rootPath: '/var/app/files',
            rootUrl: '/files',
        },
    },
}
```

Для `minio_s3` используется такой же формат с `driver: MinioS3Storage`.
Старый формат без `driver` больше не поддерживается и приведёт к ошибке `Not found driver for storage: <storageName>` при запуске приложения.

При добавлении хранилища на встроенном драйвере не нужно повторять всю конфигурацию. 
Для `MinioS3Storage` по умолчанию используются настройки подключения стандартного хранилища `minio_s3`, а для `FileLocalStorage` — пути стандартного хранилища `local`.
Эти настройки формируются из env и конфигурации модуля. В `options` нового хранилища укажите только значения, которые должны отличаться.
Пример нескольких экземпляров одного драйвера приведён в разделе [«Провайдинг нескольких хранилищ»](../README.md#провайдинг-нескольких-хранилищ).

#### Обновление публичных контрактов

Если проект реализует собственное хранилище или переопределяет существующее, обновите контракт:

1. `init()` теперь принимает `IFileStorageConfig`. В конфигурации передаются `storageName` и поля из `options`.
2. `write()` теперь принимает только `file` и `source`. Аргумент `fileStorageParams` удалён.
3. Добавьте пользовательский драйвер в `providers` модуля со scope `TRANSIENT`, чтобы каждое имя получало отдельный экземпляр.

Все хранилища из `storages` инициализируются при запуске приложения: это позволяет асинхронно получить `TRANSIENT`-экземпляры через Nest DI, сохранив синхронный `FileStorageFactory.get()`.
Конфигурация в `FileConfigService` подготавливается в конструкторе, поскольку она нужна для создания этих экземпляров до вызова `onModuleInit()`.

`IGetFileStorageParamsUseCase` остаётся необязательным. В существующей реализации измените тип первого аргумента на `fileType: string | undefined`.
Встроенные драйверы вызывают use case самостоятельно; пользовательский драйвер при необходимости должен инжектить `GET_FILE_STORAGE_PARAMS_USE_CASE_TOKEN` и вызывать `handle()` внутри `write()`.
Пример приведён в разделе [«Параметры загрузки файла в хранилище»](../README.md#параметры-загрузки-файла-в-хранилище).

Тип `storageName` в публичных моделях, DTO и интерфейсах изменён с `FileStorageEnum` на `string`. `FileStorageEnum` можно продолжать использовать как набор констант стандартных имён.

Изменение `EnumField` на `StringField` для `storageName` не требует миграции базы данных: оба декоратора используют колонку `varchar`.

## [0.9.0](../CHANGELOG.md#090-2026-08-14) (2026-08-14)

### Переименование интерцептора загрузки

`FileUploadInterceptor` переименован в `TemporaryFileUploadInterceptor`. Если интерцептор импортируется в приложении напрямую, замените импорт и класс в `@UseInterceptors`:

```ts
// До
import {FileUploadInterceptor} from '@steroidsjs/nest-file/infrastructure/interceptors/FileUploadInterceptor';

@UseInterceptors(FileUploadInterceptor)
```

```ts
// После
import {TemporaryFileUploadInterceptor} from '@steroidsjs/nest-file/infrastructure/interceptors/TemporaryFileUploadInterceptor';

@UseInterceptors(TemporaryFileUploadInterceptor)
```

Deprecated-декоратор `@FileUpload()` продолжает работать, но для нового кода следует использовать `TemporaryFileUploadInterceptor`.

### Удаление временных файлов

При `saveTemporaryFileAfterUpload: false` удаление созданного Multer временного файла теперь выполняет `TemporaryFileUploadInterceptor` после завершения обработчика запроса, в том числе если обработчик завершился ошибкой. Ошибки удаления отправляются в Sentry.

Установите совместимую peer-зависимость, если её ещё нет в приложении:

```json
{
  "dependencies": {
    "@sentry/nestjs": "^10"
  }
}
```

`FileService.upload()` и `FileService.uploadImage()` больше не удаляют переданный `FileLocalSourceDto` или локальный путь автоматически. Если приложение программно загружает локальный файл и рассчитывало на прежнее удаление исходника, удалите его самостоятельно после завершения загрузки.

### Обновление кастомных хранилищ

Интерфейс `IFileLocalStorage` удалён. Методы перечисления файлов и получения времени создания теперь входят в общий контракт `IFileStorage`, чтобы очистка lost/temporary файлов могла работать не только с локальным диском, но и с S3.

Если в приложении есть собственное хранилище, замените `IFileLocalStorage` на `IFileStorage` и реализуйте новые методы:

```ts
import {IFileStorage} from '@steroidsjs/nest-file/domain/interfaces/IFileStorage';

export class CustomFileStorage implements IFileStorage {
    // Остальные методы IFileStorage опущены.

    async getFilesPaths(): Promise<string[] | null> {
        // Верните относительные пути с разделителем `/` и без ведущего слеша.
        return ['folder/file.jpg'];
    }

    async getFileCreateTimeMs(fileName: string): Promise<number> {
        // Верните время создания или последнего изменения в миллисекундах.
        return Date.now();
    }
}
```

Код, который напрямую вызывает `FileLocalStorage.getFilesPaths()`, также необходимо сделать асинхронным:

```ts
const paths = await fileLocalStorage.getFilesPaths();
```

### Явное подключение таблиц

Если модуль приложения всё ещё собирает свои таблицы через удалённый `ModuleHelper.importDir`, замените динамический импорт явным списком:

```ts
// До
import {ModuleHelper} from '@steroidsjs/nest/infrastructure/helpers/ModuleHelper';

tables: [
    ...coreModule.tables,
    ...ModuleHelper.importDir(__dirname + '/tables'),
],
```

```ts
// После
import nestFileTables from './tables';

tables: [
    ...coreModule.tables,
    ...nestFileTables,
],
```

Если у приложения нет собственных таблиц для файлового модуля, достаточно оставить `coreModule.tables`.

### Настройка превью по fileType

Обязательных действий не требуется. При необходимости кастомный `FileTypeService` теперь может вернуть карту `previews` вместе с остальными параметрами загрузки:

```ts
return DataMapper.create(FileUploadOptions, {
    folder: 'images',
    previews: {
        thumbnail: {
            enable: true,
            width: 320,
            height: 240,
        },
    },
});
```

Ту же карту можно передать непосредственно в `FileUploadOptions.previews` для отдельной загрузки. Если она не задана, продолжает использоваться глобальная конфигурация `previews`.

## [0.8.0](../CHANGELOG.md#080-2026-08-11) (2026-08-11)

### Поддержка NestJS 11

Новый релиз `@steroidsjs/nest-file` будет одновременно поддерживать NestJS 10 и NestJS 11.
Обновление пакета не требует обязательного перехода на NestJS 11: приложение может остаться на NestJS 10, используя согласованные с ним версии интеграционных пакетов.

Для перехода приложения на NestJS 11 обновите NestJS-зависимости согласованно:

```json
{
  "dependencies": {
    "@nestjs/common": "^11.1.28",
    "@nestjs/core": "^11.1.28",
    "@nestjs/event-emitter": "^3.0.1",
    "@nestjs/platform-express": "^11.1.28",
    "@nestjs/schedule": "^6.0.1",
    "@nestjs/swagger": "^11.4.6",
    "@nestjs/typeorm": "^11.0.3"
  }
}
```

Перед обновлением также необходимо:

1. Обновить `@steroidsjs/nest` до версии с поддержкой NestJS 11.
2. Проверить `peerDependencies` остальных NestJS- и `@steroidsjs/*`-пакетов приложения.
3. Не смешивать разные major-версии `@nestjs/common`, `@nestjs/core`, `@nestjs/platform-express` и `@nestjs/testing`.
4. Для NestJS 11 использовать Swagger 11 и Schedule 5 или 6. Schedule 4 поддерживает только NestJS 10.

Для приложения на NestJS 10 остаются совместимыми `@nestjs/platform-express` 10, Swagger 8 и Schedule 4–6.

Минимальная версия Node.js для `@steroidsjs/nest-file` остаётся равна 22.

### Переход на Express 5 и Multer 2

`@nestjs/platform-express` использует Express 4 в NestJS 10 и Express 5 в NestJS 11.
`@steroidsjs/nest-file` больше не устанавливает и не требует собственную версию Express, поэтому HTTP-платформа приложения определяет единственную используемую major-версию Express.

Если приложение добавляло `express` только для совместимости с `@steroidsjs/nest-file`, прямую зависимость можно удалить. Если приложение напрямую использует runtime API Express, при переходе на NestJS 11 обновите его собственную зависимость до Express 5 и проверьте маршруты и middleware paths на соответствие новому синтаксису.

Multer внутри `@steroidsjs/nest-file` обновлён до версии 2. Используемые пакетом `diskStorage`, `single`, `limits` и `fileFilter` сохранили прежние контракты, поэтому менять конфигурацию `FileUploadInterceptor` в приложении не требуется.

Если приложение напрямую использует типы Express или Multer, обновите их:

```json
{
  "devDependencies": {
    "@types/express": "^5.0.6",
    "@types/multer": "^2.2.0"
  }
}
```

Для type-only использования импортируйте Express-типы следующим образом:

```ts
import type {Request, Response} from 'express';
```

### Обновление Schedule и Cron

Поддерживаемый диапазон `@nestjs/schedule` расширен до major-версий 4–6, а внутренняя зависимость `cron` обновлена до версии 4.
Публичная конфигурация `CronJobsRegister` не изменилась. Если приложение создаёт собственные экземпляры `CronJob`, при обновлении его прямой зависимости `cron` необходимо отдельно проверить их параметры по migration guide пакета Cron.

### Проверка MIME-типа загружаемого файла

Исправлен двойной вызов callback в `FileUploadInterceptor` при отклонении файла с недопустимым MIME-типом.
Теперь такой файл однократно отклоняется с `UnsupportedMediaTypeException`; публичная конфигурация `mimeTypes` не изменилась.

## [0.7.0](../CHANGELOG.md#070-2026-07-23) (2026-07-23)

### Переход на оригинальные пакеты TypeORM

Форки `@steroidsjs/typeorm` и `@steroidsjs/nest-typeorm` больше не используются.
Удалите их из зависимостей приложения и подключите оригинальные пакеты:

```json
{
  "dependencies": {
    "@nestjs/typeorm": "^11.0.3",
    "typeorm": "^1.1.0"
  }
}
```

Замените импорты:

```ts
// До
import {InjectRepository} from '@steroidsjs/nest-typeorm';
import {Index, Repository} from '@steroidsjs/typeorm';

// После
import {InjectRepository} from '@nestjs/typeorm';
import {Index, Repository} from 'typeorm';
```

### Обновление NestJS и Steroids

Зависимости приведены к версиям, совместимым с `@steroidsjs/nest@5.0.0-beta.1`.
В приложении необходимо использовать как минимум следующие версии:

```json
{
  "dependencies": {
    "@nestjs/common": "^10.4.19",
    "@nestjs/event-emitter": "^3.0.1",
    "@nestjs/platform-express": "^10.4.19",
    "@nestjs/typeorm": "^11.0.3",
    "@steroidsjs/nest": "^5.0.0-beta.1",
    "@steroidsjs/nest-modules": "^0.1.6",
    "typeorm": "^1.1.0"
  }
}
```

Если проект напрямую использует `@nestjs/schematics` или `@nestjs/testing`, обновите их до `^10.2.3` и `^10.4.19` соответственно.

## [0.6.0](../CHANGELOG.md#060-2026-05-04) (2026-05-04)

### Lifetime для только что загруженных файлов

В очистку lost/temporary и unused файлов добавлена задержка перед удалением недавно созданных файлов.
Это снижает риск удалить файл, который уже загружен в хранилище, но еще не успел сохраниться в БД или привязаться к сущности.

По умолчанию применяются следующие значения:

- `JUST_UPLOADED_TEMP_FILE_LIFETIME_S=10` - lost/temporary файлы из local storage не удаляются в течение 10 секунд после создания
- `JUST_UPLOADED_UNUSED_FILE_LIFETIME_S=86400` - команда `unused-files` не удаляет файлы, созданные менее 24 часов назад

Значения в env задаются в секундах. Если параметры передаются через конфиг модуля, используйте поля `justUploadedTempFileLifetimeMs` и `justUploadedUnusedFileLifetimeMs` в миллисекундах.

Если в проекте нужно сохранить прежнее поведение без задержки, можно задать env-переменные со значением `0`:

```env
JUST_UPLOADED_TEMP_FILE_LIFETIME_S=0
JUST_UPLOADED_UNUSED_FILE_LIFETIME_S=0
```

### Изменения контрактов для кастомных реализаций

Если в проекте есть собственная реализация `IFileLocalStorage`, необходимо добавить метод `getFileCreateTimeMs(fileName: string): Promise<number>`.
Метод должен вернуть время создания файла в миллисекундах. Для local storage можно ориентироваться на `birthtime` или `mtime` файла.

Если в проекте есть собственная реализация `IFileRepository.getUnusedFilesIds`, она должна принимать новый опциональный параметр `unusedFileLifetimeMs`.
Этот параметр используется для фильтрации файлов по `createTime` перед удалением.

## [0.5.0](../CHANGELOG.md#050-2026-03-25) (2026-03-25)

### userId в FileModel

В FileModel было добавлено integer nullable поле userId, поэтому после обновления пакета можно добавить сохранение id пользователя, загрузившего файл.
Это можно сделать через fileUploadOptions. Например, в эндпоинте загрузки файла:

```ts
@Put('/upload-file')
async files(
    @UploadedFile() file: any,
    @Query() dto: ProjectFileUploadDto,
    @Context() context: ContextDto,
) {
    return this.fileService.upload(
        DataMapper.create<FileUploadOptions>(FileUploadOptions, {
            ...dto,
            userId: context.user.id,
            source: DataMapper.create(FileExpressSourceDto, file),
        }),
        FileSchema,
    );
}
```

## [0.4.0](../CHANGELOG.md#040-2025-12-18) (2025-12-18)

### Параметры загрузки в хранилище по fileType

В FileModel было добавлено string nullable поле fileType, поэтому после обновления пакета необходимо сгененерировать и применить миграции в проекте

В проекте в FileModule по токену ```GET_FILE_STORAGE_PARAMS_USE_CASE_TOKEN``` можно определить сервис, реализующий интерфейс ```IGetFileStorageParamsUseCase```
, что позволяет задать необходимые параметры при загрузке файла в соответствующее хранилище.

## [0.3.3](../CHANGELOG.md#033-2025-07-03) (2025-07-03)

### FileUploadInterceptor

Используемый ранее декоратор ```FileUpload``` отмечен как deprecated и заменен на ```FileUploadInterceptor```
Если в проекте используется ```FileUpload```, необходимо заменить его на ```FileUploadInterceptor``` следующим образом:

До
```ts
@Put('/upload-file')
@FileUpload()
@ApiQuery({type: FileUploadDto})
@ApiOkResponse({type: FileSchema})
async files(
    @UploadedFile() file: IExpressSource,
    @Query()dto: FileUploadDto,
) {}
```

После
```ts
@Put('/upload-file')
@UseInterceptors(FileUploadInterceptor)
@ApiQuery({type: FileUploadDto})
@ApiOkResponse({type: FileSchema})
async files(
    @UploadedFile() file: IExpressSource,
@Query()dto: FileUploadDto,
) {}
```
