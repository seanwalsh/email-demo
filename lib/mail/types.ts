export interface Label {
  id: string;
  name: string;
  system: boolean;
  unread: number;
}

export interface Address {
  name: string;
  email: string;
}

export interface ThreadSummary {
  id: string;
  subject: string;
  snippet: string;
  from: Address;
  date: number;
  unread: boolean;
  starred: boolean;
  labelIds: string[];
  messageCount: number;
  extras: Record<string, unknown>;
}

export interface Attachment {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
}

export interface Message {
  id: string;
  from: Address;
  to: Address[];
  cc: Address[];
  date: number;
  subject: string;
  html: string | null;
  text: string | null;
  attachments: Attachment[];
  labelIds: string[];
}

export interface Thread {
  id: string;
  subject: string;
  messages: Message[];
  labelIds: string[];
}

export interface ThreadPage {
  threads: ThreadSummary[];
  nextPageToken: string | null;
}

export interface ListThreadsParams {
  labelId?: string;
  query?: string;
  pageToken?: string;
}

export interface ModifyThreadParams {
  addLabelIds?: string[];
  removeLabelIds?: string[];
}
