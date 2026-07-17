import { describe, expect, it } from "vitest";
import {
  appendOverviewSearchText,
  matchesOverviewWindowSearch,
  removeLastOverviewSearchCharacter,
} from "../../src/overview/runtime";
import {
  matchesOverviewWindowSearchPlan,
  planOverviewWindowSearchQuery,
  removeLastOverviewSearchClause,
} from "../../src/overview/window-search";

describe("overview window search text editing", () => {
  it("appends text while preserving ordinary whitespace", () => {
    expect(appendOverviewSearchText("Konsole ", " window  ")).toBe(
      "Konsole  window  ",
    );
  });

  it("ignores non-string input and C0, C1, and DEL controls", () => {
    expect(
      appendOverviewSearchText(42, "a\u0000b\u001fc\u007fd\u0080e\u009ff"),
    ).toBe("abcdef");
    expect(appendOverviewSearchText("\u0000".repeat(128), "x")).toBe("x");
    expect(appendOverviewSearchText("query", null)).toBe("query");
  });

  it("caps the query by Unicode code points without splitting surrogates", () => {
    const prefix = "a".repeat(127);

    expect(appendOverviewSearchText(prefix, "😀ignored")).toBe(`${prefix}😀`);
    expect(
      Array.from(appendOverviewSearchText("😀".repeat(200), "x")),
    ).toHaveLength(128);
  });

  it("removes exactly one Unicode code point", () => {
    expect(removeLastOverviewSearchCharacter("a😀")).toBe("a");
    expect(removeLastOverviewSearchCharacter("😀")).toBe("");
    expect(removeLastOverviewSearchCharacter(42)).toBe("");
  });

  it("removes one trailing bare, scoped, or excluded clause", () => {
    expect(removeLastOverviewSearchClause("firefox nightly")).toBe("firefox ");
    expect(removeLastOverviewSearchClause("firefox  app:nightly\t ")).toBe(
      "firefox  ",
    );
    expect(removeLastOverviewSearchClause("firefox -state:minimized")).toBe(
      "firefox ",
    );
    expect(removeLastOverviewSearchClause("firefox -private")).toBe("firefox ");
  });

  it("treats quoted values and their modifiers as complete clauses", () => {
    expect(removeLastOverviewSearchClause('firefox "project notes"')).toBe(
      "firefox ",
    );
    expect(
      removeLastOverviewSearchClause('firefox title:"project notes"  '),
    ).toBe("firefox ");
    expect(
      removeLastOverviewSearchClause('firefox -title:"project notes"'),
    ).toBe("firefox ");
    expect(removeLastOverviewSearchClause('firefox -"project notes"')).toBe(
      "firefox ",
    );
    expect(
      removeLastOverviewSearchClause('firefox "project notes" nightly'),
    ).toBe('firefox "project notes" ');
  });

  it("removes a useful clause from malformed quoted input", () => {
    expect(removeLastOverviewSearchClause('firefox title:"project notes')).toBe(
      "firefox ",
    );
    expect(removeLastOverviewSearchClause('firefox broken"project notes')).toBe(
      "firefox ",
    );
    expect(
      removeLastOverviewSearchClause('firefox "project notes"suffix'),
    ).toBe("firefox ");
  });

  it("preserves the untouched prefix and handles bounded Unicode input", () => {
    expect(removeLastOverviewSearchClause("  firefox  😀window   ")).toBe(
      "  firefox  ",
    );
    expect(
      removeLastOverviewSearchClause(`${"a".repeat(126)} 😀 ignored`),
    ).toBe(`${"a".repeat(126)} `);
  });

  it("returns empty for missing or whitespace-only input", () => {
    expect(removeLastOverviewSearchClause(undefined)).toBe("");
    expect(removeLastOverviewSearchClause(42)).toBe("");
    expect(removeLastOverviewSearchClause("")).toBe("");
    expect(removeLastOverviewSearchClause(" \t\u00a0 ")).toBe("");
    expect(removeLastOverviewSearchClause("  firefox  ")).toBe("");
  });
});

describe("matchesOverviewWindowSearch", () => {
  it("matches collapsed case-insensitive AND terms across supported fields", () => {
    expect(
      matchesOverviewWindowSearch("  FIREfox   nightly ", {
        caption: "Mozilla Firefox",
        desktopFileName: "firefox-nightly.desktop",
        resourceClass: "Navigator",
        resourceName: "firefox",
      }),
    ).toBe(true);
    expect(
      matchesOverviewWindowSearch("firefox missing", {
        caption: "Mozilla Firefox",
      }),
    ).toBe(false);
  });

  it("matches synthetic attention state terms", () => {
    const fields = {
      caption: "Mozilla Firefox",
      state: "urgent attention",
    };

    expect(matchesOverviewWindowSearch("urgent", fields)).toBe(true);
    expect(matchesOverviewWindowSearch("attention", fields)).toBe(true);
    expect(matchesOverviewWindowSearch("firefox urgent", fields)).toBe(true);
    expect(
      matchesOverviewWindowSearch("firefox urgent", {
        caption: "Mozilla Firefox",
        state: "",
      }),
    ).toBe(false);
  });

  it("composes desktop and output name terms with every existing field", () => {
    const fields = {
      caption: "Mozilla Firefox",
      desktopFileName: "firefox.desktop",
      desktopName: "Web Development",
      outputName: "DP-2",
      resourceClass: "Navigator",
      resourceName: "firefox",
      state: "urgent floating",
    };

    expect(matchesOverviewWindowSearch("development", fields)).toBe(true);
    expect(matchesOverviewWindowSearch("web firefox urgent", fields)).toBe(
      true,
    );
    expect(matchesOverviewWindowSearch("dp-2 web firefox", fields)).toBe(true);
    expect(matchesOverviewWindowSearch("web missing", fields)).toBe(false);
  });

  it("matches quoted phrases within one field", () => {
    expect(
      matchesOverviewWindowSearch('"PROJECT notes"', {
        caption: "Project Notes — Firefox",
      }),
    ).toBe(true);
    expect(
      matchesOverviewWindowSearch('"project notes"', {
        caption: "Project",
        resourceName: "notes",
      }),
    ).toBe(false);
  });

  it("combines positive clauses with bare and scoped exclusions", () => {
    const fields = {
      caption: "Project Notes",
      resourceClass: "firefox",
      state: "floating urgent",
    };

    expect(matchesOverviewWindowSearch("project -private", fields)).toBe(true);
    expect(matchesOverviewWindowSearch("project -notes", fields)).toBe(false);
    expect(
      matchesOverviewWindowSearch(
        'title:"project notes" -state:minimized',
        fields,
      ),
    ).toBe(true);
    expect(
      matchesOverviewWindowSearch('title:project -"project notes"', fields),
    ).toBe(false);
  });

  it("allows negative-only queries when no excluded clause matches", () => {
    expect(
      matchesOverviewWindowSearch("-state:minimized -private", {
        caption: "Project Notes",
        state: "floating",
      }),
    ).toBe(true);
    expect(
      matchesOverviewWindowSearch("-state:minimized", {
        caption: "Project Notes",
      }),
    ).toBe(true);
    expect(matchesOverviewWindowSearch("-state:minimized", {})).toBe(true);
    expect(
      matchesOverviewWindowSearch("-state:minimized", {
        state: "minimized urgent",
      }),
    ).toBe(false);
  });

  it.each([
    ["TITLE:browser", { caption: "Browser" }],
    ["app:firefox", { resourceClass: "Firefox" }],
    ["app:firefox", { resourceName: "firefox" }],
    ["app:firefox", { desktopFileName: "org.mozilla.firefox.desktop" }],
    ["desktop:development", { desktopName: "Web Development" }],
    ["output:dp-2", { outputName: "DP-2" }],
    ["state:urgent", { state: "floating urgent" }],
  ])("matches recognized scoped query %s", (query, fields) => {
    expect(matchesOverviewWindowSearch(query, fields)).toBe(true);
  });

  it("keeps scoped values inside their requested fields", () => {
    expect(
      matchesOverviewWindowSearch("title:firefox", {
        caption: "Browser",
        resourceName: "firefox",
      }),
    ).toBe(false);
    expect(
      matchesOverviewWindowSearch("app:browser", {
        caption: "Browser",
        resourceName: "firefox",
      }),
    ).toBe(false);
    expect(
      matchesOverviewWindowSearch('title:"project notes"', {
        caption: "Project Notes",
      }),
    ).toBe(true);
  });

  it("keeps unknown prefixes as ordinary bare text", () => {
    expect(
      matchesOverviewWindowSearch("kind:dialog", {
        caption: "kind:dialog",
      }),
    ).toBe(true);
    expect(
      matchesOverviewWindowSearch("kind:dialog", { caption: "dialog" }),
    ).toBe(false);
    expect(
      matchesOverviewWindowSearch('kind:"project notes"', {
        caption: "kind:project notes",
      }),
    ).toBe(true);
  });

  it.each([
    '"unclosed phrase',
    'title:"unclosed phrase',
    'title:"project"notes',
    "title:",
    "title: notes",
    'title:""',
  ])("fails closed for malformed structured query %j", (query) => {
    expect(
      matchesOverviewWindowSearch(query, { caption: "Project Notes" }),
    ).toBe(false);
    expect(planOverviewWindowSearchQuery(query)).toBeNull();
  });

  it("treats empty, whitespace-only, and non-string queries as unfiltered", () => {
    expect(matchesOverviewWindowSearch("", null)).toBe(true);
    expect(matchesOverviewWindowSearch("   \u00a0 ", null)).toBe(true);
    expect(matchesOverviewWindowSearch(undefined, null)).toBe(true);
  });

  it("uses no more than eight search terms", () => {
    const fields = { caption: "one two three four five six seven eight" };

    expect(
      matchesOverviewWindowSearch(
        "one two three four five six seven eight absent",
        fields,
      ),
    ).toBe(true);
  });

  it("still validates malformed syntax after the eighth clause", () => {
    expect(
      matchesOverviewWindowSearch(
        'one two three four five six seven eight title:"unclosed',
        { caption: "one two three four five six seven eight" },
      ),
    ).toBe(false);
  });

  it("scans each supported field through 512 Unicode code points", () => {
    expect(
      matchesOverviewWindowSearch("needle", {
        caption: `${"😀".repeat(511)}needle`,
      }),
    ).toBe(false);
    expect(
      matchesOverviewWindowSearch("x", {
        resourceClass: `${"😀".repeat(511)}xignored`,
      }),
    ).toBe(true);
    expect(
      matchesOverviewWindowSearch("urgent", {
        state: `${"😀".repeat(512)}urgent`,
      }),
    ).toBe(false);
    expect(
      matchesOverviewWindowSearch("x", {
        state: `${"😀".repeat(511)}xignored`,
      }),
    ).toBe(true);
  });

  it("scans desktop names through 64 Unicode code points", () => {
    expect(
      matchesOverviewWindowSearch("x", {
        desktopName: `${"😀".repeat(63)}xignored`,
      }),
    ).toBe(true);
    expect(
      matchesOverviewWindowSearch("x", {
        desktopName: `${"😀".repeat(64)}x`,
      }),
    ).toBe(false);
  });

  it("scans output names through 64 Unicode code points", () => {
    expect(
      matchesOverviewWindowSearch("x", {
        outputName: `${"😀".repeat(63)}xignored`,
      }),
    ).toBe(true);
    expect(
      matchesOverviewWindowSearch("x", {
        outputName: `${"😀".repeat(64)}x`,
      }),
    ).toBe(false);
  });

  it("does not match unsupported fields or across field boundaries", () => {
    expect(matchesOverviewWindowSearch("needle", { title: "needle" })).toBe(
      false,
    );
    expect(
      matchesOverviewWindowSearch("foobar", {
        caption: "foo",
        resourceName: "bar",
      }),
    ).toBe(false);
  });

  it("fails closed for malformed fields and throwing accessors", () => {
    expect(matchesOverviewWindowSearch("query", null)).toBe(false);
    expect(matchesOverviewWindowSearch("query", [])).toBe(false);
    expect(
      matchesOverviewWindowSearch("query", {
        caption: 42,
        resourceName: "query",
      }),
    ).toBe(false);
    expect(
      matchesOverviewWindowSearch("urgent", {
        caption: "urgent",
        state: true,
      }),
    ).toBe(false);
    expect(
      matchesOverviewWindowSearch("development", {
        caption: "development",
        desktopName: 42,
      }),
    ).toBe(false);
    expect(
      matchesOverviewWindowSearch("dp-2", {
        caption: "dp-2",
        outputName: 42,
      }),
    ).toBe(false);

    const hostile = Object.defineProperty({}, "caption", {
      get(): never {
        throw new Error("unavailable");
      },
    });
    expect(matchesOverviewWindowSearch("query", hostile)).toBe(false);

    const hostileState = Object.defineProperty({ caption: "urgent" }, "state", {
      get(): never {
        throw new Error("unavailable");
      },
    });
    expect(matchesOverviewWindowSearch("urgent", hostileState)).toBe(false);

    const hostileDesktopName = Object.defineProperty(
      { caption: "development" },
      "desktopName",
      {
        get(): never {
          throw new Error("unavailable");
        },
      },
    );
    expect(matchesOverviewWindowSearch("development", hostileDesktopName)).toBe(
      false,
    );

    const hostileOutputName = Object.defineProperty(
      { caption: "dp-2" },
      "outputName",
      {
        get(): never {
          throw new Error("unavailable");
        },
      },
    );
    expect(matchesOverviewWindowSearch("dp-2", hostileOutputName)).toBe(false);
  });

  it("does not inspect fields when the query is empty", () => {
    const hostile = Object.defineProperty({}, "caption", {
      get(): never {
        throw new Error("unavailable");
      },
    });

    Object.defineProperty(hostile, "outputName", {
      get(): never {
        throw new Error("unavailable");
      },
    });

    expect(matchesOverviewWindowSearch("  ", hostile)).toBe(true);
  });

  it("reads only scoped fields unless a bare clause requests all fields", () => {
    let captionReads = 0;
    const scoped = Object.defineProperties(
      { resourceName: "firefox" },
      {
        caption: {
          get(): string {
            captionReads += 1;
            return "Project Notes";
          },
        },
        outputName: {
          get(): never {
            throw new Error("must not be read");
          },
        },
      },
    );

    expect(
      matchesOverviewWindowSearch("title:project title:notes", scoped),
    ).toBe(true);
    expect(captionReads).toBe(1);
    expect(matchesOverviewWindowSearch("app:firefox", scoped)).toBe(true);
    expect(captionReads).toBe(1);
    expect(matchesOverviewWindowSearch("project", scoped)).toBe(false);
  });
});

describe("planned overview window search", () => {
  it("creates one deeply immutable bounded query plan", () => {
    const plan = planOverviewWindowSearchQuery(
      'Title:"Project Notes" app:firefox -STATE:minimized',
    );

    expect(plan).toEqual({
      clauses: [
        {
          bare: false,
          excluded: false,
          fields: ["caption"],
          value: "project notes",
        },
        {
          bare: false,
          excluded: false,
          fields: ["resourceClass", "resourceName", "desktopFileName"],
          value: "firefox",
        },
        {
          bare: false,
          excluded: true,
          fields: ["state"],
          value: "minimized",
        },
      ],
      requiredFields: [
        "caption",
        "resourceClass",
        "resourceName",
        "desktopFileName",
        "state",
      ],
      requiresAllFields: false,
    });
    expect(Object.isFrozen(plan)).toBe(true);
    expect(plan && Object.isFrozen(plan.clauses)).toBe(true);
    expect(plan && Object.isFrozen(plan.requiredFields)).toBe(true);
    expect(
      plan?.clauses.every(
        (clause) => Object.isFrozen(clause) && Object.isFrozen(clause.fields),
      ),
    ).toBe(true);
  });

  it("reuses a plan across windows without reparsing the query", () => {
    const plan = planOverviewWindowSearchQuery(
      'title:"project notes" -state:minimized',
    );

    expect(
      matchesOverviewWindowSearchPlan(plan, {
        caption: "Project Notes",
        state: "floating",
      }),
    ).toBe(true);
    expect(
      matchesOverviewWindowSearchPlan(plan, {
        caption: "Project Notes",
        state: "minimized",
      }),
    ).toBe(false);
  });

  it("returns an immutable valid empty plan without inspecting fields", () => {
    const plan = planOverviewWindowSearchQuery(undefined);
    const hostile = Object.defineProperty({}, "caption", {
      get(): never {
        throw new Error("unavailable");
      },
    });

    expect(plan).toEqual({
      clauses: [],
      requiredFields: [],
      requiresAllFields: false,
    });
    expect(Object.isFrozen(plan)).toBe(true);
    expect(matchesOverviewWindowSearchPlan(plan, hostile)).toBe(true);
  });

  it("decodes valid bounded external plans and rejects malformed ones", () => {
    const fields = ["caption"];
    const clause = {
      bare: false,
      excluded: false,
      fields,
      value: "project",
    };
    const external = {
      clauses: [clause],
      requiredFields: ["caption"],
      requiresAllFields: false,
    };

    expect(
      matchesOverviewWindowSearchPlan(external, { caption: "Project Notes" }),
    ).toBe(true);
    expect(
      matchesOverviewWindowSearchPlan(
        {
          clauses: Array.from({ length: 9 }, () => clause),
          requiredFields: ["caption"],
          requiresAllFields: false,
        },
        { caption: "Project Notes" },
      ),
    ).toBe(false);
    expect(
      matchesOverviewWindowSearchPlan(
        {
          clauses: [clause],
          requiredFields: ["outputName"],
          requiresAllFields: false,
        },
        { caption: "Project Notes" },
      ),
    ).toBe(false);
    expect(
      matchesOverviewWindowSearchPlan(
        {
          clauses: [
            {
              ...clause,
              value: "x".repeat(100_000),
            },
          ],
          requiredFields: ["caption"],
          requiresAllFields: false,
        },
        { caption: "Project Notes" },
      ),
    ).toBe(false);
  });

  it("fails closed for hostile external plan accessors", () => {
    const hostile = Object.freeze(
      Object.defineProperty({}, "clauses", {
        get(): never {
          throw new Error("unavailable");
        },
      }),
    );

    expect(matchesOverviewWindowSearchPlan(hostile, {})).toBe(false);
    expect(matchesOverviewWindowSearchPlan(null, {})).toBe(false);
  });

  it("stores only the first eight clauses in the bounded plan", () => {
    const plan = planOverviewWindowSearchQuery(
      "one two three four five six seven eight nine ten",
    );

    expect(plan?.clauses).toHaveLength(8);
    expect(plan?.clauses.map((clause) => clause.value)).toEqual([
      "one",
      "two",
      "three",
      "four",
      "five",
      "six",
      "seven",
      "eight",
    ]);
  });
});
