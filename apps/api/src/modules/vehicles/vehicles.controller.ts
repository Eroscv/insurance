import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { vehicleSchema, type VehicleInput } from '@insurance/shared';
import { ZodValidationPipe } from '../../common/validation/zod-validation.pipe';
import { VehiclesService } from './vehicles.service';

@Controller()
export class VehiclesController {
  constructor(private readonly service: VehiclesService) {}

  @Get('clients/:clientId/vehicles')
  list(@Param('clientId', ParseUUIDPipe) clientId: string) {
    return this.service.listByClient(clientId);
  }

  @Post('clients/:clientId/vehicles')
  create(@Param('clientId', ParseUUIDPipe) clientId: string, @Body(new ZodValidationPipe(vehicleSchema)) body: VehicleInput) {
    return this.service.create(clientId, body);
  }

  @Patch('vehicles/:id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodValidationPipe(vehicleSchema)) body: VehicleInput) {
    return this.service.update(id, body);
  }

  @HttpCode(204)
  @Delete('vehicles/:id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(id);
  }
}
