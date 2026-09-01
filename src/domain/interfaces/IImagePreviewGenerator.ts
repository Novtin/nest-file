import {FileImageModel} from '../models/FileImageModel';
import {FileModel} from '../models/FileModel';
import {IFilePreviewOptions} from './IFilePreviewOptions';

export const IImagePreviewGeneratorsToken = Symbol('IImagePreviewGenerators');

export interface IImagePreviewGenerator {
    canHandle(file: FileModel): boolean,

    generate(
        file: FileModel,
        previewName: string,
        options: IFilePreviewOptions,
    ): Promise<FileImageModel>,
}
