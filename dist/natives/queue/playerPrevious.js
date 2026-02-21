"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const forgescript_1 = require("@tryforge/forgescript");
const index_js_1 = require("../../index.js");
exports.default = new forgescript_1.NativeFunction({
    name: '$playerPrevious',
    description: 'Plays the previous track from the queue history.',
    version: '2.1.0',
    brackets: false,
    unwrap: true,
    args: [
        {
            name: 'guildId',
            description: 'The guild id to play the previous track for',
            type: forgescript_1.ArgType.Guild,
            required: true,
            rest: false,
        },
        {
            name: 'position',
            description: 'The number of tracks to go back (default 1)',
            type: forgescript_1.ArgType.Number,
            required: false,
            rest: false,
        },
    ],
    output: forgescript_1.ArgType.Boolean,
    execute(ctx, [guildId, position]) {
        const linked = ctx.client.getExtension(index_js_1.ForgeLinked, true).lavalink;
        if (!linked)
            return this.customError('ForgeLinked is not initialized');
        if (!guildId)
            guildId = ctx.guild;
        if (!guildId)
            return this.customError('Unable to find any guild. Ensure this command was ran inside of a guild and not dms or a group chat');
        const player = linked.getPlayer(guildId.id);
        if (!player)
            return this.customError('Player not found');
        const pos = position || 1;
        if (pos < 1)
            return this.customError('Position must be greater than 0');
        if (player.queue.previous.length < pos)
            return this.customError('Not enough tracks in history to go back that far');
        const toRestore = player.queue.previous.splice(0, pos);
        toRestore.reverse();
        player.queue.tracks.unshift(...toRestore);
        player.skip();
        return this.success(true);
    },
});
//# sourceMappingURL=playerPrevious.js.map
