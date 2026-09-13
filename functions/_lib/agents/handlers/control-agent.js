import { runFullCycle, evaluateSystemPriority } from '../registry.js';

export async function executeControlCycle(env, task) {
  const result = await runFullCycle(env);
  return result;
}
