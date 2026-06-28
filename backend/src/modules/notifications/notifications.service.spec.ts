import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotificationsService } from './notifications.service';
import { Notification, NotificationType } from './entities/notification.entity';
import { PushSubscription } from './entities/push-subscription.entity';
import { FirebaseService } from './firebase.service';

const mockNotificationRepo = {
  create: jest.fn().mockImplementation((dto) => dto),
  save: jest.fn().mockImplementation((entity) =>
    Promise.resolve({ id: 'notif-uuid-1', ...entity }),
  ),
  update: jest.fn().mockResolvedValue({ affected: 1 }),
  count: jest.fn().mockResolvedValue(3),
  find: jest.fn().mockResolvedValue([]),
  delete: jest.fn().mockResolvedValue({ affected: 1 }),
};

const mockSubscriptionRepo = {
  create: jest.fn().mockImplementation((dto) => dto),
  save: jest.fn().mockImplementation((entity) =>
    Promise.resolve({ id: 'sub-uuid-1', ...entity }),
  ),
  findOne: jest.fn().mockResolvedValue(null),
  find: jest.fn().mockResolvedValue([]),
  update: jest.fn().mockResolvedValue({ affected: 1 }),
};

const mockFirebaseService = {
  sendToTokens: jest.fn().mockResolvedValue({ success: 0, invalidTokens: [] }),
};

describe('NotificationsService', () => {
  let service: NotificationsService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        {
          provide: getRepositoryToken(Notification),
          useValue: mockNotificationRepo,
        },
        {
          provide: getRepositoryToken(PushSubscription),
          useValue: mockSubscriptionRepo,
        },
        {
          provide: FirebaseService,
          useValue: mockFirebaseService,
        },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
  });

  describe('create', () => {
    it('should save a notification with the correct fields', async () => {
      const dto = {
        userId: 'user-1',
        title: 'Test Title',
        body: 'Test body text',
        type: NotificationType.GENERAL,
        data: { key: 'value' },
      };

      const result = await service.create(dto);

      expect(mockNotificationRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          title: 'Test Title',
          body: 'Test body text',
          type: NotificationType.GENERAL,
          data: { key: 'value' },
        }),
      );
      expect(mockNotificationRepo.save).toHaveBeenCalled();
      expect(result.id).toBe('notif-uuid-1');
    });

    it('should default type to GENERAL when not provided', async () => {
      await service.create({ userId: 'user-1', title: 'Hi', body: 'Body' });

      expect(mockNotificationRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ type: NotificationType.GENERAL }),
      );
    });
  });

  describe('markAsRead', () => {
    it('should call repo.update with {id, userId} and {isRead: true}', async () => {
      await service.markAsRead('notif-1', 'user-1');

      expect(mockNotificationRepo.update).toHaveBeenCalledWith(
        { id: 'notif-1', userId: 'user-1' },
        { isRead: true },
      );
    });
  });

  describe('markAllAsRead', () => {
    it('should call repo.update with {userId, isRead: false} and {isRead: true}', async () => {
      await service.markAllAsRead('user-1');

      expect(mockNotificationRepo.update).toHaveBeenCalledWith(
        { userId: 'user-1', isRead: false },
        { isRead: true },
      );
    });
  });

  describe('countUnread', () => {
    it('should call repo.count with userId and isRead: false, and return the count', async () => {
      mockNotificationRepo.count.mockResolvedValueOnce(7);

      const result = await service.countUnread('user-1');

      expect(mockNotificationRepo.count).toHaveBeenCalledWith({
        where: { userId: 'user-1', isRead: false },
      });
      expect(result).toBe(7);
    });
  });

  describe('findForUser', () => {
    it('should return all notifications when unreadOnly is false', async () => {
      const mockList = [{ id: 'n1' }, { id: 'n2' }] as Notification[];
      mockNotificationRepo.find.mockResolvedValueOnce(mockList);

      const result = await service.findForUser('user-1', false);

      expect(mockNotificationRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-1' },
        }),
      );
      // isRead filter should NOT be in the where clause
      const callArg = mockNotificationRepo.find.mock.calls[0][0];
      expect(callArg.where).not.toHaveProperty('isRead');
      expect(result).toBe(mockList);
    });

    it('should pass isRead: false in where clause when unreadOnly is true', async () => {
      await service.findForUser('user-1', true);

      expect(mockNotificationRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-1', isRead: false },
        }),
      );
    });

    it('should default to unreadOnly=false', async () => {
      await service.findForUser('user-1');

      const callArg = mockNotificationRepo.find.mock.calls[0][0];
      expect(callArg.where).not.toHaveProperty('isRead');
    });

    it('should order by createdAt DESC and limit to 50', async () => {
      await service.findForUser('user-1');

      expect(mockNotificationRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          order: { createdAt: 'DESC' },
          take: 50,
        }),
      );
    });
  });
});
