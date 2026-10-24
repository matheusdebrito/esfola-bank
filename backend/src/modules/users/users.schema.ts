import { z } from "zod";

export const userCreateSchema = z.object({
  name: z.string().min(2, "Nome deve ter ao menos 2 caracteres").max(255),
  email: z.string().email("E-mail inválido").max(255),
  password: z.string().min(6, "Senha deve ter ao menos 6 caracteres").max(128),
  role: z.enum(["ADMIN", "MANAGER", "OPERATOR", "AUDITOR"]).default("OPERATOR"),
});

export const userUpdateSchema = z
  .strictObject({
    name: z.string().min(2).max(255).optional(),
    role: z.enum(["ADMIN", "MANAGER", "OPERATOR", "AUDITOR"]).optional(),
    active: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "Pelo menos um campo deve ser informado",
  });

export const ownProfileSchema = z.strictObject({
  name: z.string().trim().min(2, "Nome deve ter ao menos 2 caracteres").max(255),
});

export const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1, "Senha atual é obrigatória"),
  newPassword: z.string().min(6, "Nova senha deve ter ao menos 6 caracteres").max(128),
});

export const passwordResetSchema = z.object({
  newPassword: z.string().min(6, "Nova senha deve ter ao menos 6 caracteres").max(128),
});

export type OwnProfileInput = z.infer<typeof ownProfileSchema>;
export type UserCreateInput = z.infer<typeof userCreateSchema>;
export type UserUpdateInput = z.infer<typeof userUpdateSchema>;
export type PasswordChangeInput = z.infer<typeof passwordChangeSchema>;
export type PasswordResetInput = z.infer<typeof passwordResetSchema>;

export const userListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().optional(),
  role: z.enum(["ADMIN", "MANAGER", "OPERATOR", "AUDITOR"]).optional(),
  active: z.coerce.boolean().optional(),
});

export type UserListQuery = z.infer<typeof userListQuerySchema>;
