import type { NextFunction, Request, Response } from "express";
import { supabase } from "../config/supabase";

export async function accountCreatorMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: "Autenticación requerida" });
      return;
    }

    const { data: user, error: userError } = await supabase
      .from("user")
      .select("admin_status")
      .eq("id", req.user.id)
      .maybeSingle();
    if (userError) throw userError;

    if (user?.admin_status) {
      next();
      return;
    }

    const { data: seller, error: sellerError } = await supabase
      .from("seller")
      .select("id, is_active")
      .eq("user_id", req.user.id)
      .maybeSingle();
    if (sellerError) throw sellerError;

    if (!seller?.is_active || req.body?.role !== "client") {
      res.status(403).json({ success: false, error: "Solo administración puede crear vendedores o administradores" });
      return;
    }

    next();
  } catch (error) {
    next(error);
  }
}
