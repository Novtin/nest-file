import {extname, join} from 'path';
import * as fs from 'fs';
import {
    Injectable,
    NestInterceptor,
    ExecutionContext,
    CallHandler,
    UnsupportedMediaTypeException,
    Inject, PayloadTooLargeException,
} from '@nestjs/common';
import {Observable, switchMap, finalize} from 'rxjs';
import * as multer from 'multer';
import type {Request} from 'express';
import * as Sentry from '@sentry/nestjs';
import {FILE_UPLOAD_FIELD_NAME_METADATA_KEY} from '../decorators/FileUploadFieldName';
import {IFileTypeService} from '../../domain/interfaces/IFileTypeService';
import {FileConfigService} from '../../domain/services/FileConfigService';

// Имя multipart-поля для загружаемого файла по умолчанию
const DEFAULT_FILE_UPLOAD_FIELD_NAME = 'file';
type RequestWithOptionalFile = Request & {file?: Express.Multer.File};

@Injectable()
export class TemporaryFileUploadInterceptor implements NestInterceptor {
    constructor(
        @Inject(IFileTypeService)
        private readonly fileTypeService: IFileTypeService,
        @Inject(FileConfigService)
        private readonly fileConfigService: FileConfigService,
    ) {}

    async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<void>> {
        const ctx = context.switchToHttp();
        const request = ctx.getRequest<RequestWithOptionalFile>();
        const response = ctx.getResponse();
        const fileFieldName = this.getFileFieldName(context);

        const fileType = request.query.fileType as string;

        const config = await this.fileTypeService.getFileUploadOptionsByType(fileType);
        const shouldDeleteTemporaryFile = !this.fileConfigService.saveTemporaryFileAfterUpload;

        const storage = multer.diskStorage({
            // TODO use FileConfigService
            destination: process.env.APP_FILE_STORAGE_ROOT_PATH || join(process.cwd(), '../files/uploaded'),

            filename: (r, file, callback) => {
                const randomName = Array(24).fill(null)
                    .map(() => (Math.round(Math.random() * 16)).toString(16)).join('');
                return callback(null, `${randomName}${extname(file.originalname)}`);
            },
        });

        const upload = multer({
            storage,
            limits: {fileSize: config.maxSizeMb * 1024 * 1024},
            fileFilter: (req, file, callback: multer.FileFilterCallback) => {
                if (config.mimeTypes?.length && !config.mimeTypes.includes(file.mimetype)) {
                    return callback(new UnsupportedMediaTypeException(
                        `Недопустимый тип файла: ${file.mimetype}. Допустимы форматы ${config.mimeTypes.join(', ')}`,
                    ));
                }
                return callback(null, true);
            },
        }).single(fileFieldName);

        return new Observable<void>(observer => {
            upload(request, response, err => {
                if (err) {
                    const error = err.code === 'LIMIT_FILE_SIZE'
                        ? new PayloadTooLargeException(`Файл слишком большой. Максимальный размер: ${config.maxSizeMb}MB`)
                        : err;
                    observer.error(error);
                } else {
                    observer.next();
                    observer.complete();
                }
            });
        }).pipe(
            switchMap(() => next.handle()),
            finalize(() => {
                const path = request.file?.path;
                if (shouldDeleteTemporaryFile && path) {
                    fs
                        .promises
                        .rm(path, {force: true})
                        .catch((error) => Sentry.captureException(error));
                }
            }),
        );
    }

    private getFileFieldName(context: ExecutionContext): string {
        const fieldName = Reflect.getMetadata(FILE_UPLOAD_FIELD_NAME_METADATA_KEY, context.getHandler())
          ?? Reflect.getMetadata(FILE_UPLOAD_FIELD_NAME_METADATA_KEY, context.getClass());

        return typeof fieldName === 'string' && fieldName.trim()
            ? fieldName
            : DEFAULT_FILE_UPLOAD_FIELD_NAME;
    }
}
