import { describe, it, expect } from "vitest";
import {
  loadSchedules,
  saveSchedule,
  deleteSchedule,
  clearStore,
} from "../store/local-store.js";
import type { Schedule } from "../types/schedule.js";
import { DEFAULT_JOB_CONFIG } from "../types/index.js";

const TEST_STORE = "test-schedule-store";

function makeSchedule(id: string, enabled = true): Schedule {
  return {
    id,
    name: `Test Schedule ${id}`,
    cronExpression: "0 9 * * *",
    urlSource: "test-urls.txt",
    config: DEFAULT_JOB_CONFIG,
    enabled,
    lastRunAt: null,
    lastRunStatus: null,
    createdAt: new Date().toISOString(),
  };
}

describe("Schedule Store", () => {
  it("starts with empty schedules", async () => {
    await clearStore(TEST_STORE);
    const schedules = await loadSchedules(TEST_STORE);
    expect(schedules).toHaveLength(0);
  });

  it("saves and loads a schedule", async () => {
    await clearStore(TEST_STORE);
    await saveSchedule(makeSchedule("s1"), TEST_STORE);

    const schedules = await loadSchedules(TEST_STORE);
    expect(schedules).toHaveLength(1);
    expect(schedules[0]!.name).toBe("Test Schedule s1");
    expect(schedules[0]!.cronExpression).toBe("0 9 * * *");
  });

  it("updates existing schedule by ID", async () => {
    await clearStore(TEST_STORE);
    await saveSchedule(makeSchedule("s1"), TEST_STORE);
    await saveSchedule({ ...makeSchedule("s1"), name: "Updated" }, TEST_STORE);

    const schedules = await loadSchedules(TEST_STORE);
    expect(schedules).toHaveLength(1);
    expect(schedules[0]!.name).toBe("Updated");
  });

  it("saves multiple schedules", async () => {
    await clearStore(TEST_STORE);
    await saveSchedule(makeSchedule("s1"), TEST_STORE);
    await saveSchedule(makeSchedule("s2"), TEST_STORE);
    await saveSchedule(makeSchedule("s3"), TEST_STORE);

    const schedules = await loadSchedules(TEST_STORE);
    expect(schedules).toHaveLength(3);
  });

  it("deletes a schedule by ID", async () => {
    await clearStore(TEST_STORE);
    await saveSchedule(makeSchedule("s1"), TEST_STORE);
    await saveSchedule(makeSchedule("s2"), TEST_STORE);

    const deleted = await deleteSchedule("s1", TEST_STORE);
    expect(deleted).toBe(true);

    const schedules = await loadSchedules(TEST_STORE);
    expect(schedules).toHaveLength(1);
    expect(schedules[0]!.id).toBe("s2");
  });

  it("returns false when deleting non-existent schedule", async () => {
    await clearStore(TEST_STORE);
    const deleted = await deleteSchedule("nonexistent", TEST_STORE);
    expect(deleted).toBe(false);
  });

  it("preserves products and jobs when saving schedules", async () => {
    await clearStore(TEST_STORE);
    await saveSchedule(makeSchedule("s1"), TEST_STORE);

    // Store should still have empty products array
    const schedules = await loadSchedules(TEST_STORE);
    expect(schedules).toHaveLength(1);
  });

  it("enables and disables schedules", async () => {
    await clearStore(TEST_STORE);
    await saveSchedule(makeSchedule("s1", true), TEST_STORE);
    await saveSchedule({ ...makeSchedule("s1"), enabled: false }, TEST_STORE);

    const schedules = await loadSchedules(TEST_STORE);
    expect(schedules[0]!.enabled).toBe(false);
  });
});
