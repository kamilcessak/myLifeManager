import { queryClient } from "./queryClient";
import { useWorkspaceStore } from "../store/useWorkspaceStore";

/** Clears user-scoped client state when the session ends or the account changes. */
export function clearClientSession(): void {
  queryClient.clear();
  useWorkspaceStore.getState().setActiveWorkspace(null);
}
