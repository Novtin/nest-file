import {Readable} from 'stream';
import {toInteger as _toInteger} from 'lodash';
import * as Minio from 'minio';
import {DataMapper} from '@steroidsjs/nest/usecases/helpers/DataMapper';
import {normalizeBoolean} from '@steroidsjs/nest/infrastructure/decorators/fields/BooleanField';
import {Inject, Injectable, Optional, Scope} from '@nestjs/common';
import {IFileStorage, IFileStorageConfig} from '../interfaces/IFileStorage';
import {FileWriteResult} from '../dtos/FileWriteResult';
import {IFileReadable} from '../interfaces/IFileReadable';
import {IFileWritable} from '../interfaces/IFileWritable';
import {
    GET_FILE_STORAGE_PARAMS_USE_CASE_TOKEN,
    IGetFileStorageParamsUseCase,
} from '../../usecases/getFileStorageParams/interfaces/IGetFileStorageParamsUseCase';
import FileStorageEnum from '../enums/FileStorageEnum';

@Injectable({
    scope: Scope.TRANSIENT,
})
export class MinioS3Storage implements IFileStorage {
    public storageName: string;

    public host: string;

    public port: number;

    public isUseSsl: boolean;

    public accessKey: string;

    public secretKey: string;

    public region: string;

    public mainBucket: string;

    public rootUrl: string;

    private _client: Minio.Client;

    private _isBucketCreated: boolean;

    constructor(
        @Optional()
        @Inject(GET_FILE_STORAGE_PARAMS_USE_CASE_TOKEN)
        protected readonly getFileStorageParamsUseCase?: IGetFileStorageParamsUseCase,
    ) {
    }

    public init(config: IFileStorageConfig) {
        this.host = config?.host;
        this.port = _toInteger(config?.port);
        this.isUseSsl = normalizeBoolean(config?.isUseSsl);
        this.accessKey = config?.accessKey;
        this.secretKey = config?.secretKey;
        this.region = config?.region;
        this.mainBucket = config?.mainBucket;
        this.rootUrl = config?.rootUrl;
        this.storageName = config?.storageName ?? FileStorageEnum.MINIO_S3;

        // if (!this.accessKey) {
        //     throw new Error('Not found accessKey for MinioS3Storage');
        // }
        // if (!this.secretKey) {
        //     throw new Error('Not found secretKey for MinioS3Storage');
        // }
    }

    public async read(file: IFileReadable): Promise<Buffer> {
        return new Promise((resolve, reject) => {
            // Get a full object.
            const chunks = [];
            this.getClient().getObject(
                this.mainBucket,
                [file.folder, file.fileName].filter(Boolean).join('/'),
                (err, dataStream) => {
                    if (err) {
                        reject(err);
                    } else {
                        dataStream.on('data', (chunk) => {
                            chunks.push(chunk);
                        });
                        dataStream.on('end', () => {
                            resolve(Buffer.concat(chunks));
                        });
                        dataStream.on('error', (err2) => {
                            reject(err2);
                        });
                    }
                },
            );
        });
    }

    public async write(
        file: IFileWritable,
        source: Readable | Buffer,
    ): Promise<FileWriteResult> {
        await this.makeMainBucket();

        const fileTypeStorageParams = this.getFileStorageParamsUseCase
            ? await this.getFileStorageParamsUseCase.handle(file.fileType, this.storageName)
            : {};

        const metaData = {
            'Content-Type': file.fileMimeType,
            ...fileTypeStorageParams,
        };

        return new Promise((resolve, reject) => {
            this.getClient().putObject(
                this.mainBucket,
                [file.folder, file.fileName].filter(Boolean).join('/'),
                source,
                file.fileSize,
                metaData,
                (err, {etag}) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(
                            DataMapper.create<FileWriteResult>(FileWriteResult, {
                                md5: etag,
                            }),
                        );
                    }
                },
            );
        });
    }

    public getUrl(file: IFileReadable): string {
        return [this.rootUrl, file.folder, file.fileName].filter(Boolean).join('/');
    }

    protected makeMainBucket(): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this._isBucketCreated) {
                resolve();
                return;
            }

            const client = this.getClient();
            client.bucketExists(this.mainBucket, (err, exists) => {
                if (err) {
                    reject(err);
                } else if (exists) {
                    resolve();
                } else {
                    client.makeBucket(this.mainBucket, this.region, err2 => {
                        if (err2) {
                            this._isBucketCreated = true;
                            reject(err2);
                        } else {
                            resolve();
                        }
                    });
                }
            });
        });
    }

    protected getClient() {
        if (!this._client) {
            this._client = new Minio.Client({
                endPoint: this.host,
                port: this.port,
                useSSL: this.isUseSsl,
                accessKey: this.accessKey,
                secretKey: this.secretKey,
            });
        }
        return this._client;
    }

    async deleteFile(filePath: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const client = this.getClient();
            client.removeObject(this.mainBucket, filePath, (err: any) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }
}
