import socialMedia from "@/block-configs/social-media.json";
import videos from "@/block-configs/videos.json";
import defaultPromptsPreset from "@/block-configs/default-prompts.json";

export interface BlockPreset {
  name: string;
  description: string;
  rules: string[];
}

export interface PromptPreset {
  name: string;
  description: string;
  prompts: string[];
}

export const sitePresets: BlockPreset[] = [socialMedia, videos];
export const promptPresets: PromptPreset[] = [defaultPromptsPreset];
