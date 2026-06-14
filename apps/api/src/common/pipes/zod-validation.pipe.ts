import { BadRequestException, PipeTransform } from '@nestjs/common';
import { ZodSchema, ZodError } from 'zod';

/** Validates the incoming value against a zod schema from packages/shared. */
export class ZodValidationPipe<T> implements PipeTransform {
  constructor(private readonly schema: ZodSchema<T>) {}

  transform(value: unknown): T {
    try {
      return this.schema.parse(value);
    } catch (err) {
      if (err instanceof ZodError) {
        throw new BadRequestException({
          error: 'ValidationError',
          message: err.errors.map((e) => `${e.path.join('.')}: ${e.message}`),
        });
      }
      throw err;
    }
  }
}
