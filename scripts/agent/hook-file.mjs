import { evaluateFileWrite } from './guards.mjs';
import { readInput, respondPreToolUse } from './hook-io.mjs';

const input = readInput();
respondPreToolUse(
  evaluateFileWrite(input.tool_input?.file_path ?? input.tool_input?.notebook_path)
);
