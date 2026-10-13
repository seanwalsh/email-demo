import type {
  Label,
  ListThreadsParams,
  ModifyThreadParams,
  Thread,
  ThreadPage,
} from "./types";

// The UI and API routes depend only on this interface, never on Gmail types.
export interface MailProvider {
  listLabels(): Promise<Label[]>;
  listThreads(params: ListThreadsParams): Promise<ThreadPage>;
  getThread(id: string): Promise<Thread>;
  modifyThread(id: string, params: ModifyThreadParams): Promise<void>;
  trashThread(id: string): Promise<void>;
}
