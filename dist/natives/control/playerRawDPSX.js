"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const forgescript_1 = require("@tryforge/forgescript");
const helpers_1 = require("../util/helpers");
exports.default = new forgescript_1.NativeFunction({
    name: '$playerRawDSPX',
    description: 'Sends a raw LavaDSPX plugin filters object directly to the player. Supports high-pass, low-pass, normalization, echo and any other LavaDSPX filter',
    version: '2.3.0',
    brackets: true,
    unwrap: true,
    args: [
        { name: 'guildId', description: 'The guild ID', type: forgescript_1.ArgType.Guild, required: true, rest: false },
        { name: 'filters', description: 'JSON object with LavaDSPX filters, e.g. {"high-pass":{"cutoffFrequency":80},"echo":{"echoLength":0.5,"decay":0.5}}', type: forgescript_1.ArgType.Json, required: true, rest: false },
    ],
    async execute(ctx, [guildId, filters]) {
        const player = (0, helpers_1.getPlayer)(ctx, guildId);
        if (!player) return this.customError('Player not found');
        if (typeof filters !== 'object' || Array.isArray(filters))
            return this.customError('filters must be a JSON object');
        if (!player.filterManager.filters.pluginFilters)
            player.filterManager.filters.pluginFilters = {};
        Object.assign(player.filterManager.filters.pluginFilters, filters);
        await player.filterManager.applyPlayerFilters();
        return this.success(true);
    },
});
