"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLavalink = getLavalink;
exports.resolveGuild = resolveGuild;
exports.getPlayer = getPlayer;
function getLavalink(ctx) {
    const ext = ctx.client.getExtension(require('../..').ForgeLinked, true);
    return ext ? ext.lavalink : null;
}
function resolveGuild(ctx, guildArg) { return guildArg ?? ctx.guild ?? null; }
function getPlayer(ctx, guildArg) {
    const lavalink = getLavalink(ctx);
    if (!lavalink) return null;
    const guild = resolveGuild(ctx, guildArg);
    if (!guild) return null;
    return lavalink.getPlayer(guild.id) ?? null;
}
