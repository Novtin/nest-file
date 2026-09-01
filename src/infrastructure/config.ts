import type {IFileStorageDefinition} from '../domain/interfaces/IFileStorageDefinition';
import type {FileConfigService} from '../domain/services/FileConfigService';

export type IFileModuleConfig = Partial<Omit<Readonly<FileConfigService>, 'storages'>> & {
    storages?: Record<string, IFileStorageDefinition>,
};

export default () => ({

} as IFileModuleConfig);
