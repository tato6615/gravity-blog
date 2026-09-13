import { evaluateSystemPriority } from '../registry.js';
import { writeMemory, nowIso } from '../db.js';

export async function executeControlCycle(env, task) {
  const decision = await evaluateSystemPriority(env);
  const report = {
    generatedAt: nowIso(),
    status: 'EVALUATED',
    decision
  };
  await writeMemory(env, 'control_decisions', 'latest', report, 'control');
  return report;
}
