import {FileModel} from '../models/FileModel';
import {IImagePreviewGenerator} from './IImagePreviewGenerator';

export const IImagePreviewGeneratorResolver = Symbol('IImagePreviewGeneratorResolver');

export interface IImagePreviewGeneratorResolver {
    resolve(file: FileModel): IImagePreviewGenerator,
}
