import "dotenv/config";
import { supabase } from "../src/config/supabase";

const confirmation = "CREATE_DEMO_USERS";

const demoAccounts = [
  {
    email: "admin.demo@cuotasonline.test",
    password: "DemoAdmin-2026!",
    name: "Administración Demo",
    dni: "90000001",
    role: "admin",
  },
  {
    email: "cliente.demo@cuotasonline.test",
    password: "DemoCliente-2026!",
    name: "Cliente Demo",
    dni: "90000002",
    role: "client",
  },
  {
    email: "vendedor.demo@cuotasonline.test",
    password: "DemoVendedor-2026!",
    name: "Vendedor Demo",
    dni: "90000003",
    role: "seller",
  },
] as const;

async function findAuthUser(email: string) {
  for (let page = 1; ; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const user = data.users.find((candidate) => candidate.email?.toLowerCase() === email);
    if (user) return user;
    if (data.users.length < 1000) return null;
  }
}

async function seedAccount(account: (typeof demoAccounts)[number]) {
  const authUser = await findAuthUser(account.email);
  if (authUser) {
    const { data: profile, error: profileError } = await supabase
      .from("user")
      .select("id, name, dni, admin_status")
      .eq("id", authUser.id)
      .maybeSingle();
    if (profileError) throw profileError;

    let isExpectedRole = profile?.admin_status === true;
    if (account.role !== "admin") {
      const { data: roleRow, error: roleError } = await supabase
        .from(account.role)
        .select("id")
        .eq("user_id", authUser.id)
        .maybeSingle();
      if (roleError) throw roleError;
      isExpectedRole = profile?.admin_status === false && roleRow !== null;
    }

    if (
      profile?.name === account.name &&
      String(profile.dni) === account.dni &&
      isExpectedRole
    ) {
      console.log(`Ya existe: ${account.email} (${account.role})`);
      return;
    }

    throw new Error(
      `La cuenta ${account.email} ya existe con datos distintos. No se modificó; elegí otro correo de prueba.`,
    );
  }

  const { data: createdAuth, error: authError } = await supabase.auth.admin.createUser({
    email: account.email,
    password: account.password,
    email_confirm: true,
    user_metadata: { name: account.name },
  });
  if (authError) throw authError;
  if (!createdAuth.user) throw new Error(`Supabase no devolvió el usuario ${account.email}`);

  const userId = createdAuth.user.id;
  let profileCreated = false;
  let roleCreated = false;

  try {
    const { error: profileError } = await supabase.from("user").insert({
      id: userId,
      name: account.name,
      dni: account.dni,
      admin_status: account.role === "admin",
    });
    if (profileError) throw profileError;
    profileCreated = true;

    if (account.role !== "admin") {
      const { error: roleError } = await supabase
        .from(account.role)
        .insert({ user_id: userId, is_active: true });
      if (roleError) throw roleError;
      roleCreated = true;
    }
  } catch (error) {
    if (roleCreated && account.role !== "admin") {
      const { error: cleanupError } = await supabase.from(account.role).delete().eq("user_id", userId);
      if (cleanupError) console.error(`No se pudo revertir el rol de ${account.email}:`, cleanupError);
    }
    if (profileCreated) {
      const { error: cleanupError } = await supabase.from("user").delete().eq("id", userId);
      if (cleanupError) console.error(`No se pudo revertir el perfil de ${account.email}:`, cleanupError);
    }
    const { error: authCleanupError } = await supabase.auth.admin.deleteUser(userId);
    if (authCleanupError) console.error(`No se pudo revertir la autenticación de ${account.email}:`, authCleanupError);
    throw error;
  }

  console.log(`Creado: ${account.email} (${account.role})`);
}

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("La carga de usuarios demo está deshabilitada en producción.");
  }
  if (process.env.DEMO_SEED_CONFIRM !== confirmation) {
    throw new Error(`Para agregar cuentas de prueba, confirmá con DEMO_SEED_CONFIRM=${confirmation}. No se borra ningún dato.`);
  }

  for (const account of demoAccounts) await seedAccount(account);
  console.log("Carga de cuentas de prueba finalizada. Las contraseñas están en la guía del frontend.");
}

main().catch((error: unknown) => {
  console.error("No se pudieron cargar las cuentas demo:", error);
  process.exitCode = 1;
});
