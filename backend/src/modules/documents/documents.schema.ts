import { z } from "zod";

export const documentTypeSchema = z.enum(["RG", "PROOF_OF_ADDRESS"]);

export const documentUploadSchema = z.object({
  type: documentTypeSchema,
});

export const documentListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});

export type DocumentType = z.infer<typeof documentTypeSchema>;
export type DocumentListQuery = z.infer<typeof documentListQuerySchema>;
