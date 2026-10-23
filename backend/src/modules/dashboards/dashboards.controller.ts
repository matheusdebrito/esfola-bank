import { Request, Response } from "express";
import { asyncHandler } from "../../middlewares/error.middleware";
import { dashboardsService } from "./dashboards.service";
import { dashboardQuerySchema, type DashboardQuery } from "./dashboards.schema";
import { AuthRequest } from "../../middlewares/auth.middleware";

export const dashboardsController = {
  executive: asyncHandler(async (req: Request, res: Response) => {
    const query = dashboardQuerySchema.parse(req.query) as DashboardQuery;
    const data = await dashboardsService.executive(query);
    res.json({ error: false, data });
  }),
  financial: asyncHandler(async (req: Request, res: Response) => {
    const query = dashboardQuerySchema.parse(req.query) as DashboardQuery;
    const data = await dashboardsService.financial(query);
    res.json({ error: false, data });
  }),
  defaults: asyncHandler(async (req: Request, res: Response) => {
    const query = dashboardQuerySchema.parse(req.query) as DashboardQuery;
    const data = await dashboardsService.defaults(query);
    res.json({ error: false, data });
  }),
  operational: asyncHandler(async (req: Request, res: Response) => {
    const query = dashboardQuerySchema.parse(req.query) as DashboardQuery;
    const data = await dashboardsService.operational(query);
    res.json({ error: false, data });
  }),
  fiscalization: asyncHandler(async (req: Request, res: Response) => {
    const query = dashboardQuerySchema.parse(req.query) as DashboardQuery;
    const data = await dashboardsService.fiscalization(query);
    res.json({ error: false, data });
  }),

  monthly: asyncHandler(async (_req: Request, res: Response) => {
    const data = await dashboardsService.monthly();
    res.json({ error: false, data });
  }),
  overview: asyncHandler(async (req: Request, res: Response) => {
    const query = dashboardQuerySchema.parse(req.query) as DashboardQuery;
    const data = await dashboardsService.overview(query);
    res.json({ error: false, data });
  }),
};

export default dashboardsController;
