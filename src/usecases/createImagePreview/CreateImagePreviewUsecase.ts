import {Inject} from '@nestjs/common';
import {FileModel} from '../../domain/models/FileModel';
import {IFileTypeService} from '../../domain/interfaces/IFileTypeService';
import {ICreateImagePreviewUseCase} from '../../domain/interfaces/ICreateImagePreviewUseCase';
import {IFilePreviewOptions} from '../../domain/interfaces/IFilePreviewOptions';
import {FileConfigService} from '../../domain/services/FileConfigService';
import {IImagePreviewGeneratorResolver} from '../../domain/interfaces/IImagePreviewGeneratorResolver';

export class CreateImagePreviewUsecase implements ICreateImagePreviewUseCase {
    constructor(
        @Inject(IFileTypeService)
        private readonly fileTypeService: IFileTypeService,
        private readonly fileConfigService: FileConfigService,
        @Inject(IImagePreviewGeneratorResolver)
        private readonly imagePreviewGeneratorResolver: IImagePreviewGeneratorResolver,
    ) {
    }

    async handle(file: FileModel, previewName: string, previewOptions?: IFilePreviewOptions) {
        const resolvedPreviewOptions = previewOptions || await this.getPreviewOptions(file.fileType, previewName);
        const previewGenerator = this.imagePreviewGeneratorResolver.resolve(file);

        return previewGenerator.generate(file, previewName, resolvedPreviewOptions);
    }

    private async getPreviewOptions(fileType: string, previewName: string): Promise<IFilePreviewOptions> {
        if (fileType) {
            const fileTypeConfig = await this.fileTypeService.getFileUploadOptionsByType(fileType);
            const fileTypePreviewOptions = fileTypeConfig?.previews?.[previewName];
            if (fileTypePreviewOptions) {
                return fileTypePreviewOptions;
            }
        }

        return this.fileConfigService.previews?.[previewName];
    }
}
