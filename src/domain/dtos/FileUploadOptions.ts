import {BooleanField, IntegerField, JSONBField, StringField} from '@steroidsjs/nest/infrastructure/decorators/fields';
import FileStorageEnum from '../enums/FileStorageEnum';
import {IFilePreviewOptions} from '../interfaces/IFilePreviewOptions';
import {FileExpressSourceDto} from './sources/FileExpressSourceDto';
import {FileLocalSourceDto} from './sources/FileLocalSourceDto';
import {FileStreamSourceDto} from './sources/FileStreamSourceDto';

export class FileUploadOptions {
    @StringField({
        label: 'Files uids',
        isArray: true,
        nullable: true,
    })
    uids?: string;

    @StringField({
        label: 'Custom file title',
        nullable: true,
    })
    title?: string;

    @StringField({
        label: 'Relative path to sub-folder',
        nullable: true,
    })
    folder?: string;

    @StringField({
        label: 'Path to source file or express file or stream',
    })
    source?: FileExpressSourceDto | FileLocalSourceDto | FileStreamSourceDto;

    @StringField({
        label: 'Storage name (file, aws, ...)',
        nullable: true,
    })
    storageName: string;

    @IntegerField({
        label: 'Max file size in megabyte',
        nullable: true,
    })
    maxSizeMb: number;

    @StringField({
        label: 'Set file mime types list for check',
        isArray: true,
        nullable: true,
    })
    mimeTypes: string[];

    @BooleanField({
        label: 'Set true, for auto set mime types as images (gif, jpeg, pjpeg, png)',
    })
    imagesOnly: boolean;

    // used in FileTypeService, helps to define file uploading parameters
    @StringField({
        label: 'File type',
        nullable: true,
    })
    fileType: string;

    @IntegerField({
        label: 'User ID',
        nullable: true,
    })
    userId?: number;

    @JSONBField({
        label: 'Preview options map',
        nullable: true,
    })
    previews?: Record<string, IFilePreviewOptions>;
}
