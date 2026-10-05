# Backend

## Ejecutar

1. Instalar dependencias: `npm install`
2. Crear el archivo `.env` a partir de `.env.example`.
3. Completar `SUPABASE_URL` en `.env`.
4. Completar `SUPABASE_SERVICE_ROLE_KEY` en `.env`. Esta clave se usa solamente en el backend.
5. Iniciar el servidor: `npm run dev`

La API queda disponible en `http://localhost:3000`.

## Endpoints

- `GET /api/health`
- `GET /api/users` y `GET /api/users/:id`; `POST /api/users`
- `GET /api/sellers` y `GET /api/sellers/:id`; `POST /api/sellers`; `PUT /api/sellers/:id`
- `GET /api/clients` y `GET /api/clients/:id`; `POST /api/clients`; `PUT /api/clients/:id`
- `GET /api/cobradores` y `GET /api/cobradores/:id`; `POST /api/cobradores`; `PUT /api/cobradores/:id`
- `GET /api/contacts` y `GET /api/contacts/:id`; `POST /api/contacts`; `PUT /api/contacts/:id`
- `GET /api/products` y `GET /api/products/:id`; `POST /api/products`; `PUT /api/products/:id`; `DELETE /api/products/:id`
- `GET /api/tickets` y `GET /api/tickets/:id`; `POST /api/tickets`

Para crear un ticket, enviar `client_id`, `seller_id`, `cobrador_id` y, opcionalmente, `ticket_products` con objetos `{ "product_id": 1, "value": 100, "quotas": 2 }`.

Ejemplo: `curl http://localhost:3000/api/products`
