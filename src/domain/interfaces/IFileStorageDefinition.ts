import {Type} from '@nestjs/common';
import {IFileStorage} from './IFileStorage';

export interface IFileStorageDefinition {
    driver: Type<IFileStorage>,
    options?: Record<string, any>,
}
