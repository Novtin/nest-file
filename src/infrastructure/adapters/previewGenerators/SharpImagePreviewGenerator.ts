import {DataMapper} from '@steroidsjs/nest/usecases/helpers/DataMapper';
import {Inject, Optional} from '@nestjs/common';
import * as sharp from 'sharp';
import {FileModel} from '../../../domain/models/FileModel';
import {IImagePreviewGenerator} from '../../../domain/interfaces/IImagePreviewGenerator';
import {FileImageModel} from '../../../domain/models/FileImageModel';
import FilePreviewEnum from '../../../domain/enums/FilePreviewEnum';
import {IFileImageRepository} from '../../../domain/interfaces/IFileImageRepository';
import {IFilePreviewOptions} from '../../../domain/interfaces/IFilePreviewOptions';
import {IFileStorageFactory} from '../../../domain/interfaces/IFileStorageFactory';
import {FileHelper} from '../../../domain/helpers/FileHelper';
import {SharpHelper} from '../../../domain/helpers/SharpHelper';
import {FileSaveDto} from '../../../domain/dtos/FileSaveDto';
import {
    GET_FILE_STORAGE_PARAMS_USE_CASE_TOKEN,
    IGetFileStorageParamsUseCase,
} from '../../../usecases/getFileStorageParams/interfaces/IGetFileStorageParamsUseCase';
import {SVG_MIME_TYPE} from './SvgImagePreviewGenerator';

export class SharpImagePreviewGenerator implements IImagePreviewGenerator {
    constructor(
        @Inject(IFileImageRepository)
        public repository: IFileImageRepository,
        @Inject(IFileStorageFactory)
        private readonly fileStorageFactory: IFileStorageFactory,
        @Optional()
        @Inject(GET_FILE_STORAGE_PARAMS_USE_CASE_TOKEN)
        protected readonly getFileStorageParamsUseCase?: IGetFileStorageParamsUseCase,
    ) {
    }

    canHandle(file: FileModel): boolean {
        return file.fileMimeType.startsWith('image/')
          && file.fileMimeType !== SVG_MIME_TYPE;
    }

    async generate(
        file: FileModel,
        previewName: string,
        options: IFilePreviewOptions,
    ): Promise<FileImageModel> {
        const content = await this.fileStorageFactory.get(file.storageName).read(file);

        const image = sharp(content, {failOnError: false});
        const imageMetadata = await image.metadata();
        let imageWidth: number;
        let imageHeight: number;

        if (options?.rotate) {
            // base on EXIF
            image.autoOrient();
            imageWidth = imageMetadata.autoOrient.width;
            imageHeight = imageMetadata.autoOrient.height;
        } else {
            // not base on EXIF
            imageWidth = imageMetadata.width;
            imageHeight = imageMetadata.height;
        }

        let hasChanges = false;

        const isSizesProvided = options?.width && options?.height;
        const isStretchNeeded = imageWidth < options?.width || imageHeight < options?.height;
        const isStretchEnabled = options?.stretch;

        if (isSizesProvided && (!isStretchNeeded || isStretchEnabled)) {
            image.resize(options.width, options.height, options.sharp?.resize);
            hasChanges = true;
        }

        if (options?.sharp?.extend) {
            image.extend(options.sharp.extend);
            hasChanges = true;
        }
        if (options?.sharp?.extract) {
            image.extract(options.sharp.extract);
            hasChanges = true;
        }

        // add image output options if they are specified
        const sharpOptionName = SharpHelper.getImageOptionNameByMimeType(file.fileMimeType);
        if (sharpOptionName && options.sharp?.outputImageOptions?.[sharpOptionName]) {
            image[sharpOptionName](options.sharp?.outputImageOptions[sharpOptionName]);
        }

        const {data, info} = await image.toBuffer({resolveWithObject: true});

        const imageModel = DataMapper.create<FileImageModel>(FileImageModel, {
            fileId: file.id,
            fileName: hasChanges
                ? FileHelper.addPreviewSuffix(file.fileName, previewName)
                : file.fileName,
            folder: file.folder,
            fileMimeType: file.fileMimeType,
            storageName: file.storageName,
            fileSize: info.size,
            width: info.width,
            height: info.height,
            previewName,
            isOriginal: previewName === FilePreviewEnum.ORIGINAL,
        });

        if (hasChanges) {
            const fileStorageParams = this.getFileStorageParamsUseCase
                ? await this.getFileStorageParamsUseCase.handle(file.fileType, file.storageName)
                : null;

            await this.fileStorageFactory
                .get(file.storageName)
                .write(
                    DataMapper.create<FileSaveDto>(FileSaveDto, {
                        uid: file.uid,
                        folder: imageModel.folder,
                        fileName: imageModel.fileName,
                        fileMimeType: file.fileMimeType,
                    }),
                    data,
                    fileStorageParams,
                );
        }

        return this.repository.create(imageModel);
    }
}
