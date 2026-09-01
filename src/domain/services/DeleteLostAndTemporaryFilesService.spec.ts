import {FileStorageEnum} from '../enums/FileStorageEnum';
import {IFileStorageFactory} from '../interfaces/IFileStorageFactory';
import {IFileStorage} from '../interfaces/IFileStorage';
import {IGetFileModelsPathUsecase} from '../../usecases/getFilePathModels/interfaces/IGetFileModelsPathUsecase';
import {DeleteLostAndTemporaryFilesService} from './DeleteLostAndTemporaryFilesService';
import {FileConfigService} from './FileConfigService';

/**
 * Minimal fake storage implementing only the methods the service touches:
 * getFilesPaths / getFileCreateTimeMs / deleteFile.
 */
function makeStorage(
    paths: string[],
    opts: {
        ageMsByPath?: Record<string, number>,
        onDelete?: (p: string) => void,
        failPaths?: () => null,
    } = {},
) {
    const deleted: string[] = [];
    const storage: IFileStorage = {
        init: jest.fn(),
        read: jest.fn(),
        write: jest.fn(),
        getUrl: jest.fn(),
        getFilesPaths: async () => (opts.failPaths ? opts.failPaths() : paths.slice()),
        getFileCreateTimeMs: async (fileName: string) => {
            if (opts.ageMsByPath && opts.ageMsByPath[fileName] !== undefined) {
                return opts.ageMsByPath[fileName];
            }
            return Date.now() - 1000_000;
        },
        deleteFile: async (filePath: string) => {
            deleted.push(filePath);
            opts.onDelete?.(filePath);
        },
    };
    return {
        storage,
        deleted,
    };
}

function makeFactory(storage: IFileStorage): IFileStorageFactory {
    return {
        get: jest.fn().mockReturnValue(storage),
    };
}

function makeUsecase(paths: string[]): IGetFileModelsPathUsecase {
    return {
        handle: jest.fn().mockResolvedValue(paths),
    };
}

function makeConfig(lifetimeMs = 60_000): FileConfigService {
    return {justUploadedTempFileLifetimeMs: lifetimeMs} as unknown as FileConfigService;
}

describe('DeleteLostAndTemporaryFilesService', () => {
    describe('getLostAndTemporaryFilesPaths', () => {
        it('throws when GetFileModelsPathUsecase is not provided', async () => {
            const {storage} = makeStorage([]);
            const service = new DeleteLostAndTemporaryFilesService(
                makeFactory(storage),
                makeConfig(),
                null,
            );
            await expect(service.getLostAndTemporaryFilesPaths(FileStorageEnum.LOCAL))
                .rejects.toThrow('GetFileModelsPathUsecase is not provided');
        });

        it('returns [] when storage is unavailable (factory throws)', async () => {
            const factory: IFileStorageFactory = {
                get: jest.fn().mockImplementation(() => {
                    throw new Error('no storage');
                }),
            };
            const service = new DeleteLostAndTemporaryFilesService(
                factory,
                makeConfig(),
                makeUsecase([]),
            );
            await expect(service.getLostAndTemporaryFilesPaths(FileStorageEnum.LOCAL))
                .resolves.toEqual([]);
        });

        it('returns [] when getFilesPaths returns null', async () => {
            const {storage} = makeStorage([], {failPaths: () => null});
            const service = new DeleteLostAndTemporaryFilesService(
                makeFactory(storage),
                makeConfig(),
                makeUsecase(['uid.original.jpg']),
            );
            await expect(service.getLostAndTemporaryFilesPaths(FileStorageEnum.LOCAL))
                .resolves.toEqual([]);
        });

        it('returns [] when every storage file is referenced from the DB', async () => {
            const {storage} = makeStorage(['uid.original.jpg', 'uid.thumbnail.jpg']);
            const service = new DeleteLostAndTemporaryFilesService(
                makeFactory(storage),
                makeConfig(),
                makeUsecase(['uid.original.jpg', 'uid.thumbnail.jpg']),
            );
            await expect(service.getLostAndTemporaryFilesPaths(FileStorageEnum.LOCAL))
                .resolves.toEqual([]);
        });

        it('returns only orphaned files (present in storage, absent in DB)', async () => {
            const {storage} = makeStorage(['keep.jpg', 'lost.jpg', 'also-lost.jpg']);
            const service = new DeleteLostAndTemporaryFilesService(
                makeFactory(storage),
                makeConfig(),
                makeUsecase(['keep.jpg']),
            );
            await expect(service.getLostAndTemporaryFilesPaths(FileStorageEnum.LOCAL))
                .resolves.toEqual(expect.arrayContaining(['lost.jpg', 'also-lost.jpg']));
        });
    });

    describe('deleteLostAndTemporaryFiles', () => {
        it('deletes orphaned old files, but keeps just-uploaded ones', async () => {
            const now = Date.now();
            const {storage, deleted} = makeStorage(
                ['old-lost.jpg', 'fresh-lost.jpg', 'keep.jpg'],
                {
                    ageMsByPath: {
                        'old-lost.jpg': now - 1000_000,
                        'fresh-lost.jpg': now,
                        'keep.jpg': now - 1000_000,
                    },
                },
            );
            const service = new DeleteLostAndTemporaryFilesService(
                makeFactory(storage),
                makeConfig(60_000),
                makeUsecase(['keep.jpg']),
            );

            await service.deleteLostAndTemporaryFiles(FileStorageEnum.LOCAL);

            expect(deleted).toEqual(['old-lost.jpg']);
            expect(deleted).not.toContain('fresh-lost.jpg');
        });

        it('deletes nothing when there are no orphaned files', async () => {
            const {storage, deleted} = makeStorage(['keep.jpg']);
            const service = new DeleteLostAndTemporaryFilesService(
                makeFactory(storage),
                makeConfig(),
                makeUsecase(['keep.jpg']),
            );
            await service.deleteLostAndTemporaryFiles(FileStorageEnum.LOCAL);
            expect(deleted).toEqual([]);
        });

        it('continues deleting remaining files if one delete throws', async () => {
            const {storage, deleted} = makeStorage(['a.jpg', 'b.jpg']);

            let firstCall = true;
            storage.deleteFile = jest.fn().mockImplementation(async (p: string) => {
                if (firstCall) {
                    firstCall = false;
                    throw new Error('boom');
                }
                deleted.push(p);
            }) as any;

            const service = new DeleteLostAndTemporaryFilesService(
                makeFactory(storage),
                makeConfig(),
                makeUsecase([]),
            );

            await service.deleteLostAndTemporaryFiles(FileStorageEnum.LOCAL);

            expect(deleted).toEqual(['b.jpg']);
        });
    });
});
