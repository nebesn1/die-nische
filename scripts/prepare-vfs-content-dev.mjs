/* global console, process */

import { defaultContentRoot, generateVfsContentManifest } from "./generate-vfs-content-manifest.mjs";
import { createVfsContentTimestampReconciler } from "./vfsContentTimestampAuthoring.mjs";

const reconciler = createVfsContentTimestampReconciler({ contentRoot: defaultContentRoot });

try {
  await reconciler.reconcile();
  await generateVfsContentManifest({ contentRoot: defaultContentRoot });
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
