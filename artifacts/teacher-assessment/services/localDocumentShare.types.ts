export type LocalDocumentShare = {
  url: string;
  expiresAt: number;
  stop: () => Promise<void>;
};
