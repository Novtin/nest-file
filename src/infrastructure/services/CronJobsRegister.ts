import {Inject, Injectable, Optional} from '@nestjs/common';
import {SchedulerRegistry} from '@nestjs/schedule';
import {CronJob} from 'cron';
import type {OnApplicationBootstrap} from '@nestjs/common/interfaces/hooks/on-application-bootstrap.interface';
import {FileConfigService} from '../../domain/services/FileConfigService';
import {DeleteLostAndTemporaryFilesService} from '../../domain/services/DeleteLostAndTemporaryFilesService';

/**
 * To use this functionality you need:
 * - import ScheduleModule into the working project https://docs.nestjs.com/techniques/task-scheduling
 */
@Injectable()
export class CronJobsRegister implements OnApplicationBootstrap {
    public deleteLostAndTemporaryFilesJobName = 'delete_lost_and_temporary_files_job';

    constructor(
        private deleteService: DeleteLostAndTemporaryFilesService,
        private fileConfigService: FileConfigService,
        @Optional()
        @Inject(SchedulerRegistry)
        private schedulerRegistry: SchedulerRegistry,
    ) {}

    onApplicationBootstrap(): void {
        if (!this.schedulerRegistry) {
            return;
        }

        this.addCronJobForDeleteFiles();
    }

    addCronJobForDeleteFiles(): void {
        const {isEnable, cronTimePattern, storageName} = this.fileConfigService.deleteLostAndTemporaryFilesByCron;

        if (!isEnable) {
            return;
        }

        // `any` type used because there is a type error - "Types of property 'cronTime' are incompatible."
        const job = new CronJob(cronTimePattern, () => {
            this.deleteService.deleteLostAndTemporaryFiles(storageName);
        }) as any;

        this.schedulerRegistry.addCronJob(this.deleteLostAndTemporaryFilesJobName, job);

        job.start();
    }
}
