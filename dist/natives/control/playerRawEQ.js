"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const forgescript_1 = require("@tryforge/forgescript");
const helpers_1 = require("../util/helpers");
exports.default = new forgescript_1.NativeFunction({
    name: '$playerRawEQ',
    description: 'Sends a raw EQ band array directly to the player filter manager, bypassing enums',
    version: '2.3.0',
    brackets: true,
    unwrap: true,
    args: [
        { name: 'guildId', description: 'The guild ID', type: forgescript_1.ArgType.Guild, required: true, rest: false },
        { name: 'bands', description: 'JSON array of EQ bands, e.g. [{"band":0,"gain":0.5}]', type: forgescript_1.ArgType.Json, required: true, rest: false },
    ],
    async execute(ctx, [guildId, bands]) {
        const player = (0, helpers_1.getPlayer)(ctx, guildId);
        if (!player) return this.customError('Player not found');
        if (!Array.isArray(bands)) return this.customError('bands must be a JSON array');
        for (const band of bands) {
            if (typeof band.band !== 'number' || band.band < 0 || band.band > 14)
                return this.customError(`Invalid band index: ${band.band}. Must be 0-14`);
            if (typeof band.gain !== 'number' || band.gain < -0.25 || band.gain > 1)
                return this.customError(`Invalid gain for band ${band.band}. Must be -0.25 to 1`);
        }
        player.filterManager.filters.equalizer = bands;
        await player.filterManager.applyPlayerFilters();
        return this.success(true);
    },
});
