import * as fs from 'fs';
import {Readable} from 'stream';
import {DataMapper} from '@steroidsjs/nest/usecases/helpers/DataMapper';
import {ValidationHelper} from '@steroidsjs/nest/usecases/helpers/ValidationHelper';
import {getMimeType} from 'stream-mime-type';
import * as mime from 'mime-types';
import {IValidator} from '@steroidsjs/nest/usecases/interfaces/IValidator';
import {ReadService} from '@steroidsjs/nest/usecases/services/ReadService';
import SearchQuery from '@steroidsjs/nest/usecases/base/SearchQuery';
import {Inject, Injectable, Type} from '@nestjs/common';
import {toInteger as _toInteger} from 'lodash';
import * as Sentry from '@sentry/node';
import {ContextDto} from '@steroidsjs/nest/usecases/dtos/ContextDto';
import {generateUid} from '@steroidsjs/nest/infrastructure/decorators/typeorm/fields/TypeOrmUidField/TypeOrmUidBehaviour';
import {EventEmitter2} from '@nestjs/event-emitter';
import {IFileRepository} from '../interfaces/IFileRepository';
import {FileModel} from '../models/FileModel';
import {FileUploadOptions} from '../dtos/FileUploadOptions';
import {FileSaveDto} from '../dtos/FileSaveDto';
import {FileExpressSourceDto} from '../dtos/sources/FileExpressSourceDto';
import {FileLocalSourceDto} from '../dtos/sources/FileLocalSourceDto';
import {FileStreamSourceDto} from '../dtos/sources/FileStreamSourceDto';
import {IFilePreviewOptions} from '../interfaces/IFilePreviewOptions';
import {IEventEmitter} from '../interfaces/IEventEmitter';
import {FileRemovedEventDto} from '../dtos/events/FileRemovedEventDto';
import {IFileTypeService} from '../interfaces/IFileTypeService';
import {IFileStorageFactory} from '../interfaces/IFileStorageFactory';
import {FILE_VALIDATORS_TOKEN} from '../constants/FileValidatorsToken';
import {FileConfigService} from './FileConfigService';
import {FileImageService} from './FileImageService';

@Injectable()
export class FileService extends ReadService<FileModel> {
    constructor(
        @Inject(IFileRepository)
        protected readonly repository: IFileRepository,
        protected readonly fileImageService: FileImageService,
        protected readonly fileConfigService: FileConfigService,
        @Inject(IFileStorageFactory)
        protected readonly fileStorageFactory: IFileStorageFactory,
        @Inject(EventEmitter2)
        protected readonly eventEmitter: IEventEmitter,
        @Inject(IFileTypeService)
        protected readonly fileTypeService: IFileTypeService,
        @Inject(FILE_VALIDATORS_TOKEN)
        public validators: IValidator[],
    ) {
        super();
    }

    async read(model: FileModel): Promise<Buffer> {
        const storage = this.fileStorageFactory.get(model.storageName);
        return storage.read(model);
    }

    async upload<T>(
        rawOptions: string | FileExpressSourceDto | FileLocalSourceDto | FileStreamSourceDto | FileUploadOptions,
        schemaClass: T = null,
    ): Promise<T | FileModel> {
        const options = this.normalizeUploadOptions(rawOptions);
        const fileModel = await this.uploadFileInternal(options);
        const previewOptionsMap = await this.getPreviewOptionsMap(fileModel.fileType, options.previews);
        await this.createPreviewsOnImage(fileModel, previewOptionsMap);
        // @ts-ignore
        return schemaClass ? DataMapper.create(schemaClass, fileModel) : fileModel;
    }

    async uploadImage<T>(
        rawOptions: string | FileExpressSourceDto | FileLocalSourceDto | FileStreamSourceDto | FileUploadOptions,
        customPreviews: Record<string, IFilePreviewOptions> = null,
        schemaClass: T = null,
    ): Promise<T | FileModel> {
        const options = this.normalizeUploadOptions(rawOptions);
        const fileModel = await this.uploadFileInternal(options);
        const overridePreviewOptionsMap = customPreviews || options.previews || null;
        const previewOptionsMap = await this.getPreviewOptionsMap(fileModel.fileType, overridePreviewOptionsMap);
        await this.createPreviewsOnImage(fileModel, previewOptionsMap);
        // @ts-ignore
        return schemaClass ? DataMapper.create(schemaClass, fileModel) : fileModel;
    }

    protected async uploadFileInternal(options: FileUploadOptions): Promise<FileModel> {
        // If "fileType" filed is specified, the options associated with it are applied
        if (options.fileType) {
            const fileTypeOptions = await this.fileTypeService.getFileUploadOptionsByType(options.fileType);
            DataMapper.applyValues(options, fileTypeOptions);
        }

        // Resolve storage name
        if (!options.storageName) {
            options.storageName = this.fileConfigService.defaultStorageName;
        }

        // Create FileModel from source
        const firstUid = [].concat(options.uids || [])?.[0];

        const fileDto = await this.createDtoFromSource(options.source, firstUid);
        if (options.fileType) {
            fileDto.fileType = options.fileType;
        }
        if (options.folder) {
            fileDto.folder = options.folder;
        }
        if (options.title) {
            fileDto.title = options.title;
        }
        if (options.userId) {
            fileDto.userId = options.userId;
        }

        // Validate
        if (options.imagesOnly) {
            options.mimeTypes = this.fileConfigService.imagesMimeTypes;
        }
        if (!options.maxSizeMb) {
            options.maxSizeMb = this.fileConfigService.fileMaxSizeMb;
        }
        await ValidationHelper.validate(fileDto, {params: options as any}, this.validators);

        // Get file stream from source
        const stream = await this.createStreamFromSource(options.source);

        // Save original file via storage
        const writeResult = await this.fileStorageFactory
            .get(options.storageName)
            .write(fileDto, stream);

        // Save file in database
        return this.repository.create(DataMapper.create(FileModel, {
            ...fileDto,
            fileMimeType: fileDto.fileMimeType || '',
            md5: fileDto.md5 || writeResult.md5,
            storageName: options.storageName,
        }));
    }

    protected async createPreviewsOnImage(fileModel: FileModel, previews: Record<string, IFilePreviewOptions>) {
        // Create previews for image
        if (this.fileConfigService.imagesMimeTypes.includes(fileModel.fileMimeType)) {
            fileModel.images = [];
            for (const previewName of Object.keys(previews)) {
                const preview = previews[previewName];
                if (preview?.enable) {
                    try {
                        fileModel.images.push(
                            await this.fileImageService.createPreview(fileModel, previewName, preview),
                        );
                    } catch (e) {
                        Sentry.captureException(e, {
                            extra: {
                                scope: 'FileService',
                                fileModelId: fileModel.id,
                            },
                        });
                    }
                }
            }
        }
    }

    protected async getPreviewOptionsMap(
        fileType: string = null,
        customPreviewOptionsMap: Record<string, IFilePreviewOptions> = null,
    ): Promise<Record<string, IFilePreviewOptions>> {
        if (customPreviewOptionsMap) {
            return customPreviewOptionsMap;
        }

        if (fileType) {
            const fileTypeOptions = await this.fileTypeService.getFileUploadOptionsByType(fileType);

            if (fileTypeOptions?.previews) {
                return fileTypeOptions.previews;
            }
        }

        return this.fileConfigService.previews;
    }

    protected normalizeUploadOptions(
        rawOptions: string | FileExpressSourceDto | FileLocalSourceDto | FileStreamSourceDto | FileUploadOptions,
    ): FileUploadOptions {
        if (typeof rawOptions === 'string') {
            rawOptions = FileLocalSourceDto.createFromPath(rawOptions);
        }

        if (
            rawOptions instanceof FileExpressSourceDto
            || rawOptions instanceof FileLocalSourceDto
            || rawOptions instanceof FileStreamSourceDto
        ) {
            return DataMapper.create(FileUploadOptions, {source: rawOptions});
        }

        return rawOptions as FileUploadOptions;
    }

    /**
     * Convert any sources to stream and return it
     * @param source
     * @protected
     */
    protected async createStreamFromSource(
        source: FileExpressSourceDto | FileLocalSourceDto | FileStreamSourceDto,
    ): Promise<Readable | Buffer> {
        if (source instanceof FileExpressSourceDto || source instanceof FileLocalSourceDto) {
            // Check file exists
            try {
                await fs.promises.access(source.path, fs.constants.F_OK);
            } catch (e) {
                throw new Error('File not found: ' + source.path);
            }

            if (source instanceof FileExpressSourceDto) {
                return fs.promises.readFile(source.path);
            }
            return fs.createReadStream(source.path, 'utf8');
        }

        return source.stream;
    }

    /**
     * Create FileSaveDto from upload source
     * @param source
     * @param uid
     * @protected
     */
    protected async createDtoFromSource(
        source: FileExpressSourceDto | FileLocalSourceDto | FileStreamSourceDto,
        uid: string = null,
    ): Promise<FileSaveDto> {
        const dto = DataMapper.create(FileSaveDto, {
            uid: uid || generateUid(),
            fileMimeType: '',
        });

        if (source instanceof FileExpressSourceDto) {
            dto.title = source.originalname;
            dto.fileSize = source.size;
            dto.fileMimeType = source.mimetype;
        }

        if (source instanceof FileLocalSourceDto || source instanceof FileStreamSourceDto) {
            dto.title = source.fileName || null;
            dto.fileSize = source.fileSize || null;
            dto.fileMimeType = source.fileMimeType || null;
            dto.md5 = source.md5 || null;

            if (source instanceof FileStreamSourceDto && source.stream instanceof Buffer) {
                dto.fileSize = source.stream.length;
            }
        }

        // Auto get file size, if no exists
        if (!dto.fileSize && (source instanceof FileExpressSourceDto || source instanceof FileLocalSourceDto)) {
            dto.fileSize = (await fs.promises.stat(source.path)).size;
        }

        // Auto get mime type, if no exists
        if (!dto.fileSize && (source instanceof FileExpressSourceDto || source instanceof FileLocalSourceDto)) {
            dto.fileMimeType = mime.lookup('.' + source.path.split('.').pop());
        } else if (source instanceof FileStreamSourceDto && source.stream instanceof Readable) {
            dto.fileMimeType = (await getMimeType(source.stream, {
                filename: dto.fileName,
            })).mime;
        }

        // Generate file name by uid and extension
        const extension = (dto.title || '').split('.').pop()
            || (dto.fileMimeType ? mime.extension(dto.fileMimeType) : '');
        dto.fileName = extension ? `${dto.uid}.${extension}` : dto.uid;
        if (extension && !dto.fileMimeType) {
            dto.fileMimeType = mime.lookup(extension);
        }

        return dto;
    }

    async findById(id: number | string, context?: ContextDto | null): Promise<FileModel>

    async findById<TSchema>(
        id: number | string,
        context?: ContextDto | null,
        schemaClass?: Type<TSchema>,
    ): Promise<Type<TSchema>>

    async findById<TSchema>(
        rawId: number | string,
        context?: ContextDto | null,
        schemaClass?: Type<TSchema>,
    ): Promise<FileModel | Type<TSchema>> {
        const id = _toInteger(rawId);
        const model = await this.repository.findOne(
            (new SearchQuery<FileModel>()).where({id}),
        );
        // @ts-ignore
        return schemaClass ? DataMapper.create(schemaClass, model) : model;
    }

    async getFileWithDocument(fileName: string) {
        return this.repository.getFileWithDocument(fileName);
    }

    async getFilesPathsFromDb(storageName: string): Promise<string[] | null> {
        return this.repository.getFilesPathsByStorageName(storageName);
    }

    public async remove(id: number, context: ContextDto) {
        const file: FileModel = await this.createQuery()
            .with(['images'])
            .where({id})
            .one();

        for (const image of file.images) {
            await this.fileImageService.remove(image.id, context);
        }

        await this.repository.remove(id);

        this.eventEmitter.emit(FileRemovedEventDto.eventName, DataMapper.create(FileRemovedEventDto, {
            fileId: file.id,
            folder: file.folder,
            fileName: file.fileName,
            storageName: file.storageName,
        }));
    }

    public async getUnusedFilesIds(config: {
        fileNameLike?: string,
        ignoredTables?: string[],
        isEmpty?: boolean,
        unusedFileLifetimeMs?: number,
    }): Promise<number[]> {
        return this.repository.getUnusedFilesIds(config);
    }

    public async getCount(): Promise<number> {
        return this.repository.getCount();
    }
}
