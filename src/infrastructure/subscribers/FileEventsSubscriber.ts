import {Injectable} from '@nestjs/common';
import {OnEvent} from '@nestjs/event-emitter';
import {FileRemovedEventDto} from '../../domain/dtos/events/FileRemovedEventDto';
import {FileRemovedEventHandleUseCase} from '../../usecases/fileRemovedEventHandleUseCase/FileRemovedEventHandleUseCase';

@Injectable()
export class FileEventsSubscriber {
    constructor(
        private readonly fileRemovedEventHandleUseCase: FileRemovedEventHandleUseCase,
    ) {}

    @OnEvent(FileRemovedEventDto.eventName)
    async onRemove(payload: FileRemovedEventDto) {
        await this.fileRemovedEventHandleUseCase.handle(payload);
    }
}
