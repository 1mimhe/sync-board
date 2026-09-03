import { Injectable } from '@nestjs/common';
import { assignCollaboratorColor } from '../../../common/utils/collaborator-color.util';
import type { EditorInfo } from '../interfaces/document.interfaces';

/**
 * In-memory editor presence per document: `documentId -> socketId -> EditorInfo`.
 * Assigns deterministic, collision-free collaborator colors using the same
 * FNV-1a + curated palette approach as board presence.
 */
@Injectable()
export class EditorPresenceService {
  private readonly editors = new Map<string, Map<string, EditorInfo>>();

  /**
   * Registers an editor's presence on a document.
   *
   * @param documentId - Document UUID
   * @param socketId - Socket.IO socket identifier
   * @param info - Public editor summary
   */
  addEditor(documentId: string, socketId: string, info: EditorInfo): void {
    let documentEditors = this.editors.get(documentId);
    if (!documentEditors) {
      documentEditors = new Map<string, EditorInfo>();
      this.editors.set(documentId, documentEditors);
    }
    documentEditors.set(socketId, info);
  }

  /**
   * Removes an editor's presence from a document.
   *
   * @param documentId - Document UUID
   * @param socketId - Socket.IO socket identifier
   * @returns The removed editor info, or null when absent
   */
  removeEditor(documentId: string, socketId: string): EditorInfo | null {
    const documentEditors = this.editors.get(documentId);
    if (!documentEditors) return null;
    const info = documentEditors.get(socketId) ?? null;
    documentEditors.delete(socketId);
    if (documentEditors.size === 0) {
      this.editors.delete(documentId);
    }
    return info;
  }

  /**
   * Lists all editors currently connected to a document.
   *
   * @param documentId - Document UUID
   * @returns Array of editor summaries
   */
  getEditors(documentId: string): EditorInfo[] {
    const documentEditors = this.editors.get(documentId);
    if (!documentEditors) return [];
    return Array.from(documentEditors.values());
  }

  /**
   * Assigns a deterministic collaborator color for a user on a document.
   * Reuses the color when the same user is already present (multi-tab);
   * falls back to golden-ratio HSL hues when the palette is exhausted.
   *
   * @param documentId - Document UUID
   * @param userId - User UUID
   * @returns Hex or HSL color string
   */
  assignColor(documentId: string, userId: string): string {
    const documentEditors = this.editors.get(documentId);
    if (documentEditors) {
      for (const info of documentEditors.values()) {
        if (info.userId === userId) {
          return info.color;
        }
      }
    }

    const takenColors = new Set(
      documentEditors
        ? Array.from(documentEditors.values()).map((info) => info.color)
        : [],
    );

    return assignCollaboratorColor(userId, takenColors);
  }
}
