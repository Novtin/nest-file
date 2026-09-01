import {InjectRepository} from '@nestjs/typeorm';
import {Repository} from 'typeorm';
import {Inject, Injectable} from '@nestjs/common';
import {CrudRepository} from '@steroidsjs/nest/infrastructure/repositories/CrudRepository';
import {DataMapper} from '@steroidsjs/nest/usecases/helpers/DataMapper';
import {IFileRepository} from '../../domain/interfaces/IFileRepository';
import {FileTable} from '../tables/FileTable';
import {FileModel} from '../../domain/models/FileModel';
import {IFileStorageFactory} from '../../domain/interfaces/IFileStorageFactory';
import {CANONICAL_PATH_SEPARATOR} from '../../domain/interfaces/IFileStorage';

@Injectable()
export class FileRepository extends CrudRepository<FileModel> implements IFileRepository {
    protected modelClass = FileModel;

    constructor(
        @InjectRepository(FileTable)
        public dbRepository: Repository<FileTable>,
        @Inject(IFileStorageFactory)
        private fileStorageFactory: IFileStorageFactory,
    ) {
        super();
    }

    protected entityToModel(obj: any): FileModel {
        const model = super.entityToModel(obj);
        model.url = this.fileStorageFactory.get(model.storageName).getUrl(model);
        return model;
    }

    public async getFileWithDocument(fileName: string): Promise<FileModel> {
        const file = await this.dbRepository.createQueryBuilder('model')
            .select('model.id')
            .leftJoin('model.documents', 'document')
            .leftJoin('document.entrant', 'entrant')
            .addSelect([
                'document.id',
                'entrant.userId',
            ])
            .where('model."fileName" ILIKE :name', {name: fileName})
            .getOne();
        return DataMapper.create(FileModel, file);
    }

    async getFilesPathsByStorageName(storageName: string): Promise<string[] | null> {
        const files = await this.createQuery()
            .select([
                'fileName',
                'folder',
            ])
            .where({storageName})
            .many();
        return files.map(file => [file.folder, file.fileName]
            .filter(Boolean)
            .join(CANONICAL_PATH_SEPARATOR));
    }

    public async getUnusedFilesIds(config: {
        fileNameLike?: string,
        ignoredTables?: string[],
        isEmpty?: boolean,
        unusedFileLifetimeMs?: number,
    }): Promise<number[]> {
        // Массив объектов, где каждый объект содержит название таблицы и колонку в этой таблице, ссылающуюся на таблицу file
        const tablesWithFileReferenceColumn: Array<{table_name: string, col_name: string}> = await this.dbRepository.query(`
            SELECT
                tc.table_name as table_name,
                kcu.column_name as col_name
            FROM
                information_schema.table_constraints AS tc
                    JOIN information_schema.key_column_usage AS kcu
                         ON tc.constraint_name = kcu.constraint_name
                             AND tc.table_schema = kcu.table_schema
                    JOIN information_schema.constraint_column_usage AS ccu
                         ON ccu.constraint_name = tc.constraint_name
                             AND ccu.table_schema = tc.table_schema
            WHERE
                tc.constraint_type = 'FOREIGN KEY'
              AND tc.table_schema = 'public'
              AND ccu.table_name = 'file'
              AND ccu.column_name = 'id';
        `);

        const tablesFilesIds = await Promise.all(tablesWithFileReferenceColumn.map(async (table) => {
            if (config.ignoredTables?.length && config.ignoredTables.includes(table.table_name)) {
                return [];
            }
            const tableFilesIds = await this.dbRepository.query(`
                    SELECT DISTINCT "${table.col_name}" as id FROM "${table.table_name}"
                `);
            return tableFilesIds.map(item => item.id);
        }));

        const usedFilesIds = [...new Set(tablesFilesIds.flat())].filter(Boolean);

        const allFilesQb = this.dbRepository.createQueryBuilder('model')
            .select('model.id');

        if (config.fileNameLike) {
            allFilesQb.where('model.title ILIKE :title', {title: `%${config.fileNameLike}%`});
        }

        if (config.isEmpty) {
            allFilesQb.andWhere('(model.fileSize = 0 OR model.fileSize IS NULL)');
        }

        if (config.unusedFileLifetimeMs) {
            // Добавляем условие фильтрации файлов по дате создания.
            // Выбираются файлы, созданные до пороговой даты, которая определяется
            // как текущее время минус значение unusedFileLifetimeMs.
            const thresholdDate = new Date(Date.now() - config.unusedFileLifetimeMs);
            allFilesQb.andWhere('model."createTime" < :threshold', {threshold: thresholdDate});
        }

        return (await allFilesQb.getRawMany())
            .map(file => file.model_id)
            .filter(fileId => !usedFilesIds.includes(fileId));
    }

    public async getCount() {
        return this.dbRepository.createQueryBuilder().getCount();
    }
}
