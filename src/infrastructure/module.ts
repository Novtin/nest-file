import {IFileService} from '@steroidsjs/nest-modules/file/services/IFileService';
import {IValidator} from '@steroidsjs/nest/usecases/interfaces/IValidator';
import {ModuleRef} from '@nestjs/core';
import {IFileRepository} from '../domain/interfaces/IFileRepository';
import {IFileImageRepository} from '../domain/interfaces/IFileImageRepository';
import {FileService} from '../domain/services/FileService';
import {FileImageService} from '../domain/services/FileImageService';
import {FileConfigService} from '../domain/services/FileConfigService';
import {FileStorageFactory} from '../domain/services/FileStorageFactory';
import {FileLocalStorage} from '../domain/storages/FileLocalStorage';
import {MinioS3Storage} from '../domain/storages/MinioS3Storage';
import {DeleteLostAndTemporaryFilesService} from '../domain/services/DeleteLostAndTemporaryFilesService';
import {FileRemovedEventHandleUseCase} from '../usecases/fileRemovedEventHandleUseCase/FileRemovedEventHandleUseCase';
import {IFileTypeService} from '../domain/interfaces/IFileTypeService';
import {FileTypeService} from '../domain/services/FileTypeService';
import {IFileStorageFactory} from '../domain/interfaces/IFileStorageFactory';
import {fileValidators} from '../domain/validators';
import {FILE_VALIDATORS_TOKEN} from '../domain/constants/FileValidatorsToken';
import {FILE_STORAGES_TOKEN} from '../domain/interfaces/IFileStorage';
import {ICreateImagePreviewUseCase} from '../domain/interfaces/ICreateImagePreviewUseCase';
import {CreateImagePreviewUsecase} from '../usecases/createImagePreview/CreateImagePreviewUsecase';
import {IImagePreviewGeneratorResolver} from '../domain/interfaces/IImagePreviewGeneratorResolver';
import {IImagePreviewGenerator, IImagePreviewGeneratorsToken} from '../domain/interfaces/IImagePreviewGenerator';
import {FileEventsSubscriber} from './subscribers/FileEventsSubscriber';
import {CronJobsRegister} from './services/CronJobsRegister';
import {IFileModuleConfig} from './config';
import {FileImageRepository} from './repositories/FileImageRepository';
import {FileRepository} from './repositories/FileRepository';
import {ClearUnusedFilesCommand} from './commands/ClearUnusedFilesCommand';
import {ImagePreviewGeneratorResolver} from './services/ImagePreviewGeneratorResolver';
import {SharpImagePreviewGenerator} from './adapters/previewGenerators/SharpImagePreviewGenerator';
import {SvgImagePreviewGenerator} from './adapters/previewGenerators/SvgImagePreviewGenerator';

export default (config: IFileModuleConfig) => ({
    controllers: [],
    providers: [
        // Repositories
        {
            provide: IFileRepository,
            useClass: FileRepository,
        },
        {
            provide: IFileImageRepository,
            useClass: FileImageRepository,
        },

        // Infrastructure services
        CronJobsRegister,

        // Validators
        ...fileValidators,
        {
            provide: FILE_VALIDATORS_TOKEN,
            useFactory: (...providers: IValidator[]) => providers,
            inject: fileValidators,
        },

        // Storages
        FileLocalStorage,
        MinioS3Storage,

        // Services
        {
            provide: FileConfigService,
            useFactory: () => new FileConfigService(config),
        },
        {
            provide: IFileTypeService,
            useClass: FileTypeService,
        },

        {
            provide: ICreateImagePreviewUseCase,
            useClass: CreateImagePreviewUsecase,
        },
        {
            provide: IImagePreviewGeneratorResolver,
            useClass: ImagePreviewGeneratorResolver,
        },
        SharpImagePreviewGenerator,
        SvgImagePreviewGenerator,
        {
            provide: IImagePreviewGeneratorsToken,
            useFactory: (...generators: IImagePreviewGenerator[]) => generators,
            inject: [SvgImagePreviewGenerator, SharpImagePreviewGenerator],
        },

        {
            provide: FILE_STORAGES_TOKEN,
            inject: [ModuleRef, FileConfigService],
            useFactory: async (moduleRef: ModuleRef, fileConfigService: FileConfigService) => Object.fromEntries(
                await Promise.all(Object.entries(fileConfigService.storages).map(async ([storageName, definition]) => {
                    const storage = await moduleRef.resolve(definition.driver);
                    storage.init({
                        storageName,
                        ...definition.options,
                    });
                    return [storageName, storage];
                })),
            ),
        },

        {
            provide: IFileStorageFactory,
            useClass: FileStorageFactory,
        },
        {
            provide: IFileService,
            useClass: FileService,
        },
        {
            provide: FileImageService,
            useClass: FileImageService,
        },

        DeleteLostAndTemporaryFilesService,

        // Subscribers
        FileEventsSubscriber,

        // UseCases
        FileRemovedEventHandleUseCase,
        ClearUnusedFilesCommand,
    ],
    exports: [
        IFileService,
        FileImageService,
    ],
});
