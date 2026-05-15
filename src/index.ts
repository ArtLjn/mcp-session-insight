#!/usr/bin/env node
import { startServer } from './server.js';

startServer().catch((err: unknown) => {
  console.error('Server error:', err);
  process.exit(1);
});
