"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const forgescript_1 = require("@tryforge/forgescript");
const index_js_1 = require("../../index.js");
exports.default = new forgescript_1.NativeFunction({
    name: '$playerNodeStats',
    description: 'Get CPU, memory, and other stats of a Lavalink node',
    version: '2.1.0',
    brackets: false,
    unwrap: true,
    args: [
        {
            name: 'nodeId',
            description: 'Optional Lavalink node ID to query stats for',
            type: forgescript_1.ArgType.String,
            required: false,
            rest: false,
        },
    ],
    output: forgescript_1.ArgType.Json,
    execute(ctx, [nodeId]) {
        const linked = ctx.client.getExtension(index_js_1.ForgeLinked, true).lavalink;
        if (!linked)
            return this.customError('ForgeLinked is not initialized');
        let node;
        if (nodeId) {
            // Try to get a specific node by ID
            // @ts-ignore - nodes is expected to be a Map-like structure
            node = linked.nodeManager.nodes?.get?.(String(nodeId));
        }
        else {
            // Fallback to the first available node
            // @ts-ignore - nodes is expected to be an iterable of node values
            const values = linked.nodeManager.nodes?.values?.();
            node = values ? values.next().value : undefined;
        }
        if (!node)
            return this.customError('Lavalink node not found');
        return this.successJSON(node.stats ?? {});
    },
});
//# sourceMappingURL=playerNodeStats.js.map
