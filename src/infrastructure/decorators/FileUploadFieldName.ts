import {SetMetadata} from '@nestjs/common';

export const FILE_UPLOAD_FIELD_NAME_METADATA_KEY = 'steroidsjs:nest-file:file-upload-field-name';

export function FileUploadFieldName(fieldName: string) {
    return SetMetadata(FILE_UPLOAD_FIELD_NAME_METADATA_KEY, fieldName);
}
