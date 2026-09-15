import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { listTasksSchema, taskSchema, updateTaskStatusSchema, type ListTasksQuery, type TaskInput, type TaskStatus } from '@insurance/shared';
import { ZodValidationPipe } from '../../common/validation/zod-validation.pipe';
import { TasksService } from './tasks.service';

@Controller('tasks')
export class TasksController {
  constructor(private readonly service: TasksService) {}

  @Get()
  list(@Query(new ZodValidationPipe(listTasksSchema)) q: ListTasksQuery) {
    return this.service.list(q);
  }

  @Post()
  create(@Body(new ZodValidationPipe(taskSchema)) body: TaskInput) {
    return this.service.create(body);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.get(id);
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodValidationPipe(taskSchema)) body: TaskInput) {
    return this.service.update(id, body);
  }

  @Patch(':id/status')
  setStatus(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodValidationPipe(updateTaskStatusSchema)) body: { status: TaskStatus }) {
    return this.service.setStatus(id, body.status);
  }

  @HttpCode(204)
  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(id);
  }
}
