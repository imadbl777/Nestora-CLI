import type { SetupContext } from '../../core/context.js';
import { relativeToProjectRoot } from '../../utils/paths.js';

export type PlanAction =
  | { type: 'install'; packages: string[]; devPackages?: string[] }
  | { type: 'create'; path: string; content: string }
  | { type: 'mkdir'; path: string }
  | { type: 'modify-package-json'; path: string; scripts: Record<string, string> }
  | { type: 'transform-app-module'; path: string; configImportPath: string }
  | { type: 'env'; path: string; content: string };

export interface TypeORMPlan {
  context: SetupContext;
  actions: PlanAction[];
}

export function describePlan(plan: TypeORMPlan): string[] {
  const lines: string[] = [];
  const rel = (target: string) => relativeToProjectRoot(plan.context.projectRoot, target);
  for (const action of plan.actions) {
    switch (action.type) {
      case 'install': {
        const dev = action.devPackages?.length ? ` + ${action.devPackages.join(', ')} (dev)` : '';
        lines.push(
          `Install ${action.packages.length + (action.devPackages?.length ?? 0)} package(s): ${[
            ...action.packages,
            ...(action.devPackages ?? []),
          ].join(', ')}${dev}`,
        );
        break;
      }
      case 'create':
        lines.push(`Create ${rel(action.path)}`);
        break;
      case 'mkdir':
        lines.push(`Create directory ${rel(action.path)}`);
        break;
      case 'modify-package-json':
        lines.push(`Add migration scripts to ${rel(action.path)}`);
        break;
      case 'transform-app-module':
        lines.push(`Register TypeOrmModule in ${rel(action.path)}`);
        break;
      case 'env':
        lines.push(`Add database variables to ${rel(action.path)}`);
        break;
    }
  }
  return lines;
}