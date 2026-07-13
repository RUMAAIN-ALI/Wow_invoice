import { TemplateCapabilities } from './capabilities';
import { TemplateCategory, TemplateTheme } from './template-category';

/**
 * Template Definition: Represents the metadata and capabilities of an immutable structural template layout.
 */
export interface TemplateDefinition {
  readonly id: string;                      // e.g. "classic", "modern", "minimal"
  readonly name: string;
  readonly description: string;
  readonly capabilities: TemplateCapabilities;
  readonly category: TemplateCategory;      // business purpose — drives layout selection
  readonly theme: TemplateTheme;            // visual variant within the category
}
