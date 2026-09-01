import {Inject} from '@nestjs/common';
import {
    IImagePreviewGenerator,
    IImagePreviewGeneratorsToken,
} from '../../domain/interfaces/IImagePreviewGenerator';
import {FileModel} from '../../domain/models/FileModel';
import {IImagePreviewGeneratorResolver} from '../../domain/interfaces/IImagePreviewGeneratorResolver';

export class ImagePreviewGeneratorResolver implements IImagePreviewGeneratorResolver {
    constructor(
      @Inject(IImagePreviewGeneratorsToken)
      private readonly generators: IImagePreviewGenerator[],
    ) {}

    resolve(file: FileModel): IImagePreviewGenerator {
        const previewGenerator = this.generators
            .find(generator => generator.canHandle(file));

        if (!previewGenerator) {
            throw new Error(`No preview generator found for mimeType=${file.fileMimeType}`);
        }

        return previewGenerator;
    }
}
