const fs = require('fs');

const path = 'src/app/(tabs)/jobs.tsx';
let text = fs.readFileSync(path, 'utf8');
const eol = text.includes('\r\n') ? '\r\n' : '\n';

function normalize(value) {
  return value.replace(/\r?\n/g, eol);
}

function ensureReplace(find, replace, label) {
  const f = normalize(find);
  const r = normalize(replace);
  if (text.includes(r)) return;
  if (!text.includes(f)) {
    throw new Error(`Refusing to patch ${path}: anchor not found (${label})`);
  }
  text = text.replace(f, r);
}

function ensureImport(line) {
  if (text.includes(line)) return;

  const candidates = [
    'import { NativeAdBlock } from "../../ads/NativeAdBlock";',
    'import { JobListSkeleton } from "../../components/ui/skeleton";',
    'import type { Job } from "../../lib/jobs";',
  ];

  const anchor = candidates.find((candidate) => text.includes(candidate));
  if (!anchor) {
    throw new Error(`Refusing to patch ${path}: no safe import anchor found`);
  }

  text = text.replace(anchor, `${anchor}${eol}${line}`);
}

function ensureAfter(anchor, addition, label) {
  const a = normalize(anchor);
  const add = normalize(addition);
  if (text.includes(add.trim())) return;
  if (!text.includes(a)) {
    throw new Error(`Refusing to patch ${path}: anchor not found (${label})`);
  }
  text = text.replace(a, a + add);
}

ensureImport('import { useEarlyJobInterstitial } from "../../ads/useJobInterstitial";');

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
  '          <JobCard job={item} />',
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
