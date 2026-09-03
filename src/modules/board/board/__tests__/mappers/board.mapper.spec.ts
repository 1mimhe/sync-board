import {
  toCommentAuthorDto,
  toBoardResponseDto,
  toListResponseDto,
  toBoardLabelResponseDto,
  toCardResponseDto,
  toCardAttachmentResponseDto,
  toCardWithDetailsResponseDto,
  toListWithCardsResponseDto,
  toBoardWithContentResponseDto,
  toBoardContentPaginationDto,
  toCardCommentResponseDto,
  toActivityResponseDto,
} from '../../mappers/board.mapper';
import { AttachmentType } from '@prisma/client';

describe('BoardMapper Functions', () => {
  const now = new Date();

  describe('toCommentAuthorDto', () => {
    it('should map author object to DTO', () => {
      const author = {
        id: 'u-1',
        displayName: 'Jane Doe',
        avatarUrl: 'https://example.com/avatar.png',
      };
      expect(toCommentAuthorDto(author)).toEqual(author);
    });
  });

  describe('toBoardResponseDto', () => {
    it('should map board entity to BoardResponseDto', () => {
      const board: any = {
        id: 'b-1',
        workspaceId: 'ws-1',
        title: 'Board Title',
        description: 'Board Description',
        backgroundColor: '#123456',
        createdBy: 'u-1',
        createdAt: now,
        updatedAt: now,
        archivedAt: null,
        deletedAt: null,
      };

      expect(toBoardResponseDto(board)).toEqual({
        id: 'b-1',
        workspaceId: 'ws-1',
        title: 'Board Title',
        description: 'Board Description',
        backgroundColor: '#123456',
        createdBy: 'u-1',
        createdAt: now,
        updatedAt: now,
        archivedAt: null,
        deletedAt: null,
      });
    });
  });

  describe('toListResponseDto', () => {
    it('should map list entity to ListResponseDto', () => {
      const list: any = {
        id: 'l-1',
        boardId: 'b-1',
        title: 'To Do',
        rank: '0|h:',
        createdAt: now,
        updatedAt: now,
        archivedAt: null,
        deletedAt: null,
      };

      expect(toListResponseDto(list)).toEqual(list);
    });
  });

  describe('toBoardLabelResponseDto', () => {
    it('should map label entity to BoardLabelResponseDto', () => {
      const label: any = {
        id: 'lbl-1',
        workspaceId: 'ws-1',
        boardId: null,
        name: 'Urgent',
        color: '#ff0000',
        createdAt: now,
      };

      expect(toBoardLabelResponseDto(label)).toEqual(label);
    });
  });

  describe('toCardResponseDto', () => {
    it('should map card entity to CardResponseDto', () => {
      const card: any = {
        id: 'c-1',
        listId: 'l-1',
        title: 'Task 1',
        description: 'Description',
        rank: '0|a:',
        dueDate: now,
        isComplete: true,
        coverImageUrl: 'https://example.com/cover.png',
        createdBy: 'u-1',
        createdAt: now,
        updatedAt: now,
        archivedAt: null,
        deletedAt: null,
      };

      expect(toCardResponseDto(card)).toEqual(card);
    });
  });

  describe('toCardAttachmentResponseDto', () => {
    it('should map attachment with user to CardAttachmentResponseDto', () => {
      const attachment: any = {
        id: 'att-1',
        cardId: 'c-1',
        type: AttachmentType.file,
        url: 'https://example.com/doc.pdf',
        name: 'doc.pdf',
        mimeType: 'application/pdf',
        fileSize: 1024,
        coverUrl: null,
        createdAt: now,
        updatedAt: now,
        uploadedBy: { id: 'u-1', displayName: 'Jane Doe', avatarUrl: null },
      };

      expect(toCardAttachmentResponseDto(attachment)).toEqual({
        id: 'att-1',
        cardId: 'c-1',
        uploadedBy: { id: 'u-1', displayName: 'Jane Doe', avatarUrl: null },
        type: AttachmentType.file,
        url: 'https://example.com/doc.pdf',
        name: 'doc.pdf',
        mimeType: 'application/pdf',
        fileSize: 1024,
        coverUrl: null,
        createdAt: now,
        updatedAt: now,
      });
    });
  });

  describe('toCardWithDetailsResponseDto', () => {
    it('should map card with nested assignees, labels, and attachments', () => {
      const cardWithDetails: any = {
        id: 'c-1',
        listId: 'l-1',
        title: 'Task',
        description: null,
        rank: '0|a:',
        dueDate: null,
        isComplete: false,
        coverImageUrl: null,
        createdBy: 'u-1',
        createdAt: now,
        updatedAt: now,
        archivedAt: null,
        assignees: [
          { user: { id: 'u-1', displayName: 'Jane', avatarUrl: null } },
        ],
        labels: [
          {
            label: {
              id: 'lbl-1',
              name: 'Bug',
              color: '#f00',
              workspaceId: 'ws-1',
              createdAt: now,
            },
          },
        ],
        attachments: [],
      };

      const result = toCardWithDetailsResponseDto(cardWithDetails);

      expect(result.id).toBe('c-1');
      expect(result.assignees).toEqual([
        { user: { id: 'u-1', displayName: 'Jane', avatarUrl: null } },
      ]);
      expect(result.labels).toEqual([
        {
          label: {
            id: 'lbl-1',
            name: 'Bug',
            color: '#f00',
            workspaceId: 'ws-1',
            createdAt: now,
          },
        },
      ]);
      expect(result.attachments).toEqual([]);
    });

    it('should handle undefined attachments array by defaulting to empty array', () => {
      const cardWithoutAttachments: any = {
        id: 'c-1',
        listId: 'l-1',
        title: 'Task',
        description: null,
        rank: '0|a:',
        dueDate: null,
        isComplete: false,
        coverImageUrl: null,
        createdBy: 'u-1',
        createdAt: now,
        updatedAt: now,
        archivedAt: null,
        assignees: [],
        labels: [],
        attachments: undefined,
      };

      const result = toCardWithDetailsResponseDto(cardWithoutAttachments);
      expect(result.attachments).toEqual([]);
    });
  });

  describe('toListWithCardsResponseDto', () => {
    it('should map list with cards and cardCount', () => {
      const listWithCards: any = {
        id: 'l-1',
        boardId: 'b-1',
        title: 'Todo',
        rank: '0|h:',
        createdAt: now,
        updatedAt: now,
        archivedAt: null,
        cardCount: 0,
        cards: [],
      };

      const result = toListWithCardsResponseDto(listWithCards);
      expect(result.id).toBe('l-1');
      expect(result.cards).toEqual([]);
      expect(result.cardCount).toBe(0);
    });
  });

  describe('toBoardWithContentResponseDto and toBoardContentPaginationDto', () => {
    it('should map full board content entity and pagination metadata', () => {
      const boardWithFull: any = {
        id: 'b-1',
        workspaceId: 'ws-1',
        title: 'Board',
        description: null,
        backgroundColor: '#000000',
        createdBy: 'u-1',
        createdAt: now,
        updatedAt: now,
        archivedAt: null,
        isStarred: true,
        lists: [],
        labels: [],
        pagination: {
          listPage: 1,
          listPageSize: 10,
          totalLists: 0,
          totalPages: 0,
          cardPageSize: 20,
          totalCards: 0,
        },
      };

      const result = toBoardWithContentResponseDto(boardWithFull);

      expect(result.id).toBe('b-1');
      expect(result.isStarred).toBe(true);
      expect(result.lists).toEqual([]);
      expect(result.labels).toEqual([]);
      expect(result.pagination).toEqual({
        listPage: 1,
        listPageSize: 10,
        totalLists: 0,
        totalPages: 0,
        cardPageSize: 20,
        totalCards: 0,
      });
    });

    it('should map pagination fields correctly with toBoardContentPaginationDto', () => {
      const pagination = {
        listPage: 2,
        listPageSize: 15,
        totalLists: 30,
        totalPages: 2,
        cardPageSize: 50,
        totalCards: 100,
      };

      expect(toBoardContentPaginationDto(pagination)).toEqual(pagination);
    });
  });

  describe('toCardCommentResponseDto', () => {
    it('should map comment with author', () => {
      const comment: any = {
        id: 'comm-1',
        cardId: 'c-1',
        authorId: 'u-1',
        content: 'Looks good',
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
        author: { id: 'u-1', displayName: 'Jane', avatarUrl: null },
      };

      expect(toCardCommentResponseDto(comment)).toEqual({
        id: 'comm-1',
        cardId: 'c-1',
        authorId: 'u-1',
        content: 'Looks good',
        author: { id: 'u-1', displayName: 'Jane', avatarUrl: null },
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      });
    });
  });

  describe('toActivityResponseDto', () => {
    it('should map activity entity with actor details', () => {
      const activity: any = {
        id: 'act-1',
        boardId: 'b-1',
        user: { id: 'u-1', displayName: 'Jane', avatarUrl: null },
        action: 'created',
        entityType: 'card',
        entityId: 'c-1',
        entityTitle: 'New Task',
        fromListId: null,
        toListId: null,
        details: { key: 'value' },
        createdAt: now,
      };

      expect(toActivityResponseDto(activity)).toEqual({
        id: 'act-1',
        boardId: 'b-1',
        user: { id: 'u-1', displayName: 'Jane', avatarUrl: null },
        action: 'created',
        entityType: 'card',
        entityId: 'c-1',
        entityTitle: 'New Task',
        fromListId: null,
        toListId: null,
        details: { key: 'value' },
        createdAt: now,
      });
    });
  });
});
