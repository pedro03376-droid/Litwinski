import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { MatchesService } from './matches.service';
import { Match, MatchResult } from './entities/match.entity';

// ─── QueryBuilder mock ────────────────────────────────────────────────────────

const qbMock: any = {
  innerJoinAndSelect: jest.fn().mockReturnThis(),
  leftJoinAndSelect: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  skip: jest.fn().mockReturnThis(),
  take: jest.fn().mockReturnThis(),
  getCount: jest.fn().mockResolvedValue(0),
  getMany: jest.fn().mockResolvedValue([]),
  getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
  getOne: jest.fn().mockResolvedValue(null),
  select: jest.fn().mockReturnThis(),
  addSelect: jest.fn().mockReturnThis(),
  groupBy: jest.fn().mockReturnThis(),
  getRawOne: jest.fn().mockResolvedValue({
    wins: 0,
    draws: 0,
    losses: 0,
    total: 0,
    goalsScored: 0,
    goalsConceded: 0,
  }),
  getRawMany: jest.fn().mockResolvedValue([]),
};

// ─── Repository mock ──────────────────────────────────────────────────────────

const mockRepo = {
  createQueryBuilder: jest.fn().mockReturnValue(qbMock),
  findOne: jest.fn(),
  find: jest.fn().mockResolvedValue([]),
  create: jest.fn().mockImplementation((dto) => dto),
  save: jest.fn().mockImplementation((entity) =>
    Promise.resolve({ id: 'match-uuid', ...entity }),
  ),
  merge: jest.fn().mockImplementation((entity, changes) => ({ ...entity, ...changes })),
  remove: jest.fn().mockResolvedValue(undefined),
  update: jest.fn().mockResolvedValue({ affected: 1 }),
  delete: jest.fn().mockResolvedValue({ affected: 1 }),
};

// ─── Base fixtures ────────────────────────────────────────────────────────────

const baseMatch: Partial<Match> = {
  id: 'match-uuid',
  goalkeeperId: 'gk-1',
  competition: 'Liga Nacional',
  opponent: 'Opponent FC',
  date: new Date('2024-03-10'),
  goalsScored: 2,
  goalsConceded: 1,
  result: MatchResult.WIN,
  scouts: [],
};

const baseCreateDto = {
  goalkeeperId: 'gk-1',
  competition: 'Liga Nacional',
  opponent: 'Opponent FC',
  date: '2024-03-10',
  goalsScored: 2,
  goalsConceded: 1,
  result: MatchResult.WIN,
  location: 'home' as any,
};

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('MatchesService', () => {
  let service: MatchesService;

  beforeEach(async () => {
    jest.clearAllMocks();

    // Re-apply default implementations after clearAllMocks resets return values
    mockRepo.createQueryBuilder.mockReturnValue(qbMock);
    qbMock.innerJoinAndSelect.mockReturnThis();
    qbMock.leftJoinAndSelect.mockReturnThis();
    qbMock.where.mockReturnThis();
    qbMock.andWhere.mockReturnThis();
    qbMock.orderBy.mockReturnThis();
    qbMock.skip.mockReturnThis();
    qbMock.take.mockReturnThis();
    qbMock.select.mockReturnThis();
    qbMock.addSelect.mockReturnThis();
    qbMock.groupBy.mockReturnThis();
    qbMock.getCount.mockResolvedValue(0);
    qbMock.getMany.mockResolvedValue([]);
    qbMock.getManyAndCount.mockResolvedValue([[], 0]);
    qbMock.getOne.mockResolvedValue(null);
    qbMock.getRawOne.mockResolvedValue({ wins: 0, draws: 0, losses: 0, total: 0, goalsScored: 0, goalsConceded: 0 });
    qbMock.getRawMany.mockResolvedValue([]);

    mockRepo.find.mockResolvedValue([]);
    mockRepo.findOne.mockResolvedValue(undefined);
    mockRepo.create.mockImplementation((dto) => dto);
    mockRepo.save.mockImplementation((entity) =>
      Promise.resolve({ id: 'match-uuid', ...entity }),
    );
    mockRepo.merge.mockImplementation((entity, changes) => ({ ...entity, ...changes }));
    mockRepo.remove.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MatchesService,
        {
          provide: getRepositoryToken(Match),
          useValue: mockRepo,
        },
      ],
    }).compile();

    service = module.get<MatchesService>(MatchesService);
  });

  // ─── findAll ───────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('should call createQueryBuilder and return a paginated result shape', async () => {
      const mockMatches = [baseMatch as Match, { ...baseMatch, id: 'match-uuid-2' } as Match];
      qbMock.getCount.mockResolvedValue(2);
      qbMock.getMany.mockResolvedValue(mockMatches);

      const result = await service.findAll('gk-1', {}, { page: 1, limit: 20 });

      expect(mockRepo.createQueryBuilder).toHaveBeenCalledWith('match');
      expect(qbMock.leftJoinAndSelect).toHaveBeenCalledWith('match.scouts', 'scouts');
      expect(result).toEqual({
        data: mockMatches,
        total: 2,
        page: 1,
        limit: 20,
        totalPages: 1,
      });
    });

    it('should filter by goalkeeperId when provided', async () => {
      await service.findAll('gk-42', {}, {});

      expect(qbMock.andWhere).toHaveBeenCalledWith(
        'match.goalkeeperId = :goalkeeperId',
        { goalkeeperId: 'gk-42' },
      );
    });

    it('should not filter by goalkeeperId when not provided', async () => {
      await service.findAll(undefined, {}, {});

      const andWhereCalls: string[] = qbMock.andWhere.mock.calls.map(
        (call: any[]) => call[0],
      );
      expect(andWhereCalls).not.toContain('match.goalkeeperId = :goalkeeperId');
    });

    it('should apply competition filter when provided', async () => {
      await service.findAll('gk-1', { competition: 'Liga' }, {});

      expect(qbMock.andWhere).toHaveBeenCalledWith(
        'match.competition ILIKE :competition',
        { competition: '%Liga%' },
      );
    });

    it('should apply result filter when provided', async () => {
      await service.findAll('gk-1', { result: MatchResult.WIN }, {});

      expect(qbMock.andWhere).toHaveBeenCalledWith(
        'match.result = :result',
        { result: MatchResult.WIN },
      );
    });

    it('should calculate totalPages correctly', async () => {
      qbMock.getCount.mockResolvedValue(55);
      qbMock.getMany.mockResolvedValue([]);

      const result = await service.findAll(undefined, {}, { page: 1, limit: 20 });

      expect(result.totalPages).toBe(3);
    });

    it('should use default page=1 and limit=20 when pagination not provided', async () => {
      qbMock.getCount.mockResolvedValue(0);
      qbMock.getMany.mockResolvedValue([]);

      const result = await service.findAll();

      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });

    it('should skip correct number of records based on page and limit', async () => {
      await service.findAll(undefined, {}, { page: 3, limit: 10 });

      // page=3, limit=10 => skip=20
      expect(qbMock.skip).toHaveBeenCalledWith(20);
      expect(qbMock.take).toHaveBeenCalledWith(10);
    });

    it('should throw BadRequestException when page < 1', async () => {
      await expect(service.findAll(undefined, {}, { page: 0 })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when limit > 100', async () => {
      await expect(service.findAll(undefined, {}, { limit: 101 })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when limit < 1', async () => {
      await expect(service.findAll(undefined, {}, { limit: 0 })).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ─── findOne ───────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('should return the match when it exists', async () => {
      mockRepo.findOne.mockResolvedValue(baseMatch as Match);

      const result = await service.findOne('match-uuid');

      expect(mockRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'match-uuid' },
        relations: ['scouts', 'goalkeeper', 'goalkeeper.team', 'aiAnalyses'],
      });
      expect(result).toBe(baseMatch);
    });

    it('should throw NotFoundException when match does not exist', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne('nonexistent-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should include the id in the NotFoundException message', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne('bad-id')).rejects.toThrow(
        'Match with id "bad-id" not found',
      );
    });
  });

  // ─── create ────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('should create a match with converted date and default goals', async () => {
      const dto = { ...baseCreateDto, goalsScored: undefined, goalsConceded: undefined };

      const result = await service.create(dto as any);

      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          goalsScored: 0,
          goalsConceded: 0,
          date: expect.any(Date),
        }),
      );
      expect(mockRepo.save).toHaveBeenCalled();
      expect(result.id).toBe('match-uuid');
    });

    it('should preserve goalsScored and goalsConceded from dto when provided', async () => {
      const result = await service.create(baseCreateDto as any);

      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          goalsScored: 2,
          goalsConceded: 1,
        }),
      );
      expect(result).toMatchObject({ goalsScored: 2, goalsConceded: 1 });
    });

    it('should convert the date string to a Date object', async () => {
      await service.create(baseCreateDto as any);

      const createArg = mockRepo.create.mock.calls[0][0];
      expect(createArg.date).toBeInstanceOf(Date);
      expect(createArg.date.toISOString()).toContain('2024-03-10');
    });

    it('should return the saved entity', async () => {
      const saved = { id: 'match-uuid', ...baseCreateDto };
      mockRepo.save.mockResolvedValueOnce(saved);

      const result = await service.create(baseCreateDto as any);

      expect(result).toBe(saved);
    });
  });

  // ─── update ────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('should merge and save the match when it exists', async () => {
      mockRepo.findOne.mockResolvedValue(baseMatch as Match);
      const updateDto = { opponent: 'New Opponent', date: '2024-05-20' };

      const result = await service.update('match-uuid', updateDto);

      expect(mockRepo.merge).toHaveBeenCalledWith(
        baseMatch,
        expect.objectContaining({
          opponent: 'New Opponent',
          date: expect.any(Date),
        }),
      );
      expect(mockRepo.save).toHaveBeenCalled();
      expect(result.id).toBe('match-uuid');
    });

    it('should keep the original date when dto.date is not provided', async () => {
      mockRepo.findOne.mockResolvedValue(baseMatch as Match);
      const updateDto = { opponent: 'Another Opponent' };

      await service.update('match-uuid', updateDto);

      expect(mockRepo.merge).toHaveBeenCalledWith(
        baseMatch,
        expect.objectContaining({ date: baseMatch.date }),
      );
    });

    it('should throw NotFoundException when match does not exist', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.update('nonexistent-id', {})).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return the updated entity from save', async () => {
      mockRepo.findOne.mockResolvedValue(baseMatch as Match);
      const updatedMatch = { ...baseMatch, opponent: 'Updated Opponent' } as Match;
      mockRepo.save.mockResolvedValueOnce(updatedMatch);

      const result = await service.update('match-uuid', { opponent: 'Updated Opponent' });

      expect(result).toBe(updatedMatch);
    });
  });

  // ─── remove ────────────────────────────────────────────────────────────────

  describe('remove', () => {
    it('should find and remove the match when it exists', async () => {
      mockRepo.findOne.mockResolvedValue(baseMatch as Match);

      await service.remove('match-uuid');

      expect(mockRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'match-uuid' } }),
      );
      expect(mockRepo.remove).toHaveBeenCalledWith(baseMatch);
    });

    it('should throw NotFoundException when match does not exist', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.remove('nonexistent-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should not call remove when the match is not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.remove('bad-id')).rejects.toThrow(NotFoundException);
      expect(mockRepo.remove).not.toHaveBeenCalled();
    });
  });

  // ─── getMatchStats ─────────────────────────────────────────────────────────

  describe('getMatchStats', () => {
    it('should return zeroed stats when no matches exist', async () => {
      mockRepo.find.mockResolvedValue([]);

      const result = await service.getMatchStats('gk-1');

      expect(result).toEqual({
        totalMatches: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        goalsScored: 0,
        goalsConceded: 0,
        savePercentage: 0,
        cleanSheets: 0,
        winPercentage: 0,
      });
    });

    it('should call find with goalkeeperId and scouts relation', async () => {
      mockRepo.find.mockResolvedValue([]);

      await service.getMatchStats('gk-42');

      expect(mockRepo.find).toHaveBeenCalledWith({
        where: { goalkeeperId: 'gk-42' },
        relations: ['scouts'],
      });
    });

    it('should correctly count wins, draws, and losses', async () => {
      const matches = [
        { ...baseMatch, result: MatchResult.WIN, scouts: [] },
        { ...baseMatch, result: MatchResult.WIN, scouts: [] },
        { ...baseMatch, result: MatchResult.DRAW, scouts: [] },
        { ...baseMatch, result: MatchResult.LOSS, scouts: [] },
      ] as Match[];
      mockRepo.find.mockResolvedValue(matches);

      const result = await service.getMatchStats('gk-1');

      expect(result.totalMatches).toBe(4);
      expect(result.wins).toBe(2);
      expect(result.draws).toBe(1);
      expect(result.losses).toBe(1);
    });

    it('should compute winPercentage correctly', async () => {
      // 2 wins out of 4 matches => 50%
      const matches = [
        { ...baseMatch, result: MatchResult.WIN, scouts: [] },
        { ...baseMatch, result: MatchResult.WIN, scouts: [] },
        { ...baseMatch, result: MatchResult.LOSS, scouts: [] },
        { ...baseMatch, result: MatchResult.DRAW, scouts: [] },
      ] as Match[];
      mockRepo.find.mockResolvedValue(matches);

      const result = await service.getMatchStats('gk-1');

      expect(result.winPercentage).toBe(50);
    });

    it('should sum goalsScored and goalsConceded across all matches', async () => {
      const matches = [
        { ...baseMatch, goalsScored: 3, goalsConceded: 1, scouts: [] },
        { ...baseMatch, goalsScored: 1, goalsConceded: 2, scouts: [] },
      ] as Match[];
      mockRepo.find.mockResolvedValue(matches);

      const result = await service.getMatchStats('gk-1');

      expect(result.goalsScored).toBe(4);
      expect(result.goalsConceded).toBe(3);
    });

    it('should count cleanSheets when goalsConceded is 0', async () => {
      const matches = [
        { ...baseMatch, goalsConceded: 0, scouts: [] },
        { ...baseMatch, goalsConceded: 0, scouts: [] },
        { ...baseMatch, goalsConceded: 2, scouts: [] },
      ] as Match[];
      mockRepo.find.mockResolvedValue(matches);

      const result = await service.getMatchStats('gk-1');

      expect(result.cleanSheets).toBe(2);
    });

    it('should compute savePercentage from scout data', async () => {
      // 8 saves + 2 goals conceded from scout => 80%
      const scout = {
        highSaveRight: 4,
        highSaveLeft: 4,
        lowSaveRight: 0,
        lowSaveLeft: 0,
        centralSave: 0,
        goalOutsideArea: 0,
        goalInsideArea: 2,
      };
      const matches = [
        { ...baseMatch, scouts: [scout] },
      ] as unknown as Match[];
      mockRepo.find.mockResolvedValue(matches);

      const result = await service.getMatchStats('gk-1');

      expect(result.savePercentage).toBe(80);
    });

    it('should return savePercentage of 0 when there are no shots', async () => {
      const matches = [
        { ...baseMatch, scouts: [] },
      ] as Match[];
      mockRepo.find.mockResolvedValue(matches);

      const result = await service.getMatchStats('gk-1');

      expect(result.savePercentage).toBe(0);
    });

    it('should return MatchStats shape with all required keys', async () => {
      const result = await service.getMatchStats('gk-1');

      expect(result).toHaveProperty('totalMatches');
      expect(result).toHaveProperty('wins');
      expect(result).toHaveProperty('draws');
      expect(result).toHaveProperty('losses');
      expect(result).toHaveProperty('goalsScored');
      expect(result).toHaveProperty('goalsConceded');
      expect(result).toHaveProperty('savePercentage');
      expect(result).toHaveProperty('cleanSheets');
      expect(result).toHaveProperty('winPercentage');
    });
  });

  // ─── getRecentMatches ──────────────────────────────────────────────────────

  describe('getRecentMatches', () => {
    it('should call createQueryBuilder with goalkeeperId and order by date DESC', async () => {
      const mockMatches = [baseMatch as Match];
      qbMock.getMany.mockResolvedValue(mockMatches);

      const result = await service.getRecentMatches('gk-1', 3);

      expect(mockRepo.createQueryBuilder).toHaveBeenCalledWith('match');
      expect(qbMock.where).toHaveBeenCalledWith(
        'match.goalkeeperId = :goalkeeperId',
        { goalkeeperId: 'gk-1' },
      );
      expect(qbMock.orderBy).toHaveBeenCalledWith('match.date', 'DESC');
      expect(qbMock.take).toHaveBeenCalledWith(3);
      expect(result).toBe(mockMatches);
    });

    it('should use default limit of 5 when not provided', async () => {
      qbMock.getMany.mockResolvedValue([]);

      await service.getRecentMatches('gk-1');

      expect(qbMock.take).toHaveBeenCalledWith(5);
    });

    it('should clamp limit to 50 when a larger value is provided', async () => {
      qbMock.getMany.mockResolvedValue([]);

      await service.getRecentMatches('gk-1', 200);

      expect(qbMock.take).toHaveBeenCalledWith(50);
    });

    it('should clamp limit to 1 when a value less than 1 is provided', async () => {
      qbMock.getMany.mockResolvedValue([]);

      await service.getRecentMatches('gk-1', 0);

      expect(qbMock.take).toHaveBeenCalledWith(1);
    });
  });
});
