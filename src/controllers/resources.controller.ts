import type { Request, Response } from "express";
import * as service from "../services/resources.service";

function respond(res: Response, data: unknown, status = 200) {
  if (data === null) {
    res.status(404).json({ success: false, error: "Recurso no encontrado" });
    return;
  }
  res.status(status).json({ success: true, data });
}

const numericId = (req: Request<{ id: string }>) => Number(req.params.id);

export const getUsers = async (_req: Request, res: Response) => respond(res, await service.listUsers());
export const getDashboard = async (req: Request, res: Response) =>
  respond(res, await service.getDashboard(req.user!.id));
export const getAccountInvitation = async (req: Request<{ token: string }>, res: Response) =>
  respond(res, await service.getAccountInvitation(req.params.token));
export const completeAccountInvitation = async (req: Request<{ token: string }>, res: Response) =>
  respond(res, await service.completeAccountInvitation(req.params.token, req.body), 201);
export const getUser = async (req: Request<{ id: string }>, res: Response) => respond(res, await service.getUser(req.params.id));
export const postUser = async (req: Request, res: Response) => respond(res, await service.createUser(req.body), 201);
export const postAccount = async (req: Request, res: Response) => respond(res, await service.createAccount(req.body), 201);
export const postAccountInvitation = async (req: Request, res: Response) =>
  respond(res, await service.createAccountInvitation({
    ...req.body,
    createdBy: req.user!.id,
  }), 201);
// 
export const authAdmin = async (req: Request, res: Response) => respond(res, await service.authAdmin(req.body), 201);
// 
export const getSellers = async (_req: Request, res: Response) => respond(res, await service.listSellers());
export const getSeller = async (req: Request<{ id: string }>, res: Response) => respond(res, await service.getSeller(numericId(req)));
export const postSeller = async (req: Request, res: Response) => respond(res, await service.createSeller(req.body), 201);
export const putSeller = async (req: Request<{ id: string }>, res: Response) => respond(res, await service.updateSeller(numericId(req), req.body));

export const getClients = async (_req: Request, res: Response) => respond(res, await service.listClients());
export const getClient = async (req: Request<{ id: string }>, res: Response) => respond(res, await service.getClient(numericId(req)));
export const postClient = async (req: Request, res: Response) => respond(res, await service.createClient(req.body), 201);
export const putClient = async (req: Request<{ id: string }>, res: Response) => respond(res, await service.updateClient(numericId(req), req.body));

export const getCobradores = async (_req: Request, res: Response) => respond(res, await service.listCobradores());
export const getCobrador = async (req: Request<{ id: string }>, res: Response) => respond(res, await service.getCobrador(numericId(req)));
export const postCobrador = async (req: Request, res: Response) => respond(res, await service.createCobrador(req.body), 201);
export const putCobrador = async (req: Request<{ id: string }>, res: Response) => respond(res, await service.updateCobrador(numericId(req), req.body));

export const getContacts = async (_req: Request, res: Response) => respond(res, await service.listContacts());
export const getContact = async (req: Request<{ id: string }>, res: Response) => respond(res, await service.getContact(numericId(req)));
export const postContact = async (req: Request, res: Response) => respond(res, await service.createContact(req.body), 201);
export const putContact = async (req: Request<{ id: string }>, res: Response) => respond(res, await service.updateContact(numericId(req), req.body));

export const getProducts = async (_req: Request, res: Response) => respond(res, await service.listProducts());
export const getProduct = async (req: Request<{ id: string }>, res: Response) => respond(res, await service.getProduct(numericId(req)));
export const postProduct = async (req: Request, res: Response) => respond(res, await service.createProduct(req.body), 201);
export const putProduct = async (req: Request<{ id: string }>, res: Response) => respond(res, await service.updateProduct(numericId(req), req.body));
export const removeProduct = async (req: Request<{ id: string }>, res: Response) => respond(res, await service.deleteProduct(numericId(req)));

export const getTickets = async (_req: Request, res: Response) => respond(res, await service.listTickets());
export const getTicket = async (req: Request<{ id: string }>, res: Response) => respond(res, await service.getTicket(numericId(req)));
export const postTicket = async (req: Request, res: Response) => respond(res, await service.createTicket(req.body), 201);

export const postTicketProduct = async (req: Request, res: Response) => respond(res, await service.createTicketProduct(req.body), 201);
