const fs = require('fs');

function patchFile(path, transforms) {
  let text = fs.readFileSync(path, 'utf8');
  const original = text;

  for (const { find, replace, label } of transforms) {
    if (!text.includes(find)) {
      throw new Error(`Refusing to patch ${path}: anchor not found (${label})`);
    }
    text = text.replace(find, replace);
  }

  if (text === original) {
    throw new Error(`No changes made to ${path}`);
  }

  fs.writeFileSync(path, text, 'utf8');
  console.log(`Patched ${path}`);
}

patchFile('src/app/(tabs)/jobs.tsx', [
  {
    label: 'native ad import',
    find: 'import { JobListSkeleton } from "../../components/ui/skeleton";\n',
    replace: 'import { JobListSkeleton } from "../../components/ui/skeleton";\nimport { NativeAdBlock } from "../../ads/NativeAdBlock";\n',
  },
  {
    label: 'renderJob',
    find: `  const renderJob = useCallback(\n    ({ item }: { item: Job }) => <JobCard job={item} />,\n    []\n  );`,
    replace: `  const renderJob = useCallback(\n    ({ item, index }: { item: Job; index: number }) => {\n      const jobNumber = index + 1;\n      const showNativeAd =\n        jobNumber === 6 || (jobNumber > 6 && (jobNumber - 6) % 8 === 0);\n\n      return (\n        <>\n          <JobCard job={item} />\n          {showNativeAd ? <NativeAdBlock variant="feed" /> : null}\n        </>\n      );\n    },\n    []\n  );`,
  },
]);

patchFile('src/app/jobs/[id].tsx', [
  {
    label: 'banner import',
    find: 'import { useScreenBottomPadding } from "../../hooks/use-screen-bottom-padding";\n',
    replace: 'import { useScreenBottomPadding } from "../../hooks/use-screen-bottom-padding";\nimport { AdBanner } from "../../ads/AdBanner";\n',
  },
  {
    label: 'banner placement',
    find: '        <Text style={styles.heading}>About this opportunity</Text>\n        <Text style={styles.body}>{job.description}</Text>\n',
    replace: '        <Text style={styles.heading}>About this opportunity</Text>\n        <Text style={styles.body}>{job.description}</Text>\n\n        <AdBanner />\n',
  },
]);

console.log('Visible AdMob placements enabled. App Open and Interstitial remain disconnected.');
