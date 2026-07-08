"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const forgescript_1 = require("@tryforge/forgescript");
const index_js_1 = require("../../index.js");
exports.default = new forgescript_1.NativeFunction({
    name: '$playerCreate',
    description: 'Create a player for a guild',
    version: '1.0.0',
    brackets: true,
    unwrap: true,
    args: [
        {
            name: 'guildId',
            description: 'The guild id to create the player for',
            type: forgescript_1.ArgType.Guild,
            required: true,
            rest: false,
        },
        {
            name: 'voiceID',
            description: 'The ID of the voice channel for the bot to use',
            type: forgescript_1.ArgType.Channel,
            required: true,
            rest: false,
        },
        {
            name: 'textID',
            description: 'The ID of the text channel for the bot to use',
            type: forgescript_1.ArgType.Channel,
            required: false,
            rest: false,
        },
        {
            name: 'volume',
            description: 'The volume to set the player to',
            type: forgescript_1.ArgType.Number,
            required: false,
            rest: false,
        },
        {
            name: 'selfDeaf',
            description: 'Whether to deafen the bot',
            type: forgescript_1.ArgType.Boolean,
            required: false,
            rest: false,
        },
        {
            name: 'selfMute',
            description: 'Whether to mute the bot',
            type: forgescript_1.ArgType.Boolean,
            required: false,
            rest: false,
        },
        {
            name: 'node',
            description: 'The node to use for the player',
            type: forgescript_1.ArgType.String,
            required: false,
            rest: false,
        },
    ],
    output: forgescript_1.ArgType.Boolean,
async execute(ctx, [guildId, voiceId, textId, volume, selfDeaf, selfMute, node]) {
    const linked = ctx.client.getExtension(index_js_1.ForgeLinked, true).lavalink;
    if (!linked)
        return this.customError('ForgeLinked is not initialized');

    linked.createPlayer({
        guildId: guildId.id,
        voiceChannelId: voiceId.id,
        textChannelId: textId?.id || ctx.channel?.id,
        volume: volume || 100,
        selfDeaf: selfDeaf ?? true,
        selfMute: selfMute || false,
        node: node || undefined,
    });

    const player = linked.players.get(guildId.id);
    if (!player)
        return this.success(false);
        
    return this.success(linked.players.has(guildId.id));
},
});
//# sourceMappingURL=playerCreate.js.map
