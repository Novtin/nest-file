import * as fs from 'fs';
import {FileLocalStorage} from './FileLocalStorage';

describe('FileLocalStorage', () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('returns canonical relative paths without a leading slash', async () => {
        const storage = new FileLocalStorage();
        storage.rootPath = '/root';

        const readdirSyncMock = jest.spyOn(fs, 'readdirSync').mockImplementation((folderPath: any) => {
            if (folderPath === '/root') {
                return ['sub', 'root.jpg'] as any;
            }

            if (folderPath === '/root/sub') {
                return ['uid.original.jpg'] as any;
            }

            return [] as any;
        });

        jest.spyOn(fs, 'statSync').mockImplementation((filePath: any) => ({
            isDirectory: () => filePath === '/root' || filePath === '/root/sub',
        } as any));

        const paths = await storage.getFilesPaths();

        expect(readdirSyncMock).toHaveBeenCalledWith('/root');
        expect(paths).toEqual([
            'sub/uid.original.jpg',
            'root.jpg',
        ]);
        expect(paths).not.toContain('/sub/uid.original.jpg');
        expect(paths).not.toContain('/root.jpg');
    });
});
