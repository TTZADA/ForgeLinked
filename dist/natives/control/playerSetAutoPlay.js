"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const forgescript_1 = require("@tryforge/forgescript");
const index_js_1 = require("../../index.js");
exports.default = new forgescript_1.NativeFunction({
    name: '$playerSetAutoPlay',
    description: 'Enable or disable autoplay for a player. When enabled, a related track is automatically queued when the queue runs empty.',
    version: '2.3.0',
    brackets: true,
    unwrap: true,
    args: [
        {
            name: 'guildId',
            description: 'The guild id to set autoplay for',
            type: forgescript_1.ArgType.Guild,
            required: true,
            rest: false,
        },
        {
            name: 'enabled',
            description: 'Whether to enable autoplay',
            type: forgescript_1.ArgType.Boolean,
            required: true,
            rest: false,
        },
    ],
    output: forgescript_1.ArgType.Boolean,
    async execute(ctx, [guildId, enabled]) {
        try {
            const linked = ctx.client.getExtension(index_js_1.ForgeLinked, true)?.lavalink;
            if (!linked)
                return this.customError('ForgeLinked is not initialized');
            const player = linked.getPlayer(guildId.id);
            if (!player)
                return this.customError('Player not found');
            player.autoPlay = enabled;
            return this.success(enabled);
        }
        catch (err) {
            return this.customError(`Failed to set autoplay: ${err instanceof Error ? err.message : String(err)}`);
        }
    },
});
//# sourceMappingURL=playerSetAutoPlay.js.map
