"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const forgescript_1 = require("@tryforge/forgescript");
const helpers_1 = require("../util/helpers");

exports.default = new forgescript_1.NativeFunction({
    name: '$playerRawFilters',
    description: 'Sends a raw filter object directly to the player filter manager',
    version: '2.3.0',
    brackets: true,
    unwrap: true,
    args: [
        { name: 'guildId', description: 'The guild ID', type: forgescript_1.ArgType.Guild, required: true, rest: false },
        { name: 'filters', description: 'JSON object with filter keys, e.g. {"equalizer":[...],"loudnorm":{...}}', type: forgescript_1.ArgType.Json, required: true, rest: false },
    ],
    async execute(ctx, [guildId, filters]) {
        const player = (0, helpers_1.getPlayer)(ctx, guildId);
        if (!player) return this.customError('Player not found');
        if (typeof filters !== 'object' || Array.isArray(filters) || filters === null)
            return this.customError('filters must be a JSON object');

        for (const [key, value] of Object.entries(filters)) {
            player.filterManager.filters[key] = value;
        }

        await player.filterManager.applyPlayerFilters();
        return this.success(true);
    },
});
