/**
 * Portfolio Gateway — Component Decomposition Plan
 *
 * Source: IntelligentPortfolioGatewayPage.tsx (3425 lines)
 *
 * Sub-components identified for extraction:
 *
 * | Component                    | Lines     | Size  | Priority |
 * |------------------------------|-----------|-------|----------|
 * | ConvertDialog                | L452-704  | 253   | HIGH     |
 * | RejectDemandDialog           | L706-813  | 108   | HIGH     |
 * | WorkspacePathSelectionDialog | L818-1020 | 203   | HIGH     |
 * | PhaseTransitionDialog        | L1022-1174| 153   | MEDIUM   |
 * | PortfolioVisualizationMatrix | L1176-1276| 101   | MEDIUM   |
 * | PortfolioDecisionMatrix      | L1278-1373| 96    | MEDIUM   |
 * | HealthIndicator              | L281-295  | 15    | LOW      |
 * | ProjectCard                  | L297-342  | 46    | LOW      |
 *
 * Constants to extract:
 * - CHART_COLORS, PHASE_COLORS, PHASE_ORDER (L83-132) → constants.ts
 *
 * Unused components (candidates for removal):
 * - _SummaryMetricCard (L197-242)
 * - _PhaseDistribution (L243-280)
 * - _PipelineCard (L344-450)
 */
export {};
