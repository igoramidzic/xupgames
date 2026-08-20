import migrations from '@convex-dev/migrations/convex.config';
import presence from '@convex-dev/presence/convex.config';
import { defineApp } from 'convex/server';

const app = defineApp();
app.use(migrations);
app.use(presence);

export default app;
