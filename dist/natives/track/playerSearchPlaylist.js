"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const forgescript_1 = require("@tryforge/forgescript");
const index_js_1 = require("../../index.js");
exports.default = new forgescript_1.NativeFunction({
    name: '$playerSearchPlaylist',
    description: 'Search for playlists using LavaSearch plugin',
    version: '1.0.0',
    brackets: true,
    unwrap: true,
    args: [
        { name: 'guildId', description: 'The guild id', type: forgescript_1.ArgType.Guild, required: true, rest: false },
        { name: 'query', description: 'The search query (e.g. "lofi hip hop")', type: forgescript_1.ArgType.String, required: true, rest: false },
        { name: 'source', description: 'Source prefix: spsearch, ytsearch, ytmsearch, dzsearch...', type: forgescript_1.ArgType.String, required: false, rest: false },
        { name: 'limit', description: 'Max number of playlists to return', type: forgescript_1.ArgType.Number, required: false, rest: false },
    ],
    output: forgescript_1.ArgType.Json,
    async execute(ctx, [guildId, query, source, limit]) {
        const linked = ctx.client.getExtension(index_js_1.ForgeLinked, true).lavalink;
        if (!linked) return this.customError('ForgeLinked is not initialized');
        const player = linked.getPlayer(guildId.id);
        if (!player) return this.customError('Player not found');
        const node = player.node;
        const finalQuery = source ? `${source}:${query}` : query;
   
    function format(host) {
      const ipPattern = /^(\d{1,3}\.){3}\d{1,3}$/;

            if (ipPattern.test(host)) {
             return 'http';
         }
         return 'https';
      }
        const url = `${format(node.options.host)}://${node.options.host}/v4/loadsearch?query=${encodeURIComponent(finalQuery)}&types=playlist`;
        const response = await fetch(url, {
            headers: { Authorization: node.options.authorization },
        });
        if (!response.ok)
            return this.customError(`LavaSearch request failed: ${response.status} ${response.statusText}. Make sure the LavaSearch plugin is installed on your Lavalink server.`);
        const data = await response.json();
        const playlists = data.playlists ?? [];
        const limited = limit ? playlists.slice(0, limit) : playlists;
        if (!limited.length) return this.customError('No playlists found!');
        return this.successJSON({
            status: 'success',
            source: source ?? 'default',
            query,
            count: limited.length,
            playlists: limited.map((pl) => ({
                name: pl.info?.name ?? pl.info?.title ?? 'Unknown',
                url: pl.pluginInfo?.url ?? pl.info?.uri ?? null,
                thumbnail: pl.pluginInfo?.artworkUrl ?? null,
                author: pl.pluginInfo?.author ?? null,
                trackCount: pl.pluginInfo?.totalTracks ?? pl.tracks?.length ?? 0,
            })),
        });
    },
});
