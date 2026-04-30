import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import TimelinePage from "../page";

// Mock api
vi.mock("@/lib/api", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}));

// Mock data-cache store
vi.mock("@/stores/data-cache", () => ({
  useDataCache: () => ({
    getTeams: vi.fn(() => null),
    isTeamsStale: vi.fn(() => true),
    setTeams: vi.fn(),
    getProjects: vi.fn(() => null),
    isProjectsStale: vi.fn(() => true),
    setProjects: vi.fn(),
  }),
}));

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

import api from "@/lib/api";
import { toast } from "sonner";

const mockedApi = api as unknown as {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
};

describe("TimelinePage — regression: add button with no projects", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should disable the add-event button when the user has no projects", async () => {
    // Arrange: user has a team but zero projects
    mockedApi.get.mockImplementation((url: string) => {
      if (url === "/teams") {
        return Promise.resolve({ data: [{ id: "team-1", name: "Test Team" }] });
      }
      if (url === "/projects") {
        return Promise.resolve({ data: [] });
      }
      return Promise.resolve({ data: [] });
    });

    render(<TimelinePage />);

    // Wait for team to load
    await waitFor(() =>
      expect(screen.getByText("Test Team")).toBeInTheDocument()
    );

    // The "添加日程" button should be disabled
    const addButton = screen.getByRole("button", { name: /添加日程/ });
    expect(addButton).toBeDisabled();
  });
});
