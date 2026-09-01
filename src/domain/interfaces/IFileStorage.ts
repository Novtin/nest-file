import {Readable} from 'stream';
import {FileWriteResult} from '../dtos/FileWriteResult';
import {IFileReadable} from './IFileReadable';
import {IFileWritable} from './IFileWritable';

export interface IFileStorageConfig {
    storageName: string,
    [key: string]: any,
}

export interface IFileStorage {
    init(config: IFileStorageConfig),
    read(file: IFileReadable): Promise<Buffer>,
    write(
        file: IFileWritable,
        source: Readable | Buffer,
    ): Promise<FileWriteResult>,
    getUrl(file: IFileReadable): string,
    deleteFile(fileName: string): void | Promise<void>,
}

export const FILE_STORAGES_TOKEN = 'file_storages_token';
