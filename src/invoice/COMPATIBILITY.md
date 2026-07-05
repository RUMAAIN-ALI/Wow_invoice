# Schema Compatibility & Migration Policy

This document defines the rules for evolving the theming and layout configuration schemas without introducing breaking changes or print regressions.

---

## 1. Schema Evolution Guidelines

### A. Non-breaking Changes (Allowed in Minor Versions)
*   **Adding Optional Fields**: New keys may be added to `DocumentTheme` or `BusinessPreferences` schemas. They must always be defined as optional in serialization schemas and have defined, safe defaults.
*   **Adding Union Members**: New design tokens can be added (e.g., adding `FontFamily: "Outfit"`). The renderer must provide a standard fallback rendering path for unrecognized styles.

### B. Breaking Changes (Requires Major Version Increments)
*   **Renaming/Removing Fields**: Modifying existing keys in `DocumentTheme` or `BusinessPreferences`.
*   **Changing Types**: Changing a boolean to an object, or altering enum key definitions.
*   **Behavioral shifts**: Modifying design token mapping values in a way that shifts existing user layout dimensions noticeably.

---

## 2. Versioning & Migration Pipeline

Every theme override payload and business preference record contains a `version` metadata key (e.g., `version: 1`).

```
  Incoming Override Payload (Version X)
                   ↓
     Schema Validation Engine (Strips unknown properties)
                   ↓
         Version Check: X < Current?
          ├── Yes: Run stepwise migrators (X ➔ X+1 ➔ Current)
          └── No: Continue
                   ↓
         Merge with Base Configuration
```

1.  **Schema Validation**: The loader strips unknown properties from incoming payloads. This prevents third-party data or future/past client versions from injecting corrupt keys.
2.  **Stepwise Upgrades**: If `payload.version < CURRENT_VERSION`, a migration function executes sequentially:
    *   `migrate_v1_to_v2(payload)`
    *   `migrate_v2_to_v3(payload)`
3.  **Default Normalisation**: Missing configuration variables are populated from the base system defaults, ensuring no `undefined` properties reach the renderer.

---

## 3. Localization & Tax Policies

*   **Decoupled Taxation**: Layout/Theme configurations do not reference tax types (e.g. no `showGst` or `showVat` variables). 
*   **Generic Flags**: Prefer generic functional switches in `BusinessPreferences` such as `showGstin`, `taxation.hsnColumn`, and `taxation.gstBreakup`.
*   **Future Scope**: Enables the theme engine to seamlessly translate to international tax schemes (VAT, sales tax, or tax-free regimes) without revising the styling properties.
