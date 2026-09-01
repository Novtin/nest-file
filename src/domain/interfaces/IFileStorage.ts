import {Readable} from 'stream';
import {FileWriteResult} from '../dtos/FileWriteResult';
import {IFileReadable} from './IFileReadable';
import {IFileWritable} from './IFileWritable';

/**
 * Separator used in the canonical relative file path representation across the
 * module (forward slash). Both database and storage paths are reduced to this
 * form so they can be compared reliably regardless of the underlying OS or
 * object-storage driver.
 */
export const CANONICAL_PATH_SEPARATOR = '/';

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
    getFilesPaths(): Promise<string[] | null>,
    getFileCreateTimeMs(fileName: string): Promise<number>,
}

export const FILE_STORAGES_TOKEN = 'file_storages_token';
