import { createIsolatedSupabaseClient, supabase } from "../config/supabase";
import { sendAccountInvitationEmail, sendEmailConfirmation } from "../config/mailer";
import { HttpError } from "../errors/http-error";
import { createHash, randomBytes, randomUUID } from "node:crypto";

export async function listUsers() {
  const { data, error } = await supabase.from("user").select("*");
  if (error) throw error;
  return data;
}

export async function getUser(id: string) {
  const { data, error } = await supabase.from("user").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function createUser(input: object) {
  const { data, error } = await supabase.from("user").insert(input).select("*").single();
  if (error) throw error;
  return data;
}

type AccountRole = "admin" | "seller" | "client";

interface AccountInput {
  email: string;
  password: string;
  name: string;
  dni: string;
  role: AccountRole;
  phone?: string;
  street?: string;
  map_link?: string;
}

interface ContactInput {
  id?: number;
  created_at?: string;
  phone?: string;
  street?: string;
  map_link?: string;
  user_id: string;
}

async function provisionAccount(input: AccountInput) {
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    user_metadata: { name: input.name },
  });
  if (authError) throw authError;
  if (!authData.user) throw new Error("No se pudo crear la cuenta de autenticación");

  const userId = authData.user.id;
  try {
    await createAccountProfile(userId, input);
    return { userId, email: authData.user.email, role: input.role };
  } catch (error) {
    const { error: authCleanupError } = await supabase.auth.admin.deleteUser(userId);
    if (authCleanupError) logSupabaseFailure("rollback_auth_user", authCleanupError);
    throw error;
  }
}

async function createAccountProfile(userId: string, input: AccountInput) {
  let profileCreated = false;
  let roleCreated = false;
  let contactCreated = false;

  try {
    const { error: profileError } = await supabase.from("user").insert({
      id: userId,
      name: input.name,
      dni: input.dni,
      admin_status: input.role === "admin",
    });
    if (profileError) throw profileError;
    profileCreated = true;

    if (input.role !== "admin") {
      const { error: roleError } = await supabase
        .from(input.role)
        .insert({ user_id: userId, is_active: true });
      if (roleError) throw roleError;
      roleCreated = true;
    }

    const contact = {
      user_id: userId,
      phone: input.phone?.trim(),
      street: input.street?.trim(),
      map_link: input.map_link?.trim() || null,
    };
    if (contact.phone && contact.street) {
      const { error: contactError } = await supabase.from("contact").insert(contact);
      if (contactError) throw contactError;
      contactCreated = true;
    }

    return;
  } catch (error) {
    if (contactCreated) {
      const { error: cleanupError } = await supabase.from("contact").delete().eq("user_id", userId);
      if (cleanupError) logSupabaseFailure("rollback_contact", cleanupError);
    }
    if (roleCreated && input.role !== "admin") {
      const { error: cleanupError } = await supabase.from(input.role).delete().eq("user_id", userId);
      if (cleanupError) logSupabaseFailure("rollback_role", cleanupError);
    }
    if (profileCreated) {
      const { error: cleanupError } = await supabase.from("user").delete().eq("id", userId);
      if (cleanupError) logSupabaseFailure("rollback_profile", cleanupError);
    }
    throw error;
  }
}

export async function createAccount(input: AccountInput) {
  return provisionAccount(input);
}

async function removeProvisionedAccount(userId: string, role: AccountRole) {
  const cleanupOperations = [
    () => supabase.from("contact").delete().eq("user_id", userId),
    ...(role === "admin" ? [] : [() => supabase.from(role).delete().eq("user_id", userId)]),
    () => supabase.from("user").delete().eq("id", userId),
  ];
  for (const cleanup of cleanupOperations) {
    const { error } = await cleanup();
    if (error) logSupabaseFailure("rollback_account_record", error);
  }
  const { error } = await supabase.auth.admin.deleteUser(userId);
  if (error) logSupabaseFailure("rollback_auth_user", error);
}

const invitationDurationMs = 20 * 60 * 1000;
const tokenDigest = (token: string) => createHash("sha256").update(token).digest("hex");

function logSupabaseFailure(stage: string, error: unknown) {
  const details = error && typeof error === "object"
    ? error as {
      name?: string;
      code?: string;
      status?: number;
      message?: string;
      constraint?: string;
    }
    : null;
  const message = details?.message;
  console.error("[supabase] Request failed", {
    stage,
    name: details?.name,
    code: details?.code,
    status: details?.status,
    constraint: details?.constraint ?? message?.match(/constraint "([^"]+)"/)?.[1],
    message,
  });
}

function invitationFrontendUrl() {
  const configuredUrl = process.env.FRONTEND_URL?.trim();
  if (!configuredUrl) {
    console.error("[account-invitation] Missing configuration", { field: "FRONTEND_URL" });
    throw new HttpError("Falta configurar FRONTEND_URL para generar el enlace de registro.", 503);
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(configuredUrl);
  } catch {
    console.error("[account-invitation] Invalid configuration", { field: "FRONTEND_URL" });
    throw new HttpError("FRONTEND_URL debe ser una URL válida del frontend.", 503);
  }
  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    console.error("[account-invitation] Invalid configuration", { field: "FRONTEND_URL" });
    throw new HttpError("FRONTEND_URL debe comenzar con http:// o https://.", 503);
  }

  return configuredUrl.replace(/\/+$/, "");
}

export async function createAccountInvitation(input: {
  email: string;
  role: AccountRole;
  createdBy: string;
}) {
  const email = input.email.trim().toLowerCase();
  const frontendUrl = invitationFrontendUrl();
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + invitationDurationMs);
  const { data: invitation, error: insertError } = await supabase
    .from("account_invitation")
    .insert({
      token_hash: tokenDigest(token),
      email,
      role: input.role,
      created_by: input.createdBy,
      expires_at: expiresAt.toISOString(),
    })
    .select("id")
    .single();
  if (insertError) {
    logSupabaseFailure("insert_invitation", insertError);
    throw new HttpError(
      "No se pudo guardar la invitación en Supabase. Verificá la conexión y la tabla account_invitation.",
      502,
    );
  }
  console.info("[account-invitation] Invitation persisted", { role: input.role });

  const link = `${frontendUrl}/crear-cuenta/${token}`;
  try {
    await sendAccountInvitationEmail({ email, role: input.role, link });
  } catch (error) {
    const { error: cleanupError } = await supabase
      .from("account_invitation")
      .delete()
      .eq("id", invitation.id)
      .eq("status", "pending");
    if (cleanupError) logSupabaseFailure("rollback_invitation", cleanupError);
    throw error;
  }

  const { error: revokeError } = await supabase
    .from("account_invitation")
    .update({ status: "revoked" })
    .eq("email", email)
    .eq("role", input.role)
    .eq("status", "pending")
    .neq("id", invitation.id);
  if (revokeError) {
    logSupabaseFailure("revoke_previous_invitation", revokeError);
    throw new HttpError(
      "El correo se envió, pero no se pudo revocar una invitación anterior. Revisá el estado antes de reenviar.",
      502,
    );
  }

  return { email, role: input.role, expiresAt: expiresAt.toISOString() };
}

export async function getAccountInvitation(token: string) {
  const { data, error } = await supabase
    .from("account_invitation")
    .select("email, role, expires_at, status")
    .eq("token_hash", tokenDigest(token))
    .maybeSingle();
  if (error) throw error;
  if (!data || data.status !== "pending" || new Date(data.expires_at).getTime() <= Date.now()) {
    throw new HttpError("El enlace ya caducó, contactese para generar uno nuevo.", 410);
  }
  return { email: data.email, role: data.role, expiresAt: data.expires_at };
}

export async function completeAccountInvitation(
  token: string,
  input: Omit<AccountInput, "role">,
) {
  const claimId = randomUUID();
  const { data: invitation, error: claimError } = await supabase
    .from("account_invitation")
    .update({ status: "processing", claim_id: claimId, claimed_at: new Date().toISOString() })
    .eq("token_hash", tokenDigest(token))
    .eq("status", "pending")
    .gt("expires_at", new Date().toISOString())
    .select("id, email, role")
    .maybeSingle();
  if (claimError) throw claimError;
  if (!invitation) {
    throw new HttpError("El enlace ya caducó, contactese para generar uno nuevo.", 410);
  }

  let createdUserId: string | null = null;
  let requiresEmailConfirmation = false;
  const role = invitation.role as AccountRole;
  try {
    if (role === "client" && (!input.phone?.trim() || !input.street?.trim())) {
      throw new HttpError("El teléfono y el domicilio son obligatorios para completar una cuenta de cliente.", 400);
    }
    const email = input.email.trim().toLowerCase();
    let account: { userId: string; email: string | undefined; role: AccountRole };
    if (email === invitation.email.toLowerCase()) {
      account = await provisionAccount({ ...input, email, role });
    } else {
      const { data: generated, error: generateError } = await supabase.auth.admin.generateLink({
        type: "signup",
        email,
        password: input.password,
        options: {
          data: { name: input.name },
          redirectTo: invitationFrontendUrl(),
        },
      });
      if (generateError) {
        logSupabaseFailure("auth_generate_signup_link", generateError);
        throw new HttpError("Supabase Auth no pudo preparar la verificación del correo nuevo.", 502);
      }
      if (!generated.user?.id || !generated.properties.action_link) {
        throw new Error("No se pudo preparar la verificación del correo nuevo.");
      }

      createdUserId = generated.user.id;
      try {
        await createAccountProfile(createdUserId, { ...input, email, role });
        await sendEmailConfirmation({ email, link: generated.properties.action_link });
      } catch (error) {
        await removeProvisionedAccount(createdUserId, role);
        createdUserId = null;
        throw error;
      }
      requiresEmailConfirmation = true;
      account = { userId: generated.user.id, email: generated.user.email, role };
    }

    createdUserId = account.userId;
    const { error: finishError } = await supabase
      .from("account_invitation")
      .update({ status: "used" })
      .eq("id", invitation.id)
      .eq("claim_id", claimId);
    if (finishError) {
      logSupabaseFailure("finish_invitation", finishError);
      throw new HttpError(
        "La cuenta se creó, pero no se pudo cerrar el enlace. Contactá al administrador antes de reintentar.",
        502,
      );
    }
    return {
      userId: account.userId,
      email: account.email,
      role: account.role,
      requiresEmailConfirmation,
    };
  } catch (error) {
    if (createdUserId) await removeProvisionedAccount(createdUserId, role);
    const { error: releaseError } = await supabase
      .from("account_invitation")
      .update({ status: "pending", claim_id: null, claimed_at: null })
      .eq("id", invitation.id)
      .eq("claim_id", claimId);
    if (releaseError) logSupabaseFailure("release_invitation", releaseError);
    throw error;
  }
}
// 
export async function authAdmin(input: {
  email: string;
  password: string;
}) {
  const authClient = createIsolatedSupabaseClient();
  const { data, error } = await authClient.auth.signInWithPassword({
    email: input.email,
    password: input.password
  });

  if (error) throw error;

  return { userId: data.user?.id, email: data.user?.email, accessToken: data.session?.access_token };
}
// 
export async function listSellers() {
  const { data, error } = await supabase.from("seller").select("*");
  if (error) throw error;
  return data;
}

export async function getSeller(id: number) {
  const { data, error } = await supabase.from("seller").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function createSeller(input: object) {
  const { data, error } = await supabase.from("seller").insert(input).select("*").single();
  if (error) throw error;
  return data;
}

export async function updateSeller(id: number, input: object) {
  const { data, error } = await supabase.from("seller").update(input).eq("id", id).select("*").maybeSingle();
  if (error) throw error;
  return data;
}

export async function listClients() {
  const { data, error } = await supabase.from("client").select("*");
  if (error) throw error;
  return data;
}

export async function getClient(id: number) {
  const { data, error } = await supabase
    .from("client")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;

  if (!data) {
    throw new Error("Cliente no encontrado");
  }
  const { data: clientData, error: clientError } = await supabase
    .from("contact")
    .select("*")
    .eq("user_id", data.user_id)
    .maybeSingle();
  if (clientError) throw clientError;

  return {
    data,
    contact: clientData
  };
}

export async function createClient(input: object) {
  const { data, error } = await supabase.from("client").insert(input).select("*").single();
  if (error) throw error;
  return data;
}

export async function updateClient(id: number, input: object) {
  const { data, error } = await supabase.from("client").update(input).eq("id", id).select("*").maybeSingle();
  if (error) throw error;
  return data;
}

export async function listCobradores() {
  const { data, error } = await supabase.from("cobrador").select("*");
  if (error) throw error;
  return data;
}

export async function getCobrador(id: number) {
  const { data, error } = await supabase.from("cobrador").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function createCobrador(input: object) {
  const { data, error } = await supabase.from("cobrador").insert(input).select("*").single();
  if (error) throw error;
  return data;
}

export async function updateCobrador(id: number, input: object) {
  const { data, error } = await supabase.from("cobrador").update(input).eq("id", id).select("*").maybeSingle();
  if (error) throw error;
  return data;
}

export async function listContacts() {
  const { data, error } = await supabase.from("contact").select("*");
  if (error) throw error;
  return data;
}

export async function getContact(id: number) {
  const { data, error } = await supabase.from("contact").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function createContact(input: ContactInput) {
  const { data, error } = await supabase.from("contact").insert(input).select("*").single();
  if (error) throw error;
  return data;
}

export async function updateContact(id: number, input: Partial<ContactInput>) {
  const { data, error } = await supabase.from("contact").update(input).eq("id", id).select("*").maybeSingle();
  if (error) throw error;
  return data;
}

export async function listProducts() {
  const { data, error } = await supabase.from("product").select("*");
  if (error) throw error;
  return data;
}

export async function getProduct(id: number) {
  const { data, error } = await supabase.from("product").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function createProduct(input: object) {
  const { data, error } = await supabase.from("product").insert(input).select("*").single();
  if (error) throw error;
  return data;
}

export async function updateProduct(id: number, input: object) {
  const { data, error } = await supabase.from("product").update(input).eq("id", id).select("*").maybeSingle();
  if (error) throw error;
  return data;
}

export async function deleteProduct(id: number) {
  const { data, error } = await supabase.from("product").delete().eq("id", id).select("id").maybeSingle();
  if (error) throw error;
  return data;
}

export async function listTickets() {
  const { data, error } = await supabase
    .from("ticket")
    .select(`
      *,
      ticket_product (
        id,
        value,
        quotas,
        product (
          id,
          name,
          img,
          description
        )
      )
    `);

  if (error) throw error;

  return data;
}

export async function getDashboard(userId: string) {
  const [users, sellers, clients, contacts, products, cobradores, tickets] = await Promise.all([
    listUsers(),
    listSellers(),
    listClients(),
    listContacts(),
    listProducts(),
    listCobradores(),
    listTickets(),
  ]);

  const currentUser = users.find((user) => user.id === userId);
  if (!currentUser) throw new Error("El perfil de usuario no existe");
  if (currentUser.admin_status) return { users, sellers, clients, contacts, products, cobradores, tickets };

  const currentSeller = sellers.find((seller) => seller.user_id === userId && seller.is_active);
  if (currentSeller) {
    const scopedTickets = tickets.filter((ticket) => ticket.seller_id === currentSeller.id);
    const scopedClients = clients.filter((client) => client.is_active);
    const cobradorIds = new Set(scopedTickets.map((ticket) => ticket.cobrador_id).filter(Boolean));
    const scopedCobradores = cobradores.filter((cobrador) => cobradorIds.has(cobrador.id));
    const visibleUserIds = new Set([
      userId,
      ...scopedClients.map((client) => client.user_id),
      ...scopedCobradores.map((cobrador) => cobrador.user_id),
    ]);
    const visibleContacts = contacts.filter((contact) => visibleUserIds.has(contact.user_id));

    return {
      users: users.filter((user) => visibleUserIds.has(user.id)),
      sellers: [currentSeller],
      clients: scopedClients,
      contacts: visibleContacts,
      products,
      cobradores: scopedCobradores,
      tickets: scopedTickets,
    };
  }

  const currentClient = clients.find((client) => client.user_id === userId && client.is_active);
  if (currentClient) {
    const scopedTickets = tickets.filter((ticket) => ticket.client_id === currentClient.id);
    const sellerIds = new Set(scopedTickets.map((ticket) => ticket.seller_id));
    const scopedSellers = sellers.filter((seller) => sellerIds.has(seller.id));
    const cobradorIds = new Set(scopedTickets.map((ticket) => ticket.cobrador_id).filter(Boolean));
    const scopedCobradores = cobradores.filter((cobrador) => cobradorIds.has(cobrador.id));
    const visibleUserIds = new Set([
      userId,
      ...scopedSellers.map((seller) => seller.user_id),
      ...scopedCobradores.map((cobrador) => cobrador.user_id),
    ]);

    return {
      users: users.filter((user) => visibleUserIds.has(user.id)),
      sellers: scopedSellers,
      clients: [currentClient],
      contacts: contacts.filter((contact) => contact.user_id === userId),
      products,
      cobradores: scopedCobradores,
      tickets: scopedTickets,
    };
  }

  throw new Error("La cuenta no tiene un rol activo asignado");
}

export async function getTicket(id: number) {
  const { data, error } = await supabase.from("ticket").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
const { data: products, error: productsError } = await supabase
    .from("ticket_product")
    .select("*, product (name, img, description)")
    .eq("ticket_id", id);

  if (productsError) throw productsError;

  return {
    data,
    products
  };
}

export async function createTicket(input: {
  created_at?: string;
  client_id: number;
  seller_id: number;
  cobrador_id?: number | null;
  ticket_products?: { product_id: number; value: number; quotas: number }[];
}) {
  try {
    const { data, error } = await supabase.rpc("create_ticket_with_products", {
      p_client_id: input.client_id,
      p_seller_id: input.seller_id,
      p_cobrador_id: input.cobrador_id ?? null,
      p_ticket_products: input.ticket_products ?? [],
    });
    if (error) {
      logSupabaseFailure("create_ticket_with_products", error);
      const databaseError = error as typeof error & {
        code?: string;
        constraint?: string;
        message?: string;
      };
      const code = databaseError.code;
      const constraint = databaseError.constraint
        ?? databaseError.message?.match(/constraint "([^"]+)"/)?.[1];
      if (code === "PGRST202" || code === "42883") {
        throw new HttpError(
          "No está disponible la función de registro de ventas en Supabase. Aplicá la migración de ventas y reintentá.",
          503,
        );
      }
      if (code === "23503") {
        if (constraint === "ticket_id_fkey") {
          throw new HttpError(
            "La base de datos tiene una relación incorrecta en ticket.id. Aplicá la migración 202611180002_fix_ticket_id_foreign_key.sql en Supabase y reiniciá el backend.",
            503,
          );
        }
        throw new HttpError(
          `La base rechazó una referencia de la venta${constraint ? ` (${constraint})` : ""}. El backend registró el detalle para identificar el campo.`,
          400,
        );
      }
      if (code === "23502") {
        throw new HttpError(
          "La base de datos rechazó un campo obligatorio de la venta. Revisá que el esquema esté actualizado.",
          400,
        );
      }
      if (code === "22P02" || code === "22003") {
        throw new HttpError("El importe o la cantidad de cuotas no están dentro del rango admitido.", 400);
      }
      if (code === "P0001" && databaseError.message === "La venta debe incluir al menos un producto") {
        throw new HttpError(databaseError.message, 400);
      }
      if (code === "P0001" && databaseError.message === "Cada producto debe tener un valor y una cantidad de cuotas válidos") {
        throw new HttpError(databaseError.message, 400);
      }
      throw new HttpError(
        `No se pudo registrar la venta en Supabase${code ? ` (código ${code})` : ""}. Revisá los logs del backend.`,
        502,
      );
    }
    return data;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    logSupabaseFailure("create_ticket_with_products_connection", error);
    throw new HttpError("No se pudo conectar con Supabase para registrar la venta.", 502);
  }
}

export async function createTicketProduct(input: {
  created_at?: string;
  ticket_id: number;
  product_id: number;
  value: number;
  quotas: number;
}) {
  const { data: ticket, error } = await supabase.from("ticket_product").insert(input).select("*").single();
  if (error) throw error;
  return ticket;
}