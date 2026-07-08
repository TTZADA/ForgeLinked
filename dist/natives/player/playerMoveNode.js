"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const forgescript_1 = require("@tryforge/forgescript");
const index_js_1 = require("../../index.js");
exports.default = new forgescript_1.NativeFunction({
    name: '$playerMoveNode',
    description: 'Move a player to a different lavalink node without triggering a Discord voice reconnect',
    version: '1.0.0',
    brackets: true,
    unwrap: true,
    args: [
        {
            name: 'guildId',
            description: 'The guild id of the player to move',
            type: forgescript_1.ArgType.Guild,
            required: true,
            rest: false,
        },
        {
            name: 'nodeId',
            description: 'The target node id to move the player to',
            type: forgescript_1.ArgType.String,
            required: false,
            rest: false,
        },
        {
            name: 'pauseBefore',
            description: 'Whether to pause the player before moving',
            type: forgescript_1.ArgType.Boolean,
            required: false,
            rest: false,
        },
    ],
    output: forgescript_1.ArgType.Boolean,
    async execute(ctx, [guildId, nodeId, pauseBefore]) {
        const linked = ctx.client.getExtension(index_js_1.ForgeLinked, true).lavalink;
        if (!linked)
            return this.customError('ForgeLinked is not initialized');

        const player = linked.getPlayer(guildId.id);
        if (!player)
            return this.customError('No player found for this guild');

        const targetNode = nodeId
            ? linked.nodeManager.nodes.get(nodeId)
            : Array.from(linked.nodeManager.leastUsedNodes('playingPlayers')).find(
                (n) => n.connected && n.options.id !== player.node?.options?.id
              );

        if (!targetNode || !targetNode.connected)
            return this.customError('Target node not found or unavailable');

        if (targetNode.id === player.node?.id)
            return this.success(false);

        if (!player.voice?.endpoint || !player.voice?.sessionId || !player.voice?.token)
            return this.customError('Voice state is missing, cannot move node');

        if (player.get('internal_nodeChanging') === true)
            return this.customError('Player is already changing node, please wait');

        if (pauseBefore && !player.paused && player.queue.current) {
            await player.pause(true);
        }

        player.set('internal_nodeChanging', true);

        try {
            const currentTrack = player.queue.current;
            const lastPosition = player.lastPosition || player.position || 0;
            const wasPaused = player.paused;
            const lavalinkVolume = player.lavalinkVolume;
            const voiceChannelId = player.voiceChannelId;

            if (player.node.connected) {
                await player.node.destroyPlayer(player.guildId);
            }

            const freshVoiceState = await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    ctx.client.ws.removeListener('VOICE_SERVER_UPDATE', handler);
                    reject(new Error('VOICE_SERVER_UPDATE timeout after 5000ms'));
                }, 5000);

                const handler = (data) => {
                    if (data.guild_id !== player.guildId) return;
                    clearTimeout(timeout);
                    ctx.client.ws.removeListener('VOICE_SERVER_UPDATE', handler);
                    resolve({
                        token: data.token,
                        endpoint: data.endpoint,
                        sessionId: player.voice.sessionId,
                    });
                };

                ctx.client.ws.on('VOICE_SERVER_UPDATE', handler);

                const guild = ctx.client.guilds.cache.get(player.guildId);
                if (guild) {
                    guild.shard.send({
                        op: 4,
                        d: {
                            guild_id: player.guildId,
                            channel_id: voiceChannelId,
                            self_mute: false,
                            self_deaf: player.selfDeaf ?? false,
                        },
                    });
                } else {
                    clearTimeout(timeout);
                    ctx.client.ws.removeListener('VOICE_SERVER_UPDATE', handler);
                    reject(new Error('Guild not found in cache'));
                }
            });

            player.node = targetNode;

            await targetNode.updatePlayer({
                guildId: player.guildId,
                noReplace: false,
                playerOptions: {
                    voice: freshVoiceState,
                    ...(currentTrack && {
                        track: currentTrack,
                        position: lastPosition,
                        volume: lavalinkVolume,
                        paused: wasPaused,
                    }),
                },
            });

            await player.filterManager.applyPlayerFilters();

            return this.success(true);
        } catch (e) {
            return this.customError(`Failed to move node: ${e.message}`);
        } finally {
            player.set('internal_nodeChanging', undefined);
        }
    },
});
//# sourceMappingURL=playerMoveNode.js.map
