import * as Sentry from '@sentry/node';
import {Inject, Injectable, Optional} from '@nestjs/common';
import {IFileStorage} from '../interfaces/IFileStorage';
import {IFileStorageFactory} from '../interfaces/IFileStorageFactory';
import {
    GetFileModelsPathUsecaseToken,
    IGetFileModelsPathUsecase,
} from '../../usecases/getFilePathModels/interfaces/IGetFileModelsPathUsecase';
import {FileConfigService} from './FileConfigService';

@Injectable()
export class DeleteLostAndTemporaryFilesService {
    constructor(
        @Inject(IFileStorageFactory)
        private fileStorageFactory: IFileStorageFactory,
        protected readonly fileConfigService: FileConfigService,
        @Optional()
        @Inject(GetFileModelsPathUsecaseToken)
        private getFileModelsPathUsecase: IGetFileModelsPathUsecase,
    ) {
    }

    /**
     * Removes files that exist in the storage but are not referenced from the database
     * (lost/orphaned files), except those created recently enough to still be uploading.
     * Works for both local filesystem and S3 (Minio) storages, as both implement
     * the `getFilesPaths` / `getFileCreateTimeMs` / `deleteFile` contract of IFileStorage.
     */
    async deleteLostAndTemporaryFiles(storageName: string): Promise<void> {
        const storage = this.getStorage(storageName);
        if (!storage) {
            return;
        }
        const currentTimeMs = (new Date()).getTime();
        const lostAndTemporaryFilesPaths = await this.getLostAndTemporaryFilesPaths(storageName);
        for (const filePath of lostAndTemporaryFilesPaths) {
            try {
                const createTimeFileMs = await storage.getFileCreateTimeMs(filePath);
                const isFileJustCreated = (currentTimeMs - createTimeFileMs) < this.fileConfigService.justUploadedTempFileLifetimeMs;
                if (!isFileJustCreated) {
                    await storage.deleteFile(filePath);
                }
            } catch (er) {
                Sentry.captureException(er);
            }
        }
    }

    async getLostAndTemporaryFilesPaths(storageName: string): Promise<string[]> {
        if (!this.getFileModelsPathUsecase) {
            throw new Error('GetFileModelsPathUsecase is not provided');
        }

        const storage = this.getStorage(storageName);

        if (!storage) {
            return [];
        }

        const filePathsFromStorage = await storage.getFilesPaths();

        if (!filePathsFromStorage) {
            return [];
        }

        const fileModelsPaths = await this.getFileModelsPathUsecase.handle(storageName);

        const lostAndTemporaryFilesPaths = [];

        for (const filePath of filePathsFromStorage) {
            if (!fileModelsPaths.includes(filePath)) {
                lostAndTemporaryFilesPaths.push(filePath);
            }
        }

        return lostAndTemporaryFilesPaths;
    }

    private getStorage(storageName: string): IFileStorage {
        try {
            return this.fileStorageFactory.get(storageName) as IFileStorage;
        } catch (error) {
            Sentry.captureException(error);
            return null;
        }
    }
}
