/// <reference path="../pb_data/types.d.ts" />

// Cleanup stale viewer sessions every minute
// Sessions not updated in 2 minutes are considered stale
cronAdd("cleanup_stale_viewers", "* * * * *", () => {
  const STALE_THRESHOLD_MS = 2 * 60 * 1000; // 2 minutes

  let cutoffDate = new Date(Date.now() - STALE_THRESHOLD_MS);
  let cutoffStr = cutoffDate.toISOString().replace("T", " ");

  try {
    const staleRecords = $app.findRecordsByFilter(
      "viewers",
      "updated < {:cutoff}",
      "-updated",
      0,
      0,
      { cutoff: cutoffStr }
    );

    if (staleRecords.length > 0) {
      $app.runInTransaction((txApp) => {
        for (let record of staleRecords) {
          txApp.delete(record);
        }
      });

      console.log(
        `[Cleanup] Removed ${staleRecords.length} stale viewer sessions`
      );
    }
  } catch (err) {
    // Collection might not exist yet on first run
    if (!err.message.includes("couldn't find collection")) {
      console.error("[Cleanup] Error:", err);
    }
  }
});
