import type { Doc, Id } from '../../_generated/dataModel';
import type { QueryCtx } from '../../_generated/server';
import { MAX_PLAYERS } from '../../domain';
import { listActiveRoomMembers } from '../../roomMembers';
import {
  estimateMiniGamesDurationMs,
  MINI_GAME_DEFINITIONS,
  MINI_GAMES_ROUND_OPTIONS,
  miniGameDefinition,
  normalizeMiniGamesRoundCount,
} from './registry';
import { findMiniGamesState, requireMiniGamesMember } from './state';

function targetEmojiForRound(round: Doc<'miniGamesRounds'>) {
  return round.targetEmoji ?? round.emojiItems.find((item) => item.color === 'orange')?.emoji ?? '🍊';
}

export async function getGameHandler(ctx: QueryCtx, args: { roomId: Id<'rooms'>; sessionToken: string }) {
  const { membership } = await requireMiniGamesMember(ctx, args.roomId, args.sessionToken, false);
  const state = await findMiniGamesState(ctx, args.roomId);
  if (state === null) throw new Error('Mini Game Mix state is missing.');
  const round = state.currentRoundId === null ? null : await ctx.db.get('miniGamesRounds', state.currentRoundId);
  let currentRoundResults: Doc<'miniGamesResults'>[] = [];
  if (round !== null) {
    currentRoundResults = await ctx.db
      .query('miniGamesResults')
      .withIndex('by_roundId', (index) => index.eq('roundId', round._id))
      .take(MAX_PLAYERS + 1);
    if (currentRoundResults.length > MAX_PLAYERS) throw new Error('Mini-game participant capacity invariant violated.');
  }
  const allResults = await ctx.db
    .query('miniGamesResults')
    .withIndex('by_roomId_and_gameNumber', (index) =>
      index.eq('roomId', args.roomId).eq('gameNumber', state.gameNumber)
    )
    .take(MAX_PLAYERS * 25 + 1);
  if (allResults.length > MAX_PLAYERS * 25) throw new Error('Mini-game result capacity invariant violated.');
  const activeMembers = await listActiveRoomMembers(ctx, args.roomId);
  const scoreByMember = new Map<
    Id<'roomMembers'>,
    { displayName: string; totalScore: number; roundsFinished: number }
  >();
  for (const member of activeMembers) {
    scoreByMember.set(member._id, { displayName: member.displayName, totalScore: 0, roundsFinished: 0 });
  }
  for (const result of allResults) {
    const aggregate = scoreByMember.get(result.memberId) ?? {
      displayName: result.displayName,
      totalScore: 0,
      roundsFinished: 0,
    };
    aggregate.totalScore += result.score;
    if (result.status !== 'waiting') aggregate.roundsFinished += 1;
    scoreByMember.set(result.memberId, aggregate);
  }
  const memberDocs = await Promise.all(
    [...scoreByMember.keys()].map(async (memberId) => await ctx.db.get('roomMembers', memberId))
  );
  const activeByMemberId = new Map(memberDocs.map((member) => [member?._id, member?.isActive ?? false]));
  const standings = [...scoreByMember.entries()]
    .map(([memberId, score]) => ({
      memberId,
      ...score,
      isCurrentPlayer: memberId === membership._id,
      isActive: activeByMemberId.get(memberId) ?? false,
    }))
    .sort(
      (first, second) => second.totalScore - first.totalScore || first.displayName.localeCompare(second.displayName)
    )
    .map((standing, index) => ({ ...standing, rank: index + 1 }));
  const resultViews = currentRoundResults
    .map((result) => ({
      memberId: result.memberId,
      displayName: result.displayName,
      status: result.status,
      score: result.score,
      timeMs: result.timeMs,
      straightness: result.straightness,
      correctClicks: result.correctClicks,
      wrongClicks: result.wrongClicks,
      metric: result.metric ?? null,
      numericGuess: result.numericGuess ?? null,
      challengeResult: result.challengeResult ?? null,
      submission:
        (state.phase === 'roundResults' || state.phase === 'complete') && result.memberId === membership._id
          ? (result.submission ?? null)
          : null,
      isCurrentPlayer: result.memberId === membership._id,
      isActive: activeByMemberId.get(result.memberId) ?? true,
    }))
    .sort((first, second) => second.score - first.score || (first.timeMs ?? Infinity) - (second.timeMs ?? Infinity));
  const definition = round === null ? null : miniGameDefinition(round.miniGameId);
  const configuredRoundCount = normalizeMiniGamesRoundCount(state.configuredRoundCount);
  return {
    gameNumber: state.gameNumber,
    phase: state.phase,
    phaseStartedAt: state.phaseStartedAt,
    phaseEndsAt: state.phaseEndsAt,
    currentRoundNumber: state.currentRoundNumber,
    totalRounds: state.totalRounds,
    participantCount: state.participantCount,
    finishedCount: state.finishedCount,
    estimatedDurationMs: estimateMiniGamesDurationMs(configuredRoundCount),
    configuration: {
      roundCount: configuredRoundCount,
      roundOptions: MINI_GAMES_ROUND_OPTIONS.map((roundCount) => ({
        roundCount,
        estimatedDurationMs: estimateMiniGamesDurationMs(roundCount),
      })),
    },
    miniGames: MINI_GAME_DEFINITIONS.map((entry) => ({ ...entry })),
    round:
      round === null || definition === null
        ? null
        : (() => {
            const targetEmoji = round.miniGameId === 'orangeEmojis' ? targetEmojiForRound(round) : null;
            return {
              roundId: round._id,
              roundNumber: round.roundNumber,
              miniGame: { ...definition },
              selectionStartedAt: round.selectionStartedAt,
              playStartsAt: round.playStartsAt,
              playEndsAt: round.playEndsAt,
              lineTarget:
                round.lineStartX === null ||
                round.lineStartY === null ||
                round.lineEndX === null ||
                round.lineEndY === null
                  ? null
                  : {
                      start: { x: round.lineStartX, y: round.lineStartY },
                      end: { x: round.lineEndX, y: round.lineEndY },
                    },
              emojiItems: round.emojiItems,
              targetEmoji,
              targetCount:
                targetEmoji === null ? 0 : round.emojiItems.filter((item) => item.emoji === targetEmoji).length,
              percentageTargetColor: round.percentageTargetColor ?? null,
              percentageSegments: round.percentageSegments ?? [],
              batteryPercentage: round.batteryPercentage ?? null,
              circleTarget:
                round.circleCenterX === undefined ||
                round.circleCenterY === undefined ||
                round.circleRadius === undefined ||
                round.circleGapRotation === undefined
                  ? null
                  : {
                      center: { x: round.circleCenterX, y: round.circleCenterY },
                      radius: round.circleRadius,
                      gapRotation: round.circleGapRotation,
                    },
              distancePlaces:
                round.mapFirstName === undefined ||
                round.mapFirstX === undefined ||
                round.mapFirstY === undefined ||
                round.mapSecondName === undefined ||
                round.mapSecondX === undefined ||
                round.mapSecondY === undefined ||
                round.distanceUnit === undefined
                  ? null
                  : {
                      first: { name: round.mapFirstName, x: round.mapFirstX, y: round.mapFirstY },
                      second: { name: round.mapSecondName, x: round.mapSecondX, y: round.mapSecondY },
                      unit: round.distanceUnit,
                    },
              mapTargetName: round.mapTargetName ?? null,
              mapAnswerPoint:
                (state.phase !== 'roundResults' && state.phase !== 'complete') ||
                round.mapTargetX === undefined ||
                round.mapTargetY === undefined
                  ? null
                  : { x: round.mapTargetX, y: round.mapTargetY },
              numericAnswer:
                state.phase === 'roundResults' || state.phase === 'complete' ? (round.numericAnswer ?? null) : null,
              challengePayload: round.challengePayload ?? null,
            };
          })(),
    currentResult: resultViews.find((result) => result.isCurrentPlayer) ?? null,
    roundResults: resultViews,
    standings,
  };
}
