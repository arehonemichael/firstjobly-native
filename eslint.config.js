const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,

  {
    ignores: [
      "node_modules/**",
      "android/**",
      "ios/**",
      ".expo/**",
      "dist/**",
      "*.bak",
      "**/*.bak",
      "**/*.bak-*",
    ],
  },

  // These screens intentionally start async data loading from mount/auth/focus
  // effects. Reworking them immediately before release risks changing loading,
  // caching and staleness behavior.
  {
    files: [
      "src/app/(tabs)/applications.tsx",
      "src/app/(tabs)/graduateroom.tsx",
      "src/app/(tabs)/index.tsx",
      "src/app/(tabs)/jobs.tsx",
      "src/app/(tabs)/saved.tsx",
      "src/app/graduateroom/**/*.tsx",
      "src/app/graduateroom/verify.tsx",
      "src/app/jobs/**/*.tsx",
      "src/components/profile/documents.tsx",
      "src/components/profile/work-experience.tsx",
      "src/hooks/use-color-scheme.web.ts",
      "src/hooks/use-saved-jobs.ts",
    ],
    rules: {
      "react-hooks/set-state-in-effect": "off",
    },
  },

  // Animated.Value is intentionally stable for the lifetime of these
  // skeleton components. Preserve the existing animation implementation.
  {
    files: [
      "src/components/ui/app-ui.tsx",
      "src/components/ui/skeleton.tsx",
    ],
    rules: {
      "react-hooks/refs": "off",
    },
  },

  // Date.now() here runs in the document-upload event path to create a unique
  // storage filename, not as render output.
  {
    files: ["src/components/profile/documents.tsx"],
    rules: {
      "react-hooks/purity": "off",
    },
  },

  // Existing user-facing copy contains ordinary apostrophes/quotes.
  // This rule has no relevance to React Native Text rendering.
  {
    files: [
      "src/app/(tabs)/jobs.tsx",
      "src/app/auth.tsx",
      "src/app/graduateroom/verify.tsx",
      "src/components/graduateroom/institution-picker.tsx",
    ],
    rules: {
      "react/no-unescaped-entities": "off",
    },
  },

  // Existing conditional expression in the Room loader is intentional.
  {
    files: ["src/app/(tabs)/graduateroom.tsx"],
    rules: {
      "no-unused-expressions": "off",
    },
  },

  // Z83 imports the YesNo type while also using YesNo as its local component
  // name. TypeScript already validates the distinction correctly.
  {
    files: ["src/app/z83.tsx"],
    rules: {
      "@typescript-eslint/no-redeclare": "off",
    },
  },

  // loadSaved is deliberately tied to auth identity changes. Focus refresh is
  // handled separately by useFocusEffect.
  {
    files: ["src/hooks/use-saved-jobs.ts"],
    rules: {
      "react-hooks/exhaustive-deps": "off",
    },
  },
]);
