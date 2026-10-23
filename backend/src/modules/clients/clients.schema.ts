import { z } from "zod";
import { validateCpf } from "./cpf.util";

const UFS = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
];

const phoneSchema = z
  .string()
  .trim()
  .min(10, "Telefone inválido")
  .max(20, "Telefone inválido")
  .refine((v) => /^[0-9()+\-\s]+$/.test(v), "Telefone inválido");

export const clientCreateSchema = z.object({
  name: z.string().min(2, "Nome deve ter ao menos 2 caracteres").max(255),
  cpf: z.string().refine((v) => validateCpf(v), "CPF inválido"),
  phone: phoneSchema.optional().nullable(),
  birthDate: z.string().datetime({ message: "Data de nascimento inválida" }),
  cep: z.string().min(1, "CEP é obrigatório").max(20),
  address: z.string().min(1, "Logradouro é obrigatório").max(255),
  number: z.string().min(1, "Número é obrigatório").max(20),
  complement: z.string().max(100).optional().nullable(),
  neighborhood: z.string().min(1, "Bairro é obrigatório").max(100),
  city: z.string().min(1, "Cidade é obrigatória").max(100),
  state: z.string().length(2, "UF inválida").refine((v) => UFS.includes(v.toUpperCase()), "UF inválida"),
});

export const clientUpdateSchema = z.object({
  name: z.string().min(2).max(255).optional(),
  cpf: z.string().refine((v) => validateCpf(v), "CPF inválido").optional(),
  phone: phoneSchema.optional().nullable(),
  birthDate: z.string().datetime({ message: "Data de nascimento inválida" }).optional(),
  cep: z.string().max(20).optional(),
  address: z.string().max(255).optional(),
  number: z.string().max(20).optional(),
  complement: z.string().max(100).optional().nullable(),
  neighborhood: z.string().max(100).optional(),
  city: z.string().max(100).optional(),
  state: z.string().length(2).refine((v) => UFS.includes(v.toUpperCase()), "UF inválida").optional(),
  active: z.boolean().optional(),
}).refine((data) => Object.keys(data).length > 0, { message: "Pelo menos um campo deve ser informado" });

export const clientListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().optional(),
  active: z.coerce.boolean().optional(),
});

export type ClientCreateInput = z.infer<typeof clientCreateSchema>;
export type ClientUpdateInput = z.infer<typeof clientUpdateSchema>;
export type ClientListQuery = z.infer<typeof clientListQuerySchema>;
