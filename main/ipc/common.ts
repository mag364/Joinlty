import type { ZodSchema } from 'zod'

export const validate = <T>(schema: ZodSchema<T>, input: unknown): T => schema.parse(input)
