import { components, internal } from '../_generated/api';
import type { Doc, Id } from '../_generated/dataModel';
import type { MutationCtx } from '../_generated/server';
import { listActiveRoomMembers } from '../roomMembers';

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function buildTrendlineBotPrediction(actualValues: number[], botNumber: number): number[] {
  const skillBand = (((botNumber - 1) % 6) + 6) % 6;
  const errorScale = 0.2 - skillBand * 0.022;
  const bias = (((botNumber * 17) % 11) - 5) * 0.012;
  return actualValues.map(
    (value, index) =>
      Math.round(clamp(value + bias + Math.sin((index + 1) * (botNumber + 3) * 0.47) * errorScale) * 10_000) / 10_000
  );
}

export async function initializeTrendlineBot(ctx: MutationCtx, bot: Doc<'playtestBots'>): Promise<void> {
  await ctx.runMutation(components.trendline.game.enrollMember, {
    roomId: bot.roomId,
    member: { memberId: bot.memberId, displayName: bot.displayName },
    now: Date.now(),
  });
  const context = await ctx.runQuery(components.trendline.game.getBotContext, {
    roomId: bot.roomId,
    botId: bot._id,
  });
  if (context?.plan === null) {
    await ctx.runMutation(components.trendline.game.setBotPlan, {
      botId: bot._id,
      roomId: bot.roomId,
      plannedRoundId: null,
      submitAt: 0,
      submitted: false,
    });
  }
}

export async function runTrendlineBotTick(
  ctx: MutationCtx,
  room: Doc<'rooms'>,
  bot: Doc<'playtestBots'>
): Promise<{ cursor: { x: number; y: number } }> {
  await initializeTrendlineBot(ctx, bot);
  const context = await ctx.runQuery(components.trendline.game.getBotContext, {
    roomId: room._id,
    botId: bot._id,
  });
  const now = Date.now();
  const drawingProgress =
    context?.phase === 'drawing' && context.phaseStartedAt !== null && context.phaseEndsAt !== null
      ? clamp((now - context.phaseStartedAt) / Math.max(1, context.phaseEndsAt - context.phaseStartedAt))
      : 0;
  const cursor = {
    x: drawingProgress,
    y: 0.08 + (((bot.botNumber - 1) % 18) / 18) * 0.84,
  };
  if (
    context === null ||
    context.phase !== 'drawing' ||
    context.roundId === null ||
    context.actualValues === null ||
    context.phaseStartedAt === null
  ) {
    return { cursor };
  }
  if (context.plan?.plannedRoundId !== context.roundId) {
    await ctx.runMutation(components.trendline.game.setBotPlan, {
      botId: bot._id,
      roomId: room._id,
      plannedRoundId: context.roundId,
      submitAt: context.phaseStartedAt + 3_500 + ((bot.botNumber * 683) % 16_000),
      submitted: false,
    });
    return { cursor };
  }
  if (context.plan.submitted || now < context.plan.submitAt) return { cursor };
  const activeMembers = await listActiveRoomMembers(ctx, room._id);
  const result = await ctx.runMutation(components.trendline.game.submitPrediction, {
    roomId: room._id,
    memberId: bot.memberId,
    roundId: context.roundId,
    values: buildTrendlineBotPrediction(context.actualValues, bot.botNumber),
    eligibleMemberIds: activeMembers.map((member) => member._id),
    now,
  });
  if (result.kind === 'accepted' || result.kind === 'existing') {
    await ctx.runMutation(components.trendline.game.setBotPlan, {
      botId: bot._id,
      roomId: room._id,
      plannedRoundId: context.roundId,
      submitAt: context.plan.submitAt,
      submitted: true,
    });
  }
  if (result.kind === 'accepted' && result.allLockedIn) {
    const scheduledId: Id<'_scheduled_functions'> = await ctx.scheduler.runAfter(0, internal.trendline.closeRound, {
      roomId: room._id,
      gameNumber: result.gameNumber,
      roundNumber: result.roundNumber,
    });
    void scheduledId;
  }
  return { cursor };
}

export async function stopTrendlineBot(ctx: MutationCtx, bot: Doc<'playtestBots'>): Promise<void> {
  await ctx.runMutation(components.trendline.game.setBotPlan, {
    botId: bot._id,
    roomId: bot.roomId,
    plannedRoundId: null,
    submitAt: Number.MAX_SAFE_INTEGER,
    submitted: true,
  });
}
