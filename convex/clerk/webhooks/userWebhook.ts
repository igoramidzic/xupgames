import { internal } from '../../_generated/api';
import type { ActionCtx } from '../../_generated/server';

export async function handleUserWebhook(ctx: ActionCtx, payload: Record<string, unknown>): Promise<Response> {
  const userData = payload.data as Record<string, unknown>;

  const clerkId = userData.id as string;
  const emailAddresses = userData.email_addresses as Array<Record<string, unknown>> | undefined;
  const email = (emailAddresses?.[0]?.email_address as string | undefined) ?? '';
  const firstName = userData.first_name === null ? undefined : (userData.first_name as string | undefined);

  await ctx.runMutation(internal.clerk.createUserFromClerk, {
    clerkId,
    email,
    firstName,
  });

  return new Response('User profile created/updated', { status: 200 });
}
