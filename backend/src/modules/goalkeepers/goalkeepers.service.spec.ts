import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { GoalkeepersService } from './goalkeepers.service';
import { Goalkeeper, DominantHand, DominantFoot } from './entities/goalkeeper.entity';
import { Match } from '../matches/entities/match.entity';
import { TrainingSession } from '../training/entities/training-session.entity';
import { PerformanceIndex } from '../performance/entities/performance-index.entity';

// ─── QueryBuilder mock ────────────────────────────────────────────────────────

const mockQbResult: { data: Goalkeeper[]; total: number } = { data: [], total: 0 };

const mockQb = {
  leftJoinAndSelect: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  skip: jest.fn().mockReturnThis(),
  take: jest.fn().mockReturnThis(),
  getManyAndCount: jest.fn().mockImplementation(() =>
    Promise.resolve([mockQbResult.data, mockQbResult.total]),
  ),
};

// ─── Repository mocks ─────────────────────────────────────────────────────────

const mockGoalkeeperRepo = {
  createQueryBuilder: jest.fn().mockReturnValue(mockQb),
  findOne: jest.fn(),
  create: jest.fn().mockImplementation((dto) => dto),
  save: jest.fn().mockImplementation((entity) =>
    Promise.resolve({ id: 'gk-uuid-1', ...entity }),
  ),
  update: jest.fn().mockResolvedValue({ affected: 1 }),
  delete: jest.fn().mockResolvedValue({ affected: 1 }),
};

const mockMatchRepo = {
  find: jest.fn().mockResolvedValue([]),
};

const mockTrainingRepo = {
  find: jest.fn().mockResolvedValue([]),
};

const mockPerformanceRepo = {
  find: jest.fn().mockResolvedValue([]),
  createQueryBuilder: jest.fn().mockReturnValue({
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    getRawMany: jest.fn().mockResolvedValue([]),
  }),
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const makeGoalkeeper = (overrides: Partial<Goalkeeper> = {}): Goalkeeper =>
  ({
    id: 'gk-uuid-1',
    name: 'Lucas Ferreira',
    birthDate: new Date('2005-03-15'),
    category: 'Sub-17',
    isActive: true,
    dominantHand: DominantHand.RIGHT,
    dominantFoot: DominantFoot.RIGHT,
    age: 19,
    ...overrides,
  } as Goalkeeper);

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GoalkeepersService', () => {
  let service: GoalkeepersService;

  beforeEach(async () => {
    jest.clearAllMocks();

    // Reset QB mock return
    mockGoalkeeperRepo.createQueryBuilder.mockReturnValue(mockQb);
    mockQb.getManyAndCount.mockResolvedValue([[], 0]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GoalkeepersService,
        { provide: getRepositoryToken(Goalkeeper), useValue: mockGoalkeeperRepo },
        { provide: getRepositoryToken(Match), useValue: mockMatchRepo },
        { provide: getRepositoryToken(TrainingSession), useValue: mockTrainingRepo },
        { provide: getRepositoryToken(PerformanceIndex), useValue: mockPerformanceRepo },
      ],
    }).compile();

    service = module.get<GoalkeepersService>(GoalkeepersService);
  });

  // ─── findAll ───────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('should call createQueryBuilder and return paginated result when no filters are given', async () => {
      const mockData = [makeGoalkeeper()];
      mockQb.getManyAndCount.mockResolvedValueOnce([mockData, 1]);

      const result = await service.findAll();

      expect(mockGoalkeeperRepo.createQueryBuilder).toHaveBeenCalledWith('gk');
      expect(mockQb.leftJoinAndSelect).toHaveBeenCalledWith('gk.team', 'team');
      expect(result.data).toBe(mockData);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.totalPages).toBe(1);
    });

    it('should throw BadRequestException for invalid pagination params', async () => {
      await expect(service.findAll({ page: 0 })).rejects.toThrow(BadRequestException);
      await expect(service.findAll({ limit: 0 })).rejects.toThrow(BadRequestException);
      await expect(service.findAll({ limit: 101 })).rejects.toThrow(BadRequestException);
    });

    it('should apply search filter when search param is provided', async () => {
      await service.findAll({ search: 'lucas' });

      expect(mockQb.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('ILIKE'),
        expect.objectContaining({ search: '%lucas%' }),
      );
    });

    it('should apply teamId filter when provided', async () => {
      await service.findAll({ teamId: 'team-abc' });

      expect(mockQb.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('teamId'),
        { teamId: 'team-abc' },
      );
    });

    it('should calculate correct skip offset from page and limit', async () => {
      await service.findAll({ page: 3, limit: 10 });

      expect(mockQb.skip).toHaveBeenCalledWith(20); // (3-1)*10
      expect(mockQb.take).toHaveBeenCalledWith(10);
    });
  });

  // ─── findOne ───────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('should return goalkeeper when found', async () => {
      const gk = makeGoalkeeper();
      mockGoalkeeperRepo.findOne.mockResolvedValueOnce(gk);

      const result = await service.findOne('gk-uuid-1');

      expect(mockGoalkeeperRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'gk-uuid-1' },
        relations: ['team'],
      });
      expect(result).toBe(gk);
    });

    it('should throw NotFoundException when goalkeeper does not exist', async () => {
      mockGoalkeeperRepo.findOne.mockResolvedValueOnce(null);

      await expect(service.findOne('non-existent')).rejects.toThrow(NotFoundException);
    });

    it('should include the id in the NotFoundException message', async () => {
      mockGoalkeeperRepo.findOne.mockResolvedValueOnce(null);

      await expect(service.findOne('bad-id')).rejects.toThrow('"bad-id"');
    });
  });

  // ─── create ────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('should create and save a new goalkeeper, returning it with an id', async () => {
      const dto = {
        name: '  Lucas Ferreira  ',
        birthDate: '2005-03-15',
        category: 'Sub-17',
      };

      const result = await service.create(dto as any);

      expect(mockGoalkeeperRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Lucas Ferreira',
          isActive: true,
          dominantHand: DominantHand.RIGHT,
          dominantFoot: DominantFoot.RIGHT,
        }),
      );
      expect(mockGoalkeeperRepo.save).toHaveBeenCalled();
      expect(result.id).toBe('gk-uuid-1');
    });

    it('should trim whitespace from the name', async () => {
      await service.create({ name: '  Rafa  ', birthDate: '2003-01-01', category: 'Pro' } as any);

      expect(mockGoalkeeperRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Rafa' }),
      );
    });

    it('should use provided dominantHand and dominantFoot when supplied', async () => {
      await service.create({
        name: 'Rafa',
        birthDate: '2003-01-01',
        category: 'Pro',
        dominantHand: DominantHand.LEFT,
        dominantFoot: DominantFoot.LEFT,
      } as any);

      expect(mockGoalkeeperRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          dominantHand: DominantHand.LEFT,
          dominantFoot: DominantFoot.LEFT,
        }),
      );
    });
  });

  // ─── update ────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('should find goalkeeper, apply updates, and return updated entity', async () => {
      const existing = makeGoalkeeper();
      const updated = makeGoalkeeper({ name: 'Rafa Santos', category: 'Pro' });

      // findOne is called twice: once to verify existence, once to return updated
      mockGoalkeeperRepo.findOne
        .mockResolvedValueOnce(existing)
        .mockResolvedValueOnce(updated);

      const result = await service.update('gk-uuid-1', { name: 'Rafa Santos', category: 'Pro' });

      expect(mockGoalkeeperRepo.update).toHaveBeenCalledWith(
        'gk-uuid-1',
        expect.objectContaining({ name: 'Rafa Santos', category: 'Pro' }),
      );
      expect(result.name).toBe('Rafa Santos');
    });

    it('should throw NotFoundException when trying to update non-existent goalkeeper', async () => {
      mockGoalkeeperRepo.findOne.mockResolvedValueOnce(null);

      await expect(service.update('bad-id', { name: 'Test' })).rejects.toThrow(NotFoundException);
    });

    it('should trim whitespace from updated name', async () => {
      const existing = makeGoalkeeper();
      const updated = makeGoalkeeper({ name: 'Clean Name' });

      mockGoalkeeperRepo.findOne
        .mockResolvedValueOnce(existing)
        .mockResolvedValueOnce(updated);

      await service.update('gk-uuid-1', { name: '  Clean Name  ' });

      expect(mockGoalkeeperRepo.update).toHaveBeenCalledWith(
        'gk-uuid-1',
        expect.objectContaining({ name: 'Clean Name' }),
      );
    });
  });

  // ─── remove ────────────────────────────────────────────────────────────────

  describe('remove', () => {
    it('should deactivate goalkeeper by setting isActive to false', async () => {
      const gk = makeGoalkeeper({ name: 'Lucas Ferreira' });
      mockGoalkeeperRepo.findOne.mockResolvedValueOnce(gk);

      const result = await service.remove('gk-uuid-1');

      expect(mockGoalkeeperRepo.update).toHaveBeenCalledWith('gk-uuid-1', { isActive: false });
      expect(result.message).toContain('Lucas Ferreira');
    });

    it('should throw NotFoundException when trying to remove non-existent goalkeeper', async () => {
      mockGoalkeeperRepo.findOne.mockResolvedValueOnce(null);

      await expect(service.remove('non-existent')).rejects.toThrow(NotFoundException);
    });
  });
});
