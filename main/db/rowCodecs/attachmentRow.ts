import { z } from 'zod'
import type { Attachment } from '../../../shared/types'

export const AttachmentRowSchema = z.object({
  id: z.preprocess((value) => String(value), z.string()),
  transaction_id: z.preprocess((value) => String(value), z.string()),
  original_filename: z.preprocess((value) => String(value), z.string()),
  file_path: z.preprocess((value) => String(value), z.string()),
  mime_type: z.preprocess((value) => String(value), z.string()),
  size: z.preprocess(
    (value) => Number(value),
    z.number().refine((n) => !Number.isNaN(n), 'size is NaN'),
  ),
  created_at: z.preprocess((value) => String(value), z.string()),
})

export const parseAttachmentRow = (row: unknown): Attachment => {
  try {
    return AttachmentRowSchema.parse(row)
  } catch {
    throw new Error('Invalid Attachment DB row')
  }
}
