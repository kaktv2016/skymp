import * as z from 'zod/v4';
export const plugin=z.string().regex(/^(FrostveilNPCTest|FrostveilMCP_[a-f0-9]{12})\.esp$/);
export const hash=z.string().regex(/^[a-f0-9]{64}$/);
export const operationId=z.string().regex(/^[a-z][a-z0-9-]{0,47}$/);
export const spec=z.strictObject({editorId:z.string().regex(/^FV_[A-Za-z0-9_]{1,60}$/),displayName:z.string().min(1).max(100).regex(/^[^\x00-\x1f\x7f]+$/),height:z.number().min(0.8).max(1.2).default(1)});
export const schemas={
 ck_capabilities:z.strictObject({}),ck_inspect_installation:z.strictObject({}),ck_list_plugins:z.strictObject({}),
 ck_list_npcs:z.strictObject({plugin}),ck_get_npc:z.strictObject({plugin,localId:z.number().int().min(1).max(0xffffff)}),
 ck_list_outfits:z.strictObject({plugin}),ck_plan_npc_creation:spec,
 ck_create_npc:z.strictObject({planId:hash,reviewHash:hash,operationId,dryRun:z.boolean().default(false)}),
 ck_update_npc:z.strictObject({plugin,expectedSha256:hash,displayName:spec.shape.displayName,height:spec.shape.height.optional()}),
 ck_validate_plugin:z.strictObject({plugin}),
 ck_validate_facegen:z.strictObject({plugin,localId:z.number().int().min(1).max(0xffffff)}),
 ck_export_facegen:z.strictObject({plugin,localId:z.number().int().min(1).max(0xffffff)}),
 ck_prepare_frostveil_import:z.strictObject({plugin}),
 ck_get_operation_status:z.strictObject({operationId})
};
export type ToolName=keyof typeof schemas;
export type NpcSpec=z.infer<typeof spec>;
