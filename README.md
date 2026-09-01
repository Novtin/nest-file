# Микросервис загрузки файлов

Возможности:

1. Загрузить файл с веб-браузера или мобильного приложения
2. Сохранить его на диске или в aws-like хранилище
3. Подготовить миниатюры для изображений

## Подключение

1. Создать в проекте модуль на основе пакета:
```ts
import {Module} from '@steroidsjs/nest/infrastructure/decorators/Module';
import coreModule from '@steroidsjs/nest-file';
import {IFileModuleConfig} from '@steroidsjs/nest-file/infrastructure/config';
import {ModuleHelper} from '@steroidsjs/nest/infrastructure/helpers/ModuleHelper';

@Module({
    ...coreModule,
    tables: [
        ...coreModule.tables,
        ...ModuleHelper.importDir(__dirname + '/tables'),
    ],
    module: (config: IFileModuleConfig) => {
        const module = coreModule.module(config);
        return {
            ...module,
            providers: [
                ...module.providers,
            ],
            controllers: [
                ...module.controllers,
            ],
            exports: [
                ...module.exports,
            ],
        };
    },
})
export class FileModule {}
```

2. Сгенерировать и применить миграции:
```
yarn cli migrate:generate
yarn cli migrate
```

3. Задать в .env файле проекта нужную конфигурацию:
```
APP_FILE_STORAGE_NAME=minio_s3
APP_FILE_STORAGE_S3_HOST=s3.yandexcloud.net
APP_FILE_STORAGE_S3_ACCESS=xxx
APP_FILE_STORAGE_S3_SECRET=yyy
APP_FILE_STORAGE_S3_MAIN_BUCKET=arm-supervisor
APP_FILE_STORAGE_S3_PORT=443
APP_FILE_STORAGE_S3_USE_SSL=1
APP_FILE_STORAGE_ROOT_URL=https://storage.yandexcloud.net/arm-supervisor
JUST_UPLOADED_TEMP_FILE_LIFETIME_S=10
JUST_UPLOADED_UNUSED_FILE_LIFETIME_S=86400
```
Описание переменных: 
   - APP_FILE_STORAGE_NAME - тип используемого хранилища по-умолчанию (minio_s3 или local, из словаря FileStorageEnum)
   - APP_FILE_STORAGE_ROOT_PATH - место хранения файлов при использовании хранилища local (по-умолчанию join(process.cwd(), '../files/uploaded'))
   - APP_FILE_STORAGE_ROOT_URL - URL-префикс для ссылок на файлы (по-умолчанию /files/uploaded)
   - APP_FILE_MAX_SIZE_MB - максимальный размер файла в мегабайтах
   - APP_FILE_PREVIEW_THUMBNAIL_WIDTH - Ширина генеририуемых превью
   - APP_FILE_PREVIEW_THUMBNAIL_HEIGHT - Высота генеририуемых превью
   - APP_FILE_STORAGE_S3_HOST - Хост S3 хранилища
   - APP_FILE_STORAGE_S3_ACCESS - Публичный ключ S3 хранилища
   - APP_FILE_STORAGE_S3_SECRET - Секретный ключ S3 хранилища
   - APP_FILE_STORAGE_S3_MAIN_BUCKET - название бакета S3 хранилища
   - APP_FILE_STORAGE_S3_PORT - порт S3 хранилища
   - APP_FILE_STORAGE_S3_USE_SSL - использовать SSL для подключения
   - APP_FILE_STORAGE_S3_REGION - регион S3 хранилища
   - JUST_UPLOADED_TEMP_FILE_LIFETIME_S - время жизни только что загруженных temporary/lost файлов в секундах перед удалением cron-очисткой (по-умолчанию 10 секунд)
   - JUST_UPLOADED_UNUSED_FILE_LIFETIME_S - минимальный возраст unused файла в секундах перед удалением командой `unused-files` (по-умолчанию 86400 секунд)

### Lifetime только что загруженных файлов

Чтобы очистка не удаляла файлы, которые уже загружены в хранилище, но еще не успели сохраниться в БД или привязаться к сущности, для temporary/lost и unused файлов используется задержка перед удалением.
Для настройки через конфиг модуля доступны поля `justUploadedTempFileLifetimeMs` и `justUploadedUnusedFileLifetimeMs` в миллисекундах.

## Провайдинг нескольких хранилищ

По умолчанию модуль провайдит два хранилища: `local` и `minio_s3`.
Если в проекте нужно использовать несколько экземпляров одного хранилища с разными настройками, добавьте их определения в `storages`.
Ключи в `storages` используются как `storageName`, а `driver` определяет класс хранилища. Модуль самостоятельно резолвит драйвер для каждого ключа; встроенные драйверы имеют scope `TRANSIENT`.

```ts
import coreModule from '@steroidsjs/nest-file';
import {MinioS3Storage} from '@steroidsjs/nest-file/domain/storages/MinioS3Storage';

enum StorageNameEnum {
    MINIO_S3_1 = 'minio_s3_1',
    MINIO_S3_2 = 'minio_s3_2',
}

@Module({
    ...coreModule,
    config: () => {
        const coreConfig = coreModule.config();
        return {
            ...coreConfig,
            defaultStorageName: StorageNameEnum.MINIO_S3_1,
            storages: {
                ...coreConfig.storages,
                [StorageNameEnum.MINIO_S3_1]: {
                    driver: MinioS3Storage,
                    options: {
                        mainBucket: 'files',
                        rootUrl: 'https://storage.example.com/files',
                    },
                },
                [StorageNameEnum.MINIO_S3_2]: {
                    driver: MinioS3Storage,
                    options: {
                        mainBucket: 'images',
                        rootUrl: 'https://storage.example.com/images',
                    },
                },
            },
        };
    },
})
export class FileModule {}
```

Для экземпляров `MinioS3Storage` автоматически используются стандартные S3-настройки из env и `storages.minio_s3.options`; в `options` достаточно указать отличающиеся значения. Аналогично `FileLocalStorage` наследует `rootPath` и `rootUrl` из env и `storages.local.options`.
Пользовательский `driver` нужно добавить в `providers` модуля и объявить с Nest scope `TRANSIENT`, чтобы каждое имя хранилища получало отдельный экземпляр.

После этого нужное хранилище можно выбрать при загрузке:

```ts
await fileService.upload({
    source,
    storageName: StorageNameEnum.MINIO_S3_2,
});
```

### Параметры загрузки файла в хранилище

Если параметры записи зависят от `fileType` или имени хранилища, в проекте можно запровайдить сервис, реализующий `IGetFileStorageParamsUseCase`, по токену `GET_FILE_STORAGE_PARAMS_USE_CASE_TOKEN`.
Хранилища вызывают этот use case при записи файла.

```ts
import {
    GET_FILE_STORAGE_PARAMS_USE_CASE_TOKEN,
    IGetFileStorageParamsUseCase,
} from '@steroidsjs/nest-file/usecases/getFileStorageParams/interfaces/IGetFileStorageParamsUseCase';

@Injectable()
class GetFileStorageParamsUseCase implements IGetFileStorageParamsUseCase {
    async handle(fileType: string | undefined, storageName: string) {
        if (storageName === StorageNameEnum.MINIO_S3_2 && fileType === 'avatar') {
            return {
                'Cache-Control': 'public, max-age=31536000',
            };
        }

        return {};
    }
}

@Module({
    ...coreModule,
    module: (config) => {
        const module = coreModule.module(config);
        return {
            ...module,
            providers: [
                ...module.providers,
                {
                    provide: GET_FILE_STORAGE_PARAMS_USE_CASE_TOKEN,
                    useClass: GetFileStorageParamsUseCase,
                },
            ],
        };
    },
})
export class FileModule {}
```
