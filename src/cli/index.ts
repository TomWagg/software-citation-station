#!/usr/bin/env node

import { Command } from 'commander';
import { citeCommand } from './commands/cite.js';
import { showCommand } from './commands/show.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Simple way to get version without complex JSON imports that might fail in some Node/TS setups
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../../package.json'), 'utf8'));

const program = new Command();

program
  .name('scs')
  .description('Software Citation Station CLI')
  .version(pkg.version);

program.addCommand(citeCommand);
program.addCommand(showCommand);

program.parse();
