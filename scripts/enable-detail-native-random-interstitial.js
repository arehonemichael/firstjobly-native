const fs = require('fs');

const path = 'src/app/jobs/[id].tsx';
let text = fs.readFileSync(path, 'utf8');
const eol = text.includes('\r\n') ? '\r\n' : '\n';

function insertAfter(anchor, addition, label) {
  if (text.includes(addition.trim())) return;
  const normalizedAnchor = anchor.replace(/\n/g, eol);
  if (!text.includes(normalizedAnchor)) {
    throw new Error(`Refusing to patch ${path}: anchor not found (${label})`);
  }
  text = text.replace(normalizedAnchor, normalizedAnchor + addition.replace(/\n/g, eol));
}

function replaceOnce(find, replace, label) {
  const normalizedFind = find.replace(/\n/g, eol);
  const normalizedReplace = replace.replace(/\n/g, eol);
  if (text.includes(normalizedReplace)) return;
  if (!text.includes(normalizedFind)) {
    throw new Error(`Refusing to patch ${path}: anchor not found (${label})`);
  }
  text = text.replace(normalizedFind, normalizedReplace);
}

insertAfter(
  'import { useScreenBottomPadding } from "../../hooks/use-screen-bottom-padding";\n',
  'import { NativeAdBlock } from "../../ads/NativeAdBlock";\nimport { useJobInterstitial } from "../../ads/useJobInterstitial";\n',
  'ad imports'
);

insertAfter(
  '  const { isSaved, toggleSave } = useSavedJobs();\n',
  '  const { continueWithOptionalAd } = useJobInterstitial(id);\n',
  'interstitial hook'
);

replaceOnce(
  '        <TouchableOpacity style={styles.iconButton} onPress={() => router.back()}>',
  '        <TouchableOpacity\n          style={styles.iconButton}\n          onPress={() => void continueWithOptionalAd(() => router.back())}\n        >',
  'back action'
);

const nativeMarker = '        <NativeAdBlock />';
if (!text.includes(nativeMarker)) {
  const footerAnchor = '      <View style={styles.footer}>';
  if (!text.includes(footerAnchor)) {
    throw new Error(`Refusing to patch ${path}: anchor not found (detail native placement)`);
  }
  text = text.replace(
    footerAnchor,
    `        <NativeAdBlock />${eol}${eol}${footerAnchor}`
  );
}

fs.writeFileSync(path, text, 'utf8');
console.log('Patched Job Details: detail native ad + random capped interstitial on Back.');
console.log('Apply/Easy Apply behaviour was not changed.');
