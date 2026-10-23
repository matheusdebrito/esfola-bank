import { Request, Response } from "express";
import { asyncHandler } from "../../middlewares/error.middleware";
import { auditService } from "./audit.service";
import { AuthRequest } from "../../middlewares/auth.middleware";

export const auditController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 20));
    const action = req.query.action as string;
    const entityType = req.query.entityType as string;
    const userId = req.query.userId as string;
    const from = req.query.from ? new Date(req.query.from as string) : undefined;
    const to = req.query.to ? new Date(req.query.to as string) : undefined;

    const result = await auditService.list({ page, pageSize, action, entityType, userId, from, to });
    res.json({ error: false, data: result });
  }),
};

export default auditController;
