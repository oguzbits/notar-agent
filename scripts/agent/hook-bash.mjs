import { evaluateCommand } from './guards.mjs';
import { readInput, respondPreToolUse } from './hook-io.mjs';

const input = readInput();
respondPreToolUse(evaluateCommand(input.tool_input?.command));
