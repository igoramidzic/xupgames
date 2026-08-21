import migrations from '@convex-dev/migrations/convex.config';
import presence from '@convex-dev/presence/convex.config';
import { defineApp } from 'convex/server';
import trendline from './communityGames/trendline/convex.config.js';

const app = defineApp();
app.use(migrations);
app.use(presence);
app.use(trendline, { name: 'trendline' });

// Mount each community game as its own local component here. Keeping one
// component per game gives it isolated tables/functions while parent-app
// wrappers retain room authorization and shared lifecycle ownership.
// Example:
// import wordParty from './communityGames/wordParty/convex.config';
// app.use(wordParty, { name: 'wordParty' });

export default app;
