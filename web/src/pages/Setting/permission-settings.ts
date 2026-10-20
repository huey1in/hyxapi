import { z } from 'zod';

const matrix = z.record(z.string(), z.record(z.string(), z.boolean())).nullish().transform((value) => value ?? {});
const actions = z.array(z.object({ action: z.string(), label_key: z.string(), description_key: z.string() }));
export const permissionCatalogSchema = z.object({
  resources: z.array(z.object({ resource: z.string(), label_key: z.string(), actions })).nullish().transform((value) => value ?? []),
  roles: z.array(z.object({ key: z.string(), name: z.string(), built_in: z.boolean(), superuser: z.boolean(), grants: matrix })).nullish().transform((value) => value ?? []),
});
export const permissionDetailsSchema = z.object({ permissions: matrix, overrides: matrix });
