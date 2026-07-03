import { z } from 'zod';

/**
 * Zod validation counterpart to `IFacetDeployedInfo` (scripts/common.ts).
 *
 * gnus-ai's canonical deployment record carries per-facet history under
 * `FacetDeployedInfo`, but @diamondslab/diamonds' `DeployedDiamondDataSchema`
 * has that member commented out — so the library's `readDeployFile()` Zod parse
 * strips it and `Diamond.getDeployedDiamondData()` can never surface it. This
 * schema declares `FacetDeployedInfo` so callers can validate the raw record
 * directly without losing the facet history.
 *
 * `tx_hash` is nullable because historical entries (e.g. EscrowAIJob) record
 * `null` for not-yet-confirmed deployments.
 */
const FacetDeployedInfoEntrySchema = z.object({
	address: z.string().optional(),
	tx_hash: z.string().nullable().optional(),
	funcSelectors: z.array(z.string()).optional(),
	verified: z.boolean().optional(),
	version: z.number().optional(),
});

export const GnusDeployedDiamondDataSchema = z.object({
	DiamondAddress: z.string().optional(),
	DeployerAddress: z.string().optional(),
	FacetDeployedInfo: z.record(z.string(), FacetDeployedInfoEntrySchema).optional(),
	DeployedFacets: z.record(z.string(), FacetDeployedInfoEntrySchema).optional(),
	ExternalLibraries: z.record(z.string(), z.string()).optional(),
	protocolVersion: z.number().optional(),
});

export type GnusDeployedDiamondData = z.infer<typeof GnusDeployedDiamondDataSchema>;
