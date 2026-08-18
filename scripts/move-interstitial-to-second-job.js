const fs = require('fs');

const path = 'src/app/(tabs)/jobs.tsx';
let text = fs.readFileSync(path, 'utf8');
const eol = text.includes('\r\n') ? '\r\n' : '\n';

function ensureReplace(find, replace, label) {
  const f = find.replace(/\n/g, eol);
  const r = replace.replace(/\n/g, eol);
  if (text.includes(r)) return;
  if (!text.includes(f)) {
    throw new Error(`Refusing to patch ${path}: anchor not found (${label})`);
  }
  text = text.replace(f, r);
}

function ensureAfter(anchor, addition, label) {
  const a = anchor.replace(/\n/g, eol);
  const add = addition.replace(/\n/g, eol);
  if (text.includes(add.trim())) return;
  if (!text.includes(a)) {
    throw new Error(`Refusing to patch ${path}: anchor not found (${label})`);
  }
  text = text.replace(a, a + add);
}

ensureAfter(
  'import { NativeAdBlock } from "../../ads/NativeAdBlock";\n',
  'import { useEarlyJobInterstitial } from "../../ads/useJobInterstitial";\n',
  'early interstitial import'
);

ensureReplace(
  'const JobCard = memo(function JobCard({ job }: { job: Job }) {',
  'const JobCard = memo(function JobCard({\n  job,\n  onPress,\n}: {\n  job: Job;\n  onPress: () => void;\n}) {',
  'JobCard props'
);

ensureReplace(
  `      onPress={() =>\n        router.push({\n          pathname: "/jobs/[id]",\n          params: { id: job.id },\n        })\n      }`,
  '      onPress={onPress}',
  'JobCard press handler'
);

ensureAfter(
  '  const bottomContentPadding = useScreenBottomPadding(true);\n',
  '  const { openJobWithEarlyInterstitial } = useEarlyJobInterstitial();\n',
  'early interstitial hook'
);

ensureReplace(
  `          <JobCard job={item} />`,
  `          <JobCard\n            job={item}\n            onPress={() =>\n              void openJobWithEarlyInterstitial(() =>\n                router.push({\n                  pathname: "/jobs/[id]",\n                  params: { id: item.id },\n                })\n              )\n            }\n          />`,
  'render job press'
);

ensureReplace(
  `    },\n    []\n  );\n\n  const handleEndReached`,
  `    },\n    [openJobWithEarlyInterstitial]\n  );\n\n  const handleEndReached`,
  'renderJob dependency'
);

fs.writeFileSync(path, text, 'utf8');
console.log('Moved interstitial trigger to the second job open of the app session.');
console.log('First job opens normally; Back and Apply remain ad-free.');
console.log('Maximum one early interstitial opportunity per session; cooldown still applies.');
