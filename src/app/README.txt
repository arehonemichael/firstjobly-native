FIRSTJOBLY TOOLS + NATIVE CV MAKER

FILES
- src/app/(tabs)/tools.tsx
- src/app/(tabs)/_layout.tsx (adds Tools tab)
- src/app/cv-maker.tsx
- src/app/z83.tsx

INSTALL FIRST:
npx expo install expo-print expo-sharing @react-native-async-storage/async-storage

Because expo-print / expo-sharing are native modules, rebuild the Android development client:
npx expo prebuild --platform android
npx expo run:android

Then:
npx tsc --noEmit

CV Maker:
- Native React Native form
- Uses FirstJobly profile for prefill
- Draft stored locally with AsyncStorage
- Builds a selectable-text ATS-friendly PDF with expo-print
- Shares/saves with Android share sheet

Z83:
- Route is included in Tools.
- Full official DPSA PDF overlay is intentionally not faked in this package.
- The next package ports the existing website's genuine 2021 Z83 PDF overlay engine.
