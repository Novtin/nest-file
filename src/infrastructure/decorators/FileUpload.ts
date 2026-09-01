import {extname, join} from 'path';
import {applyDecorators, UnsupportedMediaTypeException, UseInterceptors} from '@nestjs/common';
import {FileInterceptor} from '@nestjs/platform-express';
import {diskStorage} from 'multer';

const MAX_BITS_SIZE = 25165824; // 10 mb;

interface IFileUploadOptions {
    maxFileSize?: number,
    fieldName?: string,
    allowedMimeTypes?: string[],
}

/** @deprecated Use TemporaryFileUploadInterceptor */
export function FileUpload(options?: IFileUploadOptions) {
    return applyDecorators(
        UseInterceptors(
            FileInterceptor(
                options?.fieldName ?? 'file',
                {
                    storage: diskStorage({
                        // TODO use FileConfigService
                        destination: process.env.APP_FILE_STORAGE_ROOT_PATH || join(process.cwd(), '../files/uploaded'),

                        filename: (request, file, callback) => {
                            const randomName = Array(24).fill(null)
                                .map(() => (Math.round(Math.random() * 16)).toString(16)).join('');
                            return callback(null, `${randomName}${extname(file.originalname)}`);
                        },
                    }),
                    limits: {
                        fileSize: options?.maxFileSize || MAX_BITS_SIZE,
                    },
                    fileFilter: (request, file, callback) => {
                        const allowedMimeTypes = options?.allowedMimeTypes || [];

                        if (allowedMimeTypes.length && !allowedMimeTypes.includes(file.mimetype)) {
                            return callback(
                                new UnsupportedMediaTypeException(`Недопустимый тип файла: ${file.mimetype}`),
                                false,
                            );
                        }
                        return callback(null, true);
                    },
                },
            ),
        ),
    );
}
