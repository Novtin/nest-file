import {FileModel} from '../models/FileModel';
import {FileImageModel} from '../models/FileImageModel';
import {IFilePreviewOptions} from './IFilePreviewOptions';

export const ICreateImagePreviewUseCase = Symbol('ICreateImagePreviewUseCase');

export interface ICreateImagePreviewUseCase {
  handle(file: FileModel, previewName: string, previewOptions?: IFilePreviewOptions): Promise<FileImageModel>,
}
