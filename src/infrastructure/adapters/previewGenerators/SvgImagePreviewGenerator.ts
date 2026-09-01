import {DataMapper} from '@steroidsjs/nest/usecases/helpers/DataMapper';
import {Inject} from '@nestjs/common';
import {FileModel} from '../../../domain/models/FileModel';
import {IImagePreviewGenerator} from '../../../domain/interfaces/IImagePreviewGenerator';
import {FileImageModel} from '../../../domain/models/FileImageModel';
import FilePreviewEnum from '../../../domain/enums/FilePreviewEnum';
import {IFileImageRepository} from '../../../domain/interfaces/IFileImageRepository';

export const SVG_MIME_TYPE = 'image/svg+xml';

export class SvgImagePreviewGenerator implements IImagePreviewGenerator {
    constructor(
        @Inject(IFileImageRepository)
        public repository: IFileImageRepository,
    ) {
    }

    canHandle(file: FileModel): boolean {
        return file.fileMimeType === SVG_MIME_TYPE;
    }

    async generate(file: FileModel, previewName: string) {
        const imageModel = DataMapper.create<FileImageModel>(FileImageModel, {
            fileId: file.id,
            fileName: file.fileName,
            folder: file.folder,
            fileMimeType: file.fileMimeType,
            storageName: file.storageName,
            fileSize: file.fileSize,
            width: null,
            height: null,
            previewName,
            isOriginal: previewName === FilePreviewEnum.ORIGINAL,
        });

        return this.repository.create(imageModel);
    }
}
