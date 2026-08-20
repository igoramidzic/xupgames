import { httpRouter } from 'convex/server';
import { Webhook } from 'svix';

import { httpAction } from './_generated/server';
import { handleUserWebhook } from './clerk/webhooks/userWebhook';

const http = httpRouter();

http.route({
  path: '/clerk-webhook',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;

    if (!webhookSecret) {
      console.error('Missing CLERK_WEBHOOK_SECRET environment variable');
      return new Response('Webhook secret not configured', { status: 500 });
    }

    const svixId = request.headers.get('svix-id');
    const svixTimestamp = request.headers.get('svix-timestamp');
    const svixSignature = request.headers.get('svix-signature');

    if (!svixId || !svixTimestamp || !svixSignature) {
      return new Response('Missing svix headers', { status: 400 });
    }

    const body = await request.text();
    const wh = new Webhook(webhookSecret);

    let payload: Record<string, unknown>;
    try {
      payload = wh.verify(body, {
        'svix-id': svixId,
        'svix-timestamp': svixTimestamp,
        'svix-signature': svixSignature,
      }) as Record<string, unknown>;
    } catch (err) {
      console.error('Error verifying webhook signature:', err);
      return new Response('Invalid webhook signature', { status: 400 });
    }

    const eventType = payload.type as string;

    switch (eventType) {
      case 'user.created':
      case 'user.updated':
        return handleUserWebhook(ctx, payload);

      default:
        return new Response('Event received', { status: 200 });
    }
  }),
});

export default http;
