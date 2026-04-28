import express from "express";
import { afterEach, describe, expect, it } from "vitest";

import { createPlatformServer, getPlatformProtocol } from "./platformServer";

describe("platformServer", () => {
  afterEach(() => {
    process.env.NODE_ENV = "test";
    delete process.env.COREVIA_RUNTIME_PROFILE;
    delete process.env.TLS_ENABLED;
    delete process.env.TLS_KEY_PATH;
    delete process.env.TLS_CERT_PATH;
    delete process.env.TLS_CA_PATH;
  });

  it("uses HTTP for non-production local runtime when TLS is not configured", () => {
    const server = createPlatformServer(express(), {
      NODE_ENV: "development",
      TLS_ENABLED: "false",
    });

    expect(getPlatformProtocol({ NODE_ENV: "development", TLS_ENABLED: "false" })).toBe("http");
    expect(server.constructor.name).toBe("Server");
    server.close();
  });

  it("still requires TLS in production when no certificate paths are configured", () => {
    expect(() => createPlatformServer(express(), {
      NODE_ENV: "production",
      TLS_ENABLED: "false",
    })).toThrow("TLS is required. Configure TLS_KEY_PATH and TLS_CERT_PATH before starting the platform server.");
  });

  it("allows HTTP for the local-docker profile without TLS", () => {
    const server = createPlatformServer(express(), {
      NODE_ENV: "production",
      COREVIA_RUNTIME_PROFILE: "local-docker",
      TLS_ENABLED: "false",
    });

    expect(server.constructor.name).toBe("Server");
    server.close();
  });
});