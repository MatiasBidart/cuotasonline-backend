import { Router } from "express";
import * as controller from "../controllers/resources.controller";
import { validateBody } from "../middlewares/validate-body";
import { authMiddleware } from "../middlewares/auth.middleware";
import { adminMiddleware } from "../middlewares/admin.middleware";
import { sellerOrAdminMiddleware } from "../middlewares/seller-or-admin.middleware";
import { accountCreatorMiddleware } from "../middlewares/account-creator.middleware";
import {
  cobradorSchema,
  contactSchema,
  clientSchema,
  productSchema,
  sellerSchema,
  ticketSchema,
  updateCobradorSchema,
  updateContactSchema,
  updateClientSchema,
  updateProductSchema,
  updateSellerSchema,
  userSchema,
  ticketProductSchema,
  accountSchema,
  invitationSchema,
  completeInvitationSchema,
} from "../models/schemas";
// ------------------------------
import { supabase } from "../config/supabase";
import multer from "multer";
import { randomUUID } from "node:crypto";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});
// ------------------------------

export const apiRoutes = Router();

apiRoutes.post("/auth/login", controller.authAdmin);
apiRoutes.get("/public/products/:id", controller.getProduct);
apiRoutes.get("/public/account-invitations/:token", controller.getAccountInvitation);
apiRoutes.post(
  "/public/account-invitations/:token/complete",
  validateBody(completeInvitationSchema),
  controller.completeAccountInvitation,
);
apiRoutes.use("/account-invitations", (_req, _res, next) => {
  console.info("[account-invitation] Request received");
  next();
});
apiRoutes.use("/tickets", (req, _res, next) => {
  if (req.method === "POST") console.info("[sales] Create request received");
  next();
});
apiRoutes.use(authMiddleware);
apiRoutes.get("/dashboard", controller.getDashboard);
apiRoutes.get("/users", adminMiddleware, controller.getUsers);
apiRoutes.get("/users/:id", adminMiddleware, controller.getUser);
apiRoutes.post("/users", adminMiddleware, validateBody(userSchema), controller.postUser);

apiRoutes.post("/accounts", accountCreatorMiddleware, validateBody(accountSchema), controller.postAccount);
apiRoutes.post(
  "/account-invitations",
  accountCreatorMiddleware,
  validateBody(invitationSchema),
  controller.postAccountInvitation,
);

apiRoutes.get("/sellers", adminMiddleware, controller.getSellers);
apiRoutes.get("/sellers/:id", adminMiddleware, controller.getSeller);
apiRoutes.post("/sellers", adminMiddleware, validateBody(sellerSchema), controller.postSeller);
apiRoutes.put("/sellers/:id", adminMiddleware, validateBody(updateSellerSchema), controller.putSeller);

apiRoutes.get("/clients", adminMiddleware, controller.getClients);
apiRoutes.get("/clients/:id", adminMiddleware, controller.getClient);
apiRoutes.post("/clients", adminMiddleware, validateBody(clientSchema), controller.postClient);
apiRoutes.put("/clients/:id", adminMiddleware, validateBody(updateClientSchema), controller.putClient);

apiRoutes.get("/cobradores", adminMiddleware, controller.getCobradores);
apiRoutes.get("/cobradores/:id", adminMiddleware, controller.getCobrador);
apiRoutes.post("/cobradores", adminMiddleware, validateBody(cobradorSchema), controller.postCobrador);
apiRoutes.put("/cobradores/:id", adminMiddleware, validateBody(updateCobradorSchema), controller.putCobrador);

apiRoutes.get("/contacts", adminMiddleware, controller.getContacts);
apiRoutes.get("/contacts/:id", adminMiddleware, controller.getContact);
apiRoutes.post("/contacts", adminMiddleware, validateBody(contactSchema), controller.postContact);
apiRoutes.put("/contacts/:id", adminMiddleware, validateBody(updateContactSchema), controller.putContact);

apiRoutes.get("/products", controller.getProducts);
apiRoutes.get("/products/:id", controller.getProduct);
apiRoutes.post("/products", adminMiddleware, validateBody(productSchema), controller.postProduct);
apiRoutes.put("/products/:id", adminMiddleware, validateBody(updateProductSchema), controller.putProduct);
apiRoutes.delete("/products/:id", adminMiddleware, controller.removeProduct);
// .........................
apiRoutes.post(
  "/products/image",
  adminMiddleware,
  upload.single("image"),
  async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, error: "Falta la imagen." });
      }

      const extension = req.file.originalname.split(".").pop() || "jpg";
      const path = `products/${randomUUID()}.${extension}`;

      const { data, error } = await supabase.storage
        .from("product_images")
        .upload(path, req.file.buffer, { contentType: req.file.mimetype });

      if (error) throw error;

      const { data: urlData } = supabase.storage
        .from("product_images")
        .getPublicUrl(data.path);

      return res.status(201).json({
        success: true,
        data: { url: urlData.publicUrl },
      });
    } catch (error) {
      next(error);
    }
  },
);
// .........................

apiRoutes.get("/tickets", adminMiddleware, controller.getTickets);
apiRoutes.get("/tickets/:id", adminMiddleware, controller.getTicket);
apiRoutes.post("/tickets", sellerOrAdminMiddleware, validateBody(ticketSchema), controller.postTicket);

apiRoutes.post("/ticket-product", adminMiddleware, validateBody(ticketProductSchema), controller.postTicketProduct);

apiRoutes.get("/test", (_req, res) => {
  res.json({ success: true });
});