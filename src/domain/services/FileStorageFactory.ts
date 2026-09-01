import {Inject, Injectable} from '@nestjs/common';
import {FILE_STORAGES_TOKEN, IFileStorage} from '../interfaces/IFileStorage';
import {IFileStorageFactory} from '../interfaces/IFileStorageFactory';
import {FileConfigService} from './FileConfigService';

@Injectable()
export class FileStorageFactory implements IFileStorageFactory {
    constructor(
        private fileConfigService: FileConfigService,
        @Inject(FILE_STORAGES_TOKEN)
        private storages: Record<string, IFileStorage>,
    ) {
    }

    public get(name: string = null): IFileStorage {
        name = name || this.fileConfigService.defaultStorageName;

        if (!this.storages[name]) {
            throw new Error('Not found storage by name: ' + name);
        }

        return this.storages[name];
    }
}
