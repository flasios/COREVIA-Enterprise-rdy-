import { Router, Request, Response } from 'express';
import { fetchDashboardBootstrap, fetchIntelligenceBootstrap } from '../application';
import { apiCache } from '@interfaces/middleware/cache';
import { logger } from "@platform/logging/Logger";

export function createDashboardBootstrapRoutes() {
  const router = Router();

  router.get('/bootstrap', apiCache(30000), async (req: Request, res: Response) => {
    const userId = (req.session as any)?.userId; // eslint-disable-line @typescript-eslint/no-explicit-any
    const organizationId = req.organizationId || (req.session as any)?.organizationId; // eslint-disable-line @typescript-eslint/no-explicit-any
    
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    try {
      const data = await fetchDashboardBootstrap(userId, organizationId);

      res.json({
        success: true,
        data: {
          notifications: data.notifications,
          portfolio: { totalProjects: data.portfolioTotal },
          demands: { totalDemands: data.demandTotal },
          brain: { totalDecisions: data.decisionsTotal, todayEvents: data.todayEvents },
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      logger.error('[Dashboard Bootstrap] Error:', error);
      res.status(500).json({ error: 'Failed to load dashboard data' });
    }
  });

  router.get('/intelligence-bootstrap', apiCache(60000), async (req: Request, res: Response) => {
    const userId = (req.session as any)?.userId; // eslint-disable-line @typescript-eslint/no-explicit-any
    
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    try {
      const data = await fetchIntelligenceBootstrap();

      res.json({
        success: true,
        data: {
          stats: {
            knowledgeDocuments: data.knowledgeDocs,
            totalBrainEvents: data.eventsTotal,
            pipelineLayers: 8,
            intelligenceEngines: 3
          },
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      logger.error('[Intelligence Bootstrap] Error:', error);
      res.status(500).json({ error: 'Failed to load intelligence data' });
    }
  });

  return router;
}
