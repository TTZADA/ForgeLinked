"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const forgescript_1 = require("@tryforge/forgescript");
const index_js_1 = require("../../index.js");

exports.default = new forgescript_1.NativeFunction({
    name: '$playerMoveNode',
    description: 'Move a player to a different lavalink node safely by recreating the player instance',
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
            name: 'delay',
            description: 'Delay in milliseconds before moving the node',
            type: forgescript_1.ArgType.Number,
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
    async execute(ctx, [guildId, nodeId, delay, pauseBefore]) {
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

        if (pauseBefore && !player.paused && player.queue.current) {
            await player.pause(true);
        }

        if (delay && delay > 0) {
            await new Promise((res) => setTimeout(res, delay));
        }

        try {
            const currentTrack = player.queue.current;
            const lastPosition = player.position || 0;
            const wasPaused = player.paused;
            const currentQueue = [...player.queue.tracks];
            
            const voiceChannelId = player.voiceChannel; 
            const textChannelId = player.textChannel || ctx.channel?.id;
            const currentVolume = player.volume || 100;
            const isSelfDeaf = player.options?.selfDeaf ?? true;
            const isSelfMuted = player.options?.selfMute ?? false;

            if (player.node && player.node.connected) {
                await player.node.destroyPlayer(player.guildId);
            }

            const newPlayer = await linked.createPlayer({
                guildId: guildId.id,
                voiceChannelId: voiceChannelId,
                textChannelId: textChannelId,
                volume: currentVolume,
                selfDeaf: isSelfDeaf,
                selfMute: isSelfMuted,
                node: targetNode.id,
            });

            await newPlayer.connect();

            if (currentQueue.length > 0) {
                newPlayer.queue.add(currentQueue);
            }

            if (currentTrack) {
                await newPlayer.play({
                    track: currentTrack,
                    start: lastPosition,
                    paused: wasPaused
                });
            }

            return this.success(true);
        } catch (e) {
            return this.customError(`Failed to move node: ${e.message}`);
        }
    },
})
