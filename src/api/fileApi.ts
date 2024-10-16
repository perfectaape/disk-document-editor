export interface IFileAPI {
  fetchFiles: (oauthToken: string) => Promise<File[]>;
  fetchDocumentContent(path: string, oauthToken: string): Promise<string>;
  saveDocumentContent(
    path: string,
    oauthToken: string,
    content: string
  ): Promise<void>;
}

export interface File {
  name: string;
  path?: string;
  id?: string;
  mime_type: string;
}

export function getCookie(name: string): string | undefined {
  const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
  return match ? match[2] : undefined;
}
