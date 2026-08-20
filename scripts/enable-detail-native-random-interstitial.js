const fs = require('fs');

const path = 'src/app/jobs/[id].tsx';
let text = fs.readFileSync(path, 'utf8');
const eol = text.includes('\r\n') ? '\r\n' : '\n';

function ensureImport(line) {
  if (text.includes(line)) return;

  const candidates = [
    'import { AdBanner } from "../../ads/AdBanner";',
    'import { useScreenBottomPadding } from "../../hooks/use-screen-bottom-padding";',
    'import type { Job } from "../../lib/jobs";',
  ];

  const anchor = candidates.find((candidate) => text.includes(candidate));
  if (!anchor) {
    throw new Error(`Refusing to patch ${path}: no safe import anchor found for ${line}`);
  }

  text = text.replace(anchor, `${anchor}${eol}${line}`);
}

function ensureAfter(anchor, addition, label) {
  if (text.includes(addition.trim())) return;
  if (!text.includes(anchor)) {
    throw new Error(`Refusing to patch ${path}: anchor not found (${label})`);
  }
  text = text.replace(anchor, `${anchor}${eol}${addition}`);
}

function replaceOnceAny(candidates, replace, label) {
  if (text.includes(replace)) return;
  const found = candidates.find((candidate) => text.includes(candidate));
  if (!found) {
    throw new Error(`Refusing to patch ${path}: anchor not found (${label})`);
  }
  text = text.replace(found, replace);
}

ensureImport('import { NativeAdBlock } from "../../ads/NativeAdBlock";');
ensureImport('import { useJobInterstitial } from "../../ads/useJobInterstitial";');

ensureAfter(
  '  const { isSaved, toggleSave } = useSavedJobs();',
  '  const { continueWithOptionalAd } = useJobInterstitial(id);',
  'interstitial hook'
);

replaceOnceAny(
  [
    '        <TouchableOpacity style={styles.iconButton} onPress={() => router.back()}>',
    '        <TouchableOpacity\r\n          style={styles.iconButton}\r\n          onPress={() => router.back()}\r\n        >',
    '        <TouchableOpacity\n          style={styles.iconButton}\n          onPress={() => router.back()}\n        >',
  ],
  [
    '        <TouchableOpacity',
    '          style={styles.iconButton}',
    '          onPress={() => void continueWithOptionalAd(() => router.back())}',
    '        >',
  ].join(eol),
  'back action'
);

if (!text.includes('<NativeAdBlock />')) {
  const footerCandidates = [
    '      <View style={styles.footer}>',
    '        <View style={styles.footer}>',
  ];
  const footerAnchor = footerCandidates.find((candidate) => text.includes(candidate));

  if (!footerAnchor) {
    throw new Error(`Refusing to patch ${path}: anchor not found (detail native placement)`);
  }

  const indent = footerAnchor.startsWith('        ') ? '        ' : '      ';
  text = text.replace(
    footerAnchor,
    `${indent}<NativeAdBlock />${eol}${eol}${footerAnchor}`
  );
}

fs.writeFileSync(path, text, 'utf8');
console.log('Patched Job Details: detail native ad + random capped interstitial on Back.');
console.log('Apply/Easy Apply behaviour was not changed.');
