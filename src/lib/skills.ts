export interface SkillSummary {
  id: string;
  title: string;
  category: string;
  order: number;
  dependsOn: string[];
  position?: { x: number; y: number };
}
