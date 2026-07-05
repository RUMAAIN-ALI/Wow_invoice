import { TemplateCapabilities } from './capabilities';

/**
 * Template Definition: Represents the metadata and capabilities of an immutable structural template layout.
 */
export interface TemplateDefinition {
  readonly id: string;                      // e.g. "classic", "modern", "minimal"
  readonly name: string;
  readonly description: string;
  readonly capabilities: TemplateCapabilities;
}
