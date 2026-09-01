import {DataMapper} from '@steroidsjs/nest/usecases/helpers/DataMapper';
import {ContextDto} from '@steroidsjs/nest/usecases/dtos/ContextDto';
import {Inject, Injectable} from '@nestjs/common';
import {EventEmitter2} from '@nestjs/event-emitter';
import {IFileImageRepository} from '../interfaces/IFileImageRepository';
import {FileImageModel} from '../models/FileImageModel';
import {FileModel} from '../models/FileModel';
import {IFilePreviewOptions} from '../interfaces/IFilePreviewOptions';
import {FileRemovedEventDto} from '../dtos/events/FileRemovedEventDto';
import {IEventEmitter} from '../interfaces/IEventEmitter';
import {ICreateImagePreviewUseCase} from '../interfaces/ICreateImagePreviewUseCase';

@Injectable()
export class FileImageService {
    constructor(
        @Inject(IFileImageRepository)
        public repository: IFileImageRepository,
        @Inject(ICreateImagePreviewUseCase)
        protected readonly createImagePreviewUseCase: ICreateImagePreviewUseCase,
        @Inject(EventEmitter2)
        protected readonly eventEmitter: IEventEmitter,
    ) {
    }

    async createPreview(file: FileModel, previewName: string, previewOptions: IFilePreviewOptions = null): Promise<FileImageModel> {
        return this.createImagePreviewUseCase.handle(file, previewName, previewOptions || undefined);
    }

    async getFilesPathsFromDb(storageName: string): Promise<string[] | null> {
        return this.repository.getFilesPathsByStorageName(storageName);
    }

    public async remove(id: number, context: ContextDto) {
        const fileImage = await this.repository.createQuery()
            .where({id})
            .one();

        await this.repository.remove(id);

        this.eventEmitter.emit(FileRemovedEventDto.eventName, DataMapper.create(FileRemovedEventDto, {
            fileId: fileImage.id,
            folder: fileImage.folder,
            fileName: fileImage.fileName,
            storageName: fileImage.storageName,
        }));
    }
}
