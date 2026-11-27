export const carModels: readonly { id: string; name: string }[];
export const defaultModel: string;
export function isCarModel(value: unknown): value is string;
export function imageForModel(id: string): string;
export function sampleCarModels(count: number, excluded?: readonly string[]): string[];
