# Backend

## Ejecutar

1. Instalar dependencias: `npm install`
2. Crear el archivo `.env` a partir de `.env.example`.
3. Completar `SUPABASE_URL` en `.env`.
4. Completar `SUPABASE_SERVICE_ROLE_KEY` en `.env`. Esta clave se usa solamente en el backend.
5. Configurar `FRONTEND_URL` y las credenciales `SMTP_*` para que el backend pueda enviar invitaciones.
6. Si aún no se aplicaron, ejecutar en orden `supabase/migrations/202611180001_account_invitations_and_sales.sql`, `supabase/migrations/202611180002_fix_ticket_id_foreign_key.sql` y `supabase/migrations/202611230001_contact_map_link.sql` en el SQL Editor del proyecto Supabase.
7. Iniciar el servidor: `npm run dev`

La API siempre escucha en `http://localhost:3000` (la variable `PORT` no cambia este puerto).

## Cuentas locales de prueba

Para agregar tres cuentas de prueba a la base configurada en `.env`, desde esta carpeta ejecutá:

```powershell
$env:DEMO_SEED_CONFIRM = "CREATE_DEMO_USERS"
npm run seed:demo
Remove-Item Env:DEMO_SEED_CONFIRM
```

La operación es aditiva: no borra ni reemplaza tablas o datos existentes. Crea el administrador, el cliente y el vendedor indicados abajo. Es idempotente si esas cuentas ya están completas; si un correo de prueba ya existe con datos distintos, se detiene sin sobrescribirlo. Ejecutar únicamente contra una base de desarrollo o pruebas. El script no funciona con `NODE_ENV=production`.

| Rol | Correo | Contraseña |
| --- | --- | --- |
| Administrador | `admin.demo@cuotasonline.test` | `DemoAdmin-2026!` |
| Cliente | `cliente.demo@cuotasonline.test` | `DemoCliente-2026!` |
| Vendedor | `vendedor.demo@cuotasonline.test` | `DemoVendedor-2026!` |

Las credenciales son exclusivamente locales y públicas para pruebas; no las uses en producción. La cuenta de administrador queda habilitada desde su creación. El vendedor puede cargar ventas sin cobrador asignado.
El inicio de sesión usa un cliente Supabase aislado para no reemplazar los permisos de servicio que la API necesita para consultar la base.
Como el esquema no tiene una relación de asignación entre vendedor y cliente, el panel vendedor recibe el directorio de clientes activos para permitir la primera venta; solo recibe sus propias ventas.

## Endpoints

- `GET /api/health`
- `POST /api/auth/login`
- `GET /api/dashboard` (requiere sesión; devuelve datos limitados al rol autenticado)
- `GET /api/users` y `GET /api/users/:id`; `POST /api/users`
- `POST /api/accounts` (requiere token de administrador o vendedor; vendedores solo pueden crear clientes)
- `POST /api/account-invitations` (administrador o vendedor; envía enlace de alta válido 20 minutos)
- `GET /api/public/account-invitations/:token` y `POST /api/public/account-invitations/:token/complete`
- `GET /api/sellers` y `GET /api/sellers/:id`; `POST /api/sellers`; `PUT /api/sellers/:id`
- `GET /api/clients` y `GET /api/clients/:id`; `POST /api/clients`; `PUT /api/clients/:id`
- `GET /api/cobradores` y `GET /api/cobradores/:id`; `POST /api/cobradores`; `PUT /api/cobradores/:id`
- `GET /api/contacts` y `GET /api/contacts/:id`; `POST /api/contacts`; `PUT /api/contacts/:id`
- `GET /api/products` y `GET /api/products/:id`; `POST /api/products`; `PUT /api/products/:id`; `DELETE /api/products/:id`
- `GET /api/public/products/:id` (detalle público para compartir)
- `GET /api/tickets` y `GET /api/tickets/:id`; `POST /api/tickets`
- `POST /api/tickets` guarda el ticket y todas sus líneas de producto de manera atómica usando la función de la migración.

Para crear un ticket, enviar `client_id`, `seller_id`, `cobrador_id` (opcional) y, opcionalmente, `ticket_products` con objetos `{ "product_id": 1, "value": 100, "quotas": 2 }`.
Los endpoints de datos requieren `Authorization: Bearer <accessToken>`. Los listados completos y las operaciones administrativas requieren una cuenta administradora; el registro de ventas requiere una cuenta de vendedor y no permite atribuir ventas a otra persona.

Las invitaciones se guardan en la tabla `account_invitation` y se envían con Nodemailer desde el backend; no usan `supabase.auth.admin.inviteUserByEmail`. Por eso `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` y `SMTP_FROM` del `.env` del backend sí son consumidos por el código, mientras que la configuración SMTP de Supabase Auth no envía la invitación inicial. `FRONTEND_URL` debe apuntar al frontend; en local, el enlace es `http://localhost:3001/crear-cuenta/<token>`. Si la persona cambia el correo al completar el formulario, el backend genera además un enlace de verificación con Supabase Auth y lo envía por el mismo SMTP propio. Para ese caso agregá `http://localhost:3001` en Authentication > URL Configuration > Redirect URLs de Supabase. Los vendedores pueden invitar o crear clientes, pero no crear cuentas de administración ni de vendedores.

La segunda migración corrige una relación preexistente incorrecta que hacía que `ticket.id` también apuntara a `cobrador.id`; elimina únicamente esa clave foránea errónea y asegura que el ID del ticket siga generándose secuencialmente. Conserva la clave primaria y los registros existentes.

Ejemplo: `curl http://localhost:3000/api/products`

La migración `202611230001_contact_map_link.sql` agrega `contact.map_link` como un único campo de texto opcional, restringido a URLs HTTP/HTTPS, y elimina `contact.streets_between`. Los valores antiguos de entrecalles se descartan; los domicilios de `contact.street` no se modifican. Los archivos SQL no se aplican automáticamente: ejecutá esta migración en Supabase → SQL Editor para que el campo aparezca en la tabla remota. Hasta aplicarla, las altas que envíen `map_link` fallarán porque la columna todavía no existe.

El frontend Next.js se encuentra en `../frontend` y en desarrollo usa siempre `http://localhost:3001`; no necesita configurar `NEXT_PUBLIC_API_URL` localmente. La clave de servicio de Supabase debe permanecer únicamente en el `.env` del backend.
