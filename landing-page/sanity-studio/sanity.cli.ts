import { defineCliConfig } from 'sanity/cli';

export default defineCliConfig({
  api: {
    // Replace with your actual project ID after running: npx sanity@latest init
    projectId: process.env.SANITY_STUDIO_PROJECT_ID || 'YOUR_PROJECT_ID',
    dataset: 'production',
  },
});
