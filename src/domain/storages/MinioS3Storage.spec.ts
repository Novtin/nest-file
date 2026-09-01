import {MinioS3Storage} from './MinioS3Storage';

describe('MinioS3Storage', () => {
    it('returns canonical relative object keys without a leading slash', async () => {
        const storage = new MinioS3Storage();
        storage.mainBucket = 'bucket';
        (storage as any).getClient = jest.fn().mockReturnValue({
            listObjectsV2: jest.fn().mockReturnValue([
                {name: '/uid.original.jpg'},
                {name: 'folder/uid.thumbnail.jpg'},
                {name: 'folder/'},
            ]),
        });

        const paths = await storage.getFilesPaths();

        expect(paths).toEqual([
            'uid.original.jpg',
            'folder/uid.thumbnail.jpg',
        ]);
    });
});
