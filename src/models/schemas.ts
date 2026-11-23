import { z } from "zod";

const optionalId = z.number().int().positive().optional();
const optionalTimestamp = z.string().datetime().optional();
const mapLinkSchema = z.string().url().refine((value) => {
  try {
    const protocol = new URL(value).protocol;
    return protocol === "https:" || protocol === "http:";
  } catch {
    return false;
  }
}, "El link al mapa debe ser una URL HTTP o HTTPS");

export const userSchema = z.object({
  id: z.string().uuid().optional(),
  created_at: optionalTimestamp,
  admin_status: z.boolean().optional(),
  name: z.string().min(1),
  dni: z.string().min(1),
});

export const accountSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
  dni: z.string().min(1),
  role: z.enum(["admin", "seller", "client"]),
  phone: z.string().optional(),
  street: z.string().optional(),
  map_link: mapLinkSchema.optional(),
}).superRefine((account, context) => {
  if (account.role === "client") {
    if (!account.phone?.trim()) {
      context.addIssue({ code: "custom", path: ["phone"], message: "El teléfono es obligatorio para los clientes" });
    }
    if (!account.street?.trim()) {
      context.addIssue({ code: "custom", path: ["street"], message: "El domicilio es obligatorio para los clientes" });
    }
  }
});

export const invitationSchema = z.object({
  email: z.string().email(),
  role: z.enum(["admin", "seller", "client"]),
});

export const completeInvitationSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
  dni: z.string().min(1),
  phone: z.string().optional(),
  street: z.string().optional(),
  map_link: mapLinkSchema.optional(),
});

export const sellerSchema = z.object({
  id: optionalId,
  created_at: optionalTimestamp,
  is_active: z.boolean().optional(),
  user_id: z.string().uuid(),
});

export const clientSchema = sellerSchema;

export const cobradorSchema = z.object({
  id: optionalId,
  created_at: optionalTimestamp,
  user_id: z.string().uuid(),
});

export const contactSchema = z.object({
  id: optionalId,
  phone: z.string().optional(),
  street: z.string().optional(),
  map_link: mapLinkSchema.optional(),
  user_id: z.string().uuid(),
});

export const productSchema = z.object({
  id: optionalId,
  created_at: optionalTimestamp,
  updated_at: optionalTimestamp,
  name: z.string().min(1),
  img: z.string().optional(),
  description: z.string().optional(),
});

export const ticketProductInputSchema = z.object({
  product_id: z.number().int().positive(),
  value: z.number().int().positive(),
  quotas: z.number().int().positive(),
});

export const ticketSchema = z.object({
  created_at: optionalTimestamp,
  client_id: z.number().int().positive(),
  seller_id: z.number().int().positive(),
  cobrador_id: z.number().int().positive().nullable().optional(),
  ticket_products: z.array(ticketProductInputSchema).min(1),
});

export const ticketProductSchema = z.object({
  created_at: optionalTimestamp,
  ticket_id: z.number().int().positive(),
  product_id: z.number().int().positive(),
  value: z.number().int().positive(),
  quotas: z.number().int().positive(),
});

export const updateSellerSchema = sellerSchema.partial();
export const updateClientSchema = clientSchema.partial();
export const updateCobradorSchema = cobradorSchema.partial();
export const updateContactSchema = contactSchema.partial();
export const updateProductSchema = productSchema.partial();
