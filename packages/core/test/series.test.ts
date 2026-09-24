import { describe, expect, it } from "vitest";
import { getVisibleSeriesRuns, parseRunSeries, RunSeriesSchema } from "../src/index";
import seriesFixture from "../../../content/published/series.json";

describe("multi-run series contract", () => {
  it("parses the current published series", () => {
    const series = parseRunSeries(seriesFixture);

    expect(series.runs).toHaveLength(1);
    expect(series.runs[0]?.run.attemptNumber).toBe(1);
  });

  it("allows the launch planning state with no episodes", () => {
    const series = parseRunSeries(seriesFixture);
    const run = series.runs[0];

    expect(run).toBeDefined();
    if (!run) return;

    const result = RunSeriesSchema.safeParse({
      ...series,
      runs: [
        {
          ...run,
          run: {
            ...run.run,
            status: "planning",
          },
          episodes: [],
          pokemon: [],
          soulLinks: [],
          events: [],
        },
      ],
    });

    expect(result.success).toBe(true);
  });

  it("allows failed runs", () => {
    const series = parseRunSeries(seriesFixture);
    const run = series.runs[0];

    expect(run).toBeDefined();
    if (!run) return;

    const result = RunSeriesSchema.safeParse({
      ...series,
      runs: [
        {
          ...run,
          run: {
            ...run.run,
            status: "failed",
          },
        },
      ],
    });

    expect(result.success).toBe(true);
  });

  it("rejects duplicate global episode numbers across attempts", () => {
    const series = parseRunSeries(seriesFixture);
    const base = series.runs[0];

    expect(base).toBeDefined();
    if (!base) return;

    const runOne = {
      ...base,
      episodes: [
        {
          id: "ep_0001",
          number: 1,
          status: "published" as const,
        },
      ],
      pokemon: [],
      soulLinks: [],
      events: [],
    };

    const runTwo = {
      ...base,
      run: {
        ...base.run,
        id: "run-02",
        title: "Run 2",
        attemptNumber: 2,
      },
      episodes: [
        {
          id: "ep_0002",
          number: 1,
          status: "published" as const,
        },
      ],
      pokemon: [],
      soulLinks: [],
      events: [],
    };

    const result = RunSeriesSchema.safeParse({
      ...series,
      runs: [runOne, runTwo],
    });

    expect(result.success).toBe(false);
  });
});

describe("series spoiler visibility", () => {
  it("does not expose a later attempt before its first episode", () => {
    const seriesFixtureParsed = parseRunSeries(seriesFixture);
    const base = seriesFixtureParsed.runs[0];

    expect(base).toBeDefined();
    if (!base) return;

    const runOne = {
      ...base,
      run: {
        ...base.run,
        status: "failed" as const,
      },
      episodes: [
        {
          id: "ep_0001",
          number: 1,
          status: "published" as const,
        },
        {
          id: "ep_0003",
          number: 3,
          status: "published" as const,
        },
      ],
      pokemon: [],
      soulLinks: [],
      events: [],
    };

    const runTwo = {
      ...base,
      run: {
        ...base.run,
        id: "run-02",
        title: "Run 2",
        status: "active" as const,
        attemptNumber: 2,
      },
      episodes: [
        {
          id: "ep_0006",
          number: 6,
          status: "published" as const,
        },
      ],
      pokemon: [],
      soulLinks: [],
      events: [],
    };

    const series = parseRunSeries({
      ...seriesFixtureParsed,
      runs: [runOne, runTwo],
    });

    expect(getVisibleSeriesRuns(series, 3).map((run) => run.run.id)).toEqual([
      runOne.run.id,
    ]);

    expect(getVisibleSeriesRuns(series, 6).map((run) => run.run.id)).toEqual([
      runOne.run.id,
      runTwo.run.id,
    ]);
  });
});
