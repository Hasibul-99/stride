import { Body } from '@nestjs/common';
import { ZodSchema } from 'zod';
import { ZodValidationPipe } from './zod-validation.pipe';

/** @Body() validated against a zod schema from packages/shared. */
export function ZodBody<T>(schema: ZodSchema<T>): ParameterDecorator {
  return Body(new ZodValidationPipe(schema));
}
