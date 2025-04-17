import { vi, describe, it, expect, beforeEach } from "vitest";
import {
  setupMonocle,
  MonocleInstrumentation,
  addSpanProcessors,
  getScopes,
  setScopes,
  setScopesBind,
  startTrace,
} from "../src/instrumentation/common/instrumentation";
import {
  SpanProcessor,
  NodeTracerProvider,
  ConsoleSpanExporter,
} from "@opentelemetry/sdk-trace-node";
import { context, propagation } from "@opentelemetry/api";

vi.mock("@opentelemetry/sdk-trace-node", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@opentelemetry/sdk-trace-node")>();
  return {
    ...actual,
    NodeTracerProvider: vi.fn().mockImplementation(() => ({
      addSpanProcessor: vi.fn(),
      getTracer: vi.fn(),
    })),
    ConsoleSpanExporter: vi.fn(),
    SpanProcessor: vi.fn(),
  };
});

vi.mock("@opentelemetry/context-async-hooks", () => ({
  AsyncHooksContextManager: vi.fn().mockImplementation(() => ({
    enable: vi.fn(),
  })),
}));

vi.mock("@opentelemetry/api", () => ({
  context: {
    active: vi.fn().mockReturnValue({}),
    setGlobalContextManager: vi.fn(),
    with: vi.fn((context, fn) => fn()),
    bind: vi.fn((context, fn) => fn),
  },
  propagation: {
    getBaggage: vi.fn().mockReturnValue({
      setEntry: vi.fn().mockReturnThis(),
      removeEntry: vi.fn().mockReturnThis(),
    }),
    setBaggage: vi.fn(),
    createBaggage: vi.fn().mockReturnValue({
      setEntry: vi.fn().mockReturnThis(),
    }),
    getActiveBaggage: vi.fn().mockReturnValue({
      getAllEntries: vi.fn().mockReturnValue([]),
    }),
  },
}));

vi.mock("./utils", async () => ({
  setScopesInternal: vi.fn((scopes, context, fn) => fn()),
  setScopesBindInternal: vi.fn((scopes, context, fn) => fn),
  getScopesInternal: vi.fn().mockReturnValue({}),
  startTraceInternal: vi.fn((fn) => fn()),
  setInstrumentor: vi.fn(),
  load_scopes: vi.fn().mockReturnValue([]),
}));

describe("MonocleInstrumentation", () => {
  let monocleInstrumentation: MonocleInstrumentation;

  beforeEach(() => {
    vi.clearAllMocks();
    monocleInstrumentation = new MonocleInstrumentation();
  });

  it("should initialize correctly", () => {
    expect(monocleInstrumentation).toBeDefined();
  });

  it("should enable instrumentation", () => {
    monocleInstrumentation.enable();
    // @ts-ignore: accessing private field
    expect(monocleInstrumentation["_enabled"]).toBe(true);
  });
});

describe("setupMonocle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should setup monocle with default params", () => {
    const instrumentation = setupMonocle("test-workflow");
    expect(instrumentation).toBeDefined();
  });

  it("should throw error when both spanProcessors and exporter_list provided", () => {
    const processor = {} as SpanProcessor;
    expect(() => setupMonocle("test", [processor], [], "console")).toThrow(
      "Cannot set both spanProcessors and exporter_list.",
    );
  });

  it("should setup with custom span processors", () => {
    const processor = {} as SpanProcessor;
    const instrumentation = setupMonocle("test", [processor]);
    expect(instrumentation).toBeDefined();
  });

  it("should handle error during setup", () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.mocked(NodeTracerProvider).mockImplementation(() => {
      throw new Error("Setup error");
    });

    expect(() => setupMonocle("test")).toThrow("Setup error");
  });
});

describe("addSpanProcessors", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.MONOCLE_EXPORTER;
    delete process.env.MONOCLE_EXPORTER_DELAY;
    delete process.env.AWS_LAMBDA_FUNCTION_NAME;
  });

  it("should add default processors for lambda environment", () => {
    process.env.AWS_LAMBDA_FUNCTION_NAME = "test-lambda";
    const processors: SpanProcessor[] = [];
    addSpanProcessors(processors);
    expect(processors).toHaveLength(2);
  });

  it("should use custom exporter list", () => {
    const processors: SpanProcessor[] = [];
    addSpanProcessors(processors, "console");
    expect(processors).toHaveLength(1);
  });

  it("should use default delay when MONOCLE_EXPORTER_DELAY is invalid", () => {
    process.env.MONOCLE_EXPORTER_DELAY = "invalid";
    const processors: SpanProcessor[] = [];
    addSpanProcessors(processors);
    expect(processors.length).toBeGreaterThan(0);
  });

  it("should use custom delay when MONOCLE_EXPORTER_DELAY is valid", () => {
    process.env.MONOCLE_EXPORTER_DELAY = "100";
    const processors: SpanProcessor[] = [];
    addSpanProcessors(processors);
    expect(processors.length).toBeGreaterThan(0);
  });
});

describe("Scope Management", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should set and get scopes", () => {
    const scopes = { foo: "bar" };
    const fn = vi.fn().mockReturnValue("test");

    const result = setScopes(scopes, fn);
    expect(result).toBe("test");
    expect(fn).toHaveBeenCalled();

    const retrievedScopes = getScopes();
    expect(retrievedScopes).toBeDefined();
  });

  it("should bind scopes to function", () => {
    const scopes = { foo: "bar" };
    const fn = vi.fn().mockReturnValue("test");

    const boundFn = setScopesBind(scopes, fn);
    expect(boundFn).toBeInstanceOf(Function);

    const result = boundFn();
    expect(result).toBe("test");
  });

  it("should start trace", () => {
    const fn = vi.fn().mockReturnValue("test");
    const result = startTrace(fn);
    expect(result).toBe("test");
    expect(fn).toHaveBeenCalled();
  });

  it("should handle null scopes", () => {
    const scopes = { foo: null };
    const fn = vi.fn().mockReturnValue("test");

    const result = setScopes(scopes, fn);
    expect(result).toBe("test");
    expect(fn).toHaveBeenCalled();
  });

  it("should handle empty scopes object", () => {
    const scopes = {};
    const fn = vi.fn().mockReturnValue("test");
    const result = setScopes(scopes, fn);
    expect(result).toBe("test");
    expect(fn).toHaveBeenCalled();
  });
});
